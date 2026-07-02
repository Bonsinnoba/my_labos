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

from typing import Union

# Columns to exclude from all tables when mirroring to Supabase
GLOBAL_EXCLUDE_COLUMNS = ['created_by', 'edited_by', 'edited_at', 'is_synced']

# Foreign key mappings for UUID resolution: table -> [(foreign_key_column, reference_table)]
FOREIGN_KEY_MAPPINGS = {
    'rd_logs': [('project_id', 'projects'), ('stage_id', 'project_stages')],
    'knowledge_vault': [
        ('project_id', 'projects'),
        ('component_id', 'components'),
        ('equipment_id', 'equipment'),
        ('experiment_id', 'rd_logs'),
        ('stage_id', 'project_stages')
    ],
    'findings': [
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs'),
        ('stage_id', 'project_stages')
    ],
    'equipment_maintenance': [('equipment_id', 'equipment')],
    'component_usage': [
        ('component_id', 'components'),
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs')
    ],
    'equipment_usage': [
        ('equipment_id', 'equipment'),
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs')
    ],
    'tool_usage': [
        ('tool_id', 'tools'),
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs')
    ],
    'material_usage': [
        ('material_id', 'materials'),
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs')
    ],
    'usage_logs': [
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs'),
        ('stage_id', 'experiment_stages'),
        ('user_id', 'users')
    ],
    'project_stages': [('project_id', 'projects')],
    'experiment_stages': [('experiment_id', 'rd_logs')],
    'notebook_entries': [
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs')
    ],
    'calculations': [
        ('project_id', 'projects'),
        ('experiment_id', 'rd_logs')
    ],
    'purchases': [('funding_id', 'funding_sources')],
    'maintenance_costs': [
        ('funding_source_id', 'funding_sources')
    ],
    'gains': [('funding_id', 'funding_sources')]
}

def get_deterministic_uuid(table_name: str, local_id: Any) -> str:
    """Generate a deterministic UUID v5 from table name and local ID."""
    if not local_id:
        return None
    
    # Standardize table name (e.g. rd_logs vs experiments)
    normalized_table = 'rd_logs' if table_name == 'experiments' else table_name
    
    # If the local_id is already a valid UUID string, return it as is
    if isinstance(local_id, str):
        try:
            uuid.UUID(local_id)
            return local_id
        except ValueError:
            pass
            
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{normalized_table}:{local_id}"))

def normalize_type_to_table(source_type: str) -> str:
    """Normalize source/target types in relationships to actual table names."""
    type_map = {
        'project': 'projects',
        'experiment': 'rd_logs',
        'log': 'rd_logs',
        'finding': 'findings',
        'component': 'components',
        'tool': 'tools',
        'material': 'materials',
        'equipment': 'equipment',
        'notebook': 'notebook_entries'
    }
    return type_map.get(source_type.lower(), source_type)

