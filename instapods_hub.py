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
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# Add lab_app to path
sys.path.insert(0, str(Path(__file__).parent / "lab_app"))

from fastapi import FastAPI, HTTPException, Depends, Query, File, Form, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn

from database.mesh_sync_coordinator import MeshSyncCoordinator
from auth.auth_manager import AuthManager

# Security
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "")

# Initialize AuthManager
auth_manager: Optional[AuthManager] = None

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


def verify_session(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify session token for protected endpoints using AuthManager.
    
    Args:
        credentials: HTTP Bearer credentials
        
    Returns:
        User information if valid
        
    Raises:
        HTTPException: If token is invalid
    """
    if not auth_manager:
        # If AuthManager not initialized, fall back to JWT_SECRET check
        if not JWT_SECRET:
            # Development mode - allow all
            return {"username": "dev_user", "role": "admin"}
        
        token = credentials.credentials
        if token != JWT_SECRET:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": "api_user", "role": "admin"}
    
    # Use AuthManager for session validation
    session_token = credentials.credentials
    session_result = auth_manager.validate_session(session_token)
    
    if not session_result["valid"]:
        raise HTTPException(status_code=401, detail=session_result.get("message", "Invalid session"))
    
    return session_result["user"]


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


@app.post("/auth/login")
async def login(username: str = Form(...), password: str = Form(...)):
    """
    Login endpoint for authentication.
    
    Args:
        username: Username
        password: Password
        
    Returns:
        JSON with session token and user info
    """
    if not auth_manager:
        raise HTTPException(status_code=503, detail="Authentication not available")
    
    result = auth_manager.authenticate_user(username, password)
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["message"])
    
    return {
        "success": True,
        "session_token": result["session_token"],
        "user": result["user"]
    }


@app.post("/auth/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Logout endpoint to invalidate session.
    
    Args:
        credentials: Session token
        
    Returns:
        JSON with logout status
    """
    if not auth_manager:
        return {"success": True, "message": "Logged out (auth not available)"}
    
    session_token = credentials.credentials
    result = auth_manager.logout_user(session_token)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@app.get("/signed-url")
async def get_signed_url(
    filename: str = Query(..., description="Filename to generate signed URL for"),
    user: Dict[str, Any] = Depends(verify_session)
):
    """
    Generate a time-limited B2 signed URL for file access.
    
    Requires Bearer session token authentication.
    
    Args:
        filename: The filename to generate a signed URL for
        user: User information from session validation
        
    Returns:
        JSON with signed_url and expiry_seconds
    """
    
    if not mesh_coordinator or not mesh_coordinator.s3_client:
        raise HTTPException(status_code=503, detail="B2 client not available")
    
    try:
        # Generate signed URL with 3600 second expiry
        s3_client = mesh_coordinator.s3_client
        bucket_name = mesh_coordinator.b2_bucket_name
        
        # Determine which bucket to use based on file size (if known)
        # For now, use the configured bucket
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
    user: Dict[str, Any] = Depends(verify_session)
):
    """
    Upload a file to B2 via Instapods Hub.
    
    Requires Bearer session token authentication.
    
    Args:
        file: The file to upload
        filename: The filename to use in B2
        user: User information from session validation
        
    Returns:
        JSON with filename and upload status
    """
    
    if not mesh_coordinator or not mesh_coordinator.s3_client:
        raise HTTPException(status_code=503, detail="B2 client not available")
    
    try:
        s3_client = mesh_coordinator.s3_client
        bucket_name = mesh_coordinator.b2_bucket_name
        
        # Read file content
        file_content = await file.read()
        
        # Determine which bucket to use based on file size
        # If file >= 50MB, use heavy storage bucket; otherwise use light storage
        file_size = len(file_content)
        
        # Get heavy bucket credentials if file is large
        if file_size >= 50 * 1024 * 1024:  # 50MB
            heavy_bucket = os.getenv("B2_ACCOUNT1_BUCKET")
            if heavy_bucket:
                bucket_name = heavy_bucket
                # Note: In production, you'd need to initialize a separate S3 client
                # for the heavy bucket with its credentials. For now, we use the default.
        
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
    2. Mirrors to Supabase
    3. Pulls mobile notes from Supabase
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
                    
                    if applied_count > 0:
                        # Mirror to Supabase
                        transactions = mesh_coordinator.get_pending_transactions()
                        if transactions:
                            mesh_coordinator._mirror_to_supabase(transactions)
                    
                    # Pull mobile notes from Supabase
                    mesh_coordinator._pull_mobile_notes()
                    
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


def initialize_mesh_coordinator():
    """Initialize the MeshSyncCoordinator for Instapods Hub."""
    global mesh_coordinator, auth_manager
    
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
        b2_secret_access_key=b2_secret_access_key
    )
    
    print(f"[instapods_hub] MeshSyncCoordinator initialized with device_id: {device_id}")
    
    # Initialize AuthManager
    try:
        auth_manager = AuthManager(db_path=db_path)
        print(f"[instapods_hub] AuthManager initialized")
    except Exception as e:
        print(f"[instapods_hub] Failed to initialize AuthManager: {e}")
        print("[instapods_hub] Authentication will use fallback JWT_SECRET check")


def main():
    """Main entry point for Instapods Hub."""
    print("=" * 60)
    print("Instapods Hub - Always-on Cloud Sync Coordinator")
    print("=" * 60)
    
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
