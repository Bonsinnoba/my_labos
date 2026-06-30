"""
Sync Backblaze JSON data to Supabase
This script reads JSON files from Backblaze B2 buckets and imports to Supabase
"""
import os
import boto3
import json
from supabase import create_client
import uuid

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Backblaze Account 1 (Heavy Storage)
ACCOUNT_1_ENDPOINT = os.getenv("ACCOUNT_1_ENDPOINT")
ACCOUNT_1_KEY_ID = os.getenv("ACCOUNT_1_KEY_ID")
ACCOUNT_1_APPLICATION_KEY = os.getenv("ACCOUNT_1_APPLICATION_KEY")
ACCOUNT_1_BUCKET = os.getenv("ACCOUNT_1_BUCKET")

# Backblaze Account 2 (Light Storage)
ACCOUNT_2_ENDPOINT = os.getenv("ACCOUNT_2_ENDPOINT")
ACCOUNT_2_KEY_ID = os.getenv("ACCOUNT_2_KEY_ID")
ACCOUNT_2_APPLICATION_KEY = os.getenv("ACCOUNT_2_APPLICATION_KEY")
ACCOUNT_2_BUCKET = os.getenv("ACCOUNT_2_BUCKET")

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return
    
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Initialize Backblaze S3 clients
    s3_client1 = None
    s3_client2 = None
    
    if ACCOUNT_1_KEY_ID and ACCOUNT_1_APPLICATION_KEY:
        s3_client1 = boto3.client(
            's3',
            endpoint_url=ACCOUNT_1_ENDPOINT,
            aws_access_key_id=ACCOUNT_1_KEY_ID,
            aws_secret_access_key=ACCOUNT_1_APPLICATION_KEY
        )
        print(f"Connected to Backblaze Account 1: {ACCOUNT_1_BUCKET}")
    
    if ACCOUNT_2_KEY_ID and ACCOUNT_2_APPLICATION_KEY:
        s3_client2 = boto3.client(
            's3',
            endpoint_url=ACCOUNT_2_ENDPOINT,
            aws_access_key_id=ACCOUNT_2_KEY_ID,
            aws_secret_access_key=ACCOUNT_2_APPLICATION_KEY
        )
        print(f"Connected to Backblaze Account 2: {ACCOUNT_2_BUCKET}")
    
    print("Syncing from Backblaze to Supabase...")
    
    # Function to sync from a bucket
    def sync_from_bucket(s3_client, bucket_name):
        if not s3_client:
            return
        
        print(f"\nScanning bucket: {bucket_name}")
        try:
            # List all objects in the bucket
            response = s3_client.list_objects_v2(Bucket=bucket_name)
            
            if 'Contents' not in response:
                print(f"  No files found in {bucket_name}")
                return
            
            for obj in response['Contents']:
                key = obj['Key']
                print(f"  Processing: {key}")
                
                # Only process JSON files
                if not key.endswith('.json'):
                    print(f"    Skipping (not JSON)")
                    continue
                
                try:
                    # Download and parse JSON
                    obj_data = s3_client.get_object(Bucket=bucket_name, Key=key)
                    data = json.loads(obj_data['Body'].read().decode('utf-8'))
                    
                    # Determine Supabase table based on file name or structure
                    if 'projects' in key.lower() or isinstance(data, list) and len(data) > 0 and 'name' in data[0]:
                        table = 'projects'
                    elif 'experiments' in key.lower() or 'rd_logs' in key.lower():
                        table = 'experiments'
                    elif 'knowledge' in key.lower() or 'vault' in key.lower():
                        table = 'knowledge_vault'
                    elif 'findings' in key.lower():
                        table = 'findings'
                    else:
                        print(f"    Skipping (unknown table)")
                        continue
                    
                    # Insert into Supabase
                    if isinstance(data, list):
                        for item in data:
                            item['id'] = str(uuid.uuid4())  # Generate UUID
                            try:
                                supabase.table(table).insert(item).execute()
                                print(f"    Inserted into {table}")
                            except Exception as e:
                                print(f"    Error inserting: {e}")
                    else:
                        data['id'] = str(uuid.uuid4())
                        try:
                            supabase.table(table).insert(data).execute()
                            print(f"    Inserted into {table}")
                        except Exception as e:
                            print(f"    Error inserting: {e}")
                            
                except Exception as e:
                    print(f"    Error processing {key}: {e}")
                    
        except Exception as e:
            print(f"  Error scanning bucket {bucket_name}: {e}")
    
    # Sync from both buckets
    sync_from_bucket(s3_client1, ACCOUNT_1_BUCKET)
    sync_from_bucket(s3_client2, ACCOUNT_2_BUCKET)
    
    print("\nSync complete!")

if __name__ == "__main__":
    main()
