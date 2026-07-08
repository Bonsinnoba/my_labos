"""
Equipment Management Module

This module manages laboratory equipment with calibration tracking, maintenance records,
manuals, usage history, and reminders for calibration due dates and maintenance schedules.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class EquipmentManager:
    """Manages laboratory equipment with maintenance and calibration tracking."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the equipment manager.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        print("[OK] Equipment Manager initialized")
    
    def add_equipment(self, name: str, model: str, status: str = "available",
                     calibration_date: Optional[str] = None) -> int:
        """
        Add new equipment to the inventory.
        
        Args:
            name: Equipment name
            model: Equipment model
            status: Equipment status (available, in_use, maintenance)
            calibration_date: Last calibration date (ISO format)
            
        Returns:
            The ID of the inserted equipment
        """
        equipment_id = self.db.add_equipment(
            name=name,
            model=model,
            status=status,
            calibration_date=calibration_date
        )
        
        print(f"[OK] Equipment added: {name} (ID: {equipment_id})")
        return equipment_id
    
    def get_equipment(self, equipment_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve equipment by ID."""
        return self.db.get_equipment(equipment_id)
    
    def get_all_equipment(self) -> List[Dict[str, Any]]:
        """Retrieve all equipment."""
        return self.db.get_all_equipment()
    
    def update_equipment(self, equipment_id: int, **kwargs) -> bool:
        """
        Update equipment fields.
        
        Args:
            equipment_id: Equipment ID
            **kwargs: Fields to update (name, model, status, calibration_date)
            
        Returns:
            True if successful
        """
        return self.db.update_equipment(equipment_id, **kwargs)
    
    # Maintenance and Calibration Methods
    
    def add_maintenance_record(self, equipment_id: int, maintenance_type: str,
                             description: Optional[str] = None, performed_date: Optional[str] = None,
                             next_due_date: Optional[str] = None, performed_by: Optional[str] = None,
                             notes: Optional[str] = None) -> int:
        """
        Add a maintenance or calibration record.
        
        Args:
            equipment_id: Equipment ID
            maintenance_type: Type (calibration, repair, inspection, upgrade)
            description: Description of work performed
            performed_date: Date performed (ISO format)
            next_due_date: Next due date (ISO format)
            performed_by: Who performed the maintenance
            notes: Additional notes
            
        Returns:
            The ID of the inserted record
        """
        # Set default performed date if not provided
        if not performed_date:
            performed_date = datetime.now().strftime("%Y-%m-%d")
        
        record_id = self.db.add_maintenance_record(
            equipment_id=equipment_id,
            maintenance_type=maintenance_type,
            description=description,
            performed_date=performed_date,
            next_due_date=next_due_date,
            performed_by=performed_by,
            notes=notes
        )
        
        # If this is a calibration, update equipment's calibration date
        if maintenance_type.lower() == "calibration":
            self.db.update_equipment(equipment_id, calibration_date=performed_date)
        
        print(f"[OK] Maintenance record added (ID: {record_id})")
        return record_id
    
    def get_maintenance_records(self, equipment_id: Optional[int] = None,
                               due_soon: bool = False) -> List[Dict[str, Any]]:
        """
        Retrieve maintenance records.
        
        Args:
            equipment_id: Filter by equipment ID
            due_soon: If True, only return records due within 30 days
            
        Returns:
            List of maintenance records
        """
        return self.db.get_maintenance_records(equipment_id=equipment_id, due_soon=due_soon)
    
    def get_equipment_maintenance_history(self, equipment_id: int) -> List[Dict[str, Any]]:
        """
        Get complete maintenance history for equipment.
        
        Args:
            equipment_id: Equipment ID
            
        Returns:
            List of maintenance records
        """
        return self.db.get_maintenance_records(equipment_id=equipment_id)
    
    def update_maintenance_record(self, record_id: int, **kwargs) -> bool:
        """
        Update a maintenance record.
        
        Args:
            record_id: Record ID
            **kwargs: Fields to update
            
        Returns:
            True if successful
        """
        return self.db.update_maintenance_record(record_id, **kwargs)
    
    def delete_maintenance_record(self, record_id: int) -> bool:
        """
        Delete a maintenance record.
        
        Args:
            record_id: Record ID
            
        Returns:
            True if successful
        """
        return self.db.delete_maintenance_record(record_id)
    
    # Reminder Methods
    
    def get_calibration_due_soon(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get equipment with calibration due within specified days.
        
        Args:
            days: Number of days to look ahead
            
        Returns:
            List of equipment with calibration due
        """
        # Get maintenance records due soon
        due_records = self.db.get_maintenance_records(due_soon=True)
        
        # Filter for calibration records
        calibration_due = []
        for record in due_records:
            if record['maintenance_type'].lower() == 'calibration':
                equipment = self.db.get_equipment(record['equipment_id'])
                if equipment:
                    calibration_due.append({
                        'equipment': equipment,
                        'maintenance_record': record,
                        'days_until_due': self._days_until(record['next_due_date'])
                    })
        
        # Sort by days until due
        calibration_due.sort(key=lambda x: x['days_until_due'])
        
        return calibration_due
    
    def get_maintenance_due_soon(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get equipment with maintenance due within specified days.
        
        Args:
            days: Number of days to look ahead
            
        Returns:
            List of equipment with maintenance due
        """
        due_records = self.db.get_maintenance_records(due_soon=True)
        
        maintenance_due = []
        for record in due_records:
            equipment = self.db.get_equipment(record['equipment_id'])
            if equipment:
                maintenance_due.append({
                    'equipment': equipment,
                    'maintenance_record': record,
                    'days_until_due': self._days_until(record['next_due_date'])
                })
        
        maintenance_due.sort(key=lambda x: x['days_until_due'])
        
        return maintenance_due
    
    def _days_until(self, date_str: str) -> int:
        """
        Calculate days until a given date.
        
        Args:
            date_str: Date string (ISO format)
            
        Returns:
            Number of days until the date (negative if past due)
        """
        try:
            due_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            today = datetime.now().date()
            delta = due_date - today
            return delta.days
        except (ValueError, TypeError):
            return 999  # Return large number if date is invalid
    
    def schedule_calibration(self, equipment_id: int, interval_days: int,
                           performed_by: Optional[str] = None, notes: Optional[str] = None) -> int:
        """
        Schedule calibration with automatic next due date calculation.
        
        Args:
            equipment_id: Equipment ID
            interval_days: Calibration interval in days
            performed_by: Who performed the calibration
            notes: Calibration notes
            
        Returns:
            The ID of the created maintenance record
        """
        performed_date = datetime.now().strftime("%Y-%m-%d")
        next_due_date = (datetime.now() + timedelta(days=interval_days)).strftime("%Y-%m-%d")
        
        return self.add_maintenance_record(
            equipment_id=equipment_id,
            maintenance_type="calibration",
            description="Scheduled calibration",
            performed_date=performed_date,
            next_due_date=next_due_date,
            performed_by=performed_by,
            notes=notes
        )
    
    def get_equipment_status_summary(self) -> Dict[str, Any]:
        """
        Get summary of equipment status.
        
        Returns:
            Dictionary with equipment status summary
        """
        all_equipment = self.db.get_all_equipment()
        
        status_counts = {}
        for eq in all_equipment:
            status = eq['status']
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Get calibration and maintenance due
        calibration_due = self.get_calibration_due_soon()
        maintenance_due = self.get_maintenance_due_soon()
        
        return {
            'total_equipment': len(all_equipment),
            'by_status': status_counts,
            'calibration_due_count': len(calibration_due),
            'calibration_due_details': calibration_due,
            'maintenance_due_count': len(maintenance_due),
            'maintenance_due_details': maintenance_due
        }
    
    def delete_equipment(self, equipment_id: int) -> bool:
        """
        Delete equipment and all associated maintenance records.
        
        Args:
            equipment_id: Equipment ID
            
        Returns:
            True if successful
        """
        return self.db.delete_equipment(equipment_id)
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the equipment manager
    print("=== Testing Equipment Manager ===\n")
    
    manager = EquipmentManager()
    
    try:
        # Add equipment
        eq_id = manager.add_equipment(
            name="Digital Multimeter",
            model="Fluke 87V",
            status="available",
            calibration_date="2024-01-15"
        )
        
        # Retrieve equipment
        eq = manager.get_equipment(eq_id)
        print(f"\nRetrieved equipment: {eq['name']} ({eq['model']})")
        
        # Add calibration record
        cal_id = manager.add_maintenance_record(
            equipment_id=eq_id,
            maintenance_type="calibration",
            description="Annual calibration",
            performed_date="2024-01-15",
            next_due_date="2025-01-15",
            performed_by="Metrology Lab"
        )
        
        # Get maintenance history
        history = manager.get_equipment_maintenance_history(eq_id)
        print(f"\nMaintenance history: {len(history)} records")
        
        # Get status summary
        summary = manager.get_equipment_status_summary()
        print(f"\nStatus summary: {summary}")
        
        # Cleanup
        manager.delete_equipment(eq_id)
        print("\n[OK] Test equipment deleted")
        
    finally:
        manager.close()
    
    print("\n[OK] All tests passed")
