"""
Check for files over 50MB in ACCOUNT_2 bucket (should be in ACCOUNT_1).
"""
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

s3 = boto3.client(
    's3',
    endpoint_url=os.getenv('ACCOUNT_2_ENDPOINT'),
    aws_access_key_id=os.getenv('ACCOUNT_2_KEY_ID'),
    aws_secret_access_key=os.getenv('ACCOUNT_2_APPLICATION_KEY')
)

response = s3.list_objects_v2(Bucket=os.getenv('ACCOUNT_2_BUCKET'))

print('Files in ACCOUNT_2 bucket (Light Storage):')
print('='*60)

threshold = 50 * 1024 * 1024  # 50MB
large_files = []

for obj in response.get('Contents', []):
    size_mb = obj['Size'] / (1024 * 1024)
    print(f"  {obj['Key']}: {size_mb:.2f} MB ({obj['Size']} bytes)")
    
    if obj['Size'] >= threshold:
        large_files.append(obj)

print(f'\n{"="*60}')
print(f'Files >= 50MB in ACCOUNT_2 (should be in ACCOUNT_1):')
print(f'{"="*60}')

if large_files:
    for obj in large_files:
        size_mb = obj['Size'] / (1024 * 1024)
        print(f"  {obj['Key']}: {size_mb:.2f} MB")
else:
    print('  (none found)')