def normalize_date_to_iso(date_str: Any) -> Optional[str]:
    """Normalize date/time strings from DD-MM-YYYY to YYYY-MM-DD or ISO format for PostgreSQL."""
    if not date_str:
        return None
    if not isinstance(date_str, str):
        return date_str
    
    date_str = date_str.strip()
    if not date_str:
        return None
        
    # List of formats to try parsing
    formats = [
        '%d-%m-%Y %H:%M:%S',
        '%d-%m-%Y %H:%M',
        '%d-%m-%Y',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%d'
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            # Return in ISO format
            return dt.isoformat()
        except ValueError:
            continue
            
    # Return as-is if no format matches
    return date_str

def get_local_id_from_uuid(cursor: sqlite3.Cursor, table_name: str, uuid_val: str) -> Optional[int]:
    """Find the local SQLite integer ID that hashes to the given UUID v5."""
    if not uuid_val:
        return None
    try:
        normalized_table = 'rd_logs' if table_name == 'experiments' else table_name
        cursor.execute(f"SELECT id FROM {normalized_table}")
        for row in cursor.fetchall():
            local_id = row[0]
            if get_deterministic_uuid(normalized_table, local_id) == uuid_val:
                return local_id
    except Exception as e:
        print(f"[mesh_sync] Error mapping UUID back to local ID: {e}")
    return None


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
            hub_mode: If True, this instance is the sole B2 poller (Instapods Hub).
                      If False (device mode), incoming transactions are pulled from
                      Supabase instead of B2 to eliminate redundant Class C API calls.
        """
        self.db_path = db_path
        self.device_id = device_id or self._get_or_generate_device_id()
        self.b2_bucket_name = b2_bucket_name
        self.b2_endpoint_url = b2_endpoint_url
        self.b2_access_key_id = b2_access_key_id
        self.b2_secret_access_key = b2_secret_access_key

        # Hub mode: when True this instance is the sole B2 poller.
        # Non-hub devices pull from Supabase instead to eliminate redundant B2 Class C calls.
        self.hub_mode = hub_mode
        
        self.conn: Optional[sqlite3.Connection] = None
        self.s3_client = None
        self.is_online = True
        self.sync_thread = None
        self.sync_running = False

        # Poll interval: configurable via MESH_POLL_INTERVAL env var.
        # Hub default: 7.5s for fast fan-out. Device default: 30s (Supabase pull is cheaper).
        default_interval = 7.5 if hub_mode else 30.0
        self.polling_interval = float(os.getenv("MESH_POLL_INTERVAL", str(default_interval)))
        
        # Registered device IDs for garbage collection
        self.registered_devices = set()
        
        # Cache for B2 object listings to reduce Class C transactions.
        # Extended to 300s — a single Hub poller makes list caching much less critical,
        # but retained as a safety net for burst scenarios.
        self._cached_cloud_objects = []
        self._last_cloud_list_time = 0
        self._cloud_list_cache_duration = 300  # Cache for 300 seconds (was 60s)
        
        # Cache for downloaded transaction bundles to reduce Class B transactions
        self._download_cache = {}  # key: bundle filename, value: decompressed bundle data
        self._download_cache_max_size = 200  # Max number of bundles to cache (was 100)
        self._download_cache_hits = 0
        self._download_cache_misses = 0
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

        mode_label = "HUB (sole B2 poller)" if hub_mode else f"DEVICE (Supabase pull, poll={self.polling_interval}s)"
        print(f"[mesh_sync] Mode: {mode_label}")
    
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
            # 1. Mirror the actual data records to their respective tables
            for tx in transactions:
                table_name = tx['table_name']
                operation = tx['operation']
                
                # Exclude mesh_transactions or audit logs from mirroring directly
                if table_name in ('mesh_transactions', 'audit_log'):
                    continue
                
                payload = tx['payload'].copy()
                
                # Remove internal tracking fields
                payload.pop('_record_id', None)
                
                # Clean globally excluded columns
                for col in GLOBAL_EXCLUDE_COLUMNS:
                    payload.pop(col, None)
                
                # Map last_updated to updated_at if present
                if 'last_updated' in payload:
                    payload['updated_at'] = payload.pop('last_updated')
                
                # Standardize timestamps: normalize DD-MM-YYYY → ISO, nullify blanks
                for key, value in list(payload.items()):
                    if 'date' in key.lower() or 'time' in key.lower() or key in ['timestamp', 'created_at', 'updated_at']:
                        if value == '' or value is None:
                            payload[key] = None
                        else:
                            payload[key] = normalize_date_to_iso(value)
                
                if operation in ('INSERT', 'UPDATE'):
                    # Map primary key to UUID
                    if 'id' in payload:
                        payload['id'] = get_deterministic_uuid(table_name, payload['id'])
                    
                    # Handle foreign keys mapping
                    if table_name in FOREIGN_KEY_MAPPINGS:
                        for fk_col, ref_table in FOREIGN_KEY_MAPPINGS[table_name]:
                            if fk_col in payload and payload[fk_col]:
                                payload[fk_col] = get_deterministic_uuid(ref_table, payload[fk_col])
                    
                    # Special handling for relationships table
                    if table_name == 'relationships':
                        if payload.get('source_type') and payload.get('source_id'):
                            ref_t = normalize_type_to_table(payload['source_type'])
                            payload['source_id'] = get_deterministic_uuid(ref_t, payload['source_id'])
                        if payload.get('target_type') and payload.get('target_id'):
                            ref_t = normalize_type_to_table(payload['target_type'])
                            payload['target_id'] = get_deterministic_uuid(ref_t, payload['target_id'])
                    
                    # Special handling for usage_logs table
                    if table_name == 'usage_logs':
                        if payload.get('entity_type') and payload.get('entity_id'):
                            ref_t = normalize_type_to_table(payload['entity_type'])
                            payload['entity_id'] = get_deterministic_uuid(ref_t, payload['entity_id'])
                    
                    # Special handling for maintenance_costs table
                    if table_name == 'maintenance_costs':
                        if payload.get('item_type') and payload.get('item_id'):
                            ref_t = normalize_type_to_table(payload['item_type'])
                            payload['item_id'] = get_deterministic_uuid(ref_t, payload['item_id'])
                    
                    # Upsert to Supabase
                    try:
                        self.supabase_client.table(table_name).upsert(payload).execute()
                        print(f"[mesh_sync] Mirrored {operation} to Supabase: {table_name}")
                    except Exception as e:
                        print(f"[mesh_sync] Warning: Failed to mirror {operation} to {table_name}: {e}")
                
                elif operation == 'DELETE':
                    record_id = tx['payload'].get('_record_id')
                    if record_id is None:
                        # Fallback to id if _record_id is not set
                        record_id = tx['payload'].get('id')
                    if record_id is None:
                        print(f"[mesh_sync] Warning: DELETE operation missing id/_record_id, skipping Supabase mirror")
                        continue
                    
                    # Map record_id to deterministic UUID
                    uuid_record_id = get_deterministic_uuid(table_name, record_id)
                    
                    try:
                        # Check if table has is_tombstone column for soft delete
                        # For Supabase, we always use soft delete via is_tombstone
                        self.supabase_client.table(table_name).update({'is_tombstone': 1}).eq('id', uuid_record_id).execute()
                        print(f"[mesh_sync] Mirrored soft DELETE to Supabase: {table_name} id={uuid_record_id}")
                    except Exception as e:
                        print(f"[mesh_sync] Warning: Failed to mirror DELETE to {table_name}: {e}")
            
            # 2. Mirror the transaction ledger entries to mesh_transactions table
            supabase_ledger_rows = []
            for tx in transactions:
                # Convert timestamp from milliseconds to seconds for 32-bit Postgres int limit
                ts_seconds = int(tx['timestamp'] / 1000)
                
                payload_val = tx['payload']
                if not isinstance(payload_val, str):
                    payload_val = json.dumps(payload_val)
                
                supabase_ledger_rows.append({
                    'tx_id': tx['tx_id'],
                    'table_name': tx['table_name'],
                    'operation': tx['operation'],
                    'payload': payload_val,
                    'timestamp': ts_seconds,
                    'device_origin': tx['device_origin']
                })
            
            if supabase_ledger_rows:
                try:
                    self.supabase_client.table('mesh_transactions').upsert(supabase_ledger_rows).execute()
                    print(f"[mesh_sync] Mirrored {len(supabase_ledger_rows)} ledger rows to Supabase")
                except Exception as e:
                    print(f"[mesh_sync] Warning: Failed to mirror ledger rows to Supabase: {e}")
        
        except Exception as e:
            print(f"[mesh_sync] Warning: Supabase mirroring error (non-fatal): {e}")

    def pull_from_supabase(self) -> int:
        """
        Pull and apply transactions from Supabase (device mode, no B2 Class C cost).

        Queries the Supabase mesh_transactions table for rows written by other devices
        since this device's last known timestamp. Falls back to pull_from_cloud() if
        Supabase is unreachable.

        Returns:
            Number of transactions applied
        """
        if not self.supabase_client:
            print("[mesh_sync] Supabase unavailable for pull - falling back to B2")
            return self.pull_from_cloud()

        if not self.is_online:
            print("[mesh_sync] Offline - skipping Supabase pull")
            return 0

        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT MAX(timestamp) as max_ts FROM mesh_transactions")
            result = cursor.fetchone()
            last_timestamp = result['max_ts'] if result['max_ts'] else 0

            # Convert millisecond timestamp to seconds for 32-bit integer comparison in Supabase
            last_ts_seconds = int(last_timestamp / 1000)

            query = (
                self.supabase_client
                .table('mesh_transactions')
                .select('*')
                .neq('device_origin', self.device_id)  # Ignore our own transactions
                .order('timestamp', desc=False)
            )

            if last_ts_seconds > 0:
                query = query.gt('timestamp', last_ts_seconds)

            response = query.limit(500).execute()

            if not response.data:
                print("[mesh_sync] No new transactions in Supabase")
                return 0

            # Preprocess response data to match local SQLite format requirements
            transactions = []
            for tx in response.data:
                processed_tx = tx.copy()
                
                # Convert timestamp from seconds back to milliseconds
                processed_tx['timestamp'] = int(tx['timestamp'] * 1000)
                
                # Deserialize payload if it's a JSON string
                if isinstance(tx.get('payload'), str):
                    try:
                        processed_tx['payload'] = json.loads(tx['payload'])
                    except Exception as parse_err:
                        print(f"[mesh_sync] Error parsing payload for tx {tx.get('tx_id')}: {parse_err}")
                        continue
                
                transactions.append(processed_tx)

            if not transactions:
                return 0

            applied = self.apply_incoming_transactions(transactions)
            print(f"[mesh_sync] Applied {applied} transactions from Supabase (device pull)")
            return applied

        except Exception as e:
            print(f"[mesh_sync] Supabase pull error ({e}) - falling back to B2")
            return self.pull_from_cloud()
    
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
                    cursor = self.conn.cursor()
                    # Convert note to mesh transaction format
                    # Remove Supabase-specific fields
                    note_payload = {k: v for k, v in note.items() 
                                   if k not in ['id', 'created_at', 'updated_at', 'source']}
                    
                    # Map project_id UUID back to local integer ID
                    if 'project_id' in note_payload and note_payload['project_id']:
                        local_proj_id = get_local_id_from_uuid(cursor, 'projects', note_payload['project_id'])
                        note_payload['project_id'] = local_proj_id
                    
                    # Map experiment_id UUID back to local integer ID
                    if 'experiment_id' in note_payload and note_payload['experiment_id']:
                        local_exp_id = get_local_id_from_uuid(cursor, 'rd_logs', note_payload['experiment_id'])
                        note_payload['experiment_id'] = local_exp_id
                    
                    # Log as INSERT mutation with device_origin='MOBILE'
                    # We use a special device_origin to indicate mobile source
                    tx_id = self.log_mutation(
                        table_name='notebook_entries',
                        operation='INSERT',
                        payload=note_payload,
                        record_id=None  # Supabase uses UUID, SQLite uses auto-increment
                    )
                    
                    # Update the transaction to mark it as from mobile
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
            
            # Get latest timestamp from local transactions
            cursor = self.conn.cursor()
            cursor.execute("SELECT MAX(timestamp) as max_ts FROM mesh_transactions")
            result = cursor.fetchone()
            last_timestamp = result['max_ts'] if result['max_ts'] else 0
            
            # Filter and download new transaction bundles
            new_transactions = []
            
            for obj in response['Contents']:
                key = obj['Key']
                
                # Skip if not a transaction bundle (extra safety check)
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
                
                # Keep Supabase alive (prevent free tier pausing)
                # Called every iteration but only executes every 3 days
                self._keep_supabase_alive()
                
                if self.is_online:
                    if self.hub_mode:
                        # HUB MODE: sole B2 poller — pull from B2 and mirror to Supabase
                        pulled = self.pull_from_cloud()
                        if pulled > 0:
                            # Mirror freshly pulled transactions to Supabase so devices can read them
                            pending = self.get_pending_transactions()
                            if pending:
                                self._mirror_to_supabase(pending)
                    else:
                        # DEVICE MODE: pull from Supabase (zero B2 Class C cost)
                        self.pull_from_supabase()

                    # Both modes: pull mobile notes and push local mutations to B2
                    self._pull_mobile_notes()
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
