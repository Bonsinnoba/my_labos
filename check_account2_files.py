"""
Check files in ACCOUNT_2 bucket to identify what's being uploaded.
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

print('Files in ACCOUNT_2 bucket:')
print('='*60)
for obj in response.get('Contents', []):
    print(f"  {obj['Key']}: {obj['Size']} bytes")
