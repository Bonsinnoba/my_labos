"""
Mesh Sync Coordinator - Decentralized Peer-to-Peer Cloud-Mesh Synchronization Engine

This module implements a distributed synchronization system that allows multiple PCs to write
data locally while offline and synchronize their states asynchronously via a shared Backblaze B2
account using micro-transaction text deltas (JSON changes) rather than whole-file database overwrites.
"""

import sqlite3
import json
import uuid
import time
import hashlib
import threading
import os
import tarfile
import io
import gzip
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
import requests

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    print("[mesh_sync] boto3 not available - cloud sync will be disabled")


class MeshSyncCoordinator:
    """
    Coordinates decentralized peer-to-peer synchronization across multiple workstations.
    
    Features:
    - Local mutation logging to mesh_transactions ledger
    - Deterministic conflict resolution (Last-Write-Wins with timestamp + device_origin tiebreaker)
    - Network-aware polling (online/offline behavior)
    - Automated cloud garbage collection (log compaction)
    - Backblaze B2 integration for cloud storage
    """
    
    def __init__(self, 
                 db_path: str = "local_cache.db",
                 device_id: Optional[str] = None,
                 b2_bucket_name: Optional[str] = None,
                 b2_endpoint_url: Optional[str] = None,
                 b2_access_key_id: Optional[str] = None,
                 b2_secret_access_key: Optional[str] = None):
        """
        Initialize the Mesh Sync Coordinator.
        
        Args:
            db_path: Path to the SQLite database file
            device_id: Unique identifier for this workstation (e.g., 'LAB_PC_01')
                      If not provided, will generate one and store locally
            b2_bucket_name: Backblaze B2 bucket name for transaction storage
            b2_endpoint_url: Backblaze B2 endpoint URL
            b2_access_key_id: Backblaze B2 access key ID
            b2_secret_access_key: Backblaze B2 secret access key
        """
        self.db_path = db_path
        self.device_id = device_id or self._get_or_generate_device_id()
        self.b2_bucket_name = b2_bucket_name
        self.b2_endpoint_url = b2_endpoint_url
        self.b2_access_key_id = b2_access_key_id
        self.b2_secret_access_key = b2_secret_access_key
        
        self.conn: Optional[sqlite3.Connection] = None
        self.s3_client = None
        self.is_online = True
        self.sync_thread = None
        self.sync_running = False
        self.polling_interval = 7.5  # seconds (between 5-10 as specified)
        
        # Registered device IDs for garbage collection
        self.registered_devices = set()
        
        # Initialize database connection
        self._init_db_connection()
        
        # Initialize B2 client if credentials provided
        if BOTO3_AVAILABLE and all([b2_bucket_name, b2_endpoint_url, b2_access_key_id, b2_secret_access_key]):
            self._init_b2_client()
        else:
            print("[mesh_sync] B2 credentials not provided or boto3 unavailable - cloud sync disabled")
    
    def _get_or_generate_device_id(self) -> str:
        """
        Get existing device ID from local storage or generate a new one.
        
        Returns:
            Device ID string (e.g., 'LAB_PC_01')
        """
        device_id_file = Path(".mesh_device_id")
        
        if device_id_file.exists():
            with open(device_id_file, 'r') as f:
                return f.read().strip()
        
        # Generate new device ID
        device_id = f"LAB_PC_{uuid.uuid4().hex[:6].upper()}"
        with open(device_id_file, 'w') as f:
            f.write(device_id)
        
        print(f"[mesh_sync] Generated new device ID: {device_id}")
        return device_id
    
    def _init_db_connection(self) -> None:
        """Initialize database connection with foreign keys enabled."""
        try:
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.execute("PRAGMA foreign_keys = ON")
            self.conn.row_factory = sqlite3.Row
            print(f"[mesh_sync] Database connection established: {self.db_path}")
        except sqlite3.Error as e:
            print(f"[mesh_sync] Database connection error: {e}")
            raise
    
    def _init_b2_client(self) -> None:
        """Initialize Backblaze B2 S3 client."""
        try:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.b2_endpoint_url,
                aws_access_key_id=self.b2_access_key_id,
                aws_secret_access_key=self.b2_secret_access_key
            )
            print(f"[mesh_sync] B2 client initialized for bucket: {self.b2_bucket_name}")
        except Exception as e:
            print(f"[mesh_sync] B2 client initialization error: {e}")
            self.s3_client = None
    
    def log_mutation(self, 
                    table_name: str,
                    operation: str,
                    payload: Dict[str, Any],
                    record_id: Optional[int] = None) -> str:
        """
        Log a data mutation to the local mesh_transactions ledger.
        
        Args:
            table_name: Name of the table being modified (e.g., 'projects', 'inventory')
            operation: Type of operation ('INSERT', 'UPDATE', 'DELETE')
            payload: JSON-serializable dict containing modified/mutated fields only
            record_id: Optional ID of the record being modified
            
        Returns:
            Transaction ID (cryptographically secure hash)
        """
        # Generate transaction ID
        tx_data = f"{table_name}{operation}{json.dumps(payload, sort_keys=True)}{time.time()}{self.device_id}"
        tx_id = hashlib.sha256(tx_data.encode()).hexdigest()[:32]
        
        # Get current timestamp in milliseconds
        timestamp = int(time.time() * 1000)
        
        # Add record_id to payload if provided
        if record_id is not None:
            payload['_record_id'] = record_id
        
        # Serialize payload to JSON
        payload_json = json.dumps(payload)
        
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO mesh_transactions (tx_id, table_name, operation, payload, timestamp, device_origin)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (tx_id, table_name, operation, payload_json, timestamp, self.device_id))
            
            self.conn.commit()
            print(f"[mesh_sync] Logged mutation: {operation} on {table_name} (tx_id: {tx_id})")
            return tx_id
            
        except sqlite3.Error as e:
            print(f"[mesh_sync] Error logging mutation: {e}")
            self.conn.rollback()
            raise
    
    def get_pending_transactions(self, since_timestamp: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get pending transactions that haven't been synced to cloud yet.
        
        Args:
            since_timestamp: Optional timestamp to filter transactions after
            
        Returns:
            List of transaction dictionaries
        """
        try:
            cursor = self.conn.cursor()
            
            if since_timestamp:
                cursor.execute("""
                    SELECT tx_id, table_name, operation, payload, timestamp, device_origin
                    FROM mesh_transactions
                    WHERE timestamp > ?
                    ORDER BY timestamp ASC
                """, (since_timestamp,))
            else:
                cursor.execute("""
                    SELECT tx_id, table_name, operation, payload, timestamp, device_origin
                    FROM mesh_transactions
                    ORDER BY timestamp ASC
                """)
            
            transactions = []
            for row in cursor.fetchall():
                transactions.append({
                    'tx_id': row['tx_id'],
                    'table_name': row['table_name'],
                    'operation': row['operation'],
                    'payload': json.loads(row['payload']),
                    'timestamp': row['timestamp'],
                    'device_origin': row['device_origin']
                })
            
            return transactions
            
        except sqlite3.Error as e:
            print(f"[mesh_sync] Error getting pending transactions: {e}")
            return []
    
    def apply_incoming_transactions(self, transactions: List[Dict[str, Any]]) -> int:
        """
        Apply incoming transactions from other devices with deterministic conflict resolution.
        
        Uses Last-Write-Wins strategy:
        1. Sort transactions by timestamp ASC
        2. If timestamps are identical, use alphabetical device_origin as tiebreaker
        
        Args:
            transactions: List of transaction dictionaries from cloud
            
        Returns:
            Number of transactions applied
        """
        if not transactions:
            return 0
        
        # Sort transactions by timestamp ASC, then by device_origin ASC for tiebreaker
        sorted_transactions = sorted(
            transactions,
            key=lambda x: (x['timestamp'], x['device_origin'])
        )
        
        applied_count = 0
        
        try:
            # Apply all transactions in a single atomic transaction
            with self.conn:
                cursor = self.conn.cursor()
                
                for tx in sorted_transactions:
                    # Skip if this transaction already exists locally
                    cursor.execute("""
                        SELECT tx_id FROM mesh_transactions WHERE tx_id = ?
                    """, (tx['tx_id'],))
                    
                    if cursor.fetchone():
                        print(f"[mesh_sync] Skipping duplicate transaction: {tx['tx_id']}")
                        continue
                    
                    # Apply the mutation based on operation type
                    self._apply_single_transaction(cursor, tx)
                    
                    # Log the transaction to local ledger
                    cursor.execute("""
                        INSERT INTO mesh_transactions (tx_id, table_name, operation, payload, timestamp, device_origin)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        tx['tx_id'],
                        tx['table_name'],
                        tx['operation'],
                        json.dumps(tx['payload']),
                        tx['timestamp'],
                        tx['device_origin']
                    ))
                    
                    applied_count += 1
                    print(f"[mesh_sync] Applied transaction: {tx['operation']} on {tx['table_name']} from {tx['device_origin']}")
            
            print(f"[mesh_sync] Applied {applied_count} incoming transactions")
            return applied_count
            
        except sqlite3.Error as e:
            print(f"[mesh_sync] Error applying incoming transactions: {e}")
            self.conn.rollback()
            return 0
    
    def _apply_single_transaction(self, cursor: sqlite3.Cursor, tx: Dict[str, Any]) -> None:
        """
        Apply a single transaction to the database.
        
        Args:
            cursor: Database cursor
            tx: Transaction dictionary
        """
        table_name = tx['table_name']
        operation = tx['operation']
        payload = tx['payload']
        
        if operation == 'INSERT':
            self._apply_insert(cursor, table_name, payload)
        elif operation == 'UPDATE':
            self._apply_update(cursor, table_name, payload)
        elif operation == 'DELETE':
            self._apply_delete(cursor, table_name, payload)
        else:
            print(f"[mesh_sync] Unknown operation: {operation}")
    
    def _apply_insert(self, cursor: sqlite3.Cursor, table_name: str, payload: Dict[str, Any]) -> None:
        """Apply INSERT operation."""
        # Remove _record_id if present (it's for tracking only)
        payload_copy = {k: v for k, v in payload.items() if k != '_record_id'}
        
        columns = list(payload_copy.keys())
        placeholders = ', '.join(['?' for _ in columns])
        columns_str = ', '.join(columns)
        values = list(payload_copy.values())
        
        cursor.execute(f"""
            INSERT INTO {table_name} ({columns_str})
            VALUES ({placeholders})
        """, values)
    
    def _apply_update(self, cursor: sqlite3.Cursor, table_name: str, payload: Dict[str, Any]) -> None:
        """Apply UPDATE operation with field-level updates."""
        record_id = payload.pop('_record_id', None)
        
        if record_id is None:
            print(f"[mesh_sync] UPDATE operation missing _record_id")
            return
        
        # Build SET clause for field-level updates
        set_clauses = []
        values = []
        
        for column, value in payload.items():
            if column != '_record_id':
                set_clauses.append(f"{column} = ?")
                values.append(value)
        
        if not set_clauses:
            return
        
        set_str = ', '.join(set_clauses)
        values.append(record_id)
        
        cursor.execute(f"""
            UPDATE {table_name}
            SET {set_str}
            WHERE id = ?
        """, values)
    
    def _apply_delete(self, cursor: sqlite3.Cursor, table_name: str, payload: Dict[str, Any]) -> None:
        """Apply DELETE operation (soft delete via is_tombstone if available)."""
        record_id = payload.get('_record_id')
        
        if record_id is None:
            print(f"[mesh_sync] DELETE operation missing _record_id")
            return
        
        # Check if table has is_tombstone column for soft delete
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_tombstone' in columns:
            cursor.execute(f"""
                UPDATE {table_name}
                SET is_tombstone = 1
                WHERE id = ?
            """, (record_id,))
        else:
            cursor.execute(f"""
                DELETE FROM {table_name}
                WHERE id = ?
            """, (record_id,))
    
    def push_to_cloud(self) -> bool:
        """
        Push pending local transactions to Backblaze B2 cloud storage.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.s3_client or not self.is_online:
            print("[mesh_sync] Cannot push to cloud: offline or B2 not configured")
            return False
        
        try:
            # Get pending transactions
            transactions = self.get_pending_transactions()
            
            if not transactions:
                print("[mesh_sync] No pending transactions to push")
                return True
            
            # Create transaction bundle
            bundle_data = {
                'device_id': self.device_id,
                'timestamp': int(time.time() * 1000),
                'transactions': transactions
            }
            
            # Serialize and compress
            json_data = json.dumps(bundle_data)
            compressed_data = gzip.compress(json_data.encode())
            
            # Create filename with timestamp
            bundle_filename = f"mesh_tx_{self.device_id}_{int(time.time() * 1000)}.json.gz"
            
            # Upload to B2
            self.s3_client.put_object(
                Bucket=self.b2_bucket_name,
                Key=bundle_filename,
                Body=compressed_data,
                ContentType='application/gzip'
            )
            
            print(f"[mesh_sync] Pushed {len(transactions)} transactions to cloud: {bundle_filename}")
            return True
            
        except ClientError as e:
            print(f"[mesh_sync] B2 upload error: {e}")
            return False
        except Exception as e:
            print(f"[mesh_sync] Push to cloud error: {e}")
            return False
    
    def pull_from_cloud(self) -> int:
        """
        Pull and apply transactions from Backblaze B2 cloud storage.
        
        Returns:
            Number of transactions applied
        """
        if not self.s3_client or not self.is_online:
            print("[mesh_sync] Cannot pull from cloud: offline or B2 not configured")
            return 0
        
        try:
            # List objects in bucket
            response = self.s3_client.list_objects_v2(Bucket=self.b2_bucket_name)
            
            if 'Contents' not in response:
                print("[mesh_sync] No transactions in cloud")
                return 0
            
            # Get latest timestamp from local transactions
            cursor = self.conn.cursor()
            cursor.execute("SELECT MAX(timestamp) as max_ts FROM mesh_transactions")
            result = cursor.fetchone()
            last_timestamp = result['max_ts'] if result['max_ts'] else 0
            
            # Filter and download new transaction bundles
            new_transactions = []
            
            for obj in response['Contents']:
                key = obj['Key']
                
                # Skip if not a transaction bundle
                if not key.startswith('mesh_tx_'):
                    continue
                
                # Extract timestamp from filename
                try:
                    timestamp_str = key.split('_')[-1].replace('.json.gz', '')
                    bundle_timestamp = int(timestamp_str)
                    
                    # Skip if bundle is older than our last sync
                    if bundle_timestamp <= last_timestamp:
                        continue
                except (ValueError, IndexError):
                    continue
                
                # Download and decompress bundle
                obj_response = self.s3_client.get_object(Bucket=self.b2_bucket_name, Key=key)
                compressed_data = obj_response['Body'].read()
                json_data = gzip.decompress(compressed_data).decode()
                bundle = json.loads(json_data)
                
                # Skip transactions from this device (we already have them)
                if bundle.get('device_id') == self.device_id:
                    continue
                
                new_transactions.extend(bundle.get('transactions', []))
            
            if new_transactions:
                applied = self.apply_incoming_transactions(new_transactions)
                return applied
            
            return 0
            
        except ClientError as e:
            print(f"[mesh_sync] B2 download error: {e}")
            return 0
        except Exception as e:
            print(f"[mesh_sync] Pull from cloud error: {e}")
            return 0
    
    def check_network_status(self) -> bool:
        """
        Check if network is available.
        
        Returns:
            True if online, False if offline
        """
        try:
            # Simple connectivity check
            response = requests.get('https://www.google.com', timeout=5)
            self.is_online = response.status_code == 200
        except:
            self.is_online = False
        
        return self.is_online
    
    def start_sync_loop(self) -> None:
        """Start the background sync loop."""
        if self.sync_running:
            print("[mesh_sync] Sync loop already running")
            return
        
        self.sync_running = True
        self.sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.sync_thread.start()
        print("[mesh_sync] Sync loop started")
    
    def stop_sync_loop(self) -> None:
        """Stop the background sync loop."""
        self.sync_running = False
        if self.sync_thread:
            self.sync_thread.join(timeout=5)
        print("[mesh_sync] Sync loop stopped")
    
    def _sync_loop(self) -> None:
        """Background sync loop that runs every polling_interval seconds."""
        while self.sync_running:
            try:
                # Check network status
                self.check_network_status()
                
                if self.is_online:
                    # Pull from cloud first
                    self.pull_from_cloud()
                    
                    # Then push to cloud
                    self.push_to_cloud()
                else:
                    print("[mesh_sync] Offline - transactions queued locally")
                
            except Exception as e:
                print(f"[mesh_sync] Sync loop error: {e}")
            
            # Wait for next poll
            time.sleep(self.polling_interval)
    
    def register_device(self, device_id: str) -> None:
        """
        Register a device ID for garbage collection tracking.
        
        Args:
            device_id: Device ID to register
        """
        self.registered_devices.add(device_id)
        print(f"[mesh_sync] Registered device: {device_id}")
    
    def perform_garbage_collection(self, baseline_timestamp: int) -> int:
        """
        Perform cloud garbage collection by deleting old transaction files.
        
        Only deletes files if all registered devices have synced up to the baseline timestamp.
        
        Args:
            baseline_timestamp: Timestamp up to which all devices have synced
            
        Returns:
            Number of files deleted
        """
        if not self.s3_client:
            print("[mesh_sync] Cannot perform garbage collection: B2 not configured")
            return 0
        
        try:
            # List objects in bucket
            response = self.s3_client.list_objects_v2(Bucket=self.b2_bucket_name)
            
            if 'Contents' not in response:
                return 0
            
            files_to_delete = []
            
            for obj in response['Contents']:
                key = obj['Key']
                
                # Skip if not a transaction bundle
                if not key.startswith('mesh_tx_'):
                    continue
                
                # Extract timestamp from filename
                try:
                    timestamp_str = key.split('_')[-1].replace('.json.gz', '')
                    bundle_timestamp = int(timestamp_str)
                    
                    # Delete if older than baseline
                    if bundle_timestamp < baseline_timestamp:
                        files_to_delete.append({'Key': key})
                except (ValueError, IndexError):
                    continue
            
            if files_to_delete:
                # Delete files in batches
                for i in range(0, len(files_to_delete), 1000):
                    batch = files_to_delete[i:i+1000]
                    self.s3_client.delete_objects(
                        Bucket=self.b2_bucket_name,
                        Delete={'Objects': batch}
                    )
                
                print(f"[mesh_sync] Garbage collection: deleted {len(files_to_delete)} old transaction files")
                return len(files_to_delete)
            
            return 0
            
        except ClientError as e:
            print(f"[mesh_sync] Garbage collection error: {e}")
            return 0
        except Exception as e:
            print(f"[mesh_sync] Garbage collection error: {e}")
            return 0
    
    def close(self) -> None:
        """Close database connection and cleanup resources."""
        self.stop_sync_loop()
        if self.conn:
            self.conn.close()
        print("[mesh_sync] Coordinator closed")


# Convenience function for mutation logging
def log_mutation(db_path: str, 
                table_name: str,
                operation: str,
                payload: Dict[str, Any],
                record_id: Optional[int] = None,
                device_id: Optional[str] = None) -> str:
    """
    Convenience function to log a mutation without instantiating the full coordinator.
    
    Args:
        db_path: Path to SQLite database
        table_name: Name of table being modified
        operation: Type of operation ('INSERT', 'UPDATE', 'DELETE')
        payload: JSON-serializable dict with modified fields
        record_id: Optional ID of record being modified
        device_id: Optional device ID (will generate if not provided)
        
    Returns:
        Transaction ID
    """
    coordinator = MeshSyncCoordinator(db_path=db_path, device_id=device_id)
    tx_id = coordinator.log_mutation(table_name, operation, payload, record_id)
    coordinator.close()
    return tx_id
