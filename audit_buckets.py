"""
Audit B2 buckets to identify duplicate/orphaned files.
"""
import os
import sqlite3
import boto3
from dotenv import load_dotenv
from collections import Counter

load_dotenv()

# Use correct credentials for each bucket
account1_client = boto3.client(
    's3',
    endpoint_url=os.getenv('ACCOUNT_1_ENDPOINT'),
    aws_access_key_id=os.getenv('ACCOUNT_1_KEY_ID'),
    aws_secret_access_key=os.getenv('ACCOUNT_1_APPLICATION_KEY')
)

account2_client = boto3.client(
    's3',
    endpoint_url=os.getenv('ACCOUNT_2_ENDPOINT'),
    aws_access_key_id=os.getenv('ACCOUNT_2_KEY_ID'),
    aws_secret_access_key=os.getenv('ACCOUNT_2_APPLICATION_KEY')
)

# Try mesh sync with Account 2 credentials first, if that fails skip it
try:
    mesh_client = boto3.client(
        's3',
        endpoint_url=os.getenv('MESH_SYNC_ENDPOINT'),
        aws_access_key_id=os.getenv('MESH_SYNC_KEY_ID'),
        aws_secret_access_key=os.getenv('MESH_SYNC_APPLICATION_KEY')
    )
    # Test if mesh sync credentials work
    mesh_client.list_buckets()
except:
    mesh_client = None

def list_all_objects(client, bucket_name):
    """List all objects in a bucket."""
    objects = []
    continuation_token = None
    
    while True:
        if continuation_token:
            response = client.list_objects_v2(Bucket=bucket_name, ContinuationToken=continuation_token)
        else:
            response = client.list_objects_v2(Bucket=bucket_name)
        
        if 'Contents' in response:
            objects.extend(response['Contents'])
        
        if response.get('IsTruncated'):
            continuation_token = response.get('NextContinuationToken')
        else:
            break
    
    return objects

def analyze_bucket(client, bucket_name, bucket_type):
    """Analyze a bucket for duplicates and issues."""
    print(f"\n{'='*60}")
    print(f"Analyzing {bucket_name} ({bucket_type})")
    print('='*60)
    
    objects = list_all_objects(client, bucket_name)
    
    if not objects:
        print("  No files found")
        return
    
    print(f"  Total files: {len(objects)}")
    
    # Calculate total size
    total_size = sum(obj['Size'] for obj in objects)
    print(f"  Total size: {total_size / (1024*1024):.2f} MB")
    
    # Extract base filenames (without .enc, .gz extensions)
    base_names = []
    for obj in objects:
        key = obj['Key']
        # Remove .enc and .gz extensions to get base name
        base = key.replace('.enc', '').replace('.gz', '')
        base_names.append(base)
    
    # Count duplicates
    base_name_counts = Counter(base_names)
    duplicates = {name: count for name, count in base_name_counts.items() if count > 1}
    
    print(f"  Unique files: {len(base_name_counts)}")
    print(f"  Files with duplicates: {len(duplicates)}")
    
    if duplicates:
        print(f"\n  Top 20 duplicated files:")
        for name, count in sorted(duplicates.items(), key=lambda x: x[1], reverse=True)[:20]:
            print(f"    {name}: {count} versions")
    
    # Show file extensions
    extensions = Counter(obj['Key'].split('.')[-1] for obj in objects)
    print(f"\n  File extensions: {dict(extensions)}")
    
    # Show oldest and newest files
    if objects:
        oldest = min(objects, key=lambda x: x['LastModified'])
        newest = max(objects, key=lambda x: x['LastModified'])
        print(f"\n  Oldest file: {oldest['Key']} ({oldest['LastModified']})")
        print(f"  Newest file: {newest['Key']} ({newest['LastModified']})")
    
    return objects

# Analyze all buckets
print("B2 Bucket Audit")
print("="*60)

account1_objects = analyze_bucket(account1_client, os.getenv('ACCOUNT_1_BUCKET'), 'Heavy Storage')
account2_objects = analyze_bucket(account2_client, os.getenv('ACCOUNT_2_BUCKET'), 'Light Storage')
mesh_objects = analyze_bucket(mesh_client, os.getenv('MESH_SYNC_BUCKET'), 'Mesh Sync')

# Check database state
print(f"\n{'='*60}")
print("Database State")
print('='*60)

conn = sqlite3.connect('local_cache.db')
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM knowledge_vault WHERE is_tombstone = 0')
active_files = cursor.fetchone()[0]
print(f"  Active files in database: {active_files}")

cursor.execute('SELECT COUNT(*) FROM knowledge_vault WHERE is_tombstone = 1')
tombstone_files = cursor.fetchone()[0]
print(f"  Tombstone files in database: {tombstone_files}")

cursor.execute('SELECT COUNT(*) FROM knowledge_vault WHERE cloud_file_url IS NOT NULL')
synced_files = cursor.fetchone()[0]
print(f"  Files with cloud URL: {synced_files}")

cursor.execute('SELECT COUNT(*) FROM knowledge_vault WHERE is_synced = 1')
marked_synced = cursor.fetchone()[0]
print(f"  Files marked as synced: {marked_synced}")

cursor.execute('SELECT file_path, cloud_file_url FROM knowledge_vault WHERE is_tombstone = 0 LIMIT 10')
print(f"\n  Sample active files:")
for row in cursor.fetchall():
    print(f"    {row[0]} -> {row[1]}")

conn.close()
