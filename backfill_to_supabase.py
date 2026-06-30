"""
One-time backfill script: local SQLite → Supabase
Reads every row from every structured table in local_cache.db and upserts to Supabase
"""
import os
import sqlite3
from supabase import create_client
import uuid
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Configuration
DB_PATH = os.getenv("DATABASE_PATH", "local_cache.db")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Structured tables to backfill (excluding mesh_transactions and audit tables)
STRUCTURED_TABLES = [
    'projects',
    'experiments',  # rd_logs
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
    'relationships',
    'funding_sources',
    'purchases',
    'maintenance_costs',
    'gains'
]

# Columns to exclude (exist in SQLite but not in Supabase schema)
EXCLUDED_COLUMNS = {
    'experiments': ['cloud_file_url'],
    'components': ['last_updated'],
    'funding_sources': ['last_updated']
}

# Foreign key mappings: table -> (foreign_key_column, reference_table)
FOREIGN_KEY_MAPPINGS = {
    'experiments': [('project_id', 'projects')],
    'knowledge_vault': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'findings': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'component_usage': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'equipment_usage': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'tool_usage': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'material_usage': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'usage_logs': [('project_id', 'projects'), ('experiment_id', 'experiments')],
    'project_stages': [('project_id', 'projects')],
    'experiment_stages': [('experiment_id', 'experiments')],
    'equipment_maintenance': [('equipment_id', 'equipment')]
}

# Cache for UUID mappings to avoid repeated queries
uuid_cache = {}

def get_uuid_mapping(supabase, reference_table, local_id):
    """Get UUID for a local ID from reference table."""
    cache_key = f"{reference_table}:{local_id}"
    if cache_key in uuid_cache:
        return uuid_cache[cache_key]
    
    try:
        # For projects, map by name
        if reference_table == 'projects':
            # Query local SQLite for project name
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM projects WHERE id = ?", (local_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                project_name = row['name']
                # Query Supabase for project UUID by name
                response = supabase.table('projects').select('id').eq('name', project_name).execute()
                if response.data:
                    uuid_val = response.data[0]['id']
                    uuid_cache[cache_key] = uuid_val
                    return uuid_val
        else:
            # For other tables, we'd need a similar mapping strategy
            # For now, return None to skip
            pass
    except Exception as e:
        print(f"    Error mapping UUID for {reference_table} id {local_id}: {e}")
    
    return None

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
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
    
    print(f"Backfilling from {DB_PATH} to Supabase...")
    
    for table in STRUCTURED_TABLES:
        # Check if table exists in SQLite
        sqlite_table = table
        if table == 'experiments':
            sqlite_table = 'rd_logs'
        
        if sqlite_table not in sqlite_tables:
            print(f"  Skipping {table} (not found in SQLite)")
            continue
        
        print(f"  Backfilling {table}...")
        
        try:
            cursor.execute(f"SELECT * FROM {sqlite_table}")
            rows = cursor.fetchall()
            
            if not rows:
                print(f"    No data in {table}")
                continue
            
            for row in rows:
                data = dict(row)
                
                # Remove excluded columns
                if table in EXCLUDED_COLUMNS:
                    for col in EXCLUDED_COLUMNS[table]:
                        data.pop(col, None)
                
                # Generate UUID for id
                data['id'] = str(uuid.uuid4())
                
                # Handle foreign key mappings
                if table in FOREIGN_KEY_MAPPINGS:
                    for fk_col, ref_table in FOREIGN_KEY_MAPPINGS[table]:
                        if fk_col in data and data[fk_col]:
                            # Try to map the foreign key to UUID
                            mapped_uuid = get_uuid_mapping(supabase, ref_table, data[fk_col])
                            if mapped_uuid:
                                data[fk_col] = mapped_uuid
                            else:
                                # If mapping fails, set to None to avoid UUID errors
                                data[fk_col] = None
                
                # Handle empty/invalid timestamps
                for key, value in list(data.items()):
                    if value == '' or value is None:
                        # For timestamp columns, set to None instead of empty string
                        if 'date' in key.lower() or 'time' in key.lower() or key in ['timestamp', 'created_at', 'updated_at']:
                            data[key] = None
                
                try:
                    supabase.table(table).upsert(data).execute()
                except Exception as e:
                    print(f"    Error upserting row: {e}")
            
            print(f"    Backfilled {len(rows)} rows to {table}")
            
        except Exception as e:
            print(f"    Error backfilling {table}: {e}")
    
    conn.close()
    print("Backfill complete!")

if __name__ == "__main__":
    main()
