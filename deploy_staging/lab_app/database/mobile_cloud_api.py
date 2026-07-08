"""
Mobile Cloud API Module

This module provides cloud-accessible API endpoints for mobile devices to fetch data
directly from Backblaze B2 without needing to connect to local lab computers.

Mobile devices can:
- Fetch the latest database snapshot from cloud
- Fetch individual transactions from mesh sync
- Download files directly from cloud storage
- Push their own transactions to cloud (for mobile-to-lab sync)
- Access Gemini AI assistant features
"""

import json
import gzip
import sqlite3
import os
from typing import Optional, List, Dict, Any, Generator
from datetime import datetime
from pathlib import Path
import hashlib

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    print("[mobile_cloud_api] boto3 not available - cloud API disabled")

# Optional Gemini import
try:
    from gemini_service import GeminiLabAssistant
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    GeminiLabAssistant = None


class MobileCloudAPI:
    """
    Cloud API for mobile devices to access lab data directly from Backblaze B2.
    
    This allows mobile devices to fetch data from anywhere with internet connection,
    without needing to be on the same network as lab computers.
    """
    
    def __init__(self,
                 b2_bucket_name: str,
                 b2_endpoint_url: str,
                 b2_access_key_id: str,
                 b2_secret_access_key: str,
                 snapshot_prefix: str = "db_snapshots",
                 gemini_api_key: Optional[str] = None):
        """
        Initialize the Mobile Cloud API.

        Args:
            b2_bucket_name: Backblaze B2 bucket name for data storage
            b2_endpoint_url: Backblaze B2 endpoint URL
            b2_access_key_id: Backblaze B2 access key ID
            b2_secret_access_key: Backblaze B2 secret access key
            snapshot_prefix: Prefix for database snapshot files in B2
            gemini_api_key: Optional Gemini API key for AI features
        """
        self.b2_bucket_name = b2_bucket_name
        self.b2_endpoint_url = b2_endpoint_url
        self.b2_access_key_id = b2_access_key_id
        self.b2_secret_access_key = b2_secret_access_key
        self.snapshot_prefix = snapshot_prefix

        self.s3_client = None
        self._init_b2_client()

        # Initialize Gemini AI assistant
        self.gemini_assistant = None
        if GEMINI_AVAILABLE and gemini_api_key:
            try:
                self.gemini_assistant = GeminiLabAssistant(api_key=gemini_api_key)
                print("[mobile_cloud_api] Gemini AI assistant initialized")
            except Exception as e:
                print(f"[mobile_cloud_api] Failed to initialize Gemini: {e}")
    
    def _init_b2_client(self) -> None:
        """Initialize Backblaze B2 S3 client."""
        if not BOTO3_AVAILABLE:
            print("[mobile_cloud_api] boto3 not available")
            return
        
        try:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.b2_endpoint_url,
                aws_access_key_id=self.b2_access_key_id,
                aws_secret_access_key=self.b2_secret_access_key
            )
            print(f"[mobile_cloud_api] B2 client initialized for bucket: {self.b2_bucket_name}")
        except Exception as e:
            print(f"[mobile_cloud_api] B2 client initialization error: {e}")
            self.s3_client = None
    
    def get_latest_db_snapshot(self) -> Optional[Dict[str, Any]]:
        """
        Get the latest database snapshot from cloud storage.
        
        Returns:
            Dictionary containing the database snapshot data, or None if not found
        """
        if not self.s3_client:
            return None
        
        try:
            # List objects in bucket with snapshot prefix
            response = self.s3_client.list_objects_v2(
                Bucket=self.b2_bucket_name,
                Prefix=self.snapshot_prefix
            )
            
            if 'Contents' not in response:
                print("[mobile_cloud_api] No database snapshots found")
                return None
            
            # Find the latest snapshot by sorting by last modified
            snapshots = [obj for obj in response['Contents'] if obj['Key'].endswith('.db.gz')]
            if not snapshots:
                print("[mobile_cloud_api] No valid database snapshots found")
                return None
            
            latest_snapshot = max(snapshots, key=lambda x: x['LastModified'])
            snapshot_key = latest_snapshot['Key']
            
            print(f"[mobile_cloud_api] Latest snapshot: {snapshot_key}")
            
            # Download and decompress the snapshot
            obj_response = self.s3_client.get_object(
                Bucket=self.b2_bucket_name,
                Key=snapshot_key
            )
            compressed_data = obj_response['Body'].read()
            db_data = gzip.decompress(compressed_data)
            
            # Parse the database data
            # For now, we'll return the raw data
            # In a real implementation, you might want to parse this into a structured format
            return {
                'snapshot_key': snapshot_key,
                'last_modified': latest_snapshot['LastModified'].isoformat(),
                'size': len(db_data),
                'data': db_data
            }
            
        except ClientError as e:
            print(f"[mobile_cloud_api] B2 download error: {e}")
            return None
        except Exception as e:
            print(f"[mobile_cloud_api] Get snapshot error: {e}")
            return None
    
    def get_mesh_transactions(self, since_timestamp: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get mesh transactions from cloud storage.
        
        Args:
            since_timestamp: Optional timestamp to filter transactions after
            
        Returns:
            List of transaction dictionaries
        """
        if not self.s3_client:
            return []
        
        try:
            # List objects in bucket with mesh transaction prefix
            response = self.s3_client.list_objects_v2(
                Bucket=self.b2_bucket_name,
                Prefix="mesh_tx_"
            )
            
            if 'Contents' not in response:
                print("[mobile_cloud_api] No mesh transactions found")
                return []
            
            transactions = []
            
            for obj in response['Contents']:
                key = obj['Key']
                
                # Extract timestamp from filename
                try:
                    timestamp_str = key.split('_')[-1].replace('.json.gz', '')
                    bundle_timestamp = int(timestamp_str)
                    
                    # Filter by timestamp if provided
                    if since_timestamp and bundle_timestamp <= since_timestamp:
                        continue
                except (ValueError, IndexError):
                    continue
                
                # Download and decompress the transaction bundle
                obj_response = self.s3_client.get_object(
                    Bucket=self.b2_bucket_name,
                    Key=key
                )
                compressed_data = obj_response['Body'].read()
                json_data = gzip.decompress(compressed_data).decode()
                bundle = json.loads(json_data)
                
                transactions.extend(bundle.get('transactions', []))
            
            print(f"[mobile_cloud_api] Retrieved {len(transactions)} transactions")
            return transactions
            
        except ClientError as e:
            print(f"[mobile_cloud_api] B2 download error: {e}")
            return []
        except Exception as e:
            print(f"[mobile_cloud_api] Get transactions error: {e}")
            return []
    
    def get_file_url(self, file_name: str, file_size: int) -> Optional[str]:
        """
        Get the public URL for a file stored in cloud.
        
        Args:
            file_name: Name of the file
            file_size: Size of the file in bytes (used to determine bucket)
            
        Returns:
            Public URL for the file, or None if not found
        """
        if not self.s3_client:
            return None
        
        try:
            # Determine which bucket based on file size (50MB threshold)
            size_threshold = 50 * 1024 * 1024  # 50MB
            
            if file_size >= size_threshold:
                # Heavy storage bucket
                bucket = os.getenv("ACCOUNT_1_BUCKET", "lab-heavy-storage")
                endpoint = os.getenv("ACCOUNT_1_ENDPOINT", self.b2_endpoint_url)
            else:
                # Light storage bucket
                bucket = os.getenv("ACCOUNT_2_BUCKET", "lab-light-storage")
                endpoint = os.getenv("ACCOUNT_2_ENDPOINT", self.b2_endpoint_url)
            
            # Construct public URL
            url = f"{endpoint}/{bucket}/{file_name}"
            
            return url
            
        except Exception as e:
            print(f"[mobile_cloud_api] Get file URL error: {e}")
            return None
    
    def push_mobile_transaction(self, transaction: Dict[str, Any]) -> bool:
        """
        Push a transaction from mobile device to cloud (for mobile-to-lab sync).
        
        Args:
            transaction: Transaction dictionary to push
            
        Returns:
            True if successful, False otherwise
        """
        if not self.s3_client:
            return False
        
        try:
            # Create a mobile-specific transaction bundle
            bundle_data = {
                'device_id': 'MOBILE_DEVICE',
                'timestamp': int(datetime.now().timestamp() * 1000),
                'transactions': [transaction]
            }
            
            # Serialize and compress
            json_data = json.dumps(bundle_data)
            compressed_data = gzip.compress(json_data.encode())
            
            # Create filename with timestamp
            bundle_filename = f"mesh_tx_MOBILE_{int(datetime.now().timestamp() * 1000)}.json.gz"
            
            # Upload to B2
            self.s3_client.put_object(
                Bucket=self.b2_bucket_name,
                Key=bundle_filename,
                Body=compressed_data,
                ContentType='application/gzip'
            )
            
            print(f"[mobile_cloud_api] Pushed mobile transaction: {bundle_filename}")
            return True
            
        except ClientError as e:
            print(f"[mobile_cloud_api] B2 upload error: {e}")
            return False
        except Exception as e:
            print(f"[mobile_cloud_api] Push transaction error: {e}")
            return False
    
    def is_available(self) -> bool:
        """
        Check if the cloud API is available.

        Returns:
            True if available, False otherwise
        """
        return self.s3_client is not None

    def is_gemini_available(self) -> bool:
        """
        Check if Gemini AI features are available.

        Returns:
            True if available, False otherwise
        """
        return self.gemini_assistant is not None

    # Gemini AI Methods for Mobile Access

    def review_stage_design(self, stage_context: Dict[str, Any]) -> Generator[str, None, None]:
        """
        Feature A: Stage Design Reviewer - Analyze project stage for thermal risks, component mismatches, or logic flaws.

        Args:
            stage_context: Dictionary containing Stage Goals, Experiment Logs, and Parts used

        Yields:
            Streaming response tokens
        """
        if not self.gemini_assistant:
            yield "Gemini AI not available. Configure GEMINI_API_KEY to enable AI features."
            return

        try:
            for chunk in self.gemini_assistant.review_stage_data(stage_context):
                yield chunk
        except Exception as e:
            yield f"Error generating review: {str(e)}"

    def find_component_alternates(self, component_details: str) -> Generator[str, None, None]:
        """
        Feature B: Smart Substitute Finder - Find pin-compatible, drop-in alternatives for components.

        Args:
            component_details: String describing the component (name, specs, etc.)

        Yields:
            Streaming response tokens
        """
        if not self.gemini_assistant:
            yield "Gemini AI not available. Configure GEMINI_API_KEY to enable AI features."
            return

        try:
            for chunk in self.gemini_assistant.find_alternates(component_details):
                yield chunk
        except Exception as e:
            yield f"Error finding alternatives: {str(e)}"

    def diagnose_circuit_failure(self, observation: str, experiment_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """
        Feature C: Failure Mode Analyzer - Diagnose circuit failures based on observations and experiment history.

        Args:
            observation: Raw user observation of the failure
            experiment_history: List of recent experiment data

        Yields:
            Streaming response tokens
        """
        if not self.gemini_assistant:
            yield "Gemini AI not available. Configure GEMINI_API_KEY to enable AI features."
            return

        try:
            for chunk in self.gemini_assistant.diagnose_failure(observation, experiment_history):
                yield chunk
        except Exception as e:
            yield f"Error diagnosing failure: {str(e)}"

    def generate_test_script(self, requirement: str, language: str = "python") -> Generator[str, None, None]:
        """
        Feature D: Lab Automation Scripting - Generate production-ready test automation scripts.

        Args:
            requirement: Description of the test requirement
            language: Target language (python, cpp, arduino)

        Yields:
            Streaming response tokens
        """
        if not self.gemini_assistant:
            yield "Gemini AI not available. Configure GEMINI_API_KEY to enable AI features."
            return

        try:
            for chunk in self.gemini_assistant.generate_test_script(requirement, language):
                yield chunk
        except Exception as e:
            yield f"Error generating script: {str(e)}"

    def chat(self, message: str, conversation_history: List[Dict[str, str]] = None) -> Generator[str, None, None]:
        """
        General Chat Interface - Handle general conversations with Gemini.

        Args:
            message: User's message
            conversation_history: Optional list of previous messages for context

        Yields:
            Streaming response tokens
        """
        if not self.gemini_assistant:
            yield "Gemini AI not available. Configure GEMINI_API_KEY to enable AI features."
            return

        try:
            for chunk in self.gemini_assistant.chat(message, conversation_history):
                yield chunk
        except Exception as e:
            yield f"Error generating response: {str(e)}"


# Convenience function to create mobile cloud API from environment variables
def create_mobile_cloud_api() -> Optional[MobileCloudAPI]:
    """
    Create a MobileCloudAPI instance from environment variables.

    Returns:
        MobileCloudAPI instance or None if credentials not available
    """
    b2_bucket_name = os.getenv("MESH_SYNC_BUCKET", "lab-mesh-sync")
    b2_endpoint_url = os.getenv("MESH_SYNC_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
    b2_access_key_id = os.getenv("MESH_SYNC_KEY_ID", "")
    b2_secret_access_key = os.getenv("MESH_SYNC_APPLICATION_KEY", "")
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")

    if not b2_access_key_id or not b2_secret_access_key:
        print("[mobile_cloud_api] B2 credentials not provided")
        return None

    return MobileCloudAPI(
        b2_bucket_name=b2_bucket_name,
        b2_endpoint_url=b2_endpoint_url,
        b2_access_key_id=b2_access_key_id,
        b2_secret_access_key=b2_secret_access_key,
        gemini_api_key=gemini_api_key if gemini_api_key else None
    )
