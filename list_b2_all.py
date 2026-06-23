import os
import boto3
from dotenv import load_dotenv

load_dotenv()

endpoint_url = os.getenv("MESH_SYNC_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
access_key = os.getenv("MESH_SYNC_KEY_ID")
secret_key = os.getenv("MESH_SYNC_APPLICATION_KEY")
bucket_name = os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync")

s3 = boto3.client(
    's3',
    endpoint_url=endpoint_url,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key
)

print(f"Bucket: {bucket_name}")
print(f"Endpoint: {endpoint_url}")
print()

# Try to list with different approaches
print("Method 1: list_objects_v2 (no prefix)")
try:
    response = s3.list_objects_v2(Bucket=bucket_name)
    if 'Contents' in response:
        files = response['Contents']
        print(f"  Found {len(files)} files")
        for f in files[:10]:
            print(f"    {f['Key']} ({f['Size']} bytes)")
    else:
        print("  No files found")
except Exception as e:
    print(f"  Error: {e}")

print("\nMethod 2: list_objects_v2 (with empty prefix)")
try:
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix='')
    if 'Contents' in response:
        files = response['Contents']
        print(f"  Found {len(files)} files")
        for f in files[:10]:
            print(f"    {f['Key']} ({f['Size']} bytes)")
    else:
        print("  No files found")
except Exception as e:
    print(f"  Error: {e}")

print("\nMethod 3: list_objects (deprecated)")
try:
    response = s3.list_objects(Bucket=bucket_name)
    if 'Contents' in response:
        files = response['Contents']
        print(f"  Found {len(files)} files")
        for f in files[:10]:
            print(f"    {f['Key']} ({f['Size']} bytes)")
    else:
        print("  No files found")
except Exception as e:
    print(f"  Error: {e}")

print("\nMethod 4: Check bucket exists")
try:
    s3.head_bucket(Bucket=bucket_name)
    print(f"  Bucket exists and is accessible")
except Exception as e:
    print(f"  Error: {e}")
