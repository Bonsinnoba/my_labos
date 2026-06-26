"""
Instapods Hub - Always-on Cloud Sync Coordinator

This module runs on the Instapods cloud server and acts as the central hub for:
- Continuous mesh sync (pulling from B2 every 30 seconds)
- Mirroring transactions to Supabase
- Pulling mobile notes from Supabase into the mesh
- Serving signed URLs for B2 file access
"""

import os
import sys
import time
import threading
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# Add lab_app to path
sys.path.insert(0, str(Path(__file__).parent / "lab_app"))

from fastapi import FastAPI, HTTPException, Depends, Query, File, Form, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn

from database.mesh_sync_coordinator import MeshSyncCoordinator

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

# Security
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "")


# Initialize FastAPI app
app = FastAPI(
    title="Instapods Hub",
    description="Always-on cloud sync coordinator for Lab R&D mesh",
    version="1.0.0"
)

# Global state
mesh_coordinator: Optional[MeshSyncCoordinator] = None
last_sync_timestamp: int = 0
sync_running = False

# S3 clients for file storage buckets (separate from mesh sync)
account1_s3_client = None
account2_s3_client = None


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> bool:
    """
    Verify JWT token for protected endpoints.
    
    Args:
        credentials: HTTP Bearer credentials
        
    Returns:
        True if valid
        
    Raises:
        HTTPException: If token is invalid
    """
    if not JWT_SECRET:
        # If no JWT_SECRET configured, allow all (development mode)
        return True
    
    token = credentials.credentials
    # Simple token verification - in production, use proper JWT validation
    if token != JWT_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")
    return True


@app.get("/health")
async def health_check():
    """
    Health check endpoint (no authentication required).
    
    Returns:
        JSON with status, device_id, and last_sync timestamp
    """
    return {
        "status": "ok",
        "device_id": "INSTAPODS_HUB",
        "last_sync": last_sync_timestamp,
        "last_sync_iso": datetime.fromtimestamp(last_sync_timestamp / 1000).isoformat() if last_sync_timestamp > 0 else None
    }




