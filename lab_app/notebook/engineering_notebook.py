"""
Engineering Notebook Module

This module manages the digital engineering notebook - a permanent engineering journal
that supports rich text, voice transcription, images, attachments, project association,
experiment association, and tags.
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class EngineeringNotebook:
    """Manages the digital engineering notebook."""
    
    def __init__(self, db: Optional[CacheDatabase] = None, attachments_path: str = "notebook_attachments"):
        """
        Initialize the engineering notebook.
        
        Args:
            db: CacheDatabase instance (creates new if None)
            attachments_path: Path to store attachments
        """
        self.db = db if db else CacheDatabase()
        self.attachments_path = Path(attachments_path)
        self.attachments_path.mkdir(exist_ok=True)
        
        print(f"✅ Engineering Notebook initialized at: {self.attachments_path.absolute()}")
    
    def create_entry(self, title: str, content: str, entry_type: str = "text",
                    project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                    tags: Optional[List[str]] = None, attachments: Optional[List[str]] = None,
                    voice_transcription: Optional[str] = None) -> int:
        """
        Create a new notebook entry.
        
        Args:
            title: Entry title
            content: Entry content (rich text or markdown)
            entry_type: Type of entry (text, voice, image, mixed)
            project_id: Associated project ID
            experiment_id: Associated experiment ID
            tags: List of tags
            attachments: List of attachment file paths
            voice_transcription: Transcribed voice text
            
        Returns:
            The ID of the created entry
        """
        # Convert tags to comma-separated string
        tags_str = ",".join(tags) if tags else None
        
        # Convert attachments to JSON string
        attachments_json = json.dumps(attachments) if attachments else None
        
        entry_id = self.db.add_notebook_entry(
            title=title,
            content=content,
            entry_type=entry_type,
            project_id=project_id,
            experiment_id=experiment_id,
            tags=tags_str,
            attachments=attachments_json,
            voice_transcription=voice_transcription
        )
        
        print(f"✅ Notebook entry created: {title} (ID: {entry_id})")
        return entry_id
    
    def get_entry(self, entry_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve a notebook entry by ID.
        
        Args:
            entry_id: Entry ID
            
        Returns:
            Entry dictionary with parsed tags and attachments
        """
        entry = self.db.get_notebook_entry(entry_id)
        if not entry:
            return None
        
        # Parse tags
        if entry.get('tags'):
            entry['tags_list'] = [tag.strip() for tag in entry['tags'].split(',')]
        else:
            entry['tags_list'] = []
        
        # Parse attachments
        if entry.get('attachments'):
            try:
                entry['attachments_list'] = json.loads(entry['attachments'])
            except json.JSONDecodeError:
                entry['attachments_list'] = []
        else:
            entry['attachments_list'] = []
        
        return entry
    
    def get_all_entries(self, project_id: Optional[int] = None, 
                       experiment_id: Optional[int] = None,
                       limit: int = 100) -> List[Dict[str, Any]]:
        """
        Retrieve notebook entries, optionally filtered by project or experiment.
        
        Args:
            project_id: Filter by project ID
            experiment_id: Filter by experiment ID
            limit: Maximum number of entries to return
            
        Returns:
            List of entries with parsed tags and attachments
        """
        entries = self.db.get_all_notebook_entries(project_id=project_id, experiment_id=experiment_id, limit=limit)
        
        # Parse tags and attachments for each entry
        for entry in entries:
            if entry.get('tags'):
                entry['tags_list'] = [tag.strip() for tag in entry['tags'].split(',')]
            else:
                entry['tags_list'] = []
            
            if entry.get('attachments'):
                try:
                    entry['attachments_list'] = json.loads(entry['attachments'])
                except json.JSONDecodeError:
                    entry['attachments_list'] = []
            else:
                entry['attachments_list'] = []
        
        return entries
    
    def search_entries(self, query: str, project_id: Optional[int] = None,
                      tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Search notebook entries by query and/or tags.
        
        Args:
            query: Search query string (searches title, content)
            project_id: Filter by project ID
            tags: Filter by tags
            
        Returns:
            List of matching entries
        """
        entries = self.get_all_entries(project_id=project_id, limit=1000)
        
        # Filter by query
        if query:
            query_lower = query.lower()
            entries = [entry for entry in entries 
                      if query_lower in entry['title'].lower() or
                      query_lower in entry['content'].lower()]
        
        # Filter by tags
        if tags:
            entries = [entry for entry in entries 
                      if any(tag.lower() in [t.lower() for t in entry['tags_list']] 
                            for tag in tags)]
        
        return entries
    
    def update_entry(self, entry_id: int, **kwargs) -> bool:
        """
        Update a notebook entry.
        
        Args:
            entry_id: Entry ID
            **kwargs: Fields to update (title, content, tags, attachments, etc.)
            
        Returns:
            True if successful
        """
        # Convert tags list to string if provided
        if 'tags' in kwargs and isinstance(kwargs['tags'], list):
            kwargs['tags'] = ",".join(kwargs['tags'])
        
        # Convert attachments list to JSON if provided
        if 'attachments' in kwargs and isinstance(kwargs['attachments'], list):
            kwargs['attachments'] = json.dumps(kwargs['attachments'])
        
        return self.db.update_notebook_entry(entry_id, **kwargs)
    
    def delete_entry(self, entry_id: int) -> bool:
        """
        Delete a notebook entry.
        
        Args:
            entry_id: Entry ID
            
        Returns:
            True if successful
        """
        return self.db.delete_notebook_entry(entry_id)
    
    def add_attachment(self, entry_id: int, file_path: str) -> bool:
        """
        Add an attachment to a notebook entry.
        
        Args:
            entry_id: Entry ID
            file_path: Path to the attachment file
            
        Returns:
            True if successful
        """
        entry = self.get_entry(entry_id)
        if not entry:
            return False
        
        # Move file to attachments directory
        import shutil
        from pathlib import Path
        
        source = Path(file_path)
        if not source.exists():
            return False
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest_filename = f"{entry_id}_{timestamp}_{source.name}"
        dest_path = self.attachments_path / dest_filename
        
        shutil.move(file_path, dest_path)
        
        # Update entry with new attachment
        attachments = entry['attachments_list']
        attachments.append(str(dest_path))
        
        return self.update_entry(entry_id, attachments=attachments)
    
    def get_entries_by_date_range(self, start_date: str, end_date: str,
                                  project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get entries within a date range.
        
        Args:
            start_date: Start date (ISO format: YYYY-MM-DD)
            end_date: End date (ISO format: YYYY-MM-DD)
            project_id: Optional project filter
            
        Returns:
            List of entries within the date range
        """
        all_entries = self.get_all_entries(project_id=project_id, limit=1000)
        
        filtered = []
        for entry in all_entries:
            entry_date = entry['created_at'].split(' ')[0]  # Extract date part
            if start_date <= entry_date <= end_date:
                filtered.append(entry)
        
        return filtered
    
    def get_recent_entries(self, days: int = 7, 
                          project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get recent entries from the last N days.
        
        Args:
            days: Number of days to look back
            project_id: Optional project filter
            
        Returns:
            List of recent entries
        """
        from datetime import timedelta
        
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        return self.get_entries_by_date_range(start_date, end_date, project_id)
    
    def get_all_tags(self) -> List[str]:
        """
        Get all unique tags used in the notebook.
        
        Returns:
            List of unique tags
        """
        entries = self.get_all_entries(limit=1000)
        
        all_tags = set()
        for entry in entries:
            all_tags.update(entry['tags_list'])
        
        return sorted(list(all_tags))
    
    def get_notebook_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the notebook.
        
        Returns:
            Dictionary with notebook statistics
        """
        all_entries = self.get_all_entries(limit=1000)
        
        # Count by type
        type_counts = {}
        tag_counts = {}
        
        for entry in all_entries:
            entry_type = entry['entry_type']
            type_counts[entry_type] = type_counts.get(entry_type, 0) + 1
            
            for tag in entry['tags_list']:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        return {
            'total_entries': len(all_entries),
            'by_type': type_counts,
            'top_tags': sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        }
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the engineering notebook
    print("=== Testing Engineering Notebook ===\n")
    
    notebook = EngineeringNotebook()
    
    try:
        # Create a text entry
        entry_id = notebook.create_entry(
            title="Test Entry",
            content="This is a test entry for the engineering notebook.",
            tags=["test", "sample"]
        )
        
        # Retrieve entry
        entry = notebook.get_entry(entry_id)
        print(f"\nRetrieved entry: {entry['title']}")
        print(f"Tags: {entry['tags_list']}")
        
        # Search entries
        results = notebook.search_entries("test")
        print(f"\nSearch results for 'test': {len(results)} entries")
        
        # Get stats
        stats = notebook.get_notebook_stats()
        print(f"\nNotebook stats: {stats}")
        
        # Cleanup
        notebook.delete_entry(entry_id)
        print("\n✅ Test entry deleted")
        
    finally:
        notebook.close()
    
    print("\n✅ All tests passed")
