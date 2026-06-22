"""
FastAPI Server for Lab Inventory & Research Logs

This module provides a unified web server that exposes all core Python backend
modules (database, inventory, voice, analysis, finance, calculations, knowledge vault)
via RESTful API endpoints, and serves the premium dark web dashboard UI.
"""

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import sys
from pathlib import Path
import os
import shutil
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database.cache_db import CacheDatabase
from database.cloud_sync_engine import DualAccountSyncEngine
from database.mesh_sync_coordinator import MeshSyncCoordinator
from database.mobile_cloud_api import MobileCloudAPI, create_mobile_cloud_api
from analysis.data_processor import DataProcessor
from voice.listener import VoiceListener
from dashboard.lab_dashboard import LabDashboard
from knowledge.knowledge_vault import KnowledgeVault
from notebook.engineering_notebook import EngineeringNotebook
from inventory.component_manager import ComponentManager
from equipment.equipment_manager import EquipmentManager
from findings.findings_manager import FindingsManager
from toolbox.engineering_toolbox import EngineeringToolbox
from search.semantic_search import SemanticSearch

# Optional Gemini import - will be None if not installed
try:
    from gemini_service import GeminiLabAssistant
    GEMINI_AVAILABLE = True
except ImportError:
    GeminiLabAssistant = None
    GEMINI_AVAILABLE = False

# Initialize FastAPI app
app = FastAPI(
    title="Lab R&D Operating System",
    description="Unified API & Web Interface for Lab Inventory & Research Logs",
    version="2.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize backend modules
db = CacheDatabase(db_path=os.getenv("DATABASE_PATH", "local_cache.db"))
processor = DataProcessor(local_cache_dir="local_data_cache")
voice_listener: Optional[VoiceListener] = None

dashboard = LabDashboard(db=db)
knowledge_vault = KnowledgeVault(db=db)
notebook = EngineeringNotebook(db=db)
component_manager = ComponentManager(db=db)
equipment_manager = EquipmentManager(db=db)
findings_manager = FindingsManager(db=db)
toolbox = EngineeringToolbox(db=db)
semantic_search = SemanticSearch(db=db)

# Initialize cloud sync engine
cloud_sync_engine: Optional[DualAccountSyncEngine] = None
try:
    cloud_sync_engine = DualAccountSyncEngine()
    # Start background sync if credentials are configured
    if cloud_sync_engine.initialize_cloud_clients():
        cloud_sync_engine.start_background_sync()
        print("[sync] Cloud sync engine initialized and background sync started")
    else:
        print("[sync] Cloud sync engine initialized but no credentials configured - sync disabled")
except Exception as e:
    print(f"[sync] Failed to initialize cloud sync engine: {e}")
    cloud_sync_engine = None

# Initialize mesh sync coordinator for peer-to-peer lab computer sync
mesh_coordinator: Optional[MeshSyncCoordinator] = None
try:
    # Use the same B2 bucket for mesh transactions (use account 2 for smaller transaction files)
    mesh_coordinator = MeshSyncCoordinator(
        db_path=os.getenv("DATABASE_PATH", "local_cache.db"),
        b2_bucket_name=os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync"),
        b2_endpoint_url=os.getenv("ACCOUNT_2_ENDPOINT", "https://s3.us-east-005.backblazeb2.com"),
        b2_access_key_id=os.getenv("ACCOUNT_2_KEY_ID", ""),
        b2_secret_access_key=os.getenv("ACCOUNT_2_APPLICATION_KEY", "")
    )
    # Start mesh sync loop
    mesh_coordinator.start_sync_loop()
    print("[mesh] Mesh sync coordinator initialized and sync loop started")
except Exception as e:
    print(f"[mesh] Failed to initialize mesh sync coordinator: {e}")
    mesh_coordinator = None

# Initialize mobile cloud API for direct cloud access
mobile_cloud_api: Optional[MobileCloudAPI] = None
try:
    mobile_cloud_api = create_mobile_cloud_api()
    if mobile_cloud_api and mobile_cloud_api.is_available():
        print("[mobile_cloud] Mobile cloud API initialized - mobile devices can fetch data directly from cloud")
    else:
        print("[mobile_cloud] Mobile cloud API not available - mobile devices will use local API")
except Exception as e:
    print(f"[mobile_cloud] Failed to initialize mobile cloud API: {e}")
    mobile_cloud_api = None

# Initialize Gemini Assistant (will be lazy-loaded to avoid startup errors if API key not set)
gemini_assistant: Optional[GeminiLabAssistant] = None if not GEMINI_AVAILABLE else None


# --- Pydantic Models for Request/Response Validation ---

class EquipmentCreate(BaseModel):
    name: str
    model: str
    status: str = "available"
    calibration_date: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None
    calibration_date: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "Active"
    start_date: Optional[str] = None
    summary_findings: Optional[str] = None
    project_outcome: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    summary_findings: Optional[str] = None
    project_outcome: Optional[str] = None


class RdLogCreate(BaseModel):
    project_name: str
    log_title: str
    log_text: str
    cloud_file_url: Optional[str] = None
    is_downloaded_locally: bool = False
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    outcome: Optional[str] = "PENDING"
    expected_outcome: Optional[str] = None
    actual_outcome: Optional[str] = None
    findings: Optional[str] = None
    conclusion: Optional[str] = None


class RdLogUpdate(BaseModel):
    project_name: Optional[str] = None
    log_title: Optional[str] = None
    log_text: Optional[str] = None
    cloud_file_url: Optional[str] = None
    is_downloaded_locally: Optional[bool] = None
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    outcome: Optional[str] = None
    expected_outcome: Optional[str] = None
    actual_outcome: Optional[str] = None
    findings: Optional[str] = None
    conclusion: Optional[str] = None
    status: Optional[str] = None


class VoiceControl(BaseModel):
    wake_word: str = "jarvis"


class VoiceCommand(BaseModel):
    command: str


class DataAnalysisRequest(BaseModel):
    file_path: str
    force_download: bool = False


class DataFilterRequest(BaseModel):
    file_path: str
    column: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class ToolCreate(BaseModel):
    name: str
    tool_type: Optional[str] = None
    description: Optional[str] = None
    quantity: int = 1
    min_quantity: int = 1
    storage_location: Optional[str] = None
    status: str = "available"
    purchase_date: Optional[str] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class ToolUpdate(BaseModel):
    name: Optional[str] = None
    tool_type: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    storage_location: Optional[str] = None
    status: Optional[str] = None
    purchase_date: Optional[str] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class MaterialCreate(BaseModel):
    name: str
    material_type: Optional[str] = None
    description: Optional[str] = None
    quantity: float = 0
    unit: str = "units"
    min_quantity: float = 10
    storage_location: Optional[str] = None
    purchase_date: Optional[str] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    material_type: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    min_quantity: Optional[float] = None
    storage_location: Optional[str] = None
    purchase_date: Optional[str] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


# --- Gemini AI Assistant Models ---

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
    conversation_history: Optional[List[Dict[str, Any]]] = None


class EquipmentUsageCreate(BaseModel):
    equipment_id: int
    usage_type: str = "checkout"
    project_id: Optional[int] = None
    experiment_id: Optional[int] = None
    used_by: Optional[str] = None
    post_use_status: str = "usable"
    condition_notes: Optional[str] = None
    efficiency_percentage: Optional[float] = None
    notes: Optional[str] = None


class ToolUsageCreate(BaseModel):
    tool_id: int
    quantity_used: int = 1
    amount_left: int = 0
    project_id: Optional[int] = None
    experiment_id: Optional[int] = None
    post_use_status: str = "usable"
    condition_notes: Optional[str] = None
    efficiency_percentage: Optional[float] = None
    notes: Optional[str] = None


class MaterialUsageCreate(BaseModel):
    material_id: int
    quantity_used: float
    amount_left: float = 0
    project_id: Optional[int] = None
    experiment_id: Optional[int] = None
    post_use_status: str = "usable"
    condition_notes: Optional[str] = None
    notes: Optional[str] = None


class FundingSourceCreate(BaseModel):
    name: str
    source_type: str
    description: Optional[str] = None
    budget_limit: Optional[float] = None
    current_balance: float = 0
    account_number: Optional[str] = None
    contact_person: Optional[str] = None


class FundingSourceUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    description: Optional[str] = None
    budget_limit: Optional[float] = None
    current_balance: Optional[float] = None
    account_number: Optional[str] = None
    contact_person: Optional[str] = None


class PurchaseCreate(BaseModel):
    item_type: str
    item_id: int
    purchase_date: str
    cost: float
    funding_source_id: Optional[int] = None
    currency: str = "USD"
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceCostCreate(BaseModel):
    item_type: str
    item_id: int
    maintenance_date: str
    cost: float
    funding_source_id: Optional[int] = None
    currency: str = "USD"
    service_provider: Optional[str] = None
    description: Optional[str] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None


# --- Health check endpoint ---

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "database": "connected" if db.conn else "disconnected",
        "voice": "active" if voice_listener and voice_listener.is_active() else "inactive",
        "cloud_sync": "active" if cloud_sync_engine else "disabled",
        "mesh_sync": "active" if mesh_coordinator and mesh_coordinator.sync_running else "disabled"
    }


# --- Cloud Sync API ---

@app.get("/api/sync/status")
async def get_sync_status():
    """Get cloud sync status."""
    if not cloud_sync_engine:
        return {
            "status": "disabled",
            "message": "Cloud sync engine not initialized - check Backblaze B2 credentials"
        }
    
    return {
        "status": "active" if cloud_sync_engine.running else "inactive",
        "account1_configured": bool(cloud_sync_engine.config.get("ACCOUNT_1_KEY_ID")),
        "account2_configured": bool(cloud_sync_engine.config.get("ACCOUNT_2_KEY_ID")),
        "encryption_enabled": cloud_sync_engine.secure_vault is not None
    }


