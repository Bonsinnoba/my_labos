"""
Knowledge Vault Module

This module manages document storage, metadata extraction, and search functionality
for the lab's knowledge repository. It handles PDFs, datasheets, images, research papers,
schematics, technical notes, firmware notes, and design documents.
"""

import os
import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import mimetypes

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class KnowledgeVault:
    """Manages the knowledge vault document repository."""
    
    def __init__(self, db: Optional[CacheDatabase] = None, vault_path: str = "knowledge_vault"):
        """
        Initialize the knowledge vault.
        
        Args:
            db: CacheDatabase instance (creates new if None)
            vault_path: Path to the vault storage directory
        """
        self.db = db if db else CacheDatabase()
        self.vault_path = Path(vault_path)
        try:
            self.vault_path.mkdir(exist_ok=True)
            print(f"[KnowledgeVault] Initialized with vault path: {self.vault_path.absolute()}")
        except Exception as e:
            print(f"[KnowledgeVault] Failed to create vault directory: {e}")
            raise
        
        # Create subdirectories for different file types
        (self.vault_path / "pdfs").mkdir(exist_ok=True)
        (self.vault_path / "images").mkdir(exist_ok=True)
        (self.vault_path / "datasheets").mkdir(exist_ok=True)
        (self.vault_path / "schematics").mkdir(exist_ok=True)
        (self.vault_path / "notes").mkdir(exist_ok=True)
        (self.vault_path / "videos").mkdir(exist_ok=True)
        (self.vault_path / "other").mkdir(exist_ok=True)
        
        print(f"✅ Knowledge Vault initialized at: {self.vault_path.absolute()}")
    
    def _get_file_type(self, file_path: str) -> str:
        """
        Determine the file type based on extension.
        
        Args:
            file_path: Path to the file
            
        Returns:
            File type string (pdf, image, video, datasheet, schematic, note, other)
        """
        ext = Path(file_path).suffix.lower()
        
        if ext in ['.pdf']:
            return 'pdf'
        elif ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.tiff']:
            return 'image'
        elif ext in ['.mp4', '.webm', '.mov', '.avi', '.mkv']:
            return 'video'
        elif ext in ['.sch', '.brd', '.kicad', '.pcb']:
            return 'schematic'
        elif 'datasheet' in file_path.lower():
            return 'datasheet'
        elif ext in ['.txt', '.md', '.doc', '.docx']:
            return 'note'
        else:
            return 'other'
    
    def _get_storage_path(self, file_type: str, filename: str) -> Path:
        """
        Get the appropriate storage path for a file type.
        
        Args:
            file_type: Type of file
            filename: Original filename
            
        Returns:
            Path where the file should be stored
        """
        type_dirs = {
            'pdf': 'pdfs',
            'image': 'images',
            'video': 'videos',
            'datasheet': 'datasheets',
            'schematic': 'schematics',
            'note': 'notes',
            'other': 'other'
        }
        
        dir_name = type_dirs.get(file_type, 'other')
        (self.vault_path / dir_name).mkdir(exist_ok=True)
        
        return self.vault_path / dir_name / filename
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """
        Calculate SHA256 hash of a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Hexadecimal hash string
        """
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def _extract_metadata(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """
        Extract metadata from a file.
        
        Args:
            file_path: Path to the file
            file_type: Type of file
            
        Returns:
            Dictionary of metadata
        """
        metadata = {}
        file_path_obj = Path(file_path)
        
        # Basic file metadata
        metadata['original_filename'] = file_path_obj.name
        metadata['file_extension'] = file_path_obj.suffix
        metadata['file_size'] = os.path.getsize(file_path)
        metadata['mime_type'] = mimetypes.guess_type(file_path)[0]
        metadata['file_hash'] = self._calculate_file_hash(file_path)
        metadata['extraction_date'] = datetime.now().isoformat()
        
        # Type-specific metadata could be added here
        # For PDFs: extract text, author, creation date
        # For images: EXIF data, dimensions
        # For schematics: component counts, layers
        
        return metadata
    
    def add_document(self, source_path: str, title: str, description: Optional[str] = None,
                    tags: Optional[List[str]] = None, project_id: Optional[int] = None,
                    component_id: Optional[int] = None, equipment_id: Optional[int] = None,
                    experiment_id: Optional[int] = None, stage_id: Optional[int] = None) -> int:
        """
        Add a document to the knowledge vault.
        
        Args:
            source_path: Path to the source file
            title: Document title
            description: Document description
            tags: List of tags
            project_id: Associated project ID
            component_id: Associated component ID
            equipment_id: Associated equipment ID
            experiment_id: Associated experiment ID
            stage_id: Associated experiment stage ID
            
        Returns:
            The ID of the inserted document
        """
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Source file not found: {source_path}")
        
        # Determine file type
        file_type = self._get_file_type(source_path)
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_name = Path(source_path).name
        new_filename = f"{timestamp}_{original_name}"
        
        # Move file to vault
        storage_path = self._get_storage_path(file_type, new_filename)
        
        import shutil
        try:
            shutil.move(source_path, storage_path)
        except Exception as e:
            print(f"Failed to move file from {source_path} to {storage_path}: {e}")
            raise
        
        # Extract metadata
        metadata = self._extract_metadata(storage_path, file_type)
        
        # Convert tags to comma-separated string
        tags_str = ",".join(tags) if tags else None
        
        # Store in database
        doc_id = self.db.add_document(
            title=title,
            file_path=str(storage_path),
            file_type=file_type,
            file_size=metadata['file_size'],
            description=description,
            metadata=json.dumps(metadata),
            tags=tags_str,
            project_id=project_id,
            component_id=component_id,
            equipment_id=equipment_id,
            experiment_id=experiment_id,
            stage_id=stage_id
        )
        
        print(f"✅ Document added to vault: {title} (ID: {doc_id})")
        return doc_id
    
    def get_document(self, doc_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve a document by ID.
        
        Args:
            doc_id: Document ID
            
        Returns:
            Document dictionary with metadata
        """
        doc = self.db.get_document(doc_id)
        if doc and doc.get('metadata'):
            doc['metadata'] = json.loads(doc['metadata'])
        return doc
    
    def search_documents(self, query: str, project_id: Optional[int] = None,
                        file_type: Optional[str] = None, tags: Optional[List[str]] = None,
                        experiment_id: Optional[int] = None, stage_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Search documents by query, project, type, or tags.
        
        Args:
            query: Search query string (searches title, description, tags)
            project_id: Filter by project ID
            file_type: Filter by file type
            tags: Filter by tags
            experiment_id: Filter by experiment ID
            stage_id: Filter by stage ID
            
        Returns:
            List of matching documents
        """
        # Get base documents
        docs = self.db.get_all_documents(
            project_id=project_id,
            file_type=file_type,
            experiment_id=experiment_id,
            stage_id=stage_id
        )
        
        # Filter by query
        if query:
            query_lower = query.lower()
            docs = [doc for doc in docs 
                   if query_lower in doc['title'].lower() or
                   (doc.get('description') and query_lower in doc['description'].lower()) or
                   (doc.get('tags') and query_lower in doc['tags'].lower())]
        
        # Filter by tags
        if tags:
            docs = [doc for doc in docs 
                   if doc.get('tags') and any(tag.lower() in doc['tags'].lower() for tag in tags)]
        
        return docs
    
    def get_documents_by_project(self, project_id: int) -> List[Dict[str, Any]]:
        """
        Get all documents associated with a project.
        
        Args:
            project_id: Project ID
            
        Returns:
            List of documents
        """
        return self.db.get_all_documents(project_id=project_id)
    
    def get_documents_by_component(self, component_id: int) -> List[Dict[str, Any]]:
        """
        Get all documents associated with a component (e.g., datasheets).
        
        Args:
            component_id: Component ID
            
        Returns:
            List of documents
        """
        # This would require adding a query method to the database
        # For now, return empty list
        return []
    
    def get_documents_by_equipment(self, equipment_id: int) -> List[Dict[str, Any]]:
        """
        Get all documents associated with equipment (e.g., manuals).
        
        Args:
            equipment_id: Equipment ID
            
        Returns:
            List of documents
        """
        # This would require adding a query method to the database
        # For now, return empty list
        return []
    
    def update_document(self, doc_id: int, **kwargs) -> bool:
        """
        Update document metadata.
        
        Args:
            doc_id: Document ID
            **kwargs: Fields to update (title, description, tags, etc.)
            
        Returns:
            True if successful
        """
        # Convert tags list to string if provided
        if 'tags' in kwargs and isinstance(kwargs['tags'], list):
            kwargs['tags'] = ",".join(kwargs['tags'])
        
        # Update database
        return self.db.update_document(doc_id, **kwargs) if hasattr(self.db, 'update_document') else False
    
    def delete_document(self, doc_id: int) -> bool:
        """
        Delete a document from the vault.
        
        Args:
            doc_id: Document ID
            
        Returns:
            True if successful
        """
        doc = self.db.get_document(doc_id)
        if not doc:
            return False
        
        # Record deletion in asset sync log before deletion
        file_name = Path(doc['file_path']).name
        self.db.record_asset_deletion(file_name)
        
        # Delete file from disk
        file_path = Path(doc['file_path'])
        if file_path.exists():
            file_path.unlink()
        
        # Delete from database
        return self.db.delete_document(doc_id)
    
    def get_vault_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the knowledge vault.
        
        Returns:
            Dictionary with vault statistics
        """
        all_docs = self.db.get_all_documents()
        
        # Count by type
        type_counts = {}
        total_size = 0
        
        for doc in all_docs:
            file_type = doc['file_type']
            type_counts[file_type] = type_counts.get(file_type, 0) + 1
            total_size += doc.get('file_size', 0)
        
        return {
            'total_documents': len(all_docs),
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'by_type': type_counts
        }
    
    def scan_and_register_existing_files(self, force_update: bool = False) -> int:
        """
        Scan vault directories and register any files that aren't in the database.
        
        Args:
            force_update: If True, re-register all files even if they already exist
            
        Returns:
            Number of files registered
        """
        registered_count = 0
        
        # Scan each subdirectory
        for dir_name in ['notes', 'pdfs', 'images', 'datasheets', 'schematics']:
            dir_path = self.vault_path / dir_name
            if not dir_path.exists():
                continue
            
            for file_path in dir_path.iterdir():
                if file_path.is_file():
                    try:
                        # Check if file is already in database
                        file_str = str(file_path)
                        existing_docs = self.db.get_all_documents()
                        already_registered = any(doc['file_path'] == file_str for doc in existing_docs)
                        
                        if already_registered and not force_update:
                            continue
                        
                        # Determine file type
                        file_type = self._get_file_type(file_str)
                        
                        # Generate title from filename
                        title = file_path.stem.replace('_', ' ').title()
                        
                        # Extract metadata
                        metadata = self._extract_metadata(file_str, file_type)
                        
                        # Register in database
                        doc_id = self.db.add_document(
                            title=title,
                            file_path=file_str,
                            file_type=file_type,
                            file_size=metadata['file_size'],
                            description=f"Auto-registered from {dir_name} directory",
                            metadata=json.dumps(metadata),
                            tags=None,
                            project_id=None,
                            component_id=None,
                            equipment_id=None,
                            experiment_id=None,
                            stage_id=None
                        )
                        
                        registered_count += 1
                        print(f"[KnowledgeVault] Registered existing file: {file_path.name} (ID: {doc_id})")
                        
                    except Exception as e:
                        print(f"[KnowledgeVault] Failed to register {file_path.name}: {e}")
        
        print(f"[KnowledgeVault] Registered {registered_count} existing files")
        return registered_count
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the knowledge vault
    print("=== Testing Knowledge Vault ===\n")
    
    vault = KnowledgeVault()
    
    # Create a test file
    test_file = "test_document.txt"
    with open(test_file, 'w') as f:
        f.write("This is a test document for the knowledge vault.")
    
    try:
        # Add document
        doc_id = vault.add_document(
            source_path=test_file,
            title="Test Document",
            description="A test document for the knowledge vault",
            tags=["test", "sample"]
        )
        
        # Retrieve document
        doc = vault.get_document(doc_id)
        print(f"\nRetrieved document: {doc['title']}")
        print(f"File type: {doc['file_type']}")
        print(f"Metadata: {doc['metadata']}")
        
        # Search documents
        results = vault.search_documents("test")
        print(f"\nSearch results for 'test': {len(results)} documents")
        
        # Get stats
        stats = vault.get_vault_stats()
        print(f"\nVault stats: {stats}")
        
        # Cleanup
        vault.delete_document(doc_id)
        print("\n✅ Test document deleted")
        
    finally:
        # Cleanup test file
        if os.path.exists(test_file):
            os.remove(test_file)
        
        vault.close()
    
    print("\n✅ All tests passed")
