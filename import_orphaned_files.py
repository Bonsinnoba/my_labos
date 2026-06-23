import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from lab_app.knowledge.knowledge_vault import KnowledgeVault

documents_dir = "documents"
vault_path = "knowledge_vault"

# Initialize knowledge vault
kv = KnowledgeVault(vault_path=vault_path)

# Get all files in documents directory
files = [f for f in os.listdir(documents_dir) if os.path.isfile(os.path.join(documents_dir, f))]

print(f"Found {len(files)} files in documents directory")

# Check which files are already in database
import sqlite3
conn = sqlite3.connect('local_cache.db')
cursor = conn.cursor()
cursor.execute('SELECT file_path FROM knowledge_vault')
db_files = set(row[0] for row in cursor.fetchall())
conn.close()

print(f"Found {len(db_files)} files in database")

# Import orphaned files
imported = 0
skipped = 0
failed = 0

for filename in files:
    file_path = os.path.join(documents_dir, filename)
    
    # Check if file is already in database
    if file_path in db_files:
        print(f"Skipping {filename} - already in database")
        skipped += 1
        continue
    
    # Determine file type from extension
    ext = filename.split('.')[-1].lower()
    if ext in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp']:
        file_type = 'image'
    elif ext == 'pdf':
        file_type = 'pdf'
    elif ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']:
        file_type = 'video'
    elif ext in ['doc', 'docx']:
        file_type = 'document'
    elif ext in ['txt', 'md']:
        file_type = 'text'
    else:
        file_type = 'document'
    
    # Extract title from filename (remove timestamp prefix)
    parts = filename.split('_', 1)
    if len(parts) > 1:
        title = parts[1]
    else:
        title = filename
    
    try:
        doc_id = kv.add_document(
            source_path=file_path,
            title=title,
            description=None,
            tags=None,
            project_id=None,
            component_id=None,
            equipment_id=None,
            experiment_id=None,
            stage_id=None
        )
        print(f"Imported {filename} -> ID: {doc_id}")
        imported += 1
    except Exception as e:
        print(f"Failed to import {filename}: {e}")
        failed += 1

print(f"\nSummary:")
print(f"  Imported: {imported}")
print(f"  Skipped: {skipped}")
print(f"  Failed: {failed}")
