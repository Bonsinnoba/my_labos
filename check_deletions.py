import sqlite3
from pathlib import Path

db_path = "local_cache.db"

if not Path(db_path).exists():
    print(f"Database not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check for pending deletions
cursor.execute("""
    SELECT 
        asset_sync_log.id, 
        asset_sync_log.file_name, 
        asset_sync_log.action_type, 
        asset_sync_log.timestamp,
        knowledge_vault.file_size
    FROM asset_sync_log
    LEFT JOIN knowledge_vault ON knowledge_vault.file_path LIKE '%' || asset_sync_log.file_name
    WHERE asset_sync_log.action_type = 'DELETE'
    ORDER BY asset_sync_log.timestamp ASC
""")

rows = cursor.fetchall()

if rows:
    print(f"Found {len(rows)} pending deletions:")
    for row in rows:
        log_id, file_name, action_type, timestamp, file_size = row
        print(f"  ID: {log_id}, File: {file_name}, Size: {file_size or 'unknown'}, Time: {timestamp}")
else:
    print("No pending deletions found in asset_sync_log")

conn.close()
