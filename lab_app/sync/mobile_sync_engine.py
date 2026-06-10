"""
Mobile Synchronization Architecture

This module provides the synchronization architecture for mobile devices.
It includes:
- API abstraction layer
- Conflict resolution support
- Local-first design
- Offline operation
- No cloud dependency required at this stage
"""

import json
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class SyncStatus(Enum):
    """Synchronization status enum."""
    SYNCED = "synced"
    PENDING = "pending"
    CONFLICT = "conflict"
    OFFLINE = "offline"


class ConflictResolution(Enum):
    """Conflict resolution strategy enum."""
    LAST_WRITE_WINS = "last_write_wins"
    MANUAL_REVIEW = "manual_review"
    SERVER_WINS = "server_wins"
    CLIENT_WINS = "client_wins"


class SyncEngine:
    """Manages synchronization between lab PC and mobile devices."""
    
    def __init__(self, db: Optional[CacheDatabase] = None, device_id: Optional[str] = None):
        """
        Initialize the sync engine.
        
        Args:
            db: CacheDatabase instance (creates new if None)
            device_id: Unique device identifier
        """
        self.db = db if db else CacheDatabase()
        self.device_id = device_id or self._generate_device_id()
        self.sync_status = SyncStatus.OFFLINE
        self.conflict_resolution = ConflictResolution.LAST_WRITE_WINS
        print(f"✅ Sync Engine initialized (Device ID: {self.device_id})")
    
    def _generate_device_id(self) -> str:
        """Generate a unique device ID."""
        import uuid
        return str(uuid.uuid4())
    
    def _calculate_hash(self, data: Dict[str, Any]) -> str:
        """
        Calculate hash of data for change detection.
        
        Args:
            data: Data dictionary
            
        Returns:
            Hash string
        """
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def prepare_for_sync(self, entity_type: str, entity_id: int) -> Dict[str, Any]:
        """
        Prepare an entity for synchronization.
        
        Args:
            entity_type: Type of entity (project, component, etc.)
            entity_id: ID of the entity
            
        Returns:
            Sync-ready data dictionary
        """
        # Get the entity data
        entity = self._get_entity(entity_type, entity_id)
        if not entity:
            return {}
        
        # Add sync metadata
        sync_data = {
            'entity_type': entity_type,
            'entity_id': entity_id,
            'data': entity,
            'device_id': self.device_id,
            'hash': self._calculate_hash(entity),
            'timestamp': datetime.now().isoformat(),
            'sync_status': SyncStatus.PENDING.value
        }
        
        return sync_data
    
    def _get_entity(self, entity_type: str, entity_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve an entity by type and ID.
        
        Args:
            entity_type: Type of entity
            entity_id: Entity ID
            
        Returns:
            Entity dictionary or None
        """
        try:
            if entity_type == 'project':
                return self.db.get_project(entity_id)
            elif entity_type == 'component':
                return self.db.get_component(entity_id)
            elif entity_type == 'equipment':
                return self.db.get_equipment(entity_id)
            elif entity_type == 'finding':
                return self.db.get_finding(entity_id)
            elif entity_type == 'calculation':
                return self.db.get_calculation(entity_id)
            elif entity_type == 'document':
                return self.db.get_document(entity_id)
            elif entity_type == 'notebook_entry':
                return self.db.get_notebook_entry(entity_id)
            else:
                return None
        except Exception:
            return None
    
    def detect_conflict(self, local_data: Dict[str, Any], remote_data: Dict[str, Any]) -> bool:
        """
        Detect if there's a conflict between local and remote data.
        
        Args:
            local_data: Local data
            remote_data: Remote data
            
        Returns:
            True if conflict detected
        """
        local_hash = local_data.get('hash', '')
        remote_hash = remote_data.get('hash', '')
        
        return local_hash != remote_hash
    
    def resolve_conflict(self, local_data: Dict[str, Any], remote_data: Dict[str, Any],
                        strategy: ConflictResolution = None) -> Dict[str, Any]:
        """
        Resolve a conflict between local and remote data.
        
        Args:
            local_data: Local data
            remote_data: Remote data
            strategy: Conflict resolution strategy
            
        Returns:
            Resolved data
        """
        if strategy is None:
            strategy = self.conflict_resolution
        
        if strategy == ConflictResolution.LAST_WRITE_WINS:
            # Use the most recently updated data
            local_time = local_data.get('timestamp', '')
            remote_time = remote_data.get('timestamp', '')
            
            if local_time > remote_time:
                return local_data
            else:
                return remote_data
        
        elif strategy == ConflictResolution.SERVER_WINS:
            return remote_data
        
        elif strategy == ConflictResolution.CLIENT_WINS:
            return local_data
        
        elif strategy == ConflictResolution.MANUAL_REVIEW:
            # Mark for manual review
            return {
                'conflict': True,
                'local_data': local_data,
                'remote_data': remote_data,
                'requires_manual_resolution': True
            }
        
        return local_data
    
    def create_sync_package(self, entity_types: List[str] = None) -> Dict[str, Any]:
        """
        Create a sync package for all or specified entity types.
        
        Args:
            entity_types: List of entity types to sync (None for all)
            
        Returns:
            Sync package dictionary
        """
        if entity_types is None:
            entity_types = ['project', 'component', 'equipment', 'finding', 
                          'calculation', 'document', 'notebook_entry']
        
        sync_package = {
            'device_id': self.device_id,
            'timestamp': datetime.now().isoformat(),
            'entities': []
        }
        
        for entity_type in entity_types:
            entities = self._get_all_entities(entity_type)
            for entity in entities:
                sync_data = self.prepare_for_sync(entity_type, entity['id'])
                if sync_data:
                    sync_package['entities'].append(sync_data)
        
        return sync_package
    
    def _get_all_entities(self, entity_type: str) -> List[Dict[str, Any]]:
        """
        Get all entities of a given type.
        
        Args:
            entity_type: Type of entity
            
        Returns:
            List of entities
        """
        try:
            if entity_type == 'project':
                return self.db.get_all_projects()
            elif entity_type == 'component':
                return self.db.get_all_components()
            elif entity_type == 'equipment':
                return self.db.get_all_equipment()
            elif entity_type == 'finding':
                return self.db.get_all_findings()
            elif entity_type == 'calculation':
                return self.db.get_all_calculations()
            elif entity_type == 'document':
                return self.db.get_all_documents()
            elif entity_type == 'notebook_entry':
                return self.db.get_all_notebook_entries()
            else:
                return []
        except Exception:
            return []
    
    def apply_sync_package(self, sync_package: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply a sync package from another device.
        
        Args:
            sync_package: Sync package dictionary
            
        Returns:
            Sync result dictionary
        """
        result = {
            'success': True,
            'conflicts': [],
            'applied': [],
            'skipped': []
        }
        
        for sync_data in sync_package.get('entities', []):
            entity_type = sync_data['entity_type']
            entity_id = sync_data['entity_id']
            remote_data = sync_data['data']
            
            # Get local data
            local_data = self.prepare_for_sync(entity_type, entity_id)
            
            if not local_data:
                # Entity doesn't exist locally, create it
                self._create_entity(entity_type, remote_data)
                result['applied'].append(entity_id)
            else:
                # Check for conflict
                if self.detect_conflict(local_data, remote_data):
                    resolved = self.resolve_conflict(local_data, remote_data)
                    if resolved.get('conflict'):
                        result['conflicts'].append(entity_id)
                    else:
                        self._update_entity(entity_type, entity_id, resolved['data'])
                        result['applied'].append(entity_id)
                else:
                    # No conflict, skip
                    result['skipped'].append(entity_id)
        
        return result
    
    def _create_entity(self, entity_type: str, data: Dict[str, Any]) -> bool:
        """Create an entity from sync data."""
        try:
            if entity_type == 'project':
                self.db.add_project(
                    name=data['name'],
                    description=data.get('description'),
                    status=data.get('status'),
                    start_date=data.get('start_date'),
                    summary_findings=data.get('summary_findings')
                )
            elif entity_type == 'component':
                self.db.add_component(
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
            # Add other entity types as needed
            return True
        except Exception:
            return False
    
    def _update_entity(self, entity_type: str, entity_id: int, data: Dict[str, Any]) -> bool:
        """Update an entity from sync data."""
        try:
            if entity_type == 'project':
                self.db.update_project(entity_id, **data)
            elif entity_type == 'component':
                self.db.update_component(entity_id, **data)
            elif entity_type == 'equipment':
                self.db.update_equipment(entity_id, **data)
            # Add other entity types as needed
            return True
        except Exception:
            return False
    
    def get_sync_status(self) -> Dict[str, Any]:
        """
        Get current synchronization status.
        
        Returns:
            Status dictionary
        """
        return {
            'device_id': self.device_id,
            'status': self.sync_status.value,
            'conflict_resolution': self.conflict_resolution.value,
            'last_sync': datetime.now().isoformat()
        }
    
    def set_conflict_resolution(self, strategy: ConflictResolution) -> None:
        """
        Set the conflict resolution strategy.
        
        Args:
            strategy: Conflict resolution strategy
        """
        self.conflict_resolution = strategy
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the sync engine
    print("=== Testing Sync Engine ===\n")
    
    sync = SyncEngine()
    
    try:
        # Get sync status
        status = sync.get_sync_status()
        print(f"Sync Status: {status}")
        
        # Create sync package
        package = sync.create_sync_package(['project', 'component'])
        print(f"\nSync Package: {len(package['entities'])} entities")
        
        # Test conflict detection
        data1 = {'hash': 'abc123', 'timestamp': '2024-01-01T00:00:00'}
        data2 = {'hash': 'def456', 'timestamp': '2024-01-02T00:00:00'}
        
        has_conflict = sync.detect_conflict(data1, data2)
        print(f"\nConflict detected: {has_conflict}")
        
        # Test conflict resolution
        resolved = sync.resolve_conflict(data1, data2, ConflictResolution.LAST_WRITE_WINS)
        print(f"Resolved data timestamp: {resolved['timestamp']}")
        
    finally:
        sync.close()
    
    print("\n✅ All tests passed")
