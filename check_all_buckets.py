import os
import boto3
from dotenv import load_dotenv

load_dotenv()

# Check Account #1 (Heavy Storage)
print("="*60)
print("Account #1 (Heavy Storage)")
print("="*60)
endpoint1 = os.getenv("ACCOUNT_1_ENDPOINT")
key1 = os.getenv("ACCOUNT_1_KEY_ID")
secret1 = os.getenv("ACCOUNT_1_APPLICATION_KEY")
bucket1 = os.getenv("ACCOUNT_1_BUCKET")

if key1 and secret1 and bucket1:
    s3_1 = boto3.client(
        's3',
        endpoint_url=endpoint1,
        aws_access_key_id=key1,
        aws_secret_access_key=secret1
    )
    
    try:
        response = s3_1.list_objects_v2(Bucket=bucket1)
        
        if 'Contents' in response:
            files = response['Contents']
            print(f"Bucket: {bucket1}")
            print(f"Total files: {len(files)}")
            print(f"Total size: {sum(f['Size'] for f in files) / 1024 / 1024:.2f} MB")
            print()
            print("First 20 files:")
            for f in files[:20]:
                print(f"  {f['Key']} ({f['Size']} bytes)")
            
            if len(files) > 20:
                print(f"... and {len(files) - 20} more")
        else:
            print(f"Bucket {bucket1} is empty")
            
    except Exception as e:
        print(f"Error accessing {bucket1}: {e}")
else:
    print("Account #1 credentials not configured")

# Check Account #2 (Light Storage)
print("\n" + "="*60)
print("Account #2 (Light Storage)")
print("="*60)
endpoint2 = os.getenv("ACCOUNT_2_ENDPOINT")
key2 = os.getenv("ACCOUNT_2_KEY_ID")
secret2 = os.getenv("ACCOUNT_2_APPLICATION_KEY")
bucket2 = os.getenv("ACCOUNT_2_BUCKET")

if key2 and secret2 and bucket2:
    s3_2 = boto3.client(
        's3',
        endpoint_url=endpoint2,
        aws_access_key_id=key2,
        aws_secret_access_key=secret2
    )
    
    try:
        response = s3_2.list_objects_v2(Bucket=bucket2)
        
        if 'Contents' in response:
            files = response['Contents']
            print(f"Bucket: {bucket2}")
            print(f"Total files: {len(files)}")
            print(f"Total size: {sum(f['Size'] for f in files) / 1024 / 1024:.2f} MB")
            print()
            print("First 20 files:")
            for f in files[:20]:
                print(f"  {f['Key']} ({f['Size']} bytes)")
            
            if len(files) > 20:
                print(f"... and {len(files) - 20} more")
        else:
            print(f"Bucket {bucket2} is empty")
            
    except Exception as e:
        print(f"Error accessing {bucket2}: {e}")
else:
    print("Account #2 credentials not configured")

# Check Mesh Sync bucket
print("\n" + "="*60)
print("Mesh Sync Bucket")
print("="*60)
endpoint_mesh = os.getenv("MESH_SYNC_ENDPOINT")
key_mesh = os.getenv("MESH_SYNC_KEY_ID")
secret_mesh = os.getenv("MESH_SYNC_APPLICATION_KEY")
bucket_mesh = os.getenv("MESH_SYNC_BUCKET")

if key_mesh and secret_mesh and bucket_mesh:
    s3_mesh = boto3.client(
        's3',
        endpoint_url=endpoint_mesh,
        aws_access_key_id=key_mesh,
        aws_secret_access_key=secret_mesh
    )
    
    try:
        response = s3_mesh.list_objects_v2(Bucket=bucket_mesh)
        
        if 'Contents' in response:
            files = response['Contents']
            print(f"Bucket: {bucket_mesh}")
            print(f"Total files: {len(files)}")
            print(f"Total size: {sum(f['Size'] for f in files) / 1024 / 1024:.2f} MB")
            print()
            print("First 20 files:")
            for f in files[:20]:
                print(f"  {f['Key']} ({f['Size']} bytes)")
            
            if len(files) > 20:
                print(f"... and {len(files) - 20} more")
        else:
            print(f"Bucket {bucket_mesh} is empty")
            
    except Exception as e:
        print(f"Error accessing {bucket_mesh}: {e}")
else:
    print("Mesh sync credentials not configured")
