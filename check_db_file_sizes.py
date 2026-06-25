"""
Check database for file sizes to identify files that should be in ACCOUNT_1.
"""
import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()

conn = sqlite3.connect('local_cache.db')
cursor = conn.cursor()

cursor.execute('SELECT file_path, file_size, cloud_file_url FROM knowledge_vault WHERE file_path IS NOT NULL')
rows = cursor.fetchall()

print('Database file sizes:')
print('='*60)

threshold = 50 * 1024 * 1024  # 50MB
large_files = []

for row in rows:
    file_path = row[0]
    file_size = row[1]
    cloud_url = row[2]
    size_mb = file_size / (1024 * 1024)
    
    print(f"  {file_path}: {size_mb:.2f} MB ({file_size} bytes)")
    print(f"    URL: {cloud_url}")
    
    if file_size >= threshold:
        large_files.append(row)

print(f'\n{"="*60}')
print(f'Files >= 50MB in database (should be in ACCOUNT_1):')
print(f'{"="*60}')

if large_files:
    for row in large_files:
        file_path = row[0]
        file_size = row[1]
        cloud_url = row[2]
        size_mb = file_size / (1024 * 1024)
        print(f"  {file_path}: {size_mb:.2f} MB")
        print(f"    URL: {cloud_url}")
else:
    print('  (none found)')

conn.close()
