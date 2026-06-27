import os
from pathlib import Path
from dotenv import load_dotenv
import boto3

load_dotenv(Path(r"C:\Users\balik\Iven\my_lab\.env"))

# Test direct deletion
file_to_delete = "20260623_175856_1782237536_Recording 2026-06-23 175830.mp4"

print(f"Testing deletion of: {file_to_delete}")

# Try Account #1
client1 = boto3.client(
    "s3",
    endpoint_url="https://s3.eu-central-003.backblazeb2.com",
    aws_access_key_id=os.getenv("ACCOUNT_1_KEY_ID"),
    aws_secret_access_key=os.getenv("ACCOUNT_1_APPLICATION_KEY"),
)

try:
    response = client1.delete_object(
        Bucket="lab-heavy-storage",
        Key=file_to_delete
    )
    print(f"Account #1 deletion response: {response}")
except Exception as e:
    print(f"Account #1 deletion error: {e}")

# Check if file still exists
try:
    response = client1.head_object(Bucket="lab-heavy-storage", Key=file_to_delete)
    print(f"File still exists in Account #1: {response}")
except Exception as e:
    print(f"File not found in Account #1 (expected): {e}")

# Try Account #2
client2 = boto3.client(
    "s3",
    endpoint_url="https://s3.eu-central-003.backblazeb2.com",
    aws_access_key_id=os.getenv("ACCOUNT_2_KEY_ID"),
    aws_secret_access_key=os.getenv("ACCOUNT_2_APPLICATION_KEY"),
)

try:
    response = client2.delete_object(
        Bucket="lab-light-storage",
        Key=file_to_delete
    )
    print(f"Account #2 deletion response: {response}")
except Exception as e:
    print(f"Account #2 deletion error: {e}")

# Check if file still exists
try:
    response = client2.head_object(Bucket="lab-light-storage", Key=file_to_delete)
    print(f"File still exists in Account #2: {response}")
except Exception as e:
    print(f"File not found in Account #2 (expected): {e}")
