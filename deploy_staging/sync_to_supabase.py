"""
Sync local SQLite data to Supabase
This script exports data from local_cache.db and imports to Supabase
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
    
    print(f"Syncing from {DB_PATH} to Supabase...")
    
    # Sync projects
    print("Syncing projects...")
    cursor.execute("SELECT * FROM projects")
    projects = cursor.fetchall()
    for row in projects:
        project_data = dict(row)
        # Convert to Supabase format (UUID for id)
        project_uuid = str(uuid.uuid4())
        project_data['id'] = project_uuid
        try:
            supabase.table('projects').insert(project_data).execute()
            print(f"  - Synced project: {project_data['name']}")
        except Exception as e:
            print(f"  - Error syncing project {project_data['name']}: {e}")
    
    # Sync experiments (rd_logs)
    print("Syncing experiments...")
    cursor.execute("SELECT * FROM rd_logs")
    experiments = cursor.fetchall()
    for row in experiments:
        exp_data = dict(row)
        # Convert to Supabase format
        exp_uuid = str(uuid.uuid4())
        exp_data['id'] = exp_uuid
        # Map project_id to UUID if needed
        if exp_data.get('project_id'):
            # Find corresponding project UUID
            project_name = exp_data.get('project_name')
            if project_name:
                try:
                    project_resp = supabase.table('projects').select('id').eq('name', project_name).execute()
                    if project_resp.data:
                        exp_data['project_id'] = project_resp.data[0]['id']
                except:
                    pass
        try:
            supabase.table('experiments').insert(exp_data).execute()
            print(f"  - Synced experiment: {exp_data.get('log_title', 'unnamed')}")
        except Exception as e:
            print(f"  - Error syncing experiment: {e}")
    
    # Sync knowledge_vault
    print("Syncing knowledge_vault...")
    cursor.execute("SELECT * FROM knowledge_vault")
    docs = cursor.fetchall()
    for row in docs:
        doc_data = dict(row)
        doc_uuid = str(uuid.uuid4())
        doc_data['id'] = doc_uuid
        try:
            supabase.table('knowledge_vault').insert(doc_data).execute()
            print(f"  - Synced document: {doc_data['title']}")
        except Exception as e:
            print(f"  - Error syncing document: {e}")
    
    # Sync findings
    print("Syncing findings...")
    cursor.execute("SELECT * FROM findings")
    findings_list = cursor.fetchall()
    for row in findings_list:
        finding_data = dict(row)
        finding_uuid = str(uuid.uuid4())
        finding_data['id'] = finding_uuid
        try:
            supabase.table('findings').insert(finding_data).execute()
            print(f"  - Synced finding: {finding_data['title']}")
        except Exception as e:
            print(f"  - Error syncing finding: {e}")
    
    conn.close()
    print("Sync complete!")

if __name__ == "__main__":
    main()
