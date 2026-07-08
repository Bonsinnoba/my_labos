"""
Download all missing files from B2 to local knowledge_vault
"""
import os
import gzip
import sys
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

load_dotenv()

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase

def download_file_from_b2(cloud_url: str, local_path: str) -> bool:
    """Download a file from B2 cloud storage."""
    try:
        # Parse the cloud URL to get bucket and key
        # URL format: https://s3.eu-central-003.backblazeb2.com/bucket-name/key.gz
        parts = cloud_url.replace('https://', '').split('/')
        bucket = parts[1]
        key = '/'.join(parts[2:])
        
        # Determine which account credentials to use based on bucket
        if bucket == 'lab-heavy-storage':
            endpoint = os.getenv('ACCOUNT_1_ENDPOINT', 'https://s3.eu-central-003.backblazeb2.com')
            key_id = os.getenv('ACCOUNT_1_KEY_ID')
            app_key = os.getenv('ACCOUNT_1_APPLICATION_KEY')
        else:
            endpoint = os.getenv('ACCOUNT_2_ENDPOINT', 'https://s3.eu-central-003.backblazeb2.com')
            key_id = os.getenv('ACCOUNT_2_KEY_ID')
            app_key = os.getenv('ACCOUNT_2_APPLICATION_KEY')
        
        if not key_id or not app_key:
            print(f"  [ERROR] Missing credentials for bucket {bucket}")
            return False
        
        # Create S3 client
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=app_key
        )
        
        # Download the file
        print(f"  [DOWNLOAD] Downloading {key} from {bucket}")
        response = s3.get_object(Bucket=bucket, Key=key)
        data = response['Body'].read()
        
        # Try to decompress if .gz
        if key.endswith('.gz'):
            try:
                data = gzip.decompress(data)
                print(f"  [DECOMPRESS] Decompressed {len(response['Body'].read()) if False else len(data)} bytes")
            except gzip.BadGzipFile:
                print(f"  [WARN] Not a valid gzip file, using raw data")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Write to local file
        with open(local_path, 'wb') as f:
            f.write(data)
        
        print(f"  [SUCCESS] Saved to {local_path}")
        return True
        
    except ClientError as e:
        print(f"  [ERROR] B2 download error: {e}")
        return False
    except Exception as e:
        print(f"  [ERROR] Download failed: {e}")
        return False

def main():
    db_path = Path(__file__).parent.parent / "local_cache.db"
    print(f"Using database: {db_path}")
    
    # Use the parent directory as the base for knowledge_vault
    base_dir = Path(__file__).parent.parent
    
    db = CacheDatabase(db_path=str(db_path))
    docs = db.get_all_documents()
    
    print(f"Total documents: {len(docs)}")
    
    missing_count = 0
    downloaded_count = 0
    
    for doc in docs:
        file_path = doc.get('file_path')
        cloud_url = doc.get('cloud_file_url')
        
        if not file_path:
            continue
        
        # Use base directory for absolute path
        abs_file_path = base_dir / file_path
        
        # Check if file exists locally
        if not os.path.exists(abs_file_path):
            missing_count += 1
            print(f"\n[{doc['id']}] Missing: {file_path}")
            
            if cloud_url:
                success = download_file_from_b2(cloud_url, str(abs_file_path))
                if success:
                    downloaded_count += 1
            else:
                print("  [SKIP] No cloud URL available")
    
    print(f"\n=== Summary ===")
    print(f"Missing files: {missing_count}")
    print(f"Successfully downloaded: {downloaded_count}")
    print(f"Failed: {missing_count - downloaded_count}")
    
    db.close()

if __name__ == "__main__":
    main()
