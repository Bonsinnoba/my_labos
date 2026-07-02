"""
Idempotent backfill script: local SQLite → Supabase
Reads every row from every structured table in local_cache.db and upserts to Supabase in batches of 100.
Uses deterministic UUID mapping (UUID v5) for 100% idempotency.
"""
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
dotenv_path = r"c:\Users\balik\Iven\my_lab\.env"
load_dotenv(dotenv_path=dotenv_path)

# Configuration
DB_PATH = os.getenv("DATABASE_PATH", "local_cache.db")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Structured tables to backfill (excluding mesh_transactions and audit tables)
STRUCTURED_TABLES = [
    'projects',
    'rd_logs',
    'knowledge_vault',
    'findings',
    'components',
    'tools',
    'materials',
    'equipment',
    'equipment_maintenance',
    'component_usage',
    'equipment_usage',
    'tool_usage',
    'material_usage',
    'usage_logs',
    'project_stages',
    'experiment_stages',
    'notebook_entries',
    'calculations',
    'funding_sources',
    'purchases',
    'maintenance_costs',
    'gains'
]

# Columns to exclude from all tables (exist in SQLite but not in Supabase schema)
GLOBAL_EXCLUDE_COLUMNS = ['created_by', 'edited_by', 'edited_at', 'is_synced']

# Table-specific columns to exclude
EXCLUDED_COLUMNS = {
    # Add table-specific exclusions here if any
}

# Foreign key mappings: table -> [(foreign_key_column, reference_table)]
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
    """
    Generate a deterministic UUID v5 from a table name and a local ID.
    Supports both integer IDs and string IDs (like existing UUIDs).
    """
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
            
    # Generate UUID v5 using DNS namespace + f"{normalized_table}:{local_id}"
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

# Tables with NOT-NULL FK columns that must resolve against already-inserted parents.
# Format: { child_table: [(fk_col, parent_table), ...] }
REQUIRED_PARENTS = {
    'project_stages':    [('project_id', 'projects')],
    'experiment_stages': [('experiment_id', 'rd_logs')],
    'usage_logs':        [('project_id', 'projects')],   # skip rows whose parent project is gone
    'rd_logs':           [('project_id', 'projects')],   # nullable but skip if uuid unknown
}

def upsert_batch(supabase, table: str, batch: list) -> set:
    """Upsert a batch and return the set of IDs that were successfully inserted."""
    if not batch:
        return set()
    try:
        supabase.table(table).upsert(batch).execute()
        print(f"    Upserted batch of {len(batch)} rows to {table}")
        return {row['id'] for row in batch}
    except Exception as e:
        print(f"    Error upserting batch: {e}")
        return set()

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        return
    
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Connect to local SQLite
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all tables in SQLite
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    sqlite_tables = [row[0] for row in cursor.fetchall()]
    
    print(f"Backfilling from {DB_PATH} to Supabase with deterministic UUIDs and batching...")
    
    # Track inserted UUIDs per table for parent-FK validation
    inserted_uuids: Dict[str, set] = {t: set() for t in STRUCTURED_TABLES}
    
    for table in STRUCTURED_TABLES:
        # Check if table exists in SQLite
        if table not in sqlite_tables:
            print(f"  Skipping {table} (not found in SQLite)")
            continue
        
        print(f"  Backfilling {table}...")
        
        try:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            
            if not rows:
                print(f"    No data in {table}")
                continue
            
            batch = []
            skipped = 0
            for row in rows:
                data = dict(row)
                
                # Remove globally excluded columns
                for col in GLOBAL_EXCLUDE_COLUMNS:
                    data.pop(col, None)
                
                # Remove table-specific excluded columns
                if table in EXCLUDED_COLUMNS:
                    for col in EXCLUDED_COLUMNS[table]:
                        data.pop(col, None)
                
                # Map last_updated to updated_at if present
                if 'last_updated' in data:
                    data['updated_at'] = data.pop('last_updated')
                
                # Generate deterministic UUID for primary key
                data['id'] = get_deterministic_uuid(table, data['id'])
                
                # Handle foreign key mappings
                if table in FOREIGN_KEY_MAPPINGS:
                    for fk_col, ref_table in FOREIGN_KEY_MAPPINGS[table]:
                        if fk_col in data and data[fk_col]:
                            data[fk_col] = get_deterministic_uuid(ref_table, data[fk_col])
                
                # Special handling for relationships table if it exists
                if table == 'relationships':
                    if data.get('source_type') and data.get('source_id'):
                        ref_t = normalize_type_to_table(data['source_type'])
                        data['source_id'] = get_deterministic_uuid(ref_t, data['source_id'])
                    if data.get('target_type') and data.get('target_id'):
                        ref_t = normalize_type_to_table(data['target_type'])
                        data['target_id'] = get_deterministic_uuid(ref_t, data['target_id'])
                
                # Special handling for usage_logs table
                if table == 'usage_logs':
                    if data.get('entity_type') and data.get('entity_id'):
                        ref_t = normalize_type_to_table(data['entity_type'])
                        data['entity_id'] = get_deterministic_uuid(ref_t, data['entity_id'])
                
                # Special handling for maintenance_costs table
                if table == 'maintenance_costs':
                    if data.get('item_type') and data.get('item_id'):
                        ref_t = normalize_type_to_table(data['item_type'])
                        data['item_id'] = get_deterministic_uuid(ref_t, data['item_id'])
                
                # Normalize date/time columns to ISO format for PostgreSQL
                for key, value in list(data.items()):
                    if 'date' in key.lower() or 'time' in key.lower() or key in ['timestamp', 'created_at', 'updated_at']:
                        if value == '' or value is None:
                            data[key] = None
                        else:
                            data[key] = normalize_date_to_iso(value)
                
                # --- Orphan-row guard ---
                # Skip rows whose NOT NULL FK parents were never inserted (dangling references)
                orphaned = False
                if table in REQUIRED_PARENTS:
                    for fk_col, parent_table in REQUIRED_PARENTS[table]:
                        fk_val = data.get(fk_col)
                        if fk_val and fk_val not in inserted_uuids.get(parent_table, set()):
                            print(f"    Skipping orphaned row id={data['id']}: "
                                  f"{fk_col}={fk_val} not found in {parent_table}")
                            orphaned = True
                            skipped += 1
                            break
                if orphaned:
                    continue
                
                batch.append(data)
                
                if len(batch) >= 100:
                    inserted_uuids[table] |= upsert_batch(supabase, table, batch)
                    batch = []
            
            # Upsert remaining rows (upsert_batch prints its own confirmation)
            if batch:
                inserted_uuids[table] |= upsert_batch(supabase, table, batch)
            
            msg = f"    Successfully backfilled {len(rows) - skipped}/{len(rows)} rows to {table}"
            if skipped:
                msg += f" ({skipped} orphaned rows skipped)"
            print(msg)
            
        except Exception as e:
            print(f"    Error backfilling {table}: {e}")
            import traceback
            traceback.print_exc()
            
    conn.close()
    print("Backfill complete!")

if __name__ == "__main__":
    main()

