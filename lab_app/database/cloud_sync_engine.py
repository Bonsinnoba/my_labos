"""
Dual-Account Backblaze B2 Synchronization Engine

This module handles dynamic routing of files to separate Backblaze B2 accounts
based on a 50MB size threshold for 20GB free tier maximization:
- Files < 50MB: Account #1 (Light Storage Bucket)
- Files >= 50MB: Account #2 (Heavy Storage Bucket)

All files are encrypted locally using AES-256-GCM before upload for zero-knowledge privacy.
"""

import os
import threading
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import sqlite3
import zlib
from io import BytesIO

# Import secure vault for encryption
from .secure_vault import SecureFileVault, InvalidKeyError, CorruptedPayloadError

# Configuration - Set these environment variables or update directly
CLOUD_CONFIG = {
    # Dual-Account Backblaze B2 Configuration for 20GB Free Tier Maximization
    # Account #1 - Heavy Storage Bucket (files >= 50MB)
    "ACCOUNT_1_ENDPOINT": os.getenv("ACCOUNT_1_ENDPOINT", "https://s3.us-east-005.backblazeb2.com"),
    "ACCOUNT_1_KEY_ID": os.getenv("ACCOUNT_1_KEY_ID", ""),
    "ACCOUNT_1_APPLICATION_KEY": os.getenv("ACCOUNT_1_APPLICATION_KEY", ""),
    "ACCOUNT_1_BUCKET": os.getenv("ACCOUNT_1_BUCKET", "lab-heavy-storage"),
    
    # Account #2 - Light Storage Bucket (files < 50MB)
    "ACCOUNT_2_ENDPOINT": os.getenv("ACCOUNT_2_ENDPOINT", "https://s3.us-east-005.backblazeb2.com"),
    "ACCOUNT_2_KEY_ID": os.getenv("ACCOUNT_2_KEY_ID", ""),
    "ACCOUNT_2_APPLICATION_KEY": os.getenv("ACCOUNT_2_APPLICATION_KEY", ""),
    "ACCOUNT_2_BUCKET": os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage"),
    
    # Sync Configuration
    "SYNC_INTERVAL_SECONDS": 300,  # Check for unsynced files every 5 minutes
    "STORAGE_VAULT_PATH": os.getenv("STORAGE_VAULT_PATH", "backend/storage_vault"),
    "DATABASE_PATH": os.getenv("DATABASE_PATH", "local_cache.db"),
    
    # Encryption Configuration
    "ENCRYPTION_KEY": os.getenv("ENCRYPTION_KEY", ""),  # 64-character hex string for AES-256
    "ENABLE_ENCRYPTION": os.getenv("ENABLE_ENCRYPTION", "true").lower() == "true",
}

