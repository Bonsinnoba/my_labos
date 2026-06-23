import sqlite3
import os

conn = sqlite3.connect('C:\\Users\\balik\\Iven\\my_lab\\local_cache.db')
cursor = conn.cursor()

cursor.execute('SELECT id, title, file_path FROM knowledge_vault WHERE id IN (45, 43, 46, 44, 47, 48, 50)')
rows = cursor.fetchall()

print('ID | Title | File Path | Exists')
print('-' * 120)
for r in rows:
    title = r[1][:40] if r[1] else "None"
    file_path = r[2] if r[2] else "None"
    abs_path = os.path.abspath(file_path) if file_path else None
    exists = os.path.exists(abs_path) if abs_path else False
    print(f'{r[0]} | {title} | {file_path} | {exists}')

print(f'\nTotal records: {len(rows)}')
conn.close()
