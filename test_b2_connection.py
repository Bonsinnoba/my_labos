import boto3
import os
from pathlib import Path
from botocore.exceptions import ClientError

# Load .env file manually
env_file = Path(r"C:\Users\balik\Iven\my_lab\.env")
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()
    print("Loaded .env file")

configs = [
    {
        "name": "Account #1 Heavy",
        "endpoint": "https://s3.eu-central-003.backblazeb2.com",
        "bucket": "lab-heavy-storage",
        "key_id": os.getenv("ACCOUNT_1_KEY_ID", ""),
        "app_key": os.getenv("ACCOUNT_1_APPLICATION_KEY", ""),
    },
    {
        "name": "Account #2 Light",
        "endpoint": "https://s3.eu-central-003.backblazeb2.com",
        "bucket": "lab-light-storage",
        "key_id": os.getenv("ACCOUNT_2_KEY_ID", ""),
        "app_key": os.getenv("ACCOUNT_2_APPLICATION_KEY", ""),
    },
]

for cfg in configs:
    print(f"\nTesting {cfg['name']}...")
    
    if not cfg["key_id"] or not cfg["app_key"]:
        print(f"  SKIP - credentials not set")
        continue
    
    client = boto3.client(
        "s3",
        endpoint_url=cfg["endpoint"],
        aws_access_key_id=cfg["key_id"],
        aws_secret_access_key=cfg["app_key"],
    )
    
    try:
        client.head_bucket(Bucket=cfg["bucket"])
        print(f"  OK - bucket accessible")
    except ClientError as e:
        print(f"  FAIL - {e.response['Error']['Code']}: {e.response['Error']['Message']}")
    
    # Also test listing
    try:
        resp = client.list_objects_v2(Bucket=cfg["bucket"], MaxKeys=1)
        print(f"  OK - list works, prefix sample: {[o['Key'] for o in resp.get('Contents', [])]}")
    except ClientError as e:
        print(f"  FAIL list - {e.response['Error']['Code']}")
