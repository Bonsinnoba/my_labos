import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "lab_app"))

from database.cloud_sync_engine import DualAccountSyncEngine

print("Initializing sync engine...")
engine = DualAccountSyncEngine()

print("Initializing cloud clients...")
if not engine.initialize_cloud_clients():
    print("ERROR: Failed to initialize cloud clients")
    sys.exit(1)

print("Running sync cycle...")
engine.sync_once()

print("Sync cycle completed")
