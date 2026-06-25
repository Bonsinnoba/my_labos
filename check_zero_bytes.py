"""
Check for 0-byte files in ACCOUNT_2 bucket.
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

print('0-byte files in ACCOUNT_2 bucket:')
print('='*60)
zero_byte_files = [obj for obj in response.get('Contents', []) if obj['Size'] == 0]
if zero_byte_files:
    for obj in zero_byte_files:
        print(f"  {obj['Key']}: {obj['Size']} bytes")
else:
    print('  (none found)')

print(f'\nTotal files: {len(response.get("Contents", []))}')
print(f'Zero-byte files: {len(zero_byte_files)}')
