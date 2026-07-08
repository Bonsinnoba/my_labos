from database.cache_db import CacheDatabase
import os

db = CacheDatabase()
docs = db.get_all_documents()
print(f'Total documents: {len(docs)}')

for d in docs:
    if 70 <= d['id'] <= 83:
        file_path = d.get('file_path')
        exists = os.path.exists(file_path) if file_path else False
        print(f"ID: {d['id']}, path: {file_path}, exists: {exists}")

db.close()
