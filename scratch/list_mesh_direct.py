import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def list_mesh_sync_objects():
    endpoint = os.getenv("MESH_SYNC_ENDPOINT")
    key = os.getenv("MESH_SYNC_KEY_ID")
    secret = os.getenv("MESH_SYNC_APPLICATION_KEY")
    bucket = os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync")
    
    print(f"Listing objects in {bucket} using MESH_SYNC credentials:")
    try:
        s3 = boto3.client('s3', endpoint_url=endpoint, aws_access_key_id=key, aws_secret_access_key=secret)
        resp = s3.list_objects_v2(Bucket=bucket)
        if 'Contents' in resp:
            print(f"Total files in {bucket}: {len(resp['Contents'])}")
            for obj in resp['Contents']:
                print(f"  {obj['Key']} ({obj['Size']} bytes)")
        else:
            print(f"  No objects found in {bucket} (empty)")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == '__main__':
    list_mesh_sync_objects()