# Size threshold constants
SIZE_THRESHOLD_BYTES = 50 * 1024 * 1024  # 50 Megabytes in bytes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sync_engine.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DualAccountSyncEngine:
    """
    Dual-Account Backblaze B2 Synchronization Engine for 20GB Free Tier Maximization.
    
    Routes files to separate Backblaze accounts based on 50MB size threshold:
    - Files >= 50MB: Account #1 (Heavy Storage Bucket)
    - Files < 50MB: Account #2 (Light Storage Bucket)
    
    All files are encrypted locally using AES-256-GCM before upload.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the DualAccountSyncEngine.
        
        Args:
            config: Optional configuration dictionary to override defaults
        """
        self.config = {**CLOUD_CONFIG, **(config or {})}
        self.size_threshold_bytes = SIZE_THRESHOLD_BYTES
        self.running = False
        self.sync_thread: Optional[threading.Thread] = None
        
        # Initialize dual boto3 clients
        self.account1_client = None
        self.account2_client = None
        
        # Initialize encryption vault
        self.secure_vault: Optional[SecureFileVault] = None
        if self.config["ENABLE_ENCRYPTION"]:
            if self.config["ENCRYPTION_KEY"]:
                try:
                    self.secure_vault = SecureFileVault(self.config["ENCRYPTION_KEY"])
                    logger.info("SecureFileVault initialized - encryption and compression enabled")
                except InvalidKeyError as e:
                    logger.warning(f"Failed to initialize encryption vault: {e}")
                    logger.warning("Encryption disabled - files will be uploaded with compression only")
            else:
                logger.warning("ENCRYPTION_KEY not provided - encryption disabled")
                logger.warning("Files will be uploaded with compression only")
        
        logger.info("DualAccountSyncEngine initialized")
        logger.info(f"Size threshold: {self.size_threshold_bytes / 1024 / 1024} MB")
        logger.info(f"Account #1 Bucket: {self.config['ACCOUNT_1_BUCKET']}")
        logger.info(f"Account #2 Bucket: {self.config['ACCOUNT_2_BUCKET']}")
        logger.info(f"Encryption enabled: {self.secure_vault is not None}")
    
    def _initialize_account1_client(self) -> bool:
        """
        Initialize boto3 client for Account #1 (Light Storage).
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            import boto3
            from botocore.client import Config
            
            if not self.config["ACCOUNT_1_KEY_ID"] or not self.config["ACCOUNT_1_APPLICATION_KEY"]:
                logger.warning("Account #1 credentials not provided - Account #1 upload disabled")
                return False
            
            self.account1_client = boto3.client(
                's3',
                endpoint_url=self.config["ACCOUNT_1_ENDPOINT"],
                aws_access_key_id=self.config["ACCOUNT_1_KEY_ID"],
                aws_secret_access_key=self.config["ACCOUNT_1_APPLICATION_KEY"],
                config=Config(signature_version='s3v4'),
                region_name='us-east-005'
            )
            
            # Test connection
            self.account1_client.list_buckets()
            logger.info("Account #1 boto3 client initialized successfully")
            return True
            
        except ImportError:
            logger.warning("boto3 library not installed - Account #1 upload disabled")
            logger.warning("Install with: pip install boto3")
            return False
        except Exception as e:
            logger.error(f"Failed to initialize Account #1 client: {e}")
            return False
    
    def _initialize_account2_client(self) -> bool:
        """
        Initialize boto3 client for Account #2 (Heavy Storage).
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            import boto3
            from botocore.client import Config
            
            if not self.config["ACCOUNT_2_KEY_ID"] or not self.config["ACCOUNT_2_APPLICATION_KEY"]:
                logger.warning("Account #2 credentials not provided - Account #2 upload disabled")
                return False
            
            self.account2_client = boto3.client(
                's3',
                endpoint_url=self.config["ACCOUNT_2_ENDPOINT"],
                aws_access_key_id=self.config["ACCOUNT_2_KEY_ID"],
                aws_secret_access_key=self.config["ACCOUNT_2_APPLICATION_KEY"],
                config=Config(signature_version='s3v4'),
                region_name='us-east-005'
            )
            
            # Test connection
            self.account2_client.list_buckets()
            logger.info("Account #2 boto3 client initialized successfully")
            return True
            
        except ImportError:
            logger.warning("boto3 library not installed - Account #2 upload disabled")
            logger.warning("Install with: pip install boto3")
            return False
        except Exception as e:
            logger.error(f"Failed to initialize Account #2 client: {e}")
            return False
    
    def initialize_cloud_clients(self) -> bool:
        """
        Initialize both Account #1 and Account #2 boto3 clients.
        
        Returns:
            True if at least one client initialized successfully
        """
        account1_ok = self._initialize_account1_client()
        account2_ok = self._initialize_account2_client()
        
        if not account1_ok and not account2_ok:
            logger.error("Failed to initialize any cloud storage clients")
            return False
        
        return True
    
    def _get_file_size(self, file_path: str) -> int:
        """
        Get file size in bytes.
        
        Args:
            file_path: Path to the file
            
        Returns:
            File size in bytes, or 0 if file doesn't exist
        """
        try:
            return os.path.getsize(file_path)
        except (OSError, FileNotFoundError) as e:
            logger.error(f"Failed to get file size for {file_path}: {e}")
            return 0
    
    def _compress_file(self, file_path: str) -> Optional[BytesIO]:
        """
        Compress a file using zlib.
        
        Args:
            file_path: Path to the file to compress
            
        Returns:
            BytesIO object containing compressed data, or None if compression fails
        """
        try:
            with open(file_path, 'rb') as f:
                original_data = f.read()
            
            compressed_data = zlib.compress(original_data, level=6)
            compression_ratio = len(compressed_data) / len(original_data) if len(original_data) > 0 else 1
            
            logger.info(f"Compression: {len(original_data)} -> {len(compressed_data)} bytes (ratio: {compression_ratio:.2%})")
            
            return BytesIO(compressed_data)
            
        except Exception as e:
            logger.error(f"Failed to compress file {file_path}: {e}")
            return None
    
    def _should_use_account1(self, file_size: int) -> bool:
        """
        Determine if file should be uploaded to Account #1 based on size.
        
        Args:
            file_size: File size in bytes
            
        Returns:
            True if file should go to Account #1 (>= 50MB), False for Account #2 (< 50MB)
        """
        if file_size >= self.size_threshold_bytes:
            logger.info(f"Large file detected ({file_size / 1024 / 1024:.2f} MB >= 50 MB), routing to Account #1 (Heavy Storage)")
            return True
        else:
            logger.info(f"Small file detected ({file_size / 1024 / 1024:.2f} MB < 50 MB), routing to Account #2 (Light Storage)")
            return False
    
    def _upload_to_account1(self, file_path: str, file_name: str) -> Optional[str]:
        """
        Upload file to Account #1 (Heavy Storage Bucket) with optional encryption.
        
        Args:
            file_path: Local path to the file
            file_name: Name to use for the uploaded file
            
        Returns:
            Cloud URL if upload successful, None otherwise
        """
        if not self.account1_client:
            logger.error("Account #1 client not initialized")
            return None
        
        try:
            bucket_name = self.config["ACCOUNT_1_BUCKET"]
            
            logger.info(f"Uploading {file_name} to Account #1 (Heavy Storage)")
            
            # Encrypt file if encryption is enabled
            if self.secure_vault:
                logger.info("Encrypting and compressing file before upload")
                encrypted_content = self.secure_vault.encrypt_file(file_path)
                file_name = f"{file_name}.enc"
                
                # Upload encrypted content using BytesIO
                self.account1_client.upload_fileobj(
                    BytesIO(encrypted_content),
                    Bucket=bucket_name,
                    Key=file_name
                )
            else:
                # Compress file even without encryption
                logger.info("Compressing file before upload (encryption disabled)")
                compressed_content = self._compress_file(file_path)
                if compressed_content:
                    file_name = f"{file_name}.gz"
                    self.account1_client.upload_fileobj(
                        compressed_content,
                        Bucket=bucket_name,
                        Key=file_name
                    )
                else:
                    # Upload original file if compression fails
                    logger.warning("Compression failed, uploading original file")
                    self.account1_client.upload_file(
                        Filename=file_path,
                        Bucket=bucket_name,
                        Key=file_name
                    )
            
            # Construct public URL
            public_url = f"{self.config['ACCOUNT_1_ENDPOINT']}/{bucket_name}/{file_name}"
            logger.info(f"Successfully uploaded to Account #1: {public_url}")
            
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload to Account #1: {e}")
            return None
    
    def _upload_to_account2(self, file_path: str, file_name: str) -> Optional[str]:
        """
        Upload file to Account #2 (Light Storage Bucket) with optional encryption.
        
        Args:
            file_path: Local path to the file
            file_name: Name to use for the uploaded file
            
        Returns:
            Cloud URL if upload successful, None otherwise
        """
        if not self.account2_client:
            logger.error("Account #2 client not initialized")
            return None
        
        try:
            bucket_name = self.config["ACCOUNT_2_BUCKET"]
            
            logger.info(f"Uploading {file_name} to Account #2 (Light Storage)")
            
            # Encrypt file if encryption is enabled
            if self.secure_vault:
                logger.info("Encrypting and compressing file before upload")
                encrypted_content = self.secure_vault.encrypt_file(file_path)
                file_name = f"{file_name}.enc"
                
                # Upload encrypted content using BytesIO
                self.account2_client.upload_fileobj(
                    BytesIO(encrypted_content),
                    Bucket=bucket_name,
                    Key=file_name
                )
            else:
                # Compress file even without encryption
                logger.info("Compressing file before upload (encryption disabled)")
                compressed_content = self._compress_file(file_path)
                if compressed_content:
                    file_name = f"{file_name}.gz"
                    self.account2_client.upload_fileobj(
                        compressed_content,
                        Bucket=bucket_name,
                        Key=file_name
                    )
                else:
                    # Upload original file if compression fails
                    logger.warning("Compression failed, uploading original file")
                    self.account2_client.upload_file(
                        Filename=file_path,
                        Bucket=bucket_name,
                        Key=file_name
                    )
            
            # Construct public URL
            public_url = f"{self.config['ACCOUNT_2_ENDPOINT']}/{bucket_name}/{file_name}"
            logger.info(f"Successfully uploaded to Account #2: {public_url}")
            
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload to Account #2: {e}")
            return None
    
    def _update_database_record(self, db_path: str, record_id: int, cloud_url: str) -> bool:
        """
        Update database record with cloud URL and mark as synced.
        
        Args:
            db_path: Path to SQLite database
            record_id: ID of the record to update
            cloud_url: Cloud storage URL
            
        Returns:
            True if update successful, False otherwise
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE knowledge_vault 
                SET cloud_file_url = ?, is_synced = 1 
                WHERE id = ?
            """, (cloud_url, record_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Updated database record {record_id} with cloud URL")
            return True
            
        except sqlite3.Error as e:
            logger.error(f"Failed to update database record {record_id}: {e}")
            return False
    
    def _get_unsynced_files(self, db_path: str) -> list:
        """
        Get list of unsynced files from database.
        
        Args:
            db_path: Path to SQLite database
            
        Returns:
            List of tuples (id, file_path, file_size)
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, file_path, file_size 
                FROM knowledge_vault 
                WHERE cloud_file_url IS NULL 
                AND file_path IS NOT NULL 
                AND is_synced = 0
            """)
            
            rows = cursor.fetchall()
            conn.close()
            
            logger.info(f"Found {len(rows)} unsynced files")
            return rows
            
        except sqlite3.Error as e:
            logger.error(f"Failed to query database for unsynced files: {e}")
            return []
    
    def _get_pending_asset_deletions(self, db_path: str) -> list:
        """
        Get list of pending asset deletions from asset_sync_log with file metadata.
        
        Args:
            db_path: Path to SQLite database
            
        Returns:
            List of tuples (id, file_name, action_type, timestamp, file_size)
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    asset_sync_log.id, 
                    asset_sync_log.file_name, 
                    asset_sync_log.action_type, 
                    asset_sync_log.timestamp,
                    knowledge_vault.file_size
                FROM asset_sync_log
                LEFT JOIN knowledge_vault ON knowledge_vault.file_path LIKE '%' || asset_sync_log.file_name
                WHERE asset_sync_log.action_type = 'DELETE'
                ORDER BY asset_sync_log.timestamp ASC
            """)
            
            rows = cursor.fetchall()
            conn.close()
            
            logger.info(f"Found {len(rows)} pending asset deletions")
            return rows
            
        except sqlite3.Error as e:
            logger.error(f"Failed to query database for pending deletions: {e}")
            return []
    
    def _delete_from_cloud(self, file_name: str, file_size: int = None) -> bool:
        """
        Delete a file from cloud storage (target account only based on file size).
        
        Args:
            file_name: Name of the file to delete
            file_size: File size in bytes (used to determine target account)
            
        Returns:
            True if deletion successful
        """
        # Determine target account based on file size
        if file_size is not None and file_size >= self.size_threshold_bytes:
            # File belongs to Account #1 (Heavy Storage)
            target_client = self.account1_client
            target_bucket = self.config["ACCOUNT_1_BUCKET"]
            account_name = "Account #1"
            logger.info(f"Large file ({file_size / 1024 / 1024:.2f} MB), targeting Account #1 (Heavy Storage)")
        else:
            # File belongs to Account #2 (Light Storage)
            target_client = self.account2_client
            target_bucket = self.config["ACCOUNT_2_BUCKET"]
            account_name = "Account #2"
            logger.info(f"Small file ({file_size / 1024 / 1024:.2f} MB if known), targeting Account #2 (Light Storage)")
        
        if not target_client:
            logger.error(f"{account_name} client not initialized - cannot delete {file_name}")
            return False
        
        try:
            target_client.delete_object(Bucket=target_bucket, Key=file_name)
            logger.info(f"Successfully deleted {file_name} from {account_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete {file_name} from {account_name}: {e}")
            return False
    
    def _clear_deletion_log(self, db_path: str, log_id: int) -> bool:
        """
        Clear a deletion log entry after processing.
        
        Args:
            db_path: Path to SQLite database
            log_id: The ID of the log entry to clear
            
        Returns:
            True if successful
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM asset_sync_log WHERE id = ?", (log_id,))
            conn.commit()
            conn.close()
            
            logger.info(f"Cleared deletion log entry {log_id}")
            return True
            
        except sqlite3.Error as e:
            logger.error(f"Failed to clear deletion log entry {log_id}: {e}")
            return False
    
    def _purge_database_record(self, db_path: str, file_name: str) -> bool:
        """
        Purge or archive the database record after successful cloud deletion.
        
        Args:
            db_path: Path to SQLite database
            file_name: Name of the file to purge from database
            
        Returns:
            True if successful
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Mark the record as tombstoned (soft delete) instead of hard delete
            # This preserves the record for audit trail but hides it from UI
            cursor.execute("""
                UPDATE knowledge_vault 
                SET is_tombstone = 1 
                WHERE file_path LIKE '%' || ?
            """, (file_name,))
            
            conn.commit()
            rows_affected = cursor.rowcount
            conn.close()
            
            logger.info(f"Purged database record for {file_name} (marked as tombstone, {rows_affected} rows affected)")
            return rows_affected > 0
            
        except sqlite3.Error as e:
            logger.error(f"Failed to purge database record for {file_name}: {e}")
            return False
    
    def sync_files(self) -> None:
        """
        Main sync loop - scans database for unsynced files and uploads them to appropriate account.
        Also processes pending asset deletions from asset_sync_log.
        """
        logger.info("Starting dual-account file sync cycle")
        
        db_path = self.config["DATABASE_PATH"]
        
        # Process pending asset deletions first
        pending_deletions = self._get_pending_asset_deletions(db_path)
        deletion_success_count = 0
        deletion_failure_count = 0
        
        for log_id, file_name, action_type, timestamp, file_size in pending_deletions:
            try:
                # Delete from cloud storage (target account only based on file size)
                if self._delete_from_cloud(file_name, file_size):
                    # Purge database record (mark as tombstoned)
                    if self._purge_database_record(db_path, file_name):
                        # Clear deletion log entry
                        if self._clear_deletion_log(db_path, log_id):
                            deletion_success_count += 1
                        else:
                            deletion_failure_count += 1
                    else:
                        deletion_failure_count += 1
                else:
                    deletion_failure_count += 1
                    
            except Exception as e:
                logger.error(f"Error processing deletion for {file_name}: {e}")
                deletion_failure_count += 1
        
        if pending_deletions:
            logger.info(f"Deletion sync completed: {deletion_success_count} successful, {deletion_failure_count} failed")
        
        # Process unsynced file uploads
        unsynced_files = self._get_unsynced_files(db_path)
        
        if not unsynced_files:
            logger.info("No unsynced files found")
            return
        
        success_count = 0
        failure_count = 0
        
        for record_id, file_path, file_size in unsynced_files:
            try:
                # Check if file exists locally
                if not os.path.exists(file_path):
                    logger.warning(f"File not found locally: {file_path}")
                    continue
                
                # Get actual file size if not in database
                if not file_size:
                    file_size = self._get_file_size(file_path)
                
                # Determine routing destination based on 50MB threshold
                use_account1 = self._should_use_account1(file_size)
                
                # Get file name
                file_name = Path(file_path).name
                
                # Upload to appropriate account
                if use_account1:
                    cloud_url = self._upload_to_account1(file_path, file_name)
                else:
                    cloud_url = self._upload_to_account2(file_path, file_name)
                
                if cloud_url:
                    # Update database record
                    if self._update_database_record(db_path, record_id, cloud_url):
                        success_count += 1
                    else:
                        failure_count += 1
                else:
                    failure_count += 1
                    
            except Exception as e:
                logger.error(f"Error syncing file {file_path}: {e}")
                failure_count += 1
        
        logger.info(f"Upload sync cycle completed: {success_count} successful, {failure_count} failed")
    
    def start_background_sync(self) -> None:
        """
        Start the background sync thread.
        """
        if self.running:
            logger.warning("Sync thread already running")
            return
        
        if not self.initialize_cloud_clients():
            logger.error("Cannot start sync - cloud clients failed to initialize")
            return
        
        self.running = True
        self.sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.sync_thread.start()
        logger.info("Background sync thread started")
    
    def stop_background_sync(self) -> None:
        """
        Stop the background sync thread.
        """
        self.running = False
        if self.sync_thread:
            self.sync_thread.join(timeout=5)
            logger.info("Background sync thread stopped")
    
    def _sync_loop(self) -> None:
        """
        Background sync loop that runs periodically.
        """
        while self.running:
            try:
                self.sync_files()
                
                # Wait for next sync cycle
                for _ in range(self.config["SYNC_INTERVAL_SECONDS"]):
                    if not self.running:
                        break
                    time.sleep(1)
                    
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")
                # Wait before retrying
                time.sleep(60)
    
    def sync_once(self) -> None:
        """
        Perform a single sync cycle (non-blocking).
        """
        if not self.initialize_cloud_clients():
            logger.error("Cannot sync - cloud clients failed to initialize")
            return
        
        self.sync_files()


# Example usage and testing
if __name__ == "__main__":
    print("=== DualAccountSyncEngine Example ===\n")
    
    # Create dual-account sync engine
    engine = DualAccountSyncEngine()
    
    # Perform a single sync
    engine.sync_once()
    
    # Or start background sync
    # engine.start_background_sync()
    # 
    # To stop:
    # engine.stop_background_sync()
