"""
Instapods Hub - Always-on Cloud Sync Coordinator

This module runs on the Instapods cloud server and acts as the central hub for:
- Continuous mesh sync (pulling from B2 every 30 seconds)
- Mirroring transactions to Supabase
- Pulling mobile notes from Supabase into the mesh
- Serving signed URLs for B2 file access
- Serving mobile client transaction sync and AI helper APIs
"""

import os
import sys
import time
import threading
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# Add lab_app to path
sys.path.insert(0, str(Path(__file__).parent / "lab_app"))

from fastapi import FastAPI, HTTPException, Depends, Query, File, Form, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn

from database.mesh_sync_coordinator import MeshSyncCoordinator
from database.cache_db import CacheDatabase
from database.mobile_cloud_api import MobileCloudAPI, create_mobile_cloud_api

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

# Security
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "")


# Initialization functions

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
    global mesh_coordinator, db, supabase_client
    
    # Load environment variables
    db_path = os.getenv("DATABASE_PATH", "local_cache.db")
    device_id = os.getenv("INSTAPODS_DEVICE_ID", "INSTAPODS_HUB")
    b2_bucket_name = os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync")
    b2_endpoint_url = os.getenv("MESH_SYNC_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
    b2_access_key_id = os.getenv("MESH_SYNC_KEY_ID", "")
    b2_secret_access_key = os.getenv("MESH_SYNC_APPLICATION_KEY", "")
    
    # Initialize database for API endpoints (fallback)
    db = CacheDatabase(db_path=db_path)
    print(f"[instapods_hub] CacheDatabase initialized with path: {db_path}")
    
    # Initialize Supabase client for cloud data access
    if SUPABASE_AVAILABLE:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        if supabase_url and supabase_key:
            try:
                supabase_client = create_client(supabase_url, supabase_key)
                print(f"[instapods_hub] Supabase client initialized")
            except Exception as e:
                print(f"[instapods_hub] Failed to initialize Supabase client: {e}")
        else:
            print("[instapods_hub] Supabase credentials not configured")
    else:
        print("[instapods_hub] Supabase library not available")
    
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


def initialize_mobile_cloud_api():
    """Initialize the MobileCloudAPI for Instapods Hub."""
    global mobile_cloud_api
    try:
        mobile_cloud_api = create_mobile_cloud_api()
        if mobile_cloud_api and mobile_cloud_api.is_available():
            print("[instapods_hub] Mobile cloud API initialized successfully")
        else:
            print("[instapods_hub] Mobile cloud API not available - check B2 credentials")
    except Exception as e:
        print(f"[instapods_hub] Failed to initialize mobile cloud API: {e}")
        mobile_cloud_api = None


def start_background_sync():
    """Start the background sync loop in a separate thread."""
    global sync_running
    sync_running = True
    sync_thread = threading.Thread(target=sync_loop, daemon=True)
    sync_thread.start()
    print("[instapods_hub] Background sync loop started (30s interval)")


# Initialize FastAPI app
app = FastAPI(
    title="Instapods Hub",
    description="Always-on cloud sync coordinator for Lab R&D mesh",
    version="1.0.0",
    on_startup=[
        initialize_file_storage_clients,
        initialize_mesh_coordinator,
        initialize_mobile_cloud_api,
        start_background_sync
    ]
)

# Global state
mesh_coordinator: Optional[MeshSyncCoordinator] = None
mobile_cloud_api: Optional[MobileCloudAPI] = None
last_sync_timestamp: int = 0
sync_running = False

# S3 clients for file storage buckets (separate from mesh sync)
account1_s3_client = None
account2_s3_client = None

# Database for API endpoints
db: Optional[CacheDatabase] = None

# Supabase client for cloud data access
supabase_client: Optional[Client] = None


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


@app.get("/debug")
async def debug_info():
    """
    Debug endpoint to check initialization status.
    """
    return {
        "supabase_available": SUPABASE_AVAILABLE,
        "supabase_client_initialized": supabase_client is not None,
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "supabase_key_set": bool(os.getenv("SUPABASE_SERVICE_KEY")),
        "db_initialized": db is not None,
        "mesh_coordinator_initialized": mesh_coordinator is not None,
        "mobile_cloud_api_initialized": mobile_cloud_api is not None,
        "mobile_cloud_api_available": mobile_cloud_api.is_available() if mobile_cloud_api else False
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


# --- Mobile API Endpoints ---

@app.get("/api/projects")
async def get_projects():
    """Get all projects for mobile app from Supabase."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        response = supabase_client.table('projects').select('*').execute()
        return {"projects": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get a specific project by ID from Supabase."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        response = supabase_client.table('projects').select('*').eq('id', project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True, "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/experiments")
async def get_experiments(project_id: Optional[str] = None):
    """Get all experiments from Supabase (rd_logs table alias), optionally filtered by project ID."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        query = supabase_client.table('rd_logs').select('*')
        if project_id:
            query = query.eq('project_id', project_id)
        response = query.execute()
        return response.data
    except Exception as e:
        # Table might not exist - return empty array for graceful degradation
        if 'rd_logs' in str(e) or 'PGRST205' in str(e):
            return []
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/experiments/{experiment_id}")
async def get_experiment(experiment_id: str):
    """Get a specific experiment by ID from Supabase (rd_logs table)."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        response = supabase_client.table('rd_logs').select('*').eq('id', experiment_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        if 'rd_logs' in str(e) or 'PGRST205' in str(e):
            raise HTTPException(status_code=404, detail="Experiment not found")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resources")
async def get_resources(project_id: Optional[str] = None):
    """Get all resources (documents) from Supabase, optionally filtered by project ID."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        query = supabase_client.table('knowledge_vault').select('*')
        if project_id:
            query = query.eq('project_id', project_id)
        response = query.execute()
        # Convert file_type to uppercase to match mobile app enum
        resources = []
        for doc in response.data:
            file_type = doc.get('file_type', 'other')
            file_type_upper = file_type.upper() if file_type else 'OTHER'
            doc['file_type'] = file_type_upper
            resources.append(doc)
        return resources
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notes")
async def get_notes(project_id: Optional[str] = None, experiment_id: Optional[str] = None):
    """Get all notes (notebook_entries) from Supabase, optionally filtered by project ID or experiment ID."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        query = supabase_client.table('notebook_entries').select('*')
        if project_id:
            query = query.eq('project_id', project_id)
        if experiment_id:
            query = query.eq('experiment_id', experiment_id)
        response = query.execute()
        return response.data
    except Exception as e:
        if 'notebook_entries' in str(e) or 'PGRST205' in str(e):
            return []
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/findings")
async def get_findings(experiment_id: Optional[str] = None, severity: Optional[str] = None):
    """Get all findings from Supabase, optionally filtered by experiment ID or severity."""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    try:
        query = supabase_client.table('findings').select('*')
        if experiment_id:
            query = query.eq('experiment_id', experiment_id)
        if severity:
            query = query.eq('severity', severity)
        response = query.execute()
        return {"findings": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Cloud API for Direct Cloud Access ---

@app.get("/api/mobile/cloud-status")
async def get_mobile_cloud_status():
    """Get mobile cloud API status."""
    if not mobile_cloud_api:
        return {
            "status": "disabled",
            "message": "Mobile cloud API not initialized - check B2 credentials"
        }
    
    return {
        "status": "active" if mobile_cloud_api.is_available() else "disabled",
        "b2_bucket": mobile_cloud_api.b2_bucket_name,
        "endpoint": mobile_cloud_api.b2_endpoint_url
    }


@app.get("/api/mobile/transactions")
async def get_mobile_transactions(since_timestamp: Optional[int] = None):
    """Get mesh transactions from cloud for mobile devices."""
    if not mobile_cloud_api or not mobile_cloud_api.is_available():
        raise HTTPException(status_code=503, detail="Mobile cloud API not available")
    
    try:
        transactions = mobile_cloud_api.get_mesh_transactions(since_timestamp)
        return {"transactions": transactions, "count": len(transactions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mobile/db-snapshot")
async def get_mobile_db_snapshot():
    """Get the latest database snapshot from cloud for mobile devices."""
    if not mobile_cloud_api or not mobile_cloud_api.is_available():
        raise HTTPException(status_code=503, detail="Mobile cloud API not available")
    
    try:
        snapshot = mobile_cloud_api.get_latest_db_snapshot()
        if not snapshot:
            raise HTTPException(status_code=404, detail="No database snapshot found")
        
        return {
            "snapshot_key": snapshot['snapshot_key'],
            "last_modified": snapshot['last_modified'],
            "size": snapshot['size']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mobile/file-url")
async def get_mobile_file_url(file_name: str, file_size: int):
    """Get the public URL for a file stored in cloud."""
    if not mobile_cloud_api or not mobile_cloud_api.is_available():
        raise HTTPException(status_code=503, detail="Mobile cloud API not available")
    
    try:
        url = mobile_cloud_api.get_file_url(file_name, file_size)
        if not url:
            raise HTTPException(status_code=404, detail="File URL not found")
        
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mobile/push-transaction")
async def push_mobile_transaction(transaction: Dict[str, Any]):
    """Push a transaction from mobile device to cloud (for mobile-to-lab sync)."""
    if not mobile_cloud_api or not mobile_cloud_api.is_available():
        raise HTTPException(status_code=503, detail="Mobile cloud API not available")

    try:
        success = mobile_cloud_api.push_mobile_transaction(transaction)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to push transaction")

        return {"success": True, "message": "Transaction pushed to cloud"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Cloud AI API (Gemini) ---

class StageReviewRequest(BaseModel):
    stage_context: Dict[str, Any]

class ComponentAlternatesRequest(BaseModel):
    component_details: str

class FailureDiagnosisRequest(BaseModel):
    observation: str
    experiment_history: List[Dict[str, Any]]

class TestScriptRequest(BaseModel):
    requirement: str
    language: str = "python"

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = None


@app.post("/api/mobile/ai/stage-review")
async def mobile_review_stage_design(request: StageReviewRequest):
    """Feature A: Stage Design Reviewer - Analyze project stage for thermal risks, component mismatches, or logic flaws."""
    if not mobile_cloud_api or not mobile_cloud_api.is_gemini_available():
        raise HTTPException(status_code=503, detail="Gemini AI not available. Configure GEMINI_API_KEY")

    try:
        from fastapi.responses import StreamingResponse

        def generate():
            for chunk in mobile_cloud_api.review_stage_design(request.stage_context):
                yield chunk

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mobile/ai/component-alternates")
async def mobile_find_component_alternates(request: ComponentAlternatesRequest):
    """Feature B: Smart Substitute Finder - Find pin-compatible, drop-in alternatives for components."""
    if not mobile_cloud_api or not mobile_cloud_api.is_gemini_available():
        raise HTTPException(status_code=503, detail="Gemini AI not available. Configure GEMINI_API_KEY")

    try:
        from fastapi.responses import StreamingResponse

        def generate():
            for chunk in mobile_cloud_api.find_component_alternates(request.component_details):
                yield chunk

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mobile/ai/failure-diagnosis")
async def mobile_diagnose_circuit_failure(request: FailureDiagnosisRequest):
    """Feature C: Failure Mode Analyzer - Diagnose circuit failures based on observations and experiment history."""
    if not mobile_cloud_api or not mobile_cloud_api.is_gemini_available():
        raise HTTPException(status_code=503, detail="Gemini AI not available. Configure GEMINI_API_KEY")

    try:
        from fastapi.responses import StreamingResponse

        def generate():
            for chunk in mobile_cloud_api.diagnose_circuit_failure(request.observation, request.experiment_history):
                yield chunk

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mobile/ai/test-script")
async def mobile_generate_test_script(request: TestScriptRequest):
    """Feature D: Lab Automation Scripting - Generate production-ready test automation scripts."""
    if not mobile_cloud_api or not mobile_cloud_api.is_gemini_available():
        raise HTTPException(status_code=503, detail="Gemini AI not available. Configure GEMINI_API_KEY")

    try:
        from fastapi.responses import StreamingResponse

        def generate():
            for chunk in mobile_cloud_api.generate_test_script(request.requirement, request.language):
                yield chunk

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mobile/ai/chat")
async def mobile_gemini_chat(request: ChatRequest):
    """General Chat Interface - Handle general conversations with Gemini."""
    if not mobile_cloud_api or not mobile_cloud_api.is_gemini_available():
        raise HTTPException(status_code=503, detail="Gemini AI not available. Configure GEMINI_API_KEY")

    try:
        from fastapi.responses import StreamingResponse

        def generate():
            for chunk in mobile_cloud_api.chat(request.message, request.conversation_history):
                yield chunk

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
                    # Keep Supabase connection alive to prevent free-tier suspension
                    mesh_coordinator._keep_supabase_alive()
                    
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


def main():
    """Main entry point for Instapods Hub (for local testing)."""
    print("=" * 60)
    print("Instapods Hub - Always-on Cloud Sync Coordinator")
    print("=" * 60)
    
    # Initialize file storage clients
    initialize_file_storage_clients()
    
    # Initialize mesh coordinator
    initialize_mesh_coordinator()
    
    # Initialize mobile cloud API
    initialize_mobile_cloud_api()
    
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
