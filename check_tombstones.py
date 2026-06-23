import sqlite3

conn = sqlite3.connect('C:\\Users\\balik\\Iven\\my_lab\\local_cache.db')
cursor = conn.cursor()

# Check if deleted files are in knowledge_vault as tombstones
cursor.execute("""
    SELECT id, file_path, file_size, is_tombstone
    FROM knowledge_vault
    WHERE is_tombstone = 1
    ORDER BY id DESC
    LIMIT 20
""")

rows = cursor.fetchall()

print(f'Tombstoned records: {len(rows)}')
print('ID | File Path | File Size | Is Tombstone')
print('-' * 100)
for r in rows:
    file_path = r[1][:60] if r[1] else "None"
    print(f'{r[0]} | {file_path} | {r[2]} | {r[3]}')

conn.close()
