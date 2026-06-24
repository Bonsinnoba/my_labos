"""
Clean up 0-byte files from B2 light storage bucket.
These are failed uploads that should be deleted.
"""
import os
import boto3
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# B2 credentials
ENDPOINT = os.getenv("ACCOUNT_2_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
KEY_ID = os.getenv("ACCOUNT_2_KEY_ID")
APPLICATION_KEY = os.getenv("ACCOUNT_2_APPLICATION_KEY")
BUCKET = os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage")

# Files to delete (from B2 bucket)
FILES_TO_DELETE = [
    "20260623_090000_1782175834_document_29.png",
    "20260623_090000_1782175845_Screenshot 2026-06-22 193103.png",
    "20260623_090000_1782176050_Screenshot 2026-06-22 193103.png",
    "20260623_090000_1782176382_Screenshot 2026-06-22 193103.png",
    "20260623_090000_1782176232_Screenshot 2026-06-22 210231.png",
    "20260623_090000_1782176389_Screenshot 2026-06-22 200256.png",
    "20260623_090000_1782176584_Screenshot 2026-06-22 204442.png",
]

def delete_files():
    """Delete the 0-byte files from B2."""
    if not KEY_ID or not APPLICATION_KEY:
        print("Error: ACCOUNT_2_KEY_ID and ACCOUNT_2_APPLICATION_KEY must be set")
        return
    
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=ENDPOINT,
            aws_access_key_id=KEY_ID,
            aws_secret_access_key=APPLICATION_KEY
        )
        
        print(f"Connecting to B2: {BUCKET}")
        
        deleted_count = 0
        failed_count = 0
        
        for file_name in FILES_TO_DELETE:
            try:
                s3.delete_object(Bucket=BUCKET, Key=file_name)
                print(f"Deleted: {file_name}")
                deleted_count += 1
            except s3.exceptions.NoSuchKey:
                print(f"Not found (already deleted): {file_name}")
                deleted_count += 1
            except ClientError as e:
                print(f"Failed to delete {file_name}: {e}")
                failed_count += 1
        
        print(f"\nSummary: {deleted_count} deleted, {failed_count} failed")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    delete_files()
