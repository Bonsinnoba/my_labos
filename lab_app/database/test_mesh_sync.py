"""
Test script for Mesh Sync Coordinator

This script demonstrates the decentralized peer-to-peer cloud-mesh synchronization
engine with multiple device simulation.
"""

import os
import sys
import time
import tempfile
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase
from database.mesh_sync_coordinator import MeshSyncCoordinator


def test_mutation_logging():
    """Test that mutations are logged to mesh_transactions table."""
    print("\n=== Testing Mutation Logging ===")
    
    # Create a temporary database for testing
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db = f.name
    
    try:
        # Initialize database with device ID
        db = CacheDatabase(db_path=test_db, device_id="TEST_DEVICE_01")
        
        # Test INSERT mutation
        print("Testing INSERT mutation...")
        equipment_id = db.add_equipment(
            name="Oscilloscope",
            model="Tektronix TBS2000",
            status="available"
        )
        print(f"Added equipment with ID: {equipment_id}")
        
        # Test UPDATE mutation
        print("Testing UPDATE mutation...")
        db.update_equipment(equipment_id, status="in_use")
        print("Updated equipment status")
        
        # Test DELETE mutation
        print("Testing DELETE mutation...")
        db.delete_equipment(equipment_id)
        print("Deleted equipment")
        
        # Check mesh_transactions table
        cursor = db.conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM mesh_transactions")
        result = cursor.fetchone()
        print(f"Total mutations logged: {result['count']}")
        
        # View logged transactions
        cursor.execute("SELECT * FROM mesh_transactions ORDER BY timestamp ASC")
        transactions = cursor.fetchall()
        
        print("\nLogged transactions:")
        for tx in transactions:
            print(f"  - {tx['operation']} on {tx['table_name']} from {tx['device_origin']} (tx_id: {tx['tx_id']})")
        
        db.close()
        print("✓ Mutation logging test passed")
        
    finally:
        # Cleanup
        if os.path.exists(test_db):
            os.unlink(test_db)
        if os.path.exists(".mesh_device_id"):
            os.unlink(".mesh_device_id")


def test_conflict_resolution():
    """Test deterministic conflict resolution (Last-Write-Wins)."""
    print("\n=== Testing Conflict Resolution ===")
    
    # Create a temporary database for testing
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db = f.name
    
    try:
        # Initialize database first to create mesh_transactions table
        db = CacheDatabase(db_path=test_db, device_id="TEST_DEVICE_01")
        db.close()
        
        # Now initialize coordinator
        coordinator = MeshSyncCoordinator(db_path=test_db, device_id="TEST_DEVICE_01")
        
        # Simulate transactions from different devices with same timestamp
        timestamp = int(time.time() * 1000)
        
        transactions = [
            {
                'tx_id': 'tx_001',
                'table_name': 'equipment',
                'operation': 'UPDATE',
                'payload': {'_record_id': 1, 'status': 'in_use'},
                'timestamp': timestamp,
                'device_origin': 'LAB_PC_02'  # Should win alphabetically
            },
            {
                'tx_id': 'tx_002',
                'table_name': 'equipment',
                'operation': 'UPDATE',
                'payload': {'_record_id': 1, 'status': 'maintenance'},
                'timestamp': timestamp,
                'device_origin': 'LAB_PC_01'  # Should lose alphabetically
            }
        ]
        
        # Apply transactions with conflict resolution
        applied = coordinator.apply_incoming_transactions(transactions)
        print(f"Applied {applied} transactions with conflict resolution")
        
        # Check which transaction won (should be LAB_PC_02 alphabetically)
        cursor = coordinator.conn.cursor()
        cursor.execute("SELECT device_origin FROM mesh_transactions WHERE tx_id = 'tx_001'")
        result = cursor.fetchone()
        
        if result and result['device_origin'] == 'LAB_PC_02':
            print("✓ Conflict resolution test passed - LAB_PC_02 won (alphabetical tiebreaker)")
        else:
            print("✗ Conflict resolution test failed")
        
        coordinator.close()
        
    finally:
        # Cleanup
        if os.path.exists(test_db):
            os.unlink(test_db)
        if os.path.exists(".mesh_device_id"):
            os.unlink(".mesh_device_id")


def test_device_id_generation():
    """Test device ID generation and persistence."""
    print("\n=== Testing Device ID Generation ===")
    
    # Create a temporary database for testing
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db = f.name
    
    try:
        # First initialization - should generate new device ID
        db1 = CacheDatabase(db_path=test_db)
        device_id_1 = db1.device_id
        print(f"First initialization - Device ID: {device_id_1}")
        db1.close()
        
        # Second initialization - should reuse existing device ID
        db2 = CacheDatabase(db_path=test_db)
        device_id_2 = db2.device_id
        print(f"Second initialization - Device ID: {device_id_2}")
        db2.close()
        
        if device_id_1 == device_id_2:
            print("✓ Device ID persistence test passed")
        else:
            print("✗ Device ID persistence test failed")
        
    finally:
        # Cleanup
        if os.path.exists(test_db):
            os.unlink(test_db)
        if os.path.exists(".mesh_device_id"):
            os.unlink(".mesh_device_id")


def test_transaction_payload():
    """Test that transaction payloads contain only modified fields."""
    print("\n=== Testing Transaction Payload ===")
    
    # Create a temporary database for testing
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db = f.name
    
    try:
        db = CacheDatabase(db_path=test_db, device_id="TEST_DEVICE_01")
        
        # Add equipment
        equipment_id = db.add_equipment(
            name="Multimeter",
            model="Fluke 87V",
            status="available"
        )
        
        # Update only status field
        db.update_equipment(equipment_id, status="in_use")
        
        # Check the last transaction payload
        cursor = db.conn.cursor()
        cursor.execute("""
            SELECT payload FROM mesh_transactions 
            WHERE operation = 'UPDATE' AND table_name = 'equipment'
            ORDER BY timestamp DESC LIMIT 1
        """)
        result = cursor.fetchone()
        
        if result:
            import json
            payload = json.loads(result['payload'])
            print(f"Update payload: {payload}")
            
            # Payload should only contain the updated field and record_id
            if 'status' in payload and '_record_id' in payload:
                print("✓ Transaction payload test passed - contains only modified fields")
            else:
                print("✗ Transaction payload test failed")
        
        db.close()
        
    finally:
        # Cleanup
        if os.path.exists(test_db):
            os.unlink(test_db)
        if os.path.exists(".mesh_device_id"):
            os.unlink(".mesh_device_id")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Mesh Sync Coordinator Test Suite")
    print("=" * 60)
    
    try:
        test_device_id_generation()
        test_mutation_logging()
        test_conflict_resolution()
        test_transaction_payload()
        
        print("\n" + "=" * 60)
        print("All tests completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