@app.post("/api/sync/trigger")
async def trigger_sync():
    """Manually trigger a sync cycle."""
    if not cloud_sync_engine:
        raise HTTPException(status_code=503, detail="Cloud sync engine not initialized")
    
    try:
        cloud_sync_engine.sync_once()
        return {"success": True, "message": "Sync cycle triggered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mesh Sync API for Lab Computer Peer-to-Peer Sync ---

@app.get("/api/mesh/status")
async def get_mesh_status():
    """Get mesh sync coordinator status."""
    if not mesh_coordinator:
        return {
            "status": "disabled",
            "message": "Mesh sync coordinator not initialized - check B2 credentials"
        }
    
    return {
        "status": "active" if mesh_coordinator.sync_running else "inactive",
        "device_id": mesh_coordinator.device_id,
        "is_online": mesh_coordinator.is_online,
        "b2_bucket": mesh_coordinator.b2_bucket_name,
        "registered_devices": list(mesh_coordinator.registered_devices)
    }


@app.post("/api/mesh/trigger")
async def trigger_mesh_sync():
    """Manually trigger a mesh sync cycle (pull from cloud, then push to cloud)."""
    if not mesh_coordinator:
        raise HTTPException(status_code=503, detail="Mesh sync coordinator not initialized")
    
    try:
        # Pull from cloud first
        pulled_count = mesh_coordinator.pull_from_cloud()
        # Then push to cloud
        push_success = mesh_coordinator.push_to_cloud()
        
        return {
            "success": True,
            "message": f"Mesh sync completed: pulled {pulled_count} transactions, push {'successful' if push_success else 'failed'}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mesh/transactions")
async def get_mesh_transactions(since_timestamp: Optional[int] = None):
    """Get pending mesh transactions from local ledger."""
    if not mesh_coordinator:
        raise HTTPException(status_code=503, detail="Mesh sync coordinator not initialized")
    
    try:
        transactions = mesh_coordinator.get_pending_transactions(since_timestamp)
        return {"transactions": transactions, "count": len(transactions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mesh/register-device")
async def register_mesh_device(device_id: str):
    """Register a device ID for mesh sync garbage collection tracking."""
    if not mesh_coordinator:
        raise HTTPException(status_code=503, detail="Mesh sync coordinator not initialized")
    
    try:
        mesh_coordinator.register_device(device_id)
        return {"success": True, "message": f"Device {device_id} registered"}
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


# --- Root and UI serving ---

@app.get("/", response_class=HTMLResponse)
async def serve_frontend(request: Request):
    """Serve the premium dark web UI dashboard."""
    templates_dir = Path(__file__).parent / "web" / "templates"
    html_file = templates_dir / "index.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding='utf-8'))
    return HTMLResponse(content="<h1>Error: Template not found</h1>", status_code=404)


# --- Dashboard API ---

@app.get("/api/dashboard")
async def get_dashboard():
    """Get dashboard data."""
    try:
        data = dashboard.get_dashboard_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/activities")
async def get_activities(limit: int = 20):
    """Get recent activities from the audit trail."""
    try:
        activities = db.get_recent_activities(limit)
        return {"activities": activities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Documents & Knowledge Vault API ---

@app.get("/api/documents")
async def get_documents(project_id: Optional[int] = None, file_type: Optional[str] = None,
                        experiment_id: Optional[int] = None, stage_id: Optional[int] = None):
    """Get all documents, optionally filtered."""
    try:
        docs = db.get_all_documents(
            project_id=project_id, 
            file_type=file_type, 
            experiment_id=experiment_id, 
            stage_id=stage_id
        )
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents")
async def add_document(file: UploadFile = File(...), title: str = Form(...), file_type: str = Form(...),
                       project_id: Optional[int] = Form(None), experiment_id: Optional[int] = Form(None),
                       stage_id: Optional[int] = Form(None)):
    """Add a new document to the knowledge vault."""
    try:
        documents_dir = "documents"
        os.makedirs(documents_dir, exist_ok=True)
        
        safe_filename = f"{int(time.time())}_{file.filename}"
        file_path = os.path.join(documents_dir, safe_filename)
        
        # Use chunked copying for better performance with large files
        chunk_size = 8192  # 8KB chunks
        with open(file_path, "wb") as buffer:
            while chunk := file.file.read(chunk_size):
                buffer.write(chunk)
        
        print(f"Uploading document: title={title}, file_type={file_type}, file_path={file_path}, project_id={project_id}, experiment_id={experiment_id}, stage_id={stage_id}")
        
        doc_id = knowledge_vault.add_document(
            source_path=file_path,
            title=title,
            description=None,
            tags=None,
            project_id=project_id,
            component_id=None,
            equipment_id=None,
            experiment_id=experiment_id,
            stage_id=stage_id
        )
        print(f"Document uploaded successfully with ID: {doc_id}")
        return {"id": doc_id, "message": "Document added successfully"}
    except Exception as e:
        print(f"Error uploading document: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: int):
    """Delete a document."""
    try:
        success = knowledge_vault.delete_document(doc_id)
        if success:
            return {"message": "Document deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Document not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/{doc_id}/view")
async def view_document(doc_id: int):
    """View/download a document file."""
    try:
        doc = db.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = doc.get('file_path')
        # Convert to absolute path
        abs_file_path = os.path.abspath(file_path) if file_path else None
        
        print(f"Viewing document: doc_id={doc_id}, file_path={file_path}, abs_path={abs_file_path}, exists={os.path.exists(abs_file_path) if abs_file_path else False}")
        
        if not abs_file_path or not os.path.exists(abs_file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Detect MIME type based on file extension
        import mimetypes
        mime_type, _ = mimetypes.guess_type(abs_file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        print(f"Serving file with MIME type: {mime_type}")
        
        return FileResponse(
            path=abs_file_path,
            media_type=mime_type,
            filename=os.path.basename(abs_file_path)
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error viewing document: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Resources API (maps to documents for compatibility) ---

@app.get("/api/resources")
async def get_resources(project_id: Optional[int] = None):
    """Get all resources (maps to documents for mobile compatibility)."""
    try:
        if project_id:
            docs = db.get_documents(project_id=project_id)
        else:
            docs = db.get_all_documents()
        
        # Transform documents to resource format
        resources = []
        for doc in docs:
            resources.append({
                'id': doc['id'],
                'title': doc.get('title', ''),
                'type': doc.get('file_type', 'OTHER'),
                'size': doc.get('file_size'),
                'file_path': doc.get('file_path'),
                'cloud_file_url': doc.get('cloud_file_url'),
                'date': doc.get('upload_date'),
                'uploaded_by': doc.get('uploaded_by'),
                'project_id': doc.get('project_id'),
                'tags': doc.get('tags', []),
                'created_at': doc.get('created_at'),
                'updated_at': doc.get('updated_at')
            })
        
        return resources
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/resources")
async def get_project_resources(project_id: int):
    """Get resources for a specific project (maps to documents for mobile compatibility)."""
    try:
        docs = db.get_documents(project_id=project_id)
        
        # Transform documents to resource format
        resources = []
        for doc in docs:
            resources.append({
                'id': doc['id'],
                'title': doc.get('title', ''),
                'type': doc.get('file_type', 'OTHER'),
                'size': doc.get('file_size'),
                'file_path': doc.get('file_path'),
                'cloud_file_url': doc.get('cloud_file_url'),
                'date': doc.get('upload_date'),
                'uploaded_by': doc.get('uploaded_by'),
                'project_id': project_id,
                'tags': doc.get('tags', []),
                'created_at': doc.get('created_at'),
                'updated_at': doc.get('updated_at')
            })
        
        return resources
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resources/{resource_id}")
async def get_resource(resource_id: int):
    """Get resource by ID (maps to document for mobile compatibility)."""
    try:
        doc = db.get_document(resource_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        return {
            'id': doc['id'],
            'title': doc.get('title', ''),
            'type': doc.get('file_type', 'OTHER'),
            'size': doc.get('file_size'),
            'file_path': doc.get('file_path'),
            'cloud_file_url': doc.get('cloud_file_url'),
            'date': doc.get('upload_date'),
            'uploaded_by': doc.get('uploaded_by'),
            'project_id': doc.get('project_id'),
            'tags': doc.get('tags', []),
            'created_at': doc.get('created_at'),
            'updated_at': doc.get('updated_at')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/resources")
async def create_resource(data: Dict[str, Any]):
    """Create new resource (maps to document for mobile compatibility)."""
    try:
        doc_id = db.add_document(
            title=data.get('title', ''),
            file_type=data.get('type', 'OTHER'),
            file_path=data.get('file_path'),
            cloud_file_url=data.get('cloud_file_url'),
            project_id=data.get('project_id'),
            tags=data.get('tags', [])
        )
        return {
            'id': doc_id,
            'title': data.get('title', ''),
            'type': data.get('type', 'OTHER')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/resources/{resource_id}")
async def update_resource(resource_id: int, data: Dict[str, Any]):
    """Update resource (maps to document for mobile compatibility)."""
    try:
        # Map resource fields to document fields
        doc_data = {}
        if 'title' in data:
            doc_data['title'] = data['title']
        if 'type' in data:
            doc_data['file_type'] = data['type']
        if 'file_path' in data:
            doc_data['file_path'] = data['file_path']
        if 'cloud_file_url' in data:
            doc_data['cloud_file_url'] = data['cloud_file_url']
        if 'project_id' in data:
            doc_data['project_id'] = data['project_id']
        if 'tags' in data:
            doc_data['tags'] = data['tags']
        
        success = db.update_document(resource_id, **doc_data)
        if not success:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/resources/{resource_id}")
async def delete_resource(resource_id: int):
    """Delete resource (maps to document for mobile compatibility)."""
    try:
        success = db.delete_document(resource_id)
        if not success:
            raise HTTPException(status_code=404, detail="Resource not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Notebook API ---

@app.get("/api/notebook")
async def get_notebook_entries(project_id: Optional[int] = None, experiment_id: Optional[int] = None, limit: int = 100):
    """Get notebook entries, optionally filtered."""
    try:
        entries = notebook.get_all_entries(project_id=project_id, experiment_id=experiment_id, limit=limit)
        return {"entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebook/{entry_id}")
async def get_notebook_entry(entry_id: int):
    """Get a single notebook entry by ID."""
    try:
        entry = notebook.get_entry(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "data": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/notebook")
async def add_notebook_entry(data: Dict[str, Any]):
    """Add a new notebook entry."""
    try:
        # Prevent duplicate titles (case-insensitive)
        title = data.get('title', '').strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        
        existing = notebook.get_all_entries(limit=1000)
        if any(e['title'].strip().lower() == title.lower() for e in existing):
            raise HTTPException(status_code=400, detail=f"A notebook entry with the title '{title}' already exists.")

        entry_id = notebook.create_entry(
            title=title,
            content=data['content'],
            entry_type=data.get('entry_type', 'text'),
            project_id=data.get('project_id'),
            experiment_id=data.get('experiment_id'),
            tags=data.get('tags'),
            attachments=data.get('attachments'),
            voice_transcription=data.get('voice_transcription')
        )
        # Log activity
        db.log_activity('created', 'notebook_entry', entry_id, title)
        return {"id": entry_id, "message": "Entry added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/notebook/{entry_id}")
async def update_notebook_entry(entry_id: int, data: Dict[str, Any]):
    """Update a notebook entry."""
    try:
        # Prevent duplicate titles (case-insensitive, excluding current note)
        title = data.get('title')
        if title is not None:
            title = title.strip()
            if not title:
                raise HTTPException(status_code=400, detail="Title cannot be empty")
            
            existing = notebook.get_all_entries(limit=1000)
            if any(e['title'].strip().lower() == title.lower() and e['id'] != entry_id for e in existing):
                raise HTTPException(status_code=400, detail=f"A notebook entry with the title '{title}' already exists.")

        success = notebook.update_entry(
            entry_id=entry_id,
            title=title,
            content=data.get('content'),
            entry_type=data.get('entry_type'),
            project_id=data.get('project_id'),
            experiment_id=data.get('experiment_id'),
            tags=data.get('tags'),
            attachments=data.get('attachments'),
            voice_transcription=data.get('voice_transcription')
        )
        if success:
            # Log activity
            db.log_activity('updated', 'notebook_entry', entry_id, title if title else 'Unknown')
            return {"message": "Entry updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Entry not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/notebook/{entry_id}")
async def delete_notebook_entry(entry_id: int):
    """Delete a notebook entry."""
    try:
        success = notebook.delete_entry(entry_id)
        if success:
            return {"message": "Entry deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Entry not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Components (Inventory) API ---

@app.get("/api/components")
async def get_components(low_stock_only: bool = False):
    """Get all components, optionally filtering for low stock."""
    try:
        components = component_manager.get_all_components(low_stock_only=low_stock_only)
        return {"success": True, "data": components}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/components")
async def add_component(data: Dict[str, Any]):
    """Add a new component."""
    try:
        comp_id = component_manager.add_component(
            name=data['name'],
            part_number=data.get('part_number'),
            description=data.get('description'),
            quantity=data.get('quantity', 0),
            min_quantity=data.get('min_quantity', 5),
            storage_location=data.get('storage_location'),
            datasheet=data.get('datasheet'),
            supplier=data.get('supplier'),
            supplier_part_number=data.get('supplier_part_number'),
            notes=data.get('notes')
        )
        # Log activity
        db.log_activity('created', 'component', comp_id, data['name'])
        return {"id": comp_id, "message": "Component added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/components/{component_id}")
async def update_component(component_id: int, data: Dict[str, Any]):
    """Update a component."""
    try:
        success = component_manager.update_component(component_id, **data)
        if success:
            # Log activity
            db.log_activity('updated', 'component', component_id, data.get('name', 'Unknown'))
            return {"message": "Component updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Component not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/components/{component_id}")
async def delete_component(component_id: int):
    """Delete a component."""
    try:
        success = component_manager.delete_component(component_id)
        if success:
            return {"message": "Component deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Component not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Equipment API ---

@app.get("/api/equipment")
async def get_equipment():
    """Get all equipment."""
    try:
        equipment = equipment_manager.get_all_equipment()
        return {"success": True, "data": equipment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/equipment")
async def add_equipment(data: Dict[str, Any]):
    """Add new equipment."""
    try:
        eq_id = equipment_manager.add_equipment(
            name=data['name'],
            model=data['model'],
            status=data.get('status', 'available'),
            calibration_date=data.get('calibration_date')
        )
        return {"id": eq_id, "message": "Equipment added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/equipment/{equipment_id}")
async def get_equipment_detail(equipment_id: int):
    """Get details of a specific piece of equipment."""
    try:
        equipment = db.get_equipment(equipment_id)
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return {"success": True, "data": equipment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/equipment/{equipment_id}")
async def update_equipment(equipment_id: int, data: Dict[str, Any]):
    """Update equipment details."""
    try:
        success = db.update_equipment(equipment_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/equipment/{equipment_id}")
async def delete_equipment(equipment_id: int):
    """Delete a piece of equipment."""
    try:
        success = db.delete_equipment(equipment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/equipment/{equipment_id}/maintenance")
async def get_maintenance_records(equipment_id: int):
    """Get maintenance records for equipment."""
    try:
        records = equipment_manager.get_maintenance_records(equipment_id=equipment_id)
        return {"records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/equipment/{equipment_id}/maintenance")
async def add_maintenance_record(equipment_id: int, data: Dict[str, Any]):
    """Add a maintenance record."""
    try:
        record_id = equipment_manager.add_maintenance_record(
            equipment_id=equipment_id,
            maintenance_type=data['maintenance_type'],
            description=data.get('description'),
            performed_date=data.get('performed_date'),
            next_due_date=data.get('next_due_date'),
            performed_by=data.get('performed_by'),
            notes=data.get('notes')
        )
        return {"id": record_id, "message": "Maintenance record added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Findings API ---

@app.get("/api/findings")
async def get_findings(project_id: Optional[int] = None, experiment_id: Optional[int] = None, stage_id: Optional[int] = None):
    """Get all findings, optionally filtered by project, experiment, or stage."""
    try:
        findings = findings_manager.get_all_findings(project_id=project_id, experiment_id=experiment_id, stage_id=stage_id)
        return {"findings": findings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/findings")
async def add_finding(data: Dict[str, Any]):
    """Add a new finding."""
    try:
        finding_id = findings_manager.add_finding(
            title=data['title'],
            description=data.get('description'),
            project_id=data.get('project_id'),
            finding_type=data.get('finding_type', 'observation'),
            severity=data.get('severity', 'info'),
            root_cause=data.get('root_cause'),
            solution=data.get('solution'),
            recommendations=data.get('recommendations'),
            experiment_id=data.get('experiment_id'),
            stage_id=data.get('stage_id')
        )
        return {"id": finding_id, "message": "Finding added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/findings/{finding_id}")
async def update_finding(finding_id: int, data: Dict[str, Any]):
    """Update a finding."""
    try:
        success = findings_manager.update_finding(finding_id, **data)
        if success:
            return {"message": "Finding updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Finding not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/findings/{finding_id}")
async def delete_finding(finding_id: int):
    """Delete a finding."""
    try:
        success = findings_manager.delete_finding(finding_id)
        if success:
            return {"message": "Finding deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Finding not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Usage Logs API ---
@app.post("/api/usage")
async def add_usage(data: Dict[str, Any]):
    try:
        log_id = db.add_usage_log(
            project_id=data.get('project_id'),
            experiment_id=data.get('experiment_id'),
            stage_id=data.get('stage_id'),
            entity_type=data.get('entity_type'),
            entity_id=data.get('entity_id'),
            quantity_used=data.get('quantity_used', 0),
            unit=data.get('unit'),
            amount_left=data.get('amount_left'),
            post_use_status=data.get('post_use_status'),
            notes=data.get('notes'),
            user_id=data.get('user_id', 1),
            auto_update_inventory=data.get('auto_update_inventory', True)
        )
        return {"success": True, "data": {"id": log_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/usage")
async def get_usage(project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                    limit: int = 100, offset: int = 0, stage_id: Optional[int] = None):
    try:
        logs = db.get_usage_logs(project_id=project_id, experiment_id=experiment_id, limit=limit, offset=offset, stage_id=stage_id)
        return {"success": True, "data": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Experiment Stages API ---
@app.post("/api/experiment_stages")
async def create_experiment_stage(data: Dict[str, Any]):
    try:
        # Support both 'stage_name' and legacy 'name' fields
        stage_name = data.get('stage_name') or data.get('name')
        if not stage_name:
            raise HTTPException(status_code=400, detail='stage_name is required')
        if not data.get('experiment_id'):
            raise HTTPException(status_code=400, detail='experiment_id is required')

        stage_id = db.add_experiment_stage(
            experiment_id=data.get('experiment_id'),
            stage_name=stage_name,
            owner=data.get('owner'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            status=data.get('status', 'not_started'),
            notes=data.get('notes'),
            attachments=data.get('attachments')
        )
        return {"success": True, "data": {"id": stage_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/experiment_stages")
async def list_experiment_stages(experiment_id: Optional[int] = None, limit: int = 200, offset: int = 0):
    try:
        # If an experiment_id is provided, return stages for that experiment.
        # If not provided, return all stages (frontend sometimes calls this without query params).
        if experiment_id is not None:
            stages = db.get_experiment_stages(experiment_id, limit=limit, offset=offset)
        else:
            stages = db.get_all_experiment_stages(limit=limit, offset=offset)
        return {"success": True, "data": stages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/experiment_stages/{stage_id}")
async def update_experiment_stage(stage_id: int, data: Dict[str, Any]):
    try:
        success = db.update_experiment_stage(stage_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Stage not found or no valid fields")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Project Stages API ---
@app.post("/api/project_stages")
async def create_project_stage(data: Dict[str, Any]):
    try:
        # Support both 'stage_name' and legacy 'name' fields
        stage_name = data.get('stage_name') or data.get('name')
        if not stage_name:
            raise HTTPException(status_code=400, detail='stage_name is required')
        if not data.get('project_id'):
            raise HTTPException(status_code=400, detail='project_id is required')

        stage_id = db.add_project_stage(
            project_id=data.get('project_id'),
            stage_name=stage_name,
            owner=data.get('owner'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            status=data.get('status', 'not_started'),
            notes=data.get('notes'),
            attachments=data.get('attachments')
        )
        return {"success": True, "data": {"id": stage_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/project_stages")
async def list_project_stages(project_id: Optional[int] = None, limit: int = 200, offset: int = 0):
    try:
        # If a project_id is provided, return stages for that project.
        # If not provided, return all stages.
        if project_id is not None:
            stages = db.get_project_stages(project_id, limit=limit, offset=offset)
        else:
            stages = db.get_all_project_stages(limit=limit, offset=offset)
        return {"success": True, "data": stages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/project_stages/{stage_id}")
async def update_project_stage(stage_id: int, data: Dict[str, Any]):
    try:
        success = db.update_project_stage(stage_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Stage not found or no valid fields")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/project_stages/{stage_id}")
async def delete_project_stage(stage_id: int):
    """Delete a project stage."""
    try:
        success = db.delete_project_stage(stage_id)
        if not success:
            raise HTTPException(status_code=404, detail="Stage not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/usage/{usage_id}")
async def update_usage(usage_id: int, data: Dict[str, Any]):
    try:
        success = db.update_usage_log(usage_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Usage entry not found or no valid fields")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Projects API ---

@app.get("/api/projects")
async def get_projects():
    """Get all projects."""
    try:
        projects = db.get_all_projects()
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}")
async def get_project(project_id: int):
    """Get a single project by ID."""
    try:
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True, "data": project}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/name/{name}")
async def get_project_by_name(name: str):
    """Get a project by its name."""
    try:
        project = db.get_project_by_name(name)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True, "data": project}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/projects")
async def add_project(data: Dict[str, Any]):
    """Add a new project."""
    try:
        project_id = db.add_project(
            name=data['name'],
            description=data.get('description'),
            status=data.get('status', 'Active'),
            start_date=data.get('start_date'),
            summary_findings=data.get('summary_findings'),
            project_outcome=data.get('project_outcome')
        )
        return {"id": project_id, "message": "Project added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/projects/{project_id}")
async def update_project(project_id: int, data: Dict[str, Any]):
    """Update a project."""
    try:
        success = db.update_project(project_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int):
    """Delete a project."""
    try:
        success = db.delete_project(project_id)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/projects/{project_id}/pause")
async def pause_project(project_id: int):
    """Pause a project."""
    try:
        success = db.update_project(project_id, status="Paused")
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True, "status": "Paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/projects/{project_id}/resume")
async def resume_project(project_id: int):
    """Resume a paused project."""
    try:
        success = db.update_project(project_id, status="Active")
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True, "status": "Active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/usage-summary")
async def get_project_usage_summary(project_id: int):
    """Get component and material usage summary for a project."""
    try:
        summary = db.get_project_usage_summary(project_id)
        return {"success": True, "data": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/experiments/{experiment_id}/usage-summary")
async def get_experiment_usage_summary(experiment_id: int):
    """Get component and material usage summary for an experiment."""
    try:
        summary = db.get_experiment_usage_summary(experiment_id)
        return {"success": True, "data": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Experiments API (maps to logs for compatibility) ---

@app.get("/api/experiments")
async def get_experiments(project_id: Optional[int] = None):
    """Get all experiments (maps to R&D logs for mobile compatibility)."""
    try:
        if project_id:
            logs = db.get_all_rd_logs(project_id=project_id)
        else:
            logs = db.get_all_rd_logs(limit=100)
        
        # Transform logs to experiment format
        experiments = []
        for log in logs:
            experiments.append({
                'id': log['id'],
                'title': log.get('log_title', ''),
                'status': log.get('status', 'PENDING'),
                'project_id': log.get('project_id'),
                'project_name': log.get('project_name', ''),
                'date': log.get('date'),
                'expected_outcome': log.get('expected_outcome'),
                'actual_outcome': log.get('actual_outcome'),
                'findings': log.get('log_text', ''),
                'created_at': log.get('created_at'),
                'updated_at': log.get('updated_at')
            })
        
        return experiments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/experiments/{experiment_id}")
async def get_experiment(experiment_id: int):
    """Get experiment by ID (maps to R&D log for mobile compatibility)."""
    try:
        log = db.get_rd_log(experiment_id)
        if not log:
            raise HTTPException(status_code=404, detail="Experiment not found")
        
        return {
            'id': log['id'],
            'title': log.get('log_title', ''),
            'status': log.get('status', 'PENDING'),
            'project_id': log.get('project_id'),
            'project_name': log.get('project_name', ''),
            'date': log.get('date'),
            'expected_outcome': log.get('expected_outcome'),
            'actual_outcome': log.get('actual_outcome'),
            'findings': log.get('log_text', ''),
            'created_at': log.get('created_at'),
            'updated_at': log.get('updated_at')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/experiments")
async def create_experiment(data: Dict[str, Any]):
    """Create new experiment (maps to R&D log for mobile compatibility)."""
    try:
        log_id = db.add_rd_log(
            project_name=data.get('project_name', ''),
            log_title=data.get('title', ''),
            log_text=data.get('findings', ''),
            status=data.get('status', 'PENDING'),
            expected_outcome=data.get('expected_outcome'),
            actual_outcome=data.get('actual_outcome')
        )
        return {
            'id': log_id,
            'title': data.get('title', ''),
            'status': data.get('status', 'PENDING')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/experiments/{experiment_id}")
async def update_experiment(experiment_id: int, data: Dict[str, Any]):
    """Update experiment (maps to R&D log for mobile compatibility)."""
    try:
        # Map experiment fields to log fields
        log_data = {}
        if 'title' in data:
            log_data['log_title'] = data['title']
        if 'findings' in data:
            log_data['log_text'] = data['findings']
        if 'status' in data:
            log_data['status'] = data['status']
        if 'expected_outcome' in data:
            log_data['expected_outcome'] = data['expected_outcome']
        if 'actual_outcome' in data:
            log_data['actual_outcome'] = data['actual_outcome']
        
        success = db.update_rd_log(experiment_id, **log_data)
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/experiments/{experiment_id}")
async def delete_experiment(experiment_id: int):
    """Delete experiment (maps to R&D log for mobile compatibility)."""
    try:
        success = db.delete_rd_log(experiment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/experiments")
async def get_project_experiments(project_id: int):
    """Get experiments for a specific project (maps to R&D logs for mobile compatibility)."""
    try:
        logs = db.get_all_rd_logs(project_id=project_id)
        
        # Transform logs to experiment format
        experiments = []
        for log in logs:
            experiments.append({
                'id': log['id'],
                'title': log.get('log_title', ''),
                'status': log.get('status', 'PENDING'),
                'project_id': project_id,
                'project_name': log.get('project_name', ''),
                'date': log.get('date'),
                'expected_outcome': log.get('expected_outcome'),
                'actual_outcome': log.get('actual_outcome'),
                'findings': log.get('log_text', ''),
                'created_at': log.get('created_at'),
                'updated_at': log.get('updated_at')
            })
        
        return experiments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Tools (Inventory Tracker) API ---

@app.get("/api/tools")
async def get_all_tools():
    """Get all tool entries."""
    try:
        tools = db.get_all_tools()
        return {"success": True, "data": tools}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tools/{tool_id}")
async def get_tool(tool_id: int):
    """Get a single tool entry."""
    try:
        tool = db.get_tool(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        return {"success": True, "data": tool}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools")
async def create_tool(tool: ToolCreate):
    """Create a new tool entry."""
    try:
        tool_id = db.add_tool(
            name=tool.name,
            tool_type=tool.tool_type,
            description=tool.description,
            quantity=tool.quantity,
            min_quantity=tool.min_quantity,
            storage_location=tool.storage_location,
            status=tool.status,
            purchase_date=tool.purchase_date,
            supplier=tool.supplier,
            notes=tool.notes
        )
        return {"success": True, "data": {"id": tool_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/tools/{tool_id}")
async def update_tool(tool_id: int, tool: ToolUpdate):
    """Update a tool entry."""
    try:
        success = db.update_tool(tool_id, **tool.dict(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=404, detail="Tool not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: int):
    """Delete a tool entry."""
    try:
        success = db.delete_tool(tool_id)
        if not success:
            raise HTTPException(status_code=404, detail="Tool not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Materials (Inventory Tracker) API ---

@app.get("/api/materials")
async def get_all_materials():
    """Get all material entries."""
    try:
        materials = db.get_all_materials()
        return {"success": True, "data": materials}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/materials/{material_id}")
async def get_material(material_id: int):
    """Get a single material entry."""
    try:
        material = db.get_material(material_id)
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        return {"success": True, "data": material}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/materials")
async def create_material(material: MaterialCreate):
    """Create a new material entry."""
    try:
        material_id = db.add_material(
            name=material.name,
            material_type=material.material_type,
            description=material.description,
            quantity=material.quantity,
            unit=material.unit,
            min_quantity=material.min_quantity,
            storage_location=material.storage_location,
            purchase_date=material.purchase_date,
            supplier=material.supplier,
            notes=material.notes
        )
        return {"success": True, "data": {"id": material_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/materials/{material_id}")
async def update_material(material_id: int, material: MaterialUpdate):
    """Update a material entry."""
    try:
        success = db.update_material(material_id, **material.dict(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=404, detail="Material not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/materials/{material_id}")
async def delete_material(material_id: int):
    """Delete a material entry."""
    try:
        success = db.delete_material(material_id)
        if not success:
            raise HTTPException(status_code=404, detail="Material not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Inventory Usage API ---

@app.get("/api/equipment-usage")
async def get_equipment_usages():
    """Get all equipment usage records."""
    try:
        usages = db.get_all_equipment_usage()
        return {"success": True, "data": usages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/equipment-usage")
async def create_equipment_usage(usage: EquipmentUsageCreate):
    """Record checking out or starting use of equipment."""
    try:
        usage_id = db.add_equipment_usage(
            equipment_id=usage.equipment_id,
            usage_type=usage.usage_type,
            project_id=usage.project_id,
            experiment_id=usage.experiment_id,
            used_by=usage.used_by,
            condition_notes=usage.condition_notes,
            notes=usage.notes
        )
        return {"success": True, "data": {"id": usage_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/equipment-usage/{usage_id}/return")
async def return_equipment(usage_id: int, data: Dict[str, Any]):
    """Record returning or stopping use of equipment."""
    try:
        success = db.return_equipment(
            usage_id=usage_id,
            return_date=data.get('return_date'),
            post_use_status=data.get('post_use_status', 'usable'),
            condition_notes=data.get('condition_notes'),
            efficiency_percentage=data.get('efficiency_percentage')
        )
        if not success:
            raise HTTPException(status_code=404, detail="Usage record not found or already returned")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tool-usage")
async def get_tool_usages():
    """Get all tool usage records."""
    try:
        usages = db.get_all_tool_usage()
        return {"success": True, "data": usages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tool-usage")
async def create_tool_usage(usage: ToolUsageCreate):
    """Record a tool usage action."""
    try:
        usage_id = db.add_tool_usage(
            tool_id=usage.tool_id,
            quantity_used=usage.quantity_used,
            project_id=usage.project_id,
            experiment_id=usage.experiment_id,
            post_use_status=usage.post_use_status,
            condition_notes=usage.condition_notes,
            efficiency_percentage=usage.efficiency_percentage,
            notes=usage.notes
        )
        return {"success": True, "data": {"id": usage_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/material-usage")
async def get_material_usages():
    """Get all material usage records."""
    try:
        usages = db.get_all_material_usage()
        return {"success": True, "data": usages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/material-usage")
async def create_material_usage(usage: MaterialUsageCreate):
    """Record using some materials (automatically decrements inventory quantity)."""
    try:
        usage_id = db.add_material_usage(
            material_id=usage.material_id,
            quantity_used=usage.quantity_used,
            project_id=usage.project_id,
            experiment_id=usage.experiment_id,
            notes=usage.notes
        )
        return {"success": True, "data": {"id": usage_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Finance: Funding Sources API ---

@app.get("/api/funding-sources")
async def get_all_funding_sources():
    """Get all funding sources."""
    try:
        sources = db.get_all_funding_sources()
        return {"success": True, "data": sources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/funding-sources/{source_id}")
async def get_funding_source(source_id: int):
    """Get a funding source by ID."""
    try:
        source = db.get_funding_source(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Funding source not found")
        return {"success": True, "data": source}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/funding-sources")
async def create_funding_source(data: Dict[str, Any]):
    """Create a new funding source."""
    try:
        source_id = db.add_funding_source(
            name=data['name'],
            source_type=data.get('source_type'),
            description=data.get('description'),
            budget_limit=data.get('budget_limit'),
            current_balance=data.get('current_balance', 0),
            account_number=data.get('account_number'),
            contact_person=data.get('contact_person')
        )
        return {"success": True, "data": {"id": source_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/funding-sources/{source_id}")
async def update_funding_source(source_id: int, data: Dict[str, Any]):
    """Update a funding source."""
    try:
        success = db.update_funding_source(source_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Funding source not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/funding-sources/{source_id}")
async def delete_funding_source(source_id: int):
    """Delete a funding source."""
    try:
        success = db.delete_funding_source(source_id)
        if not success:
            raise HTTPException(status_code=404, detail="Funding source not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Finance: Purchases API ---

@app.get("/api/purchases")
async def get_all_purchases():
    """Get all purchases."""
    try:
        purchases = db.get_all_purchases()
        return {"success": True, "data": purchases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/purchases/{purchase_id}")
async def get_purchase(purchase_id: int):
    """Get a purchase by ID."""
    try:
        purchase = db.get_purchase(purchase_id)
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase not found")
        return {"success": True, "data": purchase}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/purchases/item/{item_type}/{item_id}")
async def get_purchases_by_item(item_type: str, item_id: int):
    """Get all purchases for a specific item."""
    try:
        purchases = db.get_purchases_by_item(item_type, item_id)
        return {"success": True, "data": purchases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/purchases")
async def create_purchase(data: Dict[str, Any]):
    """Record a purchase."""
    try:
        purchase_id = db.add_purchase(
            item_type=data['item_type'],
            item_id=data['item_id'],
            purchase_date=data.get('purchase_date'),
            cost=data['cost'],
            currency=data.get('currency', 'USD'),
            vendor=data.get('vendor'),
            invoice_number=data.get('invoice_number'),
            funding_source_id=data.get('funding_source_id'),
            notes=data.get('notes')
        )
        return {"success": True, "data": {"id": purchase_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/purchases/{purchase_id}")
async def delete_purchase(purchase_id: int):
    """Delete a purchase."""
    try:
        success = db.delete_purchase(purchase_id)
        if not success:
            raise HTTPException(status_code=404, detail="Purchase not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Finance: Maintenance Costs API ---

@app.get("/api/maintenance-costs")
async def get_all_maintenance_costs(funding_source_id: Optional[int] = None):
    """Get all maintenance costs."""
    try:
        costs = db.get_all_maintenance_costs(funding_source_id=funding_source_id)
        return {"success": True, "data": costs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/maintenance-costs/{cost_id}")
async def get_maintenance_cost(cost_id: int):
    """Get a maintenance cost by ID."""
    try:
        cost = db.get_maintenance_cost(cost_id)
        if not cost:
            raise HTTPException(status_code=404, detail="Maintenance cost not found")
        return {"success": True, "data": cost}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/maintenance-costs/item/{item_type}/{item_id}")
async def get_maintenance_costs_by_item(item_type: str, item_id: int):
    """Get all maintenance costs for a specific item."""
    try:
        costs = db.get_maintenance_costs_by_item(item_type, item_id)
        return {"success": True, "data": costs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/maintenance-costs")
async def create_maintenance_cost(data: Dict[str, Any]):
    """Record a maintenance cost."""
    try:
        cost_id = db.add_maintenance_cost(
            item_type=data['item_type'],
            item_id=data['item_id'],
            maintenance_date=data.get('maintenance_date'),
            cost=data['cost'],
            currency=data.get('currency', 'USD'),
            funding_source_id=data.get('funding_source_id'),
            service_provider=data.get('service_provider'),
            description=data.get('description'),
            invoice_number=data.get('invoice_number'),
            notes=data.get('notes')
        )
        return {"success": True, "data": {"id": cost_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/maintenance-costs/{cost_id}")
async def delete_maintenance_cost(cost_id: int):
    """Delete a maintenance cost."""
    try:
        success = db.delete_maintenance_cost(cost_id)
        if not success:
            raise HTTPException(status_code=404, detail="Maintenance cost not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Finance: Gains/Income API ---

@app.get("/api/gains")
async def get_all_gains(funding_source_id: Optional[int] = None, project_id: Optional[int] = None):
    """Get all gains, optionally filtered by funding source or project."""
    try:
        gains = db.get_all_gains(funding_source_id=funding_source_id, project_id=project_id)
        return {"success": True, "data": gains}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gains/{gain_id}")
async def get_gain(gain_id: int):
    """Get a gain by ID."""
    try:
        gain = db.get_gain(gain_id)
        if not gain:
            raise HTTPException(status_code=404, detail="Gain not found")
        return {"success": True, "data": gain}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gains")
async def create_gain(data: Dict[str, Any]):
    """Create a new gain/income."""
    try:
        gain_id = db.add_gain(
            gain_type=data['gain_type'],
            amount=data['amount'],
            gain_date=data['gain_date'],
            currency=data.get('currency', 'USD'),
            source=data.get('source'),
            description=data.get('description'),
            funding_source_id=data.get('funding_source_id'),
            project_id=data.get('project_id'),
            category=data.get('category'),
            status=data.get('status', 'confirmed')
        )
        return {"success": True, "data": {"id": gain_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/gains/{gain_id}")
async def update_gain(gain_id: int, data: Dict[str, Any]):
    """Update a gain."""
    try:
        success = db.update_gain(gain_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Gain not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/gains/{gain_id}")
async def delete_gain(gain_id: int):
    """Delete a gain."""
    try:
        success = db.delete_gain(gain_id)
        if not success:
            raise HTTPException(status_code=404, detail="Gain not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Research Logs API (supporting both /api/logs and legacy /api/rd-logs) ---

@app.get("/api/logs")
async def get_all_rd_logs(project_name: Optional[str] = None,
                         project_id: Optional[int] = None,
                         stage_id: Optional[int] = None,
                         outcome: Optional[str] = None,
                         start_date: Optional[str] = None,
                         end_date: Optional[str] = None,
                         limit: int = 200, offset: int = 0):
    """Get all R&D logs, optionally filtered by project, outcome, or date range."""
    try:
        logs = db.get_all_rd_logs(
            project_name=project_name,
            project_id=project_id,
            stage_id=stage_id,
            outcome=outcome,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        return {"success": True, "data": logs, "count": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs/{log_id}")
async def get_rd_log(log_id: int):
    """Get an R&D log by ID."""
    try:
        log = db.get_rd_log(log_id)
        if not log:
            raise HTTPException(status_code=404, detail="R&D log not found")
        return {"success": True, "data": log}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/logs")
async def create_rd_log(data: Dict[str, Any]):
    """Create a new R&D log."""
    try:
        log_id = db.add_rd_log(
                project_name=data.get('project_name', ''),
                log_title=data['log_title'],
                log_text=data.get('log_text', ''),
                cloud_file_url=data.get('cloud_file_url'),
                is_downloaded_locally=data.get('is_downloaded_locally', False),
                project_id=data.get('project_id'),
                stage_id=data.get('stage_id'),
                outcome=data.get('outcome', 'PENDING'),
                expected_outcome=data.get('expected_outcome'),
                actual_outcome=data.get('actual_outcome'),
                findings=data.get('findings'),
                conclusion=data.get('conclusion')
            )
        return {"success": True, "data": {"id": log_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/logs/{log_id}")
async def update_rd_log(log_id: int, data: Dict[str, Any]):
    """Update an R&D log."""
    try:
        success = db.update_rd_log(log_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="R&D log not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/logs/{log_id}")
async def delete_rd_log(log_id: int):
    """Delete an R&D log."""
    try:
        success = db.delete_rd_log(log_id)
        if not success:
            raise HTTPException(status_code=404, detail="R&D log not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/logs/{log_id}/pause")
async def pause_experiment(log_id: int):
    """Pause an experiment."""
    try:
        success = db.update_rd_log(log_id, status="Paused")
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return {"success": True, "status": "Paused"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/logs/{log_id}/resume")
async def resume_experiment(log_id: int):
    """Resume a paused experiment."""
    try:
        success = db.update_rd_log(log_id, status="Active")
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return {"success": True, "status": "Active"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Legacy /api/rd-logs endpoints for backwards compatibility ---

@app.get("/api/rd-logs")
async def get_all_rd_logs_legacy(project_name: Optional[str] = None):
    try:
        logs = db.get_all_rd_logs(project_name=project_name)
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rd-logs/{log_id}")
async def get_rd_log_legacy(log_id: int):
    try:
        log = db.get_rd_log(log_id)
        if not log:
            raise HTTPException(status_code=404, detail="R&D log not found")
        return log
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rd-logs")
async def create_rd_log_legacy(log: RdLogCreate):
    try:
        log_id = db.add_rd_log(
            project_name=log.project_name,
            log_title=log.log_title,
            log_text=log.log_text,
            cloud_file_url=log.cloud_file_url,
                is_downloaded_locally=log.is_downloaded_locally,
                stage_id=getattr(log, 'stage_id', None)
        )
        return {"id": log_id, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/rd-logs/{log_id}")
async def update_rd_log_legacy(log_id: int, log: RdLogUpdate):
    try:
        success = db.update_rd_log(log_id, **log.dict(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=404, detail="R&D log not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/rd-logs/{log_id}")
async def delete_rd_log_legacy(log_id: int):
    try:
        success = db.delete_rd_log(log_id)
        if not success:
            raise HTTPException(status_code=404, detail="R&D log not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rd-logs/{log_id}/mark-downloaded")
async def mark_log_downloaded(log_id: int):
    try:
        success = db.update_rd_log(log_id, is_downloaded_locally=True)
        if not success:
            raise HTTPException(status_code=404, detail="Log entry not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rd-logs/{log_id}/link-project/{project_id}")
async def link_log_to_project(log_id: int, project_id: int):
    try:
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        success = db.update_rd_log(log_id, project_name=project['name'])
        if not success:
            raise HTTPException(status_code=404, detail="Log entry not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Data Analysis API ---

@app.post("/api/analysis/analyze")
async def analyze_file(request: DataAnalysisRequest):
    """Analyze a data file with lazy loading support."""
    try:
        df, stats = processor.analyze_file(
            file_path=request.file_path,
            force_download=request.force_download
        )
        df_dict = df.to_dict(orient='records')
        return {
            "success": True,
            "data": {
                "rows": df_dict,
                "statistics": stats,
                "row_count": len(df),
                "column_count": len(df.columns)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/filter")
async def filter_data(request: DataFilterRequest):
    """Filter data based on column value range."""
    try:
        df = processor.load_data(request.file_path)
        filtered_df = processor.filter_data(
            df=df,
            column=request.column,
            min_value=request.min_value,
            max_value=request.max_value
        )
        df_dict = filtered_df.to_dict(orient='records')
        return {
            "success": True,
            "data": {
                "rows": df_dict,
                "row_count": len(filtered_df)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/column-info")
async def get_column_info(request: DataAnalysisRequest):
    """Get information about DataFrame columns."""
    try:
        df = processor.load_data(request.file_path)
        info = processor.get_column_info(df)
        return {"success": True, "data": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Voice Control API ---

@app.get("/api/voice/status")
async def get_voice_status():
    """Get status of the voice assistant."""
    return {
        "active": voice_listener is not None and voice_listener.is_active(),
        "wake_word": voice_listener.wake_word if voice_listener else "jarvis"
    }


@app.post("/api/voice/start")
async def start_voice_assistant(control: VoiceControl, background_tasks: BackgroundTasks):
    """Start the voice assistant in the background."""
    global voice_listener
    
    if voice_listener and voice_listener.is_active():
        return {"status": "already_running", "wake_word": voice_listener.wake_word}
    
    try:
        voice_listener = VoiceListener(
            db_path=os.getenv("DATABASE_PATH", "local_cache.db"),
            wake_word=control.wake_word
        )
        
        # Start in background task to not block API request
        background_tasks.add_task(voice_listener.start)
        
        # Small sleep to allow startup
        time.sleep(0.5)
        
        return {"status": "started", "wake_word": control.wake_word}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice/stop")
async def stop_voice_assistant():
    """Stop the voice assistant."""
    global voice_listener
    
    if not voice_listener or not voice_listener.is_active():
        return {"status": "not_running"}
    
    try:
        voice_listener.stop()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice/command")
async def process_voice_command_api(cmd: VoiceCommand):
    """Manually submit a voice command string for processing."""
    from voice.interpreter import process_voice_command
    try:
        response = process_voice_command(
            command_text=cmd.command,
            db_path=os.getenv("DATABASE_PATH", "local_cache.db")
        )
        return {"success": True, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Engineering Toolbox API (Calculations) ---

@app.get("/api/calculations")
async def get_calculations(project_id: Optional[int] = None, calculation_type: Optional[str] = None):
    """Get all calculations, optionally filtered by project or type."""
    try:
        calculations = db.get_all_calculations(project_id=project_id, calculation_type=calculation_type)
        return {"calculations": calculations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calculations/{calc_id}")
async def get_calculation(calc_id: int):
    """Get a single calculation by ID."""
    try:
        calculation = db.get_calculation(calc_id)
        if not calculation:
            raise HTTPException(status_code=404, detail="Calculation not found")
        return {"success": True, "data": calculation}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculations")
async def create_calculation(data: Dict[str, Any]):
    """Create a new calculation."""
    try:
        calc_id = db.add_calculation(
            title=data['title'],
            calculation_type=data['calculation_type'],
            input_parameters=data.get('input_parameters', ''),
            result=data['result'],
            formula=data.get('formula'),
            project_id=data.get('project_id'),
            component_id=data.get('component_id')
        )
        return {"id": calc_id, "message": "Calculation created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/calculations/{calc_id}")
async def delete_calculation(calc_id: int):
    """Delete a calculation."""
    try:
        success = db.delete_calculation(calc_id)
        if success:
            return {"message": "Calculation deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Calculation not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/ohms_law")
async def calculate_ohms_law(data: Dict[str, Any]):
    """Calculate Ohm's Law."""
    try:
        result = toolbox.ohms_law(
            voltage=data.get('voltage'),
            current=data.get('current'),
            resistance=data.get('resistance')
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/voltage_divider")
async def calculate_voltage_divider(data: Dict[str, Any]):
    """Calculate voltage divider."""
    try:
        result = toolbox.voltage_divider(
            vin=data['vin'],
            r1=data['r1'],
            r2=data['r2']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/led_resistor")
async def calculate_led_resistor(data: Dict[str, Any]):
    """Calculate LED resistor."""
    try:
        result = toolbox.led_resistor(
            vs=data['vs'],
            vf=data['vf'],
            if_current=data['if_current']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/statistics")
async def calculate_statistics(data: Dict[str, Any]):
    """Calculate statistics."""
    try:
        result = toolbox.statistics(data['data'])
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# New Electronics Calculators
@app.post("/api/toolbox/rc_time_constant")
async def calculate_rc_time_constant(data: Dict[str, Any]):
    """Calculate RC time constant."""
    try:
        result = toolbox.rc_time_constant(
            resistance=data['resistance'],
            capacitance=data['capacitance']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/lc_resonant_frequency")
async def calculate_lc_resonant_frequency(data: Dict[str, Any]):
    """Calculate LC resonant frequency."""
    try:
        result = toolbox.lc_resonant_frequency(
            inductance=data['inductance'],
            capacitance=data['capacitance']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/capacitor_energy")
async def calculate_capacitor_energy(data: Dict[str, Any]):
    """Calculate capacitor energy."""
    try:
        result = toolbox.capacitor_energy(
            capacitance=data['capacitance'],
            voltage=data['voltage']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/inductor_energy")
async def calculate_inductor_energy(data: Dict[str, Any]):
    """Calculate inductor energy."""
    try:
        result = toolbox.inductor_energy(
            inductance=data['inductance'],
            current=data['current']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/rlc_impedance")
async def calculate_rlc_impedance(data: Dict[str, Any]):
    """Calculate RLC impedance."""
    try:
        result = toolbox.rlc_impedance(
            resistance=data['resistance'],
            inductance=data['inductance'],
            capacitance=data['capacitance'],
            frequency=data['frequency']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/pwm_duty_cycle")
async def calculate_pwm_duty_cycle(data: Dict[str, Any]):
    """Calculate PWM duty cycle."""
    try:
        result = toolbox.pwm_duty_cycle(
            on_time=data['on_time'],
            period=data['period']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/toolbox/battery_runtime")
async def calculate_battery_runtime(data: Dict[str, Any]):
    """Calculate battery runtime (hours = capacity_mAh / current_mA)."""
    try:
        result = toolbox.battery_runtime(
            capacity_mah=data['capacity_mah'],
            current_ma=data['current_ma']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Mechanical Calculators
@app.post("/api/toolbox/gear_ratio")
async def calculate_gear_ratio(data: Dict[str, Any]):
    """Calculate gear ratio from driver and driven teeth count."""
    try:
        result = toolbox.gear_ratio(
            teeth_driver=data['teeth_driver'],
            teeth_driven=data['teeth_driven']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/torque")
async def calculate_torque(data: Dict[str, Any]):
    """Calculate torque (τ = r × F × sin θ)."""
    try:
        result = toolbox.torque(
            force=data['force'],
            radius=data['radius'],
            angle=data.get('angle', 90)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/angular_velocity")
async def calculate_angular_velocity(data: Dict[str, Any]):
    """Convert RPM to angular velocity (ω = RPM × 2π / 60)."""
    try:
        result = toolbox.angular_velocity(rpm=data['rpm'])
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/thermal_resistance")
async def calculate_thermal_resistance(data: Dict[str, Any]):
    """Calculate thermal resistance (Rθ = ΔT / P)."""
    try:
        result = toolbox.thermal_resistance(
            temperature_rise=data['temperature_rise'],
            power=data['power']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/heat_dissipation")
async def calculate_heat_dissipation(data: Dict[str, Any]):
    """Calculate temperature rise from heat dissipation (ΔT = Rθ × P)."""
    try:
        result = toolbox.heat_dissipation(
            thermal_resistance=data['thermal_resistance'],
            power=data['power']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/temperature_rise")
async def calculate_temperature_rise(data: Dict[str, Any]):
    """Calculate final temperature from ambient + thermal rise."""
    try:
        result = toolbox.temperature_rise(
            ambient_temp=data['ambient_temp'],
            power=data['power'],
            thermal_resistance=data['thermal_resistance']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/decibel")
async def calculate_decibel(data: Dict[str, Any]):
    """Calculate decibels from a power ratio (dB = 10 × log10(P2/P1))."""
    try:
        result = toolbox.decibel(
            power_ratio=data['power_ratio'],
            reference=data.get('reference')
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/frequency_to_wavelength")
async def calculate_frequency_to_wavelength(data: Dict[str, Any]):
    """Calculate wavelength from frequency (λ = c / f)."""
    try:
        result = toolbox.frequency_to_wavelength(
            frequency=data['frequency'],
            speed_of_light=data.get('speed_of_light', 299792458)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/baud_rate")
async def calculate_baud_rate(data: Dict[str, Any]):
    """Calculate baud rate from bit rate (Baud = Bit Rate / Bits per Symbol)."""
    try:
        result = toolbox.baud_rate(
            bit_rate=data['bit_rate'],
            bits_per_symbol=data.get('bits_per_symbol', 8)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/convert_length")
async def convert_length(data: Dict[str, Any]):
    """Convert length between different units."""
    try:
        result = toolbox.convert_length(
            value=data['value'],
            from_unit=data['from_unit'],
            to_unit=data['to_unit']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/convert_mass")
async def convert_mass(data: Dict[str, Any]):
    """Convert mass between different units."""
    try:
        result = toolbox.convert_mass(
            value=data['value'],
            from_unit=data['from_unit'],
            to_unit=data['to_unit']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/convert_temperature")
async def convert_temperature(data: Dict[str, Any]):
    """Convert temperature between different units."""
    try:
        result = toolbox.convert_temperature(
            value=data['value'],
            from_unit=data['from_unit'],
            to_unit=data['to_unit']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/convert_pressure")
async def convert_pressure(data: Dict[str, Any]):
    """Convert pressure between different units."""
    try:
        result = toolbox.convert_pressure(
            value=data['value'],
            from_unit=data['from_unit'],
            to_unit=data['to_unit']
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/awg_wire_gauge")
async def calculate_awg_wire_gauge(data: Dict[str, Any]):
    """Get dimensions and characteristics of an AWG wire gauge."""
    try:
        result = toolbox.awg_wire_gauge(awg=data['awg'])
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/toolbox/wire_resistance")
async def calculate_wire_resistance(data: Dict[str, Any]):
    """Calculate resistance of a wire given AWG, length, temperature, and material."""
    try:
        result = toolbox.wire_resistance(
            awg=data['awg'],
            length=data['length'],
            temperature=data.get('temperature', 20),
            material=data.get('material', 'copper')
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Semantic Search API ---

@app.get("/api/search")
async def perform_search(query: str, limit: int = 5):
    """Perform semantic search across projects, documents, logs, and findings."""
    try:
        results = semantic_search.search(query=query, limit=limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search/summary")
async def generate_search_summary(query: str):
    """Generate a summarized response for a search query using stored matches."""
    try:
        summary = semantic_search.generate_search_summary(query=query)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Gemini AI Assistant API Routes ---

def get_gemini():
    """Lazy-load the Gemini assistant to avoid startup errors if API key not set."""
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Google GenAI SDK not installed. Install with: pip install google-generativeai")
    
    global gemini_assistant
    if gemini_assistant is None:
        try:
            gemini_assistant = GeminiLabAssistant()
        except ValueError as e:
            raise HTTPException(status_code=500, detail=f"Gemini API key not configured: {str(e)}")
    return gemini_assistant


@app.post("/api/ai/stage-review")
async def review_stage_design(request: StageReviewRequest):
    """Feature A: Stage Design Reviewer - Analyze project stage for thermal risks, component mismatches, or logic flaws."""
    try:
        assistant = get_gemini()
        from fastapi.responses import StreamingResponse
        
        def generate():
            for chunk in assistant.review_stage_data(request.stage_context):
                yield chunk
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/find-alternates")
async def find_component_alternates(request: ComponentAlternatesRequest):
    """Feature B: Smart Substitute Finder - Find pin-compatible, drop-in alternatives for components."""
    try:
        assistant = get_gemini()
        from fastapi.responses import StreamingResponse
        
        def generate():
            for chunk in assistant.find_alternates(request.component_details):
                yield chunk
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/diagnose-failure")
async def diagnose_circuit_failure(request: FailureDiagnosisRequest):
    """Feature C: Failure Mode Analyzer - Diagnose circuit failures based on observations and experiment history."""
    try:
        assistant = get_gemini()
        from fastapi.responses import StreamingResponse
        
        def generate():
            for chunk in assistant.diagnose_failure(request.observation, request.experiment_history):
                yield chunk
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/generate-script")
async def generate_test_script(request: TestScriptRequest):
    """Feature D: Lab Automation Scripting - Generate production-ready test automation scripts."""
    try:
        assistant = get_gemini()
        from fastapi.responses import StreamingResponse
        
        def generate():
            for chunk in assistant.generate_test_script(request.requirement, request.language):
                yield chunk
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/chat")
async def gemini_chat(request: ChatRequest):
    """General Chat Interface - Handle general conversations with Gemini."""
    try:
        assistant = get_gemini()
        from fastapi.responses import StreamingResponse
        
        # Save user message to database before streaming
        session_id = 'default'
        try:
            db.save_ai_chat_message(session_id, 'user', request.message)
        except Exception as e:
            print(f"Warning: Failed to save user message: {e}")
        
        def generate():
            try:
                full_response = ""
                for chunk in assistant.chat(request.message, request.conversation_history):
                    full_response += chunk
                    yield chunk
                
                # Save model response to database after streaming
                try:
                    db.save_ai_chat_message(session_id, 'model', full_response)
                except Exception as e:
                    print(f"Warning: Failed to save model response: {e}")
            except Exception as e:
                yield f"Error generating response: {str(e)}"
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Error in /api/ai/chat: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai/chat-history")
async def get_chat_history(session_id: str = "default", project_id: Optional[int] = None, experiment_id: Optional[int] = None):
    """Get AI chat history for a session."""
    try:
        history = db.get_ai_chat_history(session_id, project_id, experiment_id)
        return {"success": True, "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/ai/chat-history")
async def delete_chat_history(session_id: str):
    """Delete AI chat history for a session."""
    try:
        success = db.delete_ai_chat_history(session_id)
        return {"success": True, "deleted": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai/chat-sessions")
async def get_chat_sessions():
    """Get all unique chat session IDs with metadata."""
    try:
        sessions = db.get_ai_chat_sessions()
        return {"success": True, "data": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cleanup/old-activities")
async def cleanup_old_activities(hours: int = 24):
    """Delete activity log entries older than specified hours."""
    try:
        deleted_count = db.delete_old_activities(hours)
        return {"success": True, "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Sync API ---

@app.post("/api/sync/transactions")
async def sync_transactions(data: Dict[str, Any]):
    """Receive sync transactions from mobile devices."""
    try:
        transactions = data.get('transactions', [])
        device_id = data.get('device_id')
        
        # Process each transaction
        for tx in transactions:
            table_name = tx.get('table_name')
            operation = tx.get('operation')
            payload = tx.get('payload')
            
            if operation == 'INSERT':
                if table_name == 'projects':
                    db.add_project(**payload)
                elif table_name == 'experiments':
                    # Map to logs
                    db.add_rd_log(
                        project_name=payload.get('project_name', ''),
                        log_title=payload.get('title', ''),
                        log_text=payload.get('findings', ''),
                        status=payload.get('status', 'Active')
                    )
                elif table_name == 'findings':
                    db.add_finding(**payload)
            elif operation == 'UPDATE':
                record_id = payload.get('_record_id') or payload.get('id')
                if record_id:
                    if table_name == 'projects':
                        db.update_project(record_id, **payload)
                    elif table_name == 'experiments':
                        db.update_rd_log(record_id, **payload)
                    elif table_name == 'findings':
                        db.update_finding(record_id, **payload)
            elif operation == 'DELETE':
                record_id = payload.get('_record_id') or payload.get('id')
                if record_id:
                    if table_name == 'projects':
                        db.delete_project(record_id)
                    elif table_name == 'experiments':
                        db.delete_rd_log(record_id)
                    elif table_name == 'findings':
                        db.delete_finding(record_id)
        
        return {"success": True, "processed": len(transactions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sync/updates")
async def get_sync_updates(since: Optional[str] = None):
    """Get updates since last sync for mobile devices."""
    try:
        updates = []
        
        # Get recent projects
        projects = db.get_all_projects()
        for project in projects:
            if since and project.get('updated_at') and project['updated_at'] < since:
                continue
            updates.append({
                'table_name': 'projects',
                'operation': 'UPDATE',
                'payload': project,
                'timestamp': project.get('updated_at') or project.get('created_at')
            })
        
        # Get recent logs (experiments)
        logs = db.get_all_rd_logs(limit=100)
        for log in logs:
            if since and log.get('updated_at') and log['updated_at'] < since:
                continue
            updates.append({
                'table_name': 'experiments',
                'operation': 'UPDATE',
                'payload': log,
                'timestamp': log.get('updated_at') or log.get('created_at')
            })
        
        # Get recent findings
        findings = findings_manager.get_all_findings()
        for finding in findings:
            if since and finding.get('updated_at') and finding['updated_at'] < since:
                continue
            updates.append({
                'table_name': 'findings',
                'operation': 'UPDATE',
                'payload': finding,
                'timestamp': finding.get('updated_at') or finding.get('created_at')
            })
        
        return {"success": True, "updates": updates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Toolbox/Calculator API ---

@app.post("/api/tools/ohms-law")
async def calculate_ohms_law(data: Dict[str, Any]):
    """Calculate Ohm's Law (V = I * R)."""
    try:
        result = toolbox.ohms_law(
            voltage=data.get('voltage'),
            current=data.get('current'),
            resistance=data.get('resistance')
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/voltage-divider")
async def calculate_voltage_divider(data: Dict[str, Any]):
    """Calculate voltage divider output."""
    try:
        result = toolbox.voltage_divider(
            vin=data['vin'],
            r1=data['r1'],
            r2=data['r2']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/power")
async def calculate_power(data: Dict[str, Any]):
    """Calculate power (P = V * I = V² / R = I² * R)."""
    try:
        result = toolbox.power_calculator(
            voltage=data['voltage'],
            current=data.get('current'),
            resistance=data.get('resistance')
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/led-resistor")
async def calculate_led_resistor(data: Dict[str, Any]):
    """Calculate LED resistor value."""
    try:
        result = toolbox.led_resistor(
            vs=data['vs'],
            vf=data['vf'],
            if_current=data['if_current']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/battery-runtime")
async def calculate_battery_runtime(data: Dict[str, Any]):
    """Calculate battery runtime."""
    try:
        result = toolbox.battery_runtime(
            capacity_mah=data['capacity_mah'],
            current_ma=data['current_ma']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/rc-time-constant")
async def calculate_rc_time_constant(data: Dict[str, Any]):
    """Calculate RC time constant (τ = R * C)."""
    try:
        result = toolbox.rc_time_constant(
            resistance=data['resistance'],
            capacitance=data['capacitance']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/lc-resonant-frequency")
async def calculate_lc_resonant_frequency(data: Dict[str, Any]):
    """Calculate LC resonant frequency (f = 1 / (2π * √(LC)))."""
    try:
        result = toolbox.lc_resonant_frequency(
            inductance=data['inductance'],
            capacitance=data['capacitance']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/scientific-calculator")
async def calculate_scientific(data: Dict[str, Any]):
    """Evaluate a mathematical expression."""
    try:
        result = toolbox.scientific_calculator(expression=data['expression'])
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/statistics")
async def calculate_statistics(data: Dict[str, Any]):
    """Calculate basic statistics for a dataset."""
    try:
        result = toolbox.statistics(data=data['data'])
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/matrix-multiply")
async def calculate_matrix_multiply(data: Dict[str, Any]):
    """Multiply two matrices."""
    try:
        result = toolbox.matrix_multiply(
            matrix_a=data['matrix_a'],
            matrix_b=data['matrix_b']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/capacitor-energy")
async def calculate_capacitor_energy(data: Dict[str, Any]):
    """Calculate energy stored in a capacitor (E = 0.5 * C * V²)."""
    try:
        result = toolbox.capacitor_energy(
            capacitance=data['capacitance'],
            voltage=data['voltage']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/inductor-energy")
async def calculate_inductor_energy(data: Dict[str, Any]):
    """Calculate energy stored in an inductor (E = 0.5 * L * I²)."""
    try:
        result = toolbox.inductor_energy(
            inductance=data['inductance'],
            current=data['current']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/rlc-impedance")
async def calculate_rlc_impedance(data: Dict[str, Any]):
    """Calculate RLC circuit impedance."""
    try:
        result = toolbox.rlc_impedance(
            resistance=data['resistance'],
            inductance=data['inductance'],
            capacitance=data['capacitance'],
            frequency=data['frequency']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/pwm-duty-cycle")
async def calculate_pwm_duty_cycle(data: Dict[str, Any]):
    """Calculate PWM duty cycle."""
    try:
        result = toolbox.pwm_duty_cycle(
            on_time=data['on_time'],
            period=data['period']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/gear-ratio")
async def calculate_gear_ratio(data: Dict[str, Any]):
    """Calculate gear ratio."""
    try:
        result = toolbox.gear_ratio(
            teeth_driver=data['teeth_driver'],
            teeth_driven=data['teeth_driven']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/torque")
async def calculate_torque(data: Dict[str, Any]):
    """Calculate torque (τ = r * F * sin(θ))."""
    try:
        result = toolbox.torque(
            force=data['force'],
            radius=data['radius'],
            angle=data.get('angle', 90)
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/thermal-resistance")
async def calculate_thermal_resistance(data: Dict[str, Any]):
    """Calculate thermal resistance (Rθ = ΔT / P)."""
    try:
        result = toolbox.thermal_resistance(
            temperature_rise=data['temperature_rise'],
            power=data['power']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/heat-dissipation")
async def calculate_heat_dissipation(data: Dict[str, Any]):
    """Calculate temperature rise from heat dissipation (ΔT = Rθ * P)."""
    try:
        result = toolbox.heat_dissipation(
            thermal_resistance=data['thermal_resistance'],
            power=data['power']
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/decibel")
async def calculate_decibel(data: Dict[str, Any]):
    """Calculate decibels from power ratio."""
    try:
        result = toolbox.decibel(
            power_ratio=data['power_ratio'],
            reference=data.get('reference')
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/frequency-to-wavelength")
async def calculate_frequency_to_wavelength(data: Dict[str, Any]):
    """Calculate wavelength from frequency (λ = c / f)."""
    try:
        result = toolbox.frequency_to_wavelength(
            frequency=data['frequency'],
            speed_of_light=data.get('speed_of_light', 299792458)
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/baud-rate")
async def calculate_baud_rate(data: Dict[str, Any]):
    """Calculate baud rate from bit rate."""
    try:
        result = toolbox.baud_rate(
            bit_rate=data['bit_rate'],
            bits_per_symbol=data.get('bits_per_symbol', 8)
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/wire-resistance")
async def calculate_wire_resistance(data: Dict[str, Any]):
    """Calculate wire resistance."""
    try:
        result = toolbox.wire_resistance(
            awg=data['awg'],
            length=data['length'],
            temperature=data.get('temperature', 20),
            material=data.get('material', 'copper')
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Mobile Notebook API ---

@app.post("/api/notebook/mobile")
async def create_notebook_entry_mobile(data: Dict[str, Any]):
    """Create a new notebook entry from mobile."""
    try:
        entry_id = notebook.create_entry(
            title=data.get('title', ''),
            content=data.get('content', ''),
            entry_type=data.get('entry_type', 'text'),
            project_id=data.get('project_id'),
            experiment_id=data.get('experiment_id'),
            tags=data.get('tags'),
            attachments=data.get('attachments'),
            voice_transcription=data.get('voice_transcription')
        )
        return {"success": True, "entry_id": entry_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebook/mobile/{entry_id}")
async def get_notebook_entry_mobile(entry_id: int):
    """Get a notebook entry by ID for mobile."""
    try:
        entry = notebook.get_entry(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Notebook entry not found")
        return {"success": True, "data": entry}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/notebook/mobile/{entry_id}")
async def update_notebook_entry_mobile(entry_id: int, data: Dict[str, Any]):
    """Update a notebook entry from mobile."""
    try:
        success = db.update_notebook_entry(entry_id, **data)
        if not success:
            raise HTTPException(status_code=404, detail="Notebook entry not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/notebook/mobile/{entry_id}")
async def delete_notebook_entry_mobile(entry_id: int):
    """Delete a notebook entry from mobile."""
    try:
        success = db.delete_notebook_entry(entry_id)
        if not success:
            raise HTTPException(status_code=404, detail="Notebook entry not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Static Files Mounting ---

static_dir = Path(__file__).parent / "web" / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# --- Cleanup on Shutdown ---

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on server shutdown."""
    global voice_listener
    
    if voice_listener and voice_listener.is_active():
        voice_listener.stop()
    
    if db:
        db.close()


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    
    print("[info] Starting Unified Lab R&D Operating System Server...")
    print(f"[server] Web Dashboard & API available at: http://{host}:{port}")
    print(f"[docs]   API documentation at: http://{host}:{port}/docs")
    
    uvicorn.run(app, host=host, port=port)
