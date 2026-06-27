import os
from pathlib import Path
from dotenv import load_dotenv
import boto3

load_dotenv(Path(r"C:\Users\balik\Iven\my_lab\.env"))

# Test version-aware deletion
file_to_delete = "20260623_175856_1782237536_Recording 2026-06-23 175830.mp4"

print(f"Testing version-aware deletion of: {file_to_delete}")

# Account #1
client1 = boto3.client(
    "s3",
    endpoint_url="https://s3.eu-central-003.backblazeb2.com",
    aws_access_key_id=os.getenv("ACCOUNT_1_KEY_ID"),
    aws_secret_access_key=os.getenv("ACCOUNT_1_APPLICATION_KEY"),
)

bucket = "lab-heavy-storage"
key = file_to_delete

print(f"\nListing versions for {key} in {bucket}...")
versions = []
try:
    paginator = client1.get_paginator('list_object_versions')
    for page in paginator.paginate(Bucket=bucket, Prefix=key):
        for version in page.get('Versions', []):
            if version['Key'] == key:
                versions.append(version['VersionId'])
                print(f"  Found version: {version['VersionId']}")
        for marker in page.get('DeleteMarkers', []):
            if marker['Key'] == key:
                versions.append(marker['VersionId'])
                print(f"  Found delete marker: {marker['VersionId']}")
except Exception as e:
    print(f"Error listing versions: {e}")

if versions:
    print(f"\nDeleting {len(versions)} version(s)...")
    for version_id in versions:
        try:
            response = client1.delete_object(Bucket=bucket, Key=key, VersionId=version_id)
            print(f"  Deleted version {version_id}: {response.get('ResponseMetadata', {}).get('HTTPStatusCode')}")
        except Exception as e:
            print(f"  Failed to delete version {version_id}: {e}")
else:
    print("No versions found")
