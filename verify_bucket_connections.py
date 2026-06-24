"""
Verify connections to all 3 B2 buckets.
Tests ACCOUNT_1, ACCOUNT_2, and MESH_SYNC_BUCKET credentials.
"""
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def test_bucket_connection(bucket_name, endpoint, key_id, app_key):
    """Test connection to a B2 bucket."""
    print(f"\n{'='*60}")
    print(f"Testing {bucket_name}")
    print(f"{'='*60}")
    print(f"Endpoint: {endpoint}")
    print(f"Key ID: {key_id}")
    print(f"App Key: {app_key}")
    
    if not key_id or not app_key:
        print("❌ FAIL: Credentials not provided")
        return False
    
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=app_key
        )
        
        # Test by listing objects (this will fail if credentials are wrong)
        response = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        object_count = len(response.get('Contents', []))
        
        print(f"✅ SUCCESS: Connected to {bucket_name}")
        print(f"   Objects in bucket: {object_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False

def main():
    print("="*60)
    print("B2 Bucket Connection Verification")
    print("="*60)
    
    # Test ACCOUNT_1 (Heavy Storage)
    account1_success = test_bucket_connection(
        bucket_name=os.getenv("ACCOUNT_1_BUCKET", "lab-heavy-storage"),
        endpoint=os.getenv("ACCOUNT_1_ENDPOINT"),
        key_id=os.getenv("ACCOUNT_1_KEY_ID"),
        app_key=os.getenv("ACCOUNT_1_APPLICATION_KEY")
    )
    
    # Test ACCOUNT_2 (Light Storage)
    account2_success = test_bucket_connection(
        bucket_name=os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage"),
        endpoint=os.getenv("ACCOUNT_2_ENDPOINT"),
        key_id=os.getenv("ACCOUNT_2_KEY_ID"),
        app_key=os.getenv("ACCOUNT_2_APPLICATION_KEY")
    )
    
    # Test MESH_SYNC_BUCKET
    mesh_success = test_bucket_connection(
        bucket_name=os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync"),
        endpoint=os.getenv("MESH_SYNC_ENDPOINT"),
        key_id=os.getenv("MESH_SYNC_KEY_ID"),
        app_key=os.getenv("MESH_SYNC_APPLICATION_KEY")
    )
    
    print(f"\n{'='*60}")
    print("Summary")
    print(f"{'='*60}")
    print(f"ACCOUNT_1 (Heavy Storage): {'✅ OK' if account1_success else '❌ FAIL'}")
    print(f"ACCOUNT_2 (Light Storage): {'✅ OK' if account2_success else '❌ FAIL'}")
    print(f"MESH_SYNC_BUCKET:          {'✅ OK' if mesh_success else '❌ FAIL'}")
    
    all_success = account1_success and account2_success and mesh_success
    print(f"\nOverall: {'✅ All buckets connected successfully' if all_success else '❌ Some buckets failed'}")
    
    return all_success

if __name__ == "__main__":
    main()
