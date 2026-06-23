import sqlite3

conn = sqlite3.connect('C:\\Users\\balik\\Iven\\my_lab\\local_cache.db')
cursor = conn.cursor()

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

print(f'Pending deletions: {len(rows)}')
print('ID | File Name | File Size | Timestamp')
print('-' * 100)
for r in rows:
    file_name = r[1][:50] if r[1] else "None"
    file_size = r[4] if r[4] else "Unknown"
    print(f'{r[0]} | {file_name} | {file_size} | {r[3]}')

conn.close()
