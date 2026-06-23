import os
import boto3
from dotenv import load_dotenv

load_dotenv()

# Account #2 (Light Storage)
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

print(f"Listing files in {bucket_name}...")
print()

try:
    response = s3.list_objects_v2(Bucket=bucket_name)
    
    if 'Contents' in response:
        files = response['Contents']
        print(f"Total files: {len(files)}")
        print(f"Total size: {sum(f['Size'] for f in files) / 1024 / 1024:.2f} MB")
        print()
        print("First 20 files:")
        for f in files[:20]:
            print(f"  {f['Key']} ({f['Size']} bytes)")
        
        if len(files) > 20:
            print(f"... and {len(files) - 20} more")
    else:
        print("Bucket is empty")
        
except Exception as e:
    print(f"Error: {e}")

# Also check Account #1 (Heavy Storage)
heavy_bucket = os.getenv("ACCOUNT_1_BUCKET")
if heavy_bucket:
    print(f"\n" + "="*60)
    print(f"Checking heavy storage bucket: {heavy_bucket}")
    print("="*60)
    
    try:
        response = s3.list_objects_v2(Bucket=heavy_bucket)
        
        if 'Contents' in response:
            files = response['Contents']
            print(f"Total files: {len(files)}")
            print(f"Total size: {sum(f['Size'] for f in files) / 1024 / 1024:.2f} MB")
            print()
            print("First 20 files:")
            for f in files[:20]:
                print(f"  {f['Key']} ({f['Size']} bytes)")
            
            if len(files) > 20:
                print(f"... and {len(files) - 20} more")
        else:
            print("Bucket is empty")
            
    except Exception as e:
        print(f"Error: {e}")

# List all buckets
print(f"\n" + "="*60)
print("Listing all buckets accessible with these credentials")
print("="*60)
try:
    buckets = s3.list_buckets()
    for bucket in buckets['Buckets']:
        print(f"  {bucket['Name']}")
except Exception as e:
    print(f"Error listing buckets: {e}")
