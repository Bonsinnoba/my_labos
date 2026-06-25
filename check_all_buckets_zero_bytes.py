"""
Check all 3 buckets for 0-byte files.
"""
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def check_bucket(bucket_name, endpoint, key_id, app_key):
    """Check a bucket for 0-byte files."""
    print(f"\n{'='*60}")
    print(f"Checking {bucket_name}")
    print(f"{'='*60}")
    
    s3 = boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=app_key
    )
    
    response = s3.list_objects_v2(Bucket=bucket_name)
    
    zero_byte_files = [obj for obj in response.get('Contents', []) if obj['Size'] == 0]
    all_files = response.get('Contents', [])
    
    print(f"Total files: {len(all_files)}")
    print(f"0-byte files: {len(zero_byte_files)}")
    
    if zero_byte_files:
        print("\n0-byte files:")
        for obj in zero_byte_files:
            print(f"  {obj['Key']}: {obj['Size']} bytes")
    else:
        print("(no 0-byte files)")
    
    return zero_byte_files

# Check all 3 buckets
check_bucket(
    os.getenv("ACCOUNT_1_BUCKET", "lab-heavy-storage"),
    os.getenv("ACCOUNT_1_ENDPOINT"),
    os.getenv("ACCOUNT_1_KEY_ID"),
    os.getenv("ACCOUNT_1_APPLICATION_KEY")
)

check_bucket(
    os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage"),
    os.getenv("ACCOUNT_2_ENDPOINT"),
    os.getenv("ACCOUNT_2_KEY_ID"),
    os.getenv("ACCOUNT_2_APPLICATION_KEY")
)

check_bucket(
    os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync"),
    os.getenv("MESH_SYNC_ENDPOINT"),
    os.getenv("MESH_SYNC_KEY_ID"),
    os.getenv("MESH_SYNC_APPLICATION_KEY")
)
