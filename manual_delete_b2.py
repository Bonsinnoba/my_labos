import os
import boto3
from dotenv import load_dotenv

load_dotenv()

# Account #2 (Light Storage) - where most files should be
endpoint_url = os.getenv("MESH_SYNC_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
access_key = os.getenv("MESH_SYNC_KEY_ID")
secret_key = os.getenv("MESH_SYNC_APPLICATION_KEY")
bucket_name = os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync")

s3 = boto3.client(
    's3',
    endpoint_url=endpoint_url,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key
)

files_to_delete = [
    "20260609_061022_1780985422_Screenshot 2026-06-09 004335.png",
    "20260609_053451_1780983291_Screenshot 2026-06-08 230008.png",
    "20260619_045159_1781844719_af9fdcc5a3407265625ea04c85961978.jpg",
    "20260619_052425_1781846665_51f441bee0d58d95ead8a271f1e65ca1.jpg",
    "20260622_133327_1782135207_Gemini_Generated_Image_fzh0pofzh0pofzh0.png",
    "20260622_134535_1782135934_Gemini_Generated_Image_f0zezhf0zezhf0ze.png",
    "20260622_123438_1782131678_Gemini_Generated_Image_gh7a4mgh7a4mgh7a.png",
    "20260622_133933_1782135573_test_upload.txt",
    "20260622_121447_1782130487_test_upload.txt",
    "20260619_053149_1781847109_Screenshot 2026-06-19 022209.png",
    "20260622_143517_1782138917_Gemini_Generated_Image_gh7a4mgh7a4mgh7a.png",
    "20260622_142401_1782138241_Gemini_Generated_Image_fzh0pofzh0pofzh0.png",
    "20260622_143528_1782138928_Screenshot 2026-06-21 204327.png",
    "20260622_143554_1782138954_Gemini_Generated_Image_smuxdesmuxdesmux.png",
    "20260622_143607_1782138967_Gemini_Generated_Image_7xdcfg7xdcfg7xdc.png",
    "20260619_055831_1781848627_Recording 2026-05-26 211402.mp4",
    "20260623_085646_1782205006_document_29.png",
    "20260623_085618_1782204978_Screenshot 2026-06-22 204442.png",
    "20260623_090000_1782203017_upload_1782203017020_Screenshot 2026-06-22 205936.png",
    "20260623_090000_1782203234_upload_1782203233887_Gemini_Generated_Image_w5djpuw5djpuw5dj.png",
    "20260623_090000_1782176773_Screenshot 2026-06-22 193103.png",
    "20260623_090000_1782199832_Screenshot 2026-06-22 204442.png",
    "20260623_090000_1782177387_Screenshot 2026-06-22 200256.png",
    "20260623_090000_1782176469_Screenshot 2026-06-22 205936.png",
    "20260623_085705_1782205025_Screenshot 2026-06-21 204327.png",
    "20260623_090000_1782176708_Screenshot 2026-06-22 204442.png",
    "20260623_085959_1782173289_document_29.png",
    "20260623_090000_1782173716_Screenshot 2026-06-21 204327.png",
    "20260623_090000_1782175240_Screenshot 2026-06-22 193103.png",
    "20260623_090000_1782175472_Screenshot 2026-06-22 204442.png",
    "20260623_090000_1782175489_Screenshot 2026-06-22 200256.png",
    "20260623_090000_1782175640_Screenshot 2026-06-22 205936.png",
]

print(f"Deleting {len(files_to_delete)} files from {bucket_name}...")

deleted = 0
failed = 0
not_found = 0

for filename in files_to_delete:
    try:
        s3.delete_object(Bucket=bucket_name, Key=filename)
        print(f"✓ Deleted: {filename}")
        deleted += 1
    except s3.exceptions.NoSuchKey:
        print(f"⊘ Not found: {filename}")
        not_found += 1
    except Exception as e:
        print(f"✗ Failed: {filename} - {e}")
        failed += 1

print(f"\nSummary: {deleted} deleted, {not_found} not found, {failed} failed")
