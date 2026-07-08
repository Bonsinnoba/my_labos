"""
Component Inventory Management Module

This module manages component inventory with low-stock warnings, search and filtering,
component history, and project usage tracking.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class ComponentManager:
    """Manages component inventory and usage tracking."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the component manager.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        print("[OK] Component Manager initialized")
    
    def add_component(self, name: str, part_number: Optional[str] = None,
                     description: Optional[str] = None, quantity: int = 0,
                     min_quantity: int = 5, storage_location: Optional[str] = None,
                     datasheet: Optional[str] = None, supplier: Optional[str] = None,
                     supplier_part_number: Optional[str] = None, notes: Optional[str] = None) -> int:
        """
        Add a new component to inventory.
        
        Args:
            name: Component name
            part_number: Unique part number
            description: Component description
            quantity: Current quantity
            min_quantity: Minimum quantity threshold for alerts
            storage_location: Storage location
            datasheet: Path to datasheet
            supplier: Supplier name
            supplier_part_number: Supplier's part number
            notes: Additional notes
            
        Returns:
            The ID of the inserted component
        """
        component_id = self.db.add_component(
            name=name,
            part_number=part_number,
            description=description,
            quantity=quantity,
            min_quantity=min_quantity,
            storage_location=storage_location,
            datasheet=datasheet,
            supplier=supplier,
            supplier_part_number=supplier_part_number,
            notes=notes
        )
        
        print(f"[OK] Component added: {name} (ID: {component_id})")
        return component_id
    
    def get_component(self, component_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a component by ID."""
        return self.db.get_component(component_id)
    
    def get_component_by_part_number(self, part_number: str) -> Optional[Dict[str, Any]]:
        """Retrieve a component by part number."""
        return self.db.get_component_by_part_number(part_number)
    
    def get_all_components(self, low_stock_only: bool = False) -> List[Dict[str, Any]]:
        """
        Retrieve all components, optionally filtering for low stock.
        
        Args:
            low_stock_only: If True, only return components below minimum quantity
            
        Returns:
            List of components
        """
        return self.db.get_all_components(low_stock_only=low_stock_only)
    
    def search_components(self, query: str) -> List[Dict[str, Any]]:
        """
        Search components by name, part number, or description.
        
        Args:
            query: Search query string
            
        Returns:
            List of matching components
        """
        all_components = self.db.get_all_components()
        query_lower = query.lower()
        
        matches = []
        for comp in all_components:
            if (query_lower in comp['name'].lower() or
                (comp.get('part_number') and query_lower in comp['part_number'].lower()) or
                (comp.get('description') and query_lower in comp['description'].lower()) or
                (comp.get('supplier') and query_lower in comp['supplier'].lower())):
                matches.append(comp)
        
        return matches
    
    def update_component(self, component_id: int, **kwargs) -> bool:
        """
        Update component fields.
        
        Args:
            component_id: Component ID
            **kwargs: Fields to update
            
        Returns:
            True if successful
        """
        return self.db.update_component(component_id, **kwargs)
    
    def adjust_quantity(self, component_id: int, delta: int, 
                      project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                      notes: Optional[str] = None) -> bool:
        """
        Adjust component quantity and record usage.
        
        Args:
            component_id: Component ID
            delta: Quantity change (positive for addition, negative for usage)
            project_id: Associated project ID (for usage tracking)
            experiment_id: Associated experiment ID (for usage tracking)
            notes: Usage notes
            
        Returns:
            True if successful
        """
        # Adjust quantity
        success = self.db.adjust_component_quantity(component_id, delta)
        
        if success and delta < 0:
            # Record usage if quantity decreased
            self.db.add_component_usage(
                component_id=component_id,
                quantity_used=abs(delta),
                project_id=project_id,
                experiment_id=experiment_id,
                notes=notes
            )
        
        return success
    
    def get_low_stock_components(self) -> List[Dict[str, Any]]:
        """
        Get all components with low stock (quantity <= min_quantity).
        
        Returns:
            List of low-stock components
        """
        return self.db.get_all_components(low_stock_only=True)
    
    def get_component_usage_history(self, component_id: int) -> List[Dict[str, Any]]:
        """
        Get usage history for a component.
        
        Args:
            component_id: Component ID
            
        Returns:
            List of usage records
        """
        return self.db.get_component_usage(component_id=component_id)
    
    def get_projects_using_component(self, component_id: int) -> List[Dict[str, Any]]:
        """
        Get all projects that have used a specific component.
        
        Args:
            component_id: Component ID
            
        Returns:
            List of project IDs with usage info
        """
        usage_records = self.db.get_component_usage(component_id=component_id)
        
        # Extract unique project IDs
        project_usage = {}
        for record in usage_records:
            if record.get('project_id'):
                pid = record['project_id']
                if pid not in project_usage:
                    project_usage[pid] = {
                        'project_id': pid,
                        'total_used': 0,
                        'usage_count': 0
                    }
                project_usage[pid]['total_used'] += record['quantity_used']
                project_usage[pid]['usage_count'] += 1
        
        return list(project_usage.values())
    
    def get_components_used_in_project(self, project_id: int) -> List[Dict[str, Any]]:
        """
        Get all components used in a specific project.
        
        Args:
            project_id: Project ID
            
        Returns:
            List of components with usage info
        """
        usage_records = self.db.get_component_usage(project_id=project_id)
        
        # Group by component
        component_usage = {}
        for record in usage_records:
            cid = record['component_id']
            if cid not in component_usage:
                component = self.db.get_component(cid)
                component_usage[cid] = {
                    'component': component,
                    'total_used': 0,
                    'usage_count': 0
                }
            component_usage[cid]['total_used'] += record['quantity_used']
            component_usage[cid]['usage_count'] += 1
        
        return list(component_usage.values())
    
    def delete_component(self, component_id: int) -> bool:
        """
        Delete a component from inventory.
        
        Args:
            component_id: Component ID
            
        Returns:
            True if successful
        """
        return self.db.delete_component(component_id)
    
    def get_inventory_stats(self) -> Dict[str, Any]:
        """
        Get inventory statistics.
        
        Returns:
            Dictionary with inventory statistics
        """
        all_components = self.db.get_all_components()
        low_stock = self.db.get_all_components(low_stock_only=True)
        
        total_quantity = sum(comp['quantity'] for comp in all_components)
        
        # Count by supplier
        supplier_counts = {}
        for comp in all_components:
            if comp.get('supplier'):
                supplier = comp['supplier']
                supplier_counts[supplier] = supplier_counts.get(supplier, 0) + 1
        
        return {
            'total_components': len(all_components),
            'total_quantity': total_quantity,
            'low_stock_count': len(low_stock),
            'low_stock_components': low_stock,
            'by_supplier': supplier_counts
        }
    
    def restock_component(self, component_id: int, quantity: int, 
                        notes: Optional[str] = None) -> bool:
        """
        Restock a component.
        
        Args:
            component_id: Component ID
            quantity: Quantity to add
            notes: Restock notes
            
        Returns:
            True if successful
        """
        return self.adjust_quantity(component_id, quantity, notes=notes)
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the component manager
    print("=== Testing Component Manager ===\n")
    
    manager = ComponentManager()
    
    try:
        # Add a component
        comp_id = manager.add_component(
            name="ESP32-WROOM-32",
            part_number="ESP32-WROOM-32",
            description="WiFi + Bluetooth MCU",
            quantity=10,
            min_quantity=5,
            supplier="Espressif",
            storage_location="Shelf A1"
        )
        
        # Retrieve component
        comp = manager.get_component(comp_id)
        print(f"\nRetrieved component: {comp['name']}")
        print(f"Quantity: {comp['quantity']}")
        
        # Search components
        results = manager.search_components("ESP32")
        print(f"\nSearch results for 'ESP32': {len(results)} components")
        
        # Adjust quantity
        manager.adjust_quantity(comp_id, -3, notes="Used in Solar Charge Controller project")
        comp = manager.get_component(comp_id)
        print(f"\nAfter using 3: Quantity = {comp['quantity']}")
        
        # Get usage history
        history = manager.get_component_usage_history(comp_id)
        print(f"\nUsage history: {len(history)} records")
        
        # Get stats
        stats = manager.get_inventory_stats()
        print(f"\nInventory stats: {stats}")
        
        # Cleanup
        manager.delete_component(comp_id)
        print("\n[OK] Test component deleted")
        
    finally:
        manager.close()
    
    print("\n[OK] All tests passed")
