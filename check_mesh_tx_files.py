"""
Check for mesh_tx_ files in ACCOUNT_2 bucket (these should only be in MESH_SYNC_BUCKET).
"""
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

# Check ACCOUNT_2 for mesh_tx_ files
s3_account2 = boto3.client(
    's3',
    endpoint_url=os.getenv('ACCOUNT_2_ENDPOINT'),
    aws_access_key_id=os.getenv('ACCOUNT_2_KEY_ID'),
    aws_secret_access_key=os.getenv('ACCOUNT_2_APPLICATION_KEY')
)

response = s3_account2.list_objects_v2(Bucket=os.getenv('ACCOUNT_2_BUCKET'))

print('Mesh transaction files in ACCOUNT_2 bucket (should be NONE):')
print('='*60)
mesh_tx_files = [obj for obj in response.get('Contents', []) if obj['Key'].startswith('mesh_tx_')]
if mesh_tx_files:
    for obj in mesh_tx_files:
        print(f"  {obj['Key']}: {obj['Size']} bytes")
else:
    print('  (none found - correct)')

# Check MESH_SYNC_BUCKET for mesh_tx_ files
s3_mesh = boto3.client(
    's3',
    endpoint_url=os.getenv('MESH_SYNC_ENDPOINT'),
    aws_access_key_id=os.getenv('MESH_SYNC_KEY_ID'),
    aws_secret_access_key=os.getenv('MESH_SYNC_APPLICATION_KEY')
)

response = s3_mesh.list_objects_v2(Bucket=os.getenv('MESH_SYNC_BUCKET'))

print('\nMesh transaction files in MESH_SYNC_BUCKET:')
print('='*60)
mesh_tx_files = [obj for obj in response.get('Contents', []) if obj['Key'].startswith('mesh_tx_')]
if mesh_tx_files:
    for obj in mesh_tx_files:
        print(f"  {obj['Key']}: {obj['Size']} bytes")
else:
    print('  (none found)')
