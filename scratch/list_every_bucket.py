import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def list_every_bucket_contents():
    # Account 1
    print("="*60)
    print("Listing ALL buckets & keys for Account 1:")
    endpoint1 = os.getenv("ACCOUNT_1_ENDPOINT")
    key1 = os.getenv("ACCOUNT_1_KEY_ID")
    secret1 = os.getenv("ACCOUNT_1_APPLICATION_KEY")
    if key1 and secret1:
        try:
            s3 = boto3.client('s3', endpoint_url=endpoint1, aws_access_key_id=key1, aws_secret_access_key=secret1)
            buckets = s3.list_buckets()
            for b in buckets.get('Buckets', []):
                b_name = b['Name']
                print(f"Bucket: {b_name}")
                try:
                    resp = s3.list_objects_v2(Bucket=b_name)
                    if 'Contents' in resp:
                        for obj in resp['Contents']:
                            print(f"  {obj['Key']} ({obj['Size']} bytes)")
                    else:
                        print("  (empty)")
                except Exception as ex:
                    print(f"  Error listing bucket {b_name}: {ex}")
        except Exception as e:
            print(f"Error accessing Account 1: {e}")
    else:
        print("Account 1 not configured")

    # Account 2
    print("\n" + "="*60)
    print("Listing ALL buckets & keys for Account 2:")
    endpoint2 = os.getenv("ACCOUNT_2_ENDPOINT")
    key2 = os.getenv("ACCOUNT_2_KEY_ID")
    secret2 = os.getenv("ACCOUNT_2_APPLICATION_KEY")
    if key2 and secret2:
        try:
            s3 = boto3.client('s3', endpoint_url=endpoint2, aws_access_key_id=key2, aws_secret_access_key=secret2)
            buckets = s3.list_buckets()
            for b in buckets.get('Buckets', []):
                b_name = b['Name']
                print(f"Bucket: {b_name}")
                try:
                    resp = s3.list_objects_v2(Bucket=b_name)
                    if 'Contents' in resp:
                        for obj in resp['Contents']:
                            print(f"  {obj['Key']} ({obj['Size']} bytes)")
                    else:
                        print("  (empty)")
                except Exception as ex:
                    print(f"  Error listing bucket {b_name}: {ex}")
        except Exception as e:
            print(f"Error accessing Account 2: {e}")
    else:
        print("Account 2 not configured")

    # Mesh Sync
    print("\n" + "="*60)
    print("Listing ALL buckets & keys for Mesh Sync:")
    endpoint_mesh = os.getenv("MESH_SYNC_ENDPOINT")
    key_mesh = os.getenv("MESH_SYNC_KEY_ID")
    secret_mesh = os.getenv("MESH_SYNC_APPLICATION_KEY")
    if key_mesh and secret_mesh:
        try:
            s3 = boto3.client('s3', endpoint_url=endpoint_mesh, aws_access_key_id=key_mesh, aws_secret_access_key=secret_mesh)
            buckets = s3.list_buckets()
            for b in buckets.get('Buckets', []):
                b_name = b['Name']
                print(f"Bucket: {b_name}")
                try:
                    resp = s3.list_objects_v2(Bucket=b_name)
                    if 'Contents' in resp:
                        for obj in resp['Contents']:
                            print(f"  {obj['Key']} ({obj['Size']} bytes)")
                    else:
                        print("  (empty)")
                except Exception as ex:
                    print(f"  Error listing bucket {b_name}: {ex}")
        except Exception as e:
            print(f"Error accessing Mesh Sync: {e}")
    else:
        print("Mesh Sync not configured")

if __name__ == '__main__':
    list_every_bucket_contents()
