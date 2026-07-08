"""
Real-Time Sync Status Indicators Module

This module provides real-time synchronization status tracking and reporting
for the Lab R&D Operating System. It monitors sync operations and provides
status updates to the UI via WebSocket or polling.
"""

import sqlite3
import json
import time
import threading
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path
from enum import Enum


class SyncStatus(Enum):
    """Sync status enumeration."""
    IDLE = "idle"
    SYNCING = "syncing"
    ERROR = "error"
    OFFLINE = "offline"
    COMPLETED = "completed"


class SyncStatusTracker:
    """
    Tracks and reports real-time synchronization status.
    
    Features:
    - Real-time sync status monitoring
    - Progress tracking for file uploads/downloads
    - Error reporting and recovery
    - Network status monitoring
    - WebSocket-compatible status updates
    """
    
    def __init__(self, db_path: str = "local_cache.db"):
        """
        Initialize the SyncStatusTracker.
        
        Args:
            db_path: Path to the SQLite database
        """
        self.db_path = db_path
        self.current_status = SyncStatus.IDLE
        self.sync_progress = 0
        self.sync_message = "Ready"
        self.last_sync_time = None
        self.error_count = 0
        self.is_online = True
        
        # Sync statistics
        self.total_files_synced = 0
        self.total_bytes_transferred = 0
        self.current_file = None
        self.current_file_progress = 0
        
        # Thread-safe status updates
        self.status_lock = threading.Lock()
        
        # Status change callbacks
        self.status_callbacks = []
        
        self._initialize_database()
        
        print("[OK] SyncStatusTracker initialized")
    
    def _initialize_database(self) -> None:
        """Initialize sync status tracking tables."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create sync_status table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    status TEXT NOT NULL,
                    message TEXT,
                    progress INTEGER DEFAULT 0,
                    current_file TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create sync_history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    status TEXT NOT NULL,
                    message TEXT,
                    files_synced INTEGER DEFAULT 0,
                    bytes_transferred INTEGER DEFAULT 0,
                    duration_seconds REAL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create sync_errors table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_errors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    error_type TEXT,
                    error_message TEXT,
                    file_path TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved BOOLEAN DEFAULT 0
                )
            """)
            
            conn.commit()
            conn.close()
            
            print("[OK] Sync status database initialized")
            
        except sqlite3.Error as e:
            print(f"❌ Failed to initialize sync status database: {e}")
    
    def update_status(self, status: SyncStatus, message: str = "", 
                     progress: int = 0, current_file: Optional[str] = None) -> None:
        """
        Update the current sync status.
        
        Args:
            status: New sync status
            message: Status message
            progress: Progress percentage (0-100)
            current_file: Current file being processed
        """
        with self.status_lock:
            self.current_status = status
            self.sync_message = message
            self.sync_progress = max(0, min(100, progress))
            self.current_file = current_file
            
            # Log status change to database
            self._log_status_to_db(status, message, progress, current_file)
            
            # Notify callbacks
            self._notify_callbacks()
            
            print(f"📊 Sync Status: {status.value} - {message} ({progress}%)")
    
    def _log_status_to_db(self, status: SyncStatus, message: str, 
                         progress: int, current_file: Optional[str]) -> None:
        """Log status change to database."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO sync_status (status, message, progress, current_file)
                VALUES (?, ?, ?, ?)
            """, (status.value, message, progress, current_file))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            print(f"❌ Failed to log status to database: {e}")
    
    def _notify_callbacks(self) -> None:
        """Notify all registered status callbacks."""
        status_data = self.get_status_dict()
        for callback in self.status_callbacks:
            try:
                callback(status_data)
            except Exception as e:
                print(f"❌ Status callback error: {e}")
    
    def register_callback(self, callback) -> None:
        """
        Register a callback function for status updates.
        
        Args:
            callback: Function to call when status changes
        """
        self.status_callbacks.append(callback)
    
    def get_status_dict(self) -> Dict[str, Any]:
        """
        Get current status as a dictionary.
        
        Returns:
            Dictionary containing current sync status
        """
        with self.status_lock:
            return {
                "status": self.current_status.value,
                "message": self.sync_message,
                "progress": self.sync_progress,
                "current_file": self.current_file,
                "is_online": self.is_online,
                "total_files_synced": self.total_files_synced,
                "total_bytes_transferred": self.total_bytes_transferred,
                "last_sync_time": self.last_sync_time,
                "error_count": self.error_count,
                "timestamp": datetime.now().isoformat()
            }
    
    def start_sync(self, total_files: int = 0) -> None:
        """
        Start a new sync operation.
        
        Args:
            total_files: Total number of files to sync
        """
        with self.status_lock:
            self.current_status = SyncStatus.SYNCING
            self.sync_progress = 0
            self.sync_message = "Starting sync..."
            self.total_files_synced = 0
            self.total_bytes_transferred = 0
            self.current_file = None
            self.sync_start_time = time.time()
            
            self._notify_callbacks()
    
    def update_file_progress(self, file_name: str, progress: int, 
                           bytes_transferred: int = 0) -> None:
        """
        Update progress for the current file.
        
        Args:
            file_name: Name of the file being processed
            progress: Progress percentage (0-100)
            bytes_transferred: Bytes transferred so far
        """
        with self.status_lock:
            self.current_file = file_name
            self.current_file_progress = progress
            self.total_bytes_transferred += bytes_transferred
            
            self._notify_callbacks()
    
    def complete_file(self, file_name: str, bytes_transferred: int = 0) -> None:
        """
        Mark a file as completed.
        
        Args:
            file_name: Name of the completed file
            bytes_transferred: Bytes transferred for this file
        """
        with self.status_lock:
            self.total_files_synced += 1
            self.total_bytes_transferred += bytes_transferred
            self.current_file = None
            
            self._notify_callbacks()
    
    def complete_sync(self, success: bool = True) -> None:
        """
        Complete the current sync operation.
        
        Args:
            success: Whether the sync was successful
        """
        with self.status_lock:
            duration = time.time() - getattr(self, 'sync_start_time', time.time())
            
            if success:
                self.current_status = SyncStatus.COMPLETED
                self.sync_message = "Sync completed successfully"
                self.sync_progress = 100
            else:
                self.current_status = SyncStatus.ERROR
                self.sync_message = "Sync completed with errors"
                self.error_count += 1
            
            self.last_sync_time = datetime.now().isoformat()
            
            # Log to history
            self._log_sync_history(success, duration)
            
            self._notify_callbacks()
    
    def _log_sync_history(self, success: bool, duration: float) -> None:
        """Log sync operation to history."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            status = "completed" if success else "error"
            cursor.execute("""
                INSERT INTO sync_history (status, message, files_synced, bytes_transferred, duration_seconds)
                VALUES (?, ?, ?, ?, ?)
            """, (status, self.sync_message, self.total_files_synced, 
                  self.total_bytes_transferred, duration))
            
            conn.commit()
            conn.close()
            
        except sqlite3.Error as e:
            print(f"❌ Failed to log sync history: {e}")
    
    def log_error(self, error_type: str, error_message: str, 
                 file_path: Optional[str] = None) -> None:
        """
        Log a sync error.
        
        Args:
            error_type: Type of error
            error_message: Error message
            file_path: Optional file path that caused the error
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO sync_errors (error_type, error_message, file_path)
                VALUES (?, ?, ?)
            """, (error_type, error_message, file_path))
            
            conn.commit()
            conn.close()
            
            self.error_count += 1
            print(f"❌ Sync error logged: {error_type} - {error_message}")
            
        except sqlite3.Error as e:
            print(f"❌ Failed to log error: {e}")
    
    def set_online_status(self, is_online: bool) -> None:
        """
        Update online/offline status.
        
        Args:
            is_online: Whether the system is online
        """
        with self.status_lock:
            self.is_online = is_online
            
            if not is_online:
                self.current_status = SyncStatus.OFFLINE
                self.sync_message = "Offline - sync paused"
            elif self.current_status == SyncStatus.OFFLINE:
                self.current_status = SyncStatus.IDLE
                self.sync_message = "Online - ready to sync"
            
            self._notify_callbacks()
    
    def get_recent_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent sync history.
        
        Args:
            limit: Maximum number of history entries to return
            
        Returns:
            List of sync history entries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, status, message, files_synced, bytes_transferred, 
                       duration_seconds, timestamp
                FROM sync_history
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            
            results = cursor.fetchall()
            conn.close()
            
            history = []
            for result in results:
                history.append({
                    "id": result[0],
                    "status": result[1],
                    "message": result[2],
                    "files_synced": result[3],
                    "bytes_transferred": result[4],
                    "duration_seconds": result[5],
                    "timestamp": result[6]
                })
            
            return history
            
        except sqlite3.Error as e:
            print(f"❌ Failed to get sync history: {e}")
            return []
    
    def get_recent_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent sync errors.
        
        Args:
            limit: Maximum number of error entries to return
            
        Returns:
            List of error entries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, error_type, error_message, file_path, timestamp, resolved
                FROM sync_errors
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            
            results = cursor.fetchall()
            conn.close()
            
            errors = []
            for result in results:
                errors.append({
                    "id": result[0],
                    "error_type": result[1],
                    "error_message": result[2],
                    "file_path": result[3],
                    "timestamp": result[4],
                    "resolved": bool(result[5])
                })
            
            return errors
            
        except sqlite3.Error as e:
            print(f"❌ Failed to get sync errors: {e}")
            return []
    
    def cleanup_old_status_logs(self, days_to_keep: int = 7) -> int:
        """
        Clean up old status logs from database.
        
        Args:
            days_to_keep: Number of days of logs to keep
            
        Returns:
            Number of records deleted
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            
            # Clean up old status logs
            cursor.execute("""
                DELETE FROM sync_status WHERE timestamp < ?
            """, (cutoff_date,))
            
            status_deleted = cursor.rowcount
            
            # Clean up old history (keep longer)
            history_cutoff = datetime.now() - timedelta(days=days_to_keep * 2)
            cursor.execute("""
                DELETE FROM sync_history WHERE timestamp < ?
            """, (history_cutoff,))
            
            history_deleted = cursor.rowcount
            
            # Clean up resolved errors
            cursor.execute("""
                DELETE FROM sync_errors WHERE resolved = 1 AND timestamp < ?
            """, (cutoff_date,))
            
            errors_deleted = cursor.rowcount
            
            conn.commit()
            conn.close()
            
            total_deleted = status_deleted + history_deleted + errors_deleted
            if total_deleted > 0:
                print(f"[OK] Cleaned up {total_deleted} old status logs")
            
            return total_deleted
            
        except sqlite3.Error as e:
            print(f"❌ Failed to cleanup old logs: {e}")
            return 0


# Global sync status tracker instance
_global_tracker: Optional[SyncStatusTracker] = None


def get_sync_tracker(db_path: str = "local_cache.db") -> SyncStatusTracker:
    """
    Get or create the global sync status tracker instance.
    
    Args:
        db_path: Path to the SQLite database
        
    Returns:
        SyncStatusTracker instance
    """
    global _global_tracker
    if _global_tracker is None:
        _global_tracker = SyncStatusTracker(db_path)
    return _global_tracker


if __name__ == "__main__":
    # Test the sync status tracker
    print("=== Testing SyncStatusTracker ===\n")
    
    tracker = SyncStatusTracker()
    
    # Test status updates
    print("Testing status updates...")
    tracker.update_status(SyncStatus.SYNCING, "Starting sync", 10)
    time.sleep(0.5)
    
    tracker.update_status(SyncStatus.SYNCING, "Uploading files", 50, "test_file.csv")
    time.sleep(0.5)
    
    tracker.update_status(SyncStatus.COMPLETED, "Sync complete", 100)
    
    # Test sync operation
    print("\nTesting sync operation...")
    tracker.start_sync(total_files=5)
    
    for i in range(5):
        tracker.update_file_progress(f"file_{i}.csv", 50, 1024 * 1024)
        time.sleep(0.2)
        tracker.complete_file(f"file_{i}.csv", 1024 * 1024)
    
    tracker.complete_sync(success=True)
    
    # Test error logging
    print("\nTesting error logging...")
    tracker.log_error("upload_error", "Failed to upload file", "problematic_file.csv")
    
    # Test history retrieval
    print("\nRetrieving sync history...")
    history = tracker.get_recent_history(limit=5)
    for entry in history:
        print(f"   - {entry['status']}: {entry['message']}")
    
    # Test error retrieval
    print("\nRetrieving recent errors...")
    errors = tracker.get_recent_errors(limit=5)
    for error in errors:
        print(f"   - {error['error_type']}: {error['error_message']}")
    
    # Test status dictionary
    print("\nCurrent status:")
    status = tracker.get_status_dict()
    for key, value in status.items():
        print(f"   {key}: {value}")
    
    print("\n[OK] All sync status tests completed!")
