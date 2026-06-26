"""
Simple Audit Logger for Lab Data

This module provides simple audit tracking for lab data operations.
It focuses on "who did what when" without complex permissions or roles.
"""

import sqlite3
import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path


class AuditLogger:
    """
    Simple audit logger for tracking who did what when.
    
    Features:
    - Track creation and modification of records
    - Record user/device identification
    - Simple timestamp tracking
    - No complex permissions or roles
    """
    
    def __init__(self, db_path: str = "local_cache.db"):
        """
        Initialize the AuditLogger.
        
        Args:
            db_path: Path to the SQLite database
        """
        self.db_path = db_path
        self._initialize_database()
        
        print("[OK] AuditLogger initialized")
    
    def _initialize_database(self) -> None:
        """Initialize audit logging tables."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create audit_log table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    record_id INTEGER,
                    user_id TEXT,
                    device_id TEXT,
                    personnel_name TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    details TEXT
                )
            """)
            
            # Create index for faster queries
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_table_record 
                ON audit_log(table_name, record_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_timestamp 
                ON audit_log(timestamp DESC)
            """)
            
            conn.commit()
            conn.close()
            
            print("[OK] Audit logging database initialized")
            
        except sqlite3.Error as e:
            print(f"[ERR] Failed to initialize audit database: {e}")
    
    def log_action(self, action: str, table_name: str, record_id: int,
                   user_id: Optional[str] = None, device_id: Optional[str] = None,
                   personnel_name: Optional[str] = None, details: Optional[Dict] = None) -> None:
        """
        Log an action for audit trail.
        
        Args:
            action: Action type (create, update, delete, etc.)
            table_name: Name of the table affected
            record_id: ID of the record affected
            user_id: User ID (for mobile)
            device_id: Device ID (for desktop)
            personnel_name: Personnel name (optional)
            details: Additional details as dictionary
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            details_json = json.dumps(details) if details else None
            
            cursor.execute("""
                INSERT INTO audit_log (action, table_name, record_id, user_id, device_id, personnel_name, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (action, table_name, record_id, user_id, device_id, personnel_name, details_json))
            
            conn.commit()
            conn.close()
            
            print(f"[LOG] Audit: {action} on {table_name}:{record_id} by {personnel_name or device_id or user_id}")
            
        except sqlite3.Error as e:
            print(f"[ERR] Failed to log audit: {e}")
    
    def get_audit_trail(self, table_name: Optional[str] = None, 
                      record_id: Optional[int] = None,
                      limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get audit trail for a table or record.
        
        Args:
            table_name: Filter by table name
            record_id: Filter by record ID
            limit: Maximum number of entries to return
            
        Returns:
            List of audit log entries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if table_name and record_id:
                cursor.execute("""
                    SELECT id, action, table_name, record_id, user_id, device_id, personnel_name, timestamp, details
                    FROM audit_log
                    WHERE table_name = ? AND record_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (table_name, record_id, limit))
            elif table_name:
                cursor.execute("""
                    SELECT id, action, table_name, record_id, user_id, device_id, personnel_name, timestamp, details
                    FROM audit_log
                    WHERE table_name = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (table_name, limit))
            else:
                cursor.execute("""
                    SELECT id, action, table_name, record_id, user_id, device_id, personnel_name, timestamp, details
                    FROM audit_log
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (limit,))
            
            results = cursor.fetchall()
            conn.close()
            
            audit_trail = []
            for result in results:
                audit_id, action, tbl_name, rec_id, user_id, device_id, personnel_name, timestamp, details = result
                audit_trail.append({
                    "id": audit_id,
                    "action": action,
                    "table_name": tbl_name,
                    "record_id": rec_id,
                    "user_id": user_id,
                    "device_id": device_id,
                    "personnel_name": personnel_name,
                    "timestamp": timestamp,
                    "details": json.loads(details) if details else None
                })
            
            return audit_trail
            
        except sqlite3.Error as e:
            print(f"[ERR] Failed to get audit trail: {e}")
            return []
    
    def get_who_created(self, table_name: str, record_id: int) -> Optional[Dict[str, Any]]:
        """
        Get who created a specific record.
        
        Args:
            table_name: Name of the table
            record_id: ID of the record
            
        Returns:
            Dictionary with creator information or None
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT user_id, device_id, personnel_name, timestamp
                FROM audit_log
                WHERE table_name = ? AND record_id = ? AND action = 'create'
                ORDER BY timestamp ASC
                LIMIT 1
            """, (table_name, record_id))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                user_id, device_id, personnel_name, timestamp = result
                return {
                    "user_id": user_id,
                    "device_id": device_id,
                    "personnel_name": personnel_name,
                    "created_at": timestamp
                }
            
            return None
            
        except sqlite3.Error as e:
            print(f"[ERR] Failed to get creator info: {e}")
            return None
    
    def get_who_edited(self, table_name: str, record_id: int) -> List[Dict[str, Any]]:
        """
        Get who edited a specific record.
        
        Args:
            table_name: Name of the table
            record_id: ID of the record
            
        Returns:
            List of edit information
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT user_id, device_id, personnel_name, timestamp, details
                FROM audit_log
                WHERE table_name = ? AND record_id = ? AND action = 'update'
                ORDER BY timestamp DESC
            """, (table_name, record_id))
            
            results = cursor.fetchall()
            conn.close()
            
            edits = []
            for result in results:
                user_id, device_id, personnel_name, timestamp, details = result
                edits.append({
                    "user_id": user_id,
                    "device_id": device_id,
                    "personnel_name": personnel_name,
                    "edited_at": timestamp,
                    "details": json.loads(details) if details else None
                })
            
            return edits
            
        except sqlite3.Error as e:
            print(f"[ERR] Failed to get edit info: {e}")
            return []


# Global audit logger instance
_global_audit_logger: Optional[AuditLogger] = None


def get_audit_logger(db_path: str = "local_cache.db") -> AuditLogger:
    """
    Get or create the global audit logger instance.
    
    Args:
        db_path: Path to the SQLite database
        
    Returns:
        AuditLogger instance
    """
    global _global_audit_logger
    if _global_audit_logger is None:
        _global_audit_logger = AuditLogger(db_path)
    return _global_audit_logger


if __name__ == "__main__":
    # Test the audit logger
    print("=== Testing AuditLogger ===\n")
    
    logger = AuditLogger()
    
    # Test logging actions
    print("Testing audit logging...")
    logger.log_action("create", "projects", 1, device_id="LAB_PC_01", personnel_name="John Doe")
    logger.log_action("update", "projects", 1, device_id="LAB_PC_02", personnel_name="Jane Smith", details={"field": "status", "old": "active", "new": "completed"})
    logger.log_action("create", "equipment", 5, user_id="mobile_user_01", personnel_name="Bob Johnson")
    
    # Test audit trail retrieval
    print("\nTesting audit trail retrieval...")
    trail = logger.get_audit_trail(table_name="projects", record_id=1)
    for entry in trail:
        print(f"   - {entry['action']} by {entry['personnel_name']} at {entry['timestamp']}")
    
    # Test creator info
    print("\nTesting creator info...")
    creator = logger.get_who_created("projects", 1)
    if creator:
        print(f"   Created by: {creator['personnel_name']} ({creator['device_id']}) at {creator['created_at']}")
    
    # Test edit info
    print("\nTesting edit info...")
    edits = logger.get_who_edited("projects", 1)
    for edit in edits:
        print(f"   Edited by: {edit['personnel_name']} at {edit['edited_at']}")
    
    print("\n[OK] All audit logger tests completed!")
