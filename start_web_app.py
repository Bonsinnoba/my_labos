"""
Startup Script for Lab Manager Web Application

This script launches the FastAPI server which serves both the API endpoints
and the static frontend files. The backend modules (database, voice, analysis)
remain intact and are exposed via the API.
"""

import sys
import subprocess
from pathlib import Path
import os
from dotenv import load_dotenv
# Load environment variables
load_dotenv()

# Add lab_app to path
sys.path.insert(0, str(Path(__file__).parent / "lab_app"))


def main():
    """Launch the web application server."""
    host = os.getenv("API_HOST", "127.0.0.1")
    port = os.getenv("API_PORT", "8000")
    
    print("[info] Starting Lab Manager Web Application...")
    print("=" * 60)
    print(f"[server] API Server: http://{host}:{port}")
    print(f"[docs]   API Docs:   http://{host}:{port}/docs")
    print(f"[web]    Frontend:   http://{host}:{port}")
    print("=" * 60)
    print("\n[modules] Backend Modules:")
    print("   [OK] Database (SQLite cache_db.py)")
    print("   [OK] Voice Listener (voice/listener.py)")
    print("   [OK] Data Processor (analysis/data_processor.py)")
    print("\n[frontend] Frontend:")
    print("   [OK] Premium Dark Theme Dashboard (lab_app/web/)")
    print("\nPress Ctrl+C to stop the server\n")
    
    # Launch the FastAPI server
    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "lab_app.api_server:app", 
             "--host", host, "--port", port, "--reload"],
            cwd=Path(__file__).parent,
            env=env
        )
    except KeyboardInterrupt:
        print("\n\n[info] Server stopped")
    except Exception as e:
        print(f"\n[error] Error starting server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
