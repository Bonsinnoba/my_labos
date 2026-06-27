"""
Startup Script for Lab Manager Web Application
"""
import sys
import subprocess
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

sys.path.insert(0, str(Path(__file__).parent / "lab_app"))

def main():
    """Launch the web application server."""
    host = os.getenv("API_HOST", "0.0.0.0")
    port = os.getenv("API_PORT", "8000")

    # Kill any existing process on port 8000
    try:
        result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
        for line in result.stdout.splitlines():
            if f':{port}' in line and 'LISTENING' in line:
                pid = line.strip().split()[-1]
                subprocess.run(['taskkill', '/PID', pid, '/F'], capture_output=True)
                print(f"[env] Freed port {port} (killed PID {pid})")
    except Exception:
        pass

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

    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "lab_app.api_server:app",
             "--host", host, "--port", port],
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