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

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("[mesh_sync] supabase not available - Supabase mirroring will be disabled")


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
                 b2_secret_access_key: Optional[str] = None,
                 hub_mode: bool = False):
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
        self.hub_mode = hub_mode
        
        self.conn: Optional[sqlite3.Connection] = None
        self.s3_client = None
        self.is_online = True
        self.sync_thread = None
        self.sync_running = False
        self.polling_interval = 7.5  # seconds (between 5-10 as specified)
        
        # Registered device IDs for garbage collection
        self.registered_devices = set()
        
        # Cache for B2 object listings to reduce Class C transactions
        self._cached_cloud_objects = []
        self._last_cloud_list_time = 0
        self._cloud_list_cache_duration = 60  # Cache for 60 seconds
        
        # Cache for downloaded transaction bundles to reduce Class B transactions
        self._download_cache = {}  # key: bundle filename, value: decompressed bundle data
        self._download_cache_max_size = 100  # Max number of bundles to cache
        self._download_cache_hits = 0
        self._download_cache_misses = 0
        
        # Supabase client for mirroring (initialized once at class level)
        self.supabase_client: Optional[Client] = None
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
        
        # Mobile sync tracking
        self.mobile_pull_timestamp_file = Path(".mesh_mobile_pull_timestamp")
        self.last_mobile_pull_timestamp = self._load_mobile_pull_timestamp()
        
        # Supabase keep-alive tracking (prevent free tier pausing)
        self.last_supabase_ping_timestamp = self._load_supabase_ping_timestamp()
        
        # Initialize database connection
        self._init_db_connection()
        
        # Initialize B2 client if credentials provided
        if BOTO3_AVAILABLE and all([b2_bucket_name, b2_endpoint_url, b2_access_key_id, b2_secret_access_key]):
            self._init_b2_client()
        else:
            print("[mesh_sync] B2 credentials not provided or boto3 unavailable - cloud sync disabled")
        
        # Initialize Supabase client if credentials provided
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_service_key:
            self._init_supabase_client()
        else:
            print("[mesh_sync] Supabase credentials not provided or supabase not available - mirroring disabled")
    
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
            
            # Create mesh_sync_state table if not exists
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS mesh_sync_state (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            self.conn.commit()
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
    
    def _init_supabase_client(self) -> None:
        """Initialize Supabase client for mirroring."""
        try:
            self.supabase_client = create_client(
                self.supabase_url,
                self.supabase_service_key
            )
            print("[mesh_sync] Supabase client initialized for mirroring")
        except Exception as e:
            print(f"[mesh_sync] Supabase client initialization error: {e}")
            self.supabase_client = None
    
    def _load_mobile_pull_timestamp(self) -> int:
        """
        Load the last mobile pull timestamp from local file.
        
        Returns:
            Timestamp in milliseconds, or 0 if file doesn't exist
        """
        if self.mobile_pull_timestamp_file.exists():
            try:
                with open(self.mobile_pull_timestamp_file, 'r') as f:
                    return int(f.read().strip())
            except Exception as e:
                print(f"[mesh_sync] Error loading mobile pull timestamp: {e}")
        return 0
    
    def _save_mobile_pull_timestamp(self, timestamp: int) -> None:
        """
        Save the last mobile pull timestamp to local file.
        
        Args:
            timestamp: Timestamp in milliseconds
        """
        try:
            with open(self.mobile_pull_timestamp_file, 'w') as f:
                f.write(str(timestamp))
        except Exception as e:
            print(f"[mesh_sync] Error saving mobile pull timestamp: {e}")
    
    def _load_supabase_ping_timestamp(self) -> int:
        """
        Load the last Supabase ping timestamp from local file.
        
        Returns:
            Timestamp in milliseconds, or 0 if file doesn't exist
        """
        ping_file = Path(".mesh_supabase_ping_timestamp")
        if ping_file.exists():
            try:
                with open(ping_file, 'r') as f:
                    return int(f.read().strip())
            except Exception as e:
                print(f"[mesh_sync] Error loading Supabase ping timestamp: {e}")
        return 0
    
    def _save_supabase_ping_timestamp(self, timestamp: int) -> None:
        """
        Save the last Supabase ping timestamp to local file.
        
        Args:
            timestamp: Timestamp in milliseconds
        """
        try:
            ping_file = Path(".mesh_supabase_ping_timestamp")
            with open(ping_file, 'w') as f:
                f.write(str(timestamp))
        except Exception as e:
            print(f"[mesh_sync] Error saving Supabase ping timestamp: {e}")
    
    def _keep_supabase_alive(self) -> None:
        """
        Keep Supabase connection alive to prevent free tier pausing.
        
        Executes a lightweight query every 3 days (259,200 seconds) to prevent
        Supabase from pausing the project due to inactivity.
        
        This is non-fatal and should not affect the sync loop if it fails.
        """
        if not self.supabase_client or not self.check_network_status():
            return
        
        current_timestamp = int(time.time() * 1000)
        three_days_ms = 259200 * 1000  # 3 days in milliseconds
        
        # Check if more than 3 days have passed since last ping
        if self.last_supabase_ping_timestamp > 0:
            time_since_last_ping = current_timestamp - self.last_supabase_ping_timestamp
            if time_since_last_ping < three_days_ms:
                # Not due yet, skip
                return
        
        try:
            # Execute lightweight query to keep connection alive
            response = self.supabase_client.table('equipment').select('id').limit(1).execute()
            
            # Update last ping timestamp on success
            self._save_supabase_ping_timestamp(current_timestamp)
            self.last_supabase_ping_timestamp = current_timestamp
            
            print(f"[mesh_sync] Supabase keep-alive ping successful at {datetime.fromtimestamp(current_timestamp / 1000).isoformat()}")
        
        except Exception as e:
            print(f"[mesh_sync] Warning: Supabase keep-alive ping failed (non-fatal): {e}")
    
    def _mirror_to_supabase(self, transactions: List[Dict[str, Any]]) -> None:
        """
        Mirror transactions to Supabase (non-fatal, best-effort).
        
        Args:
            transactions: List of transaction dictionaries to mirror
        """
        if not self.supabase_client or not self.check_network_status():
            return
        
        try:
            for tx in transactions:
                table_name = tx['table_name']
                operation = tx['operation']
                payload = tx['payload'].copy()
                
                # Remove internal tracking fields
                payload.pop('_record_id', None)
                
                if operation in ('INSERT', 'UPDATE'):
                    # Upsert to Supabase
                    try:
                        self.supabase_client.table(table_name).upsert(payload).execute()
                        print(f"[mesh_sync] Mirrored {operation} to Supabase: {table_name}")
                    except Exception as e:
                        print(f"[mesh_sync] Warning: Failed to mirror {operation} to {table_name}: {e}")
                
                elif operation == 'DELETE':
                    record_id = tx['payload'].get('_record_id')
                    if record_id is None:
                        print(f"[mesh_sync] Warning: DELETE operation missing _record_id, skipping Supabase mirror")
                        continue
                    
                    try:
                        # Check if table has is_tombstone column for soft delete
                        # For Supabase, we always use soft delete via is_tombstone
                        self.supabase_client.table(table_name).update({'is_tombstone': 1}).eq('id', record_id).execute()
                        print(f"[mesh_sync] Mirrored soft DELETE to Supabase: {table_name} id={record_id}")
                    except Exception as e:
                        print(f"[mesh_sync] Warning: Failed to mirror DELETE to {table_name}: {e}")
        
        except Exception as e:
            print(f"[mesh_sync] Warning: Supabase mirroring error (non-fatal): {e}")
    
    def _pull_mobile_notes(self) -> int:
        """
        Pull mobile notes from Supabase and inject them into the mesh (non-fatal, best-effort).
        
        Returns:
            Number of mobile notes pulled
        """
        if not self.supabase_client or not self.check_network_status():
            return 0
        
        try:
            # Query Supabase for mobile notes updated since last pull
            # Convert milliseconds to ISO timestamp for Supabase query
            last_pull_iso = datetime.fromtimestamp(self.last_mobile_pull_timestamp / 1000).isoformat() if self.last_mobile_pull_timestamp > 0 else None
            
            query = self.supabase_client.table('notebook_entries').select('*').eq('source', 'mobile')
            
            if last_pull_iso:
                query = query.gt('updated_at', last_pull_iso)
            
            response = query.execute()
            
            if not response.data:
                return 0
            
            pulled_count = 0
            current_timestamp = int(time.time() * 1000)
            
            for note in response.data:
                try:
                    # Convert note to mesh transaction format
                    # Remove Supabase-specific fields
                    note_payload = {k: v for k, v in note.items() 
                                   if k not in ['id', 'created_at', 'updated_at', 'source']}
                    
                    # Log as INSERT mutation with device_origin='MOBILE'
                    # We use a special device_origin to indicate mobile source
                    tx_id = self.log_mutation(
                        table_name='notebook_entries',
                        operation='INSERT',
                        payload=note_payload,
                        record_id=None  # Supabase uses UUID, SQLite uses auto-increment
                    )
                    
                    # Update the transaction to mark it as from mobile
                    cursor = self.conn.cursor()
                    cursor.execute("""
                        UPDATE mesh_transactions
                        SET device_origin = 'MOBILE'
                        WHERE tx_id = ?
                    """, (tx_id,))
                    self.conn.commit()
                    
                    pulled_count += 1
                    print(f"[mesh_sync] Pulled mobile note: {note.get('title', 'untitled')}")
                
                except Exception as e:
                    print(f"[mesh_sync] Warning: Failed to process mobile note: {e}")
                    continue
            
            # Update last pull timestamp
            if pulled_count > 0:
                self._save_mobile_pull_timestamp(current_timestamp)
                print(f"[mesh_sync] Pulled {pulled_count} mobile notes from Supabase")
            
            return pulled_count
        
        except Exception as e:
            print(f"[mesh_sync] Warning: Mobile note pull error (non-fatal): {e}")
            return 0
    
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
                    WHERE timestamp > ? AND is_synced = 0
                    ORDER BY timestamp ASC
                """, (since_timestamp,))
            else:
                cursor.execute("""
                    SELECT tx_id, table_name, operation, payload, timestamp, device_origin
                    FROM mesh_transactions
                    WHERE is_synced = 0
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
            
            # Mirror to Supabase (non-fatal, best-effort)
            if applied_count > 0:
                self._mirror_to_supabase(sorted_transactions)
            
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
            # Load last_pushed_ts from mesh_sync_state
            last_pushed_ts = 0
            try:
                cursor = self.conn.cursor()
                cursor.execute("SELECT value FROM mesh_sync_state WHERE key = 'last_pushed_ts'")
                result = cursor.fetchone()
                if result:
                    last_pushed_ts = int(result['value'])
            except Exception as e:
                print(f"[mesh_sync] Warning: Failed to load last_pushed_ts: {e}")
            
            # Get pending transactions since last push
            transactions = self.get_pending_transactions(since_timestamp=last_pushed_ts)
            
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
            
            # Mark transactions as synced
            tx_ids = [tx['tx_id'] for tx in transactions]
            cursor = self.conn.cursor()
            placeholders = ','.join('?' * len(tx_ids))
            cursor.execute(f"""
                UPDATE mesh_transactions 
                SET is_synced = 1 
                WHERE tx_id IN ({placeholders})
            """, tx_ids)
            self.conn.commit()
            
            # Save the max timestamp of transactions just pushed (only after successful upload)
            max_timestamp = max(tx['timestamp'] for tx in transactions)
            try:
                cursor = self.conn.cursor()
                cursor.execute("INSERT OR REPLACE INTO mesh_sync_state (key, value) VALUES ('last_pushed_ts', ?)", (str(max_timestamp),))
                self.conn.commit()
                print(f"[mesh_sync] Saved last_pushed_ts: {max_timestamp}")
            except Exception as e:
                print(f"[mesh_sync] Warning: Failed to save last_pushed_ts: {e}")
            
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
            # Use cached object list if available and recent (reduces Class C transactions)
            current_time = time.time()
            time_since_last_list = current_time - self._last_cloud_list_time
            
            if time_since_last_list < self._cloud_list_cache_duration and self._cached_cloud_objects:
                # Use cached list
                response = {'Contents': self._cached_cloud_objects}
                print("[mesh_sync] Using cached B2 object list")
            else:
                # List only mesh_tx_ files using prefix filter (reduces Class C transactions)
                response = self.s3_client.list_objects_v2(
                    Bucket=self.b2_bucket_name,
                    Prefix='mesh_tx_'
                )
                
                # Cache the results
                if 'Contents' in response:
                    self._cached_cloud_objects = response['Contents']
                    self._last_cloud_list_time = current_time
                    print(f"[mesh_sync] Cached {len(self._cached_cloud_objects)} B2 objects for {self._cloud_list_cache_duration}s")
            
            if 'Contents' not in response:
                print("[mesh_sync] No transactions in cloud")
                return 0
            
            # Load last_pulled_bundle_ts from mesh_sync_state (bundle filename timestamps, not transaction timestamps)
            last_pulled_bundle_ts = 0
            try:
                cursor = self.conn.cursor()
                cursor.execute("SELECT value FROM mesh_sync_state WHERE key = 'last_pulled_bundle_ts'")
                result = cursor.fetchone()
                if result:
                    last_pulled_bundle_ts = int(result['value'])
            except Exception as e:
                print(f"[mesh_sync] Warning: Failed to load last_pulled_bundle_ts: {e}")
            
            # Filter and download new transaction bundles
            new_transactions = []
            max_bundle_timestamp_seen = last_pulled_bundle_ts
            
            for obj in response['Contents']:
                key = obj['Key']
                
                # Skip if not a transaction bundle (extra safety check)
                if not key.startswith('mesh_tx_'):
                    continue
                
                # Extract timestamp from filename
                try:
                    timestamp_str = key.split('_')[-1].replace('.json.gz', '')
                    bundle_timestamp = int(timestamp_str)
                    
                    # Track the highest bundle timestamp seen
                    if bundle_timestamp > max_bundle_timestamp_seen:
                        max_bundle_timestamp_seen = bundle_timestamp
                    
                    # Skip if bundle is older than or equal to our last pulled bundle timestamp
                    if bundle_timestamp <= last_pulled_bundle_ts:
                        continue
                except (ValueError, IndexError):
                    continue
                
                # Download and decompress bundle (with caching to reduce Class B transactions)
                if key in self._download_cache:
                    # Cache hit - use cached data
                    bundle = self._download_cache[key]
                    self._download_cache_hits += 1
                    print(f"[mesh_sync] Download cache hit for {key}")
                else:
                    # Cache miss - download from B2
                    obj_response = self.s3_client.get_object(Bucket=self.b2_bucket_name, Key=key)
                    compressed_data = obj_response['Body'].read()
                    json_data = gzip.decompress(compressed_data).decode()
                    bundle = json.loads(json_data)
                    self._download_cache_misses += 1
                    
                    # Add to cache (evict oldest if cache is full)
                    if len(self._download_cache) >= self._download_cache_max_size:
                        # Remove oldest entry (FIFO)
                        oldest_key = next(iter(self._download_cache))
                        del self._download_cache[oldest_key]
                    
                    self._download_cache[key] = bundle
                    print(f"[mesh_sync] Download cache miss for {key} (hits: {self._download_cache_hits}, misses: {self._download_cache_misses})")
                
                # Skip transactions from this device (we already have them)
                if bundle.get('device_id') == self.device_id:
                    continue
                
                new_transactions.extend(bundle.get('transactions', []))
            
            # Save the highest bundle timestamp seen to mesh_sync_state
            if max_bundle_timestamp_seen > last_pulled_bundle_ts:
                try:
                    cursor = self.conn.cursor()
                    cursor.execute("INSERT OR REPLACE INTO mesh_sync_state (key, value) VALUES ('last_pulled_bundle_ts', ?)", (str(max_bundle_timestamp_seen),))
                    self.conn.commit()
                    print(f"[mesh_sync] Saved last_pulled_bundle_ts: {max_bundle_timestamp_seen}")
                except Exception as e:
                    print(f"[mesh_sync] Warning: Failed to save last_pulled_bundle_ts: {e}")
            
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
        if self.hub_mode:
            print("[mesh_sync] ERROR: Cannot start internal sync loop in hub mode - hub manages its own sync loop")
            return
        
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
                
                # Keep Supabase alive (prevent free tier pausing)
                # Called every iteration but only executes every 3 days
                self._keep_supabase_alive()
                
                if self.is_online:
                    # Pull from cloud first
                    self.pull_from_cloud()
                    
                    # Pull mobile notes from Supabase
                    self._pull_mobile_notes()
                    
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