@app.get("/signed-url")
async def get_signed_url(
    filename: str = Query(..., description="Filename to generate signed URL for"),
    file_size: Optional[int] = Query(None, description="File size in bytes (optional)"),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Generate a time-limited B2 signed URL for file access from the correct storage bucket.
    
    Requires Bearer JWT authentication.
    
    Args:
        filename: The filename to generate a signed URL for
        file_size: Optional file size in bytes to determine storage bucket routing
        credentials: JWT credentials
        
    Returns:
        JSON with signed_url and expiry_seconds
    """
    verify_jwt(credentials)
    
    # Look up file_size in database if not provided
    if file_size is None and mesh_coordinator and mesh_coordinator.db_path:
        try:
            import sqlite3
            conn = sqlite3.connect(mesh_coordinator.db_path)
            cursor = conn.cursor()
            
            # Clean suffix to match original database path
            clean_filename = filename
            if filename.endswith('.enc'):
                clean_filename = filename[:-4]
            elif filename.endswith('.gz'):
                clean_filename = filename[:-3]
                
            cursor.execute("""
                SELECT file_size FROM knowledge_vault 
                WHERE file_path LIKE '%' || ? OR file_path LIKE '%' || ?
            """, (filename, clean_filename))
            row = cursor.fetchone()
            if row:
                file_size = row[0]
            conn.close()
        except Exception as db_err:
            print(f"[instapods_hub] DB lookup error for {filename}: {db_err}")
    
    # Determine client and bucket based on file size (50MB threshold)
    if file_size is not None and file_size >= 50 * 1024 * 1024:
        s3_client = account1_s3_client
        bucket_name = os.getenv("ACCOUNT_1_BUCKET", "lab-heavy-storage")
        account_label = "Account #1"
    else:
        s3_client = account2_s3_client
        bucket_name = os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage")
        account_label = "Account #2"
        
    if not s3_client:
        raise HTTPException(status_code=503, detail=f"B2 client for {account_label} not initialized")
    
    try:
        # Generate signed URL with 3600 second expiry
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': filename},
            ExpiresIn=3600
        )
        
        return {
            "signed_url": signed_url,
            "expiry_seconds": 3600,
            "filename": filename
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate signed URL: {str(e)}")


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(..., description="File to upload"),
    filename: str = Form(..., description="Filename to use in B2"),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Upload a file to B2 via Instapods Hub.
    
    Requires Bearer JWT authentication.
    
    Args:
        file: The file to upload
        filename: The filename to use in B2
        credentials: JWT credentials
        
    Returns:
        JSON with filename and upload status
    """
    verify_jwt(credentials)
    
    # Determine which S3 client to use based on file size
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size >= 50 * 1024 * 1024:  # 50MB - use Account #1 (Heavy Storage)
        s3_client = account1_s3_client
        bucket_name = os.getenv("ACCOUNT_1_BUCKET", "lab-heavy-storage")
    else:  # < 50MB - use Account #2 (Light Storage)
        s3_client = account2_s3_client
        bucket_name = os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage")
    
    if not s3_client:
        raise HTTPException(status_code=503, detail="S3 client not available for this bucket")
    
    try:
        # Upload to B2
        s3_client.put_object(
            Bucket=bucket_name,
            Key=filename,
            Body=file_content,
            ContentType=file.content_type or 'application/octet-stream'
        )
        
        return {
            "filename": filename,
            "bucket": bucket_name,
            "size": file_size,
            "status": "uploaded"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


def sync_loop():
    """
    Background sync loop that runs every 30 seconds.
    
    This loop:
    1. Pulls transactions from B2
    2. Pulls mobile notes from Supabase
    3. Pushes local transactions to B2
    """
    global last_sync_timestamp, sync_running
    
    while sync_running:
        try:
            if mesh_coordinator:
                # Check network status
                mesh_coordinator.check_network_status()
                
                if mesh_coordinator.is_online:
                    # Pull from B2
                    applied_count = mesh_coordinator.pull_from_cloud()
                    
                    # Pull mobile notes from Supabase
                    mesh_coordinator._pull_mobile_notes()
                    
                    # Push to B2
                    mesh_coordinator.push_to_cloud()
                    
                    # Update last sync timestamp
                    last_sync_timestamp = int(time.time() * 1000)
                    print(f"[instapods_hub] Sync completed at {datetime.fromtimestamp(last_sync_timestamp / 1000).isoformat()}")
                else:
                    print("[instapods_hub] Offline - skipping sync")
        
        except Exception as e:
            print(f"[instapods_hub] Sync loop error: {e}")
        
        # Wait 30 seconds before next sync
        time.sleep(30)


def start_background_sync():
    """Start the background sync loop in a separate thread."""
    global sync_running
    sync_running = True
    sync_thread = threading.Thread(target=sync_loop, daemon=True)
    sync_thread.start()
    print("[instapods_hub] Background sync loop started (30s interval)")


def initialize_file_storage_clients():
    """Initialize S3 clients for file storage buckets."""
    global account1_s3_client, account2_s3_client
    
    if not BOTO3_AVAILABLE:
        print("[instapods_hub] boto3 not available - file upload disabled")
        return
    
    # Initialize Account #1 client (Heavy Storage)
    account1_endpoint = os.getenv("ACCOUNT_1_ENDPOINT")
    account1_key_id = os.getenv("ACCOUNT_1_KEY_ID")
    account1_app_key = os.getenv("ACCOUNT_1_APPLICATION_KEY")
    
    if account1_key_id and account1_app_key:
        try:
            account1_s3_client = boto3.client(
                's3',
                endpoint_url=account1_endpoint,
                aws_access_key_id=account1_key_id,
                aws_secret_access_key=account1_app_key
            )
            print(f"[instapods_hub] Account #1 client initialized")
        except Exception as e:
            print(f"[instapods_hub] Failed to initialize Account #1 client: {e}")
    
    # Initialize Account #2 client (Light Storage)
    account2_endpoint = os.getenv("ACCOUNT_2_ENDPOINT")
    account2_key_id = os.getenv("ACCOUNT_2_KEY_ID")
    account2_app_key = os.getenv("ACCOUNT_2_APPLICATION_KEY")
    
    if account2_key_id and account2_app_key:
        try:
            account2_s3_client = boto3.client(
                's3',
                endpoint_url=account2_endpoint,
                aws_access_key_id=account2_key_id,
                aws_secret_access_key=account2_app_key
            )
            print(f"[instapods_hub] Account #2 client initialized")
        except Exception as e:
            print(f"[instapods_hub] Failed to initialize Account #2 client: {e}")


def initialize_mesh_coordinator():
    """Initialize the MeshSyncCoordinator for Instapods Hub."""
    global mesh_coordinator
    
    # Load environment variables
    db_path = os.getenv("DATABASE_PATH", "local_cache.db")
    device_id = os.getenv("INSTAPODS_DEVICE_ID", "INSTAPODS_HUB")
    b2_bucket_name = os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync")
    b2_endpoint_url = os.getenv("MESH_SYNC_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
    b2_access_key_id = os.getenv("MESH_SYNC_KEY_ID", "")
    b2_secret_access_key = os.getenv("MESH_SYNC_APPLICATION_KEY", "")
    
    mesh_coordinator = MeshSyncCoordinator(
        db_path=db_path,
        device_id=device_id,
        b2_bucket_name=b2_bucket_name,
        b2_endpoint_url=b2_endpoint_url,
        b2_access_key_id=b2_access_key_id,
        b2_secret_access_key=b2_secret_access_key,
        hub_mode=True  # Hub is the sole B2 poller; devices pull from Supabase
    )
    
    print(f"[instapods_hub] MeshSyncCoordinator initialized with device_id: {device_id}")


def main():
    """Main entry point for Instapods Hub."""
    print("=" * 60)
    print("Instapods Hub - Always-on Cloud Sync Coordinator")
    print("=" * 60)
    
    # Initialize file storage clients
    initialize_file_storage_clients()
    
    # Initialize mesh coordinator
    initialize_mesh_coordinator()
    
    # Start background sync loop
    start_background_sync()
    
    # Get server configuration
    host = os.getenv("INSTAPODS_HOST", "0.0.0.0")
    port = int(os.getenv("INSTAPODS_PORT", "8001"))
    
    print(f"[instapods_hub] Starting FastAPI server on {host}:{port}")
    print(f"[instapods_hub] Health endpoint: http://{host}:{port}/health")
    print(f"[instapods_hub] Signed URL endpoint: http://{host}:{port}/signed-url")
    print("=" * 60)
    
    # Run FastAPI server
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
