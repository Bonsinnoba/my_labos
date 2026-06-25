"""
Check the recording file details in database and cloud.
"""
import os
import sqlite3
import boto3
from dotenv import load_dotenv

load_dotenv()

# Check database for recording files
conn = sqlite3.connect('local_cache.db')
cursor = conn.cursor()

cursor.execute('SELECT file_path, file_size, cloud_file_url FROM knowledge_vault WHERE file_path LIKE "%Recording%"')
rows = cursor.fetchall()

print('Recording files in database:')
print('='*60)

for row in rows:
    file_path = row[0]
    file_size = row[1]
    cloud_url = row[2]
    size_mb = file_size / (1024 * 1024)
    
    print(f"  File: {file_path}")
    print(f"  Original size: {size_mb:.2f} MB ({file_size} bytes)")
    print(f"  Cloud URL: {cloud_url}")
    print()

conn.close()

# Check ACCOUNT_2 for the compressed file
s3 = boto3.client(
    's3',
    endpoint_url=os.getenv('ACCOUNT_2_ENDPOINT'),
    aws_access_key_id=os.getenv('ACCOUNT_2_KEY_ID'),
    aws_secret_access_key=os.getenv('ACCOUNT_2_APPLICATION_KEY')
)

response = s3.list_objects_v2(Bucket=os.getenv('ACCOUNT_2_BUCKET'))

print('Recording files in ACCOUNT_2 bucket:')
print('='*60)

for obj in response.get('Contents', []):
    if 'Recording' in obj['Key']:
        size_mb = obj['Size'] / (1024 * 1024)
        print(f"  {obj['Key']}")
        print(f"  Compressed size: {size_mb:.2f} MB ({obj['Size']} bytes)")
