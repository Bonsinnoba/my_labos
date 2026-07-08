from database.cache_db import CacheDatabase
import os
import sys
from pathlib import Path

# Use the same database path as the API server
db_path = Path(__file__).parent.parent / "local_cache.db"
print(f"Using database: {db_path}")

db = CacheDatabase(db_path=str(db_path))
docs = db.get_all_documents()
print(f'Total documents: {len(docs)}')

for d in docs:
    if 70 <= d['id'] <= 83:
        file_path = d.get('file_path')
        cloud_url = d.get('cloud_file_url')
        exists = os.path.exists(file_path) if file_path else False
        print(f"ID: {d['id']}, path: {file_path}, exists: {exists}, cloud_url: {cloud_url}")

db.close()
