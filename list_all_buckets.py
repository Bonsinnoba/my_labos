"""
List all buckets in the B2 account to verify credentials and endpoints.
"""
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def list_buckets_for_account(account_name, endpoint, key_id, app_key):
    """List all buckets for a given account."""
    print(f"\n{'='*60}")
    print(f"Account: {account_name}")
    print(f"Endpoint: {endpoint}")
    print('='*60)
    
    try:
        client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=app_key
        )
        
        response = client.list_buckets()
        buckets = response.get('Buckets', [])
        
        print(f"  Found {len(buckets)} buckets:")
        for bucket in buckets:
            print(f"    - {bucket['Name']} (Created: {bucket['CreationDate']})")
            
            # Get bucket info
            try:
                location = client.get_bucket_location(Bucket=bucket['Name'])
                print(f"      Location: {location.get('LocationConstraint', 'us-east-1')}")
            except Exception as e:
                print(f"      Location: Error - {e}")
        
        return buckets
        
    except Exception as e:
        print(f"  ERROR: {e}")
        return []

# Try all three accounts
account1_buckets = list_buckets_for_account(
    "Account 1 (Heavy Storage)",
    os.getenv('ACCOUNT_1_ENDPOINT'),
    os.getenv('ACCOUNT_1_KEY_ID'),
    os.getenv('ACCOUNT_1_APPLICATION_KEY')
)

account2_buckets = list_buckets_for_account(
    "Account 2 (Light Storage)",
    os.getenv('ACCOUNT_2_ENDPOINT'),
    os.getenv('ACCOUNT_2_KEY_ID'),
    os.getenv('ACCOUNT_2_APPLICATION_KEY')
)

mesh_buckets = list_buckets_for_account(
    "Mesh Sync",
    os.getenv('MESH_SYNC_ENDPOINT'),
    os.getenv('MESH_SYNC_KEY_ID'),
    os.getenv('MESH_SYNC_APPLICATION_KEY')
)

print(f"\n{'='*60}")
print("Summary")
print('='*60)
print(f"  Account 1 buckets: {len(account1_buckets)}")
print(f"  Account 2 buckets: {len(account2_buckets)}")
print(f"  Mesh Sync buckets: {len(mesh_buckets)}")
