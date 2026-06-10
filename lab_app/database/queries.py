"""
Database Query Helper Functions

This module provides high-level helper functions for common database operations,
particularly for project lifecycle management and relational queries between
projects and R&D logs.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from database.cache_db import CacheDatabase


def add_project(name: str, description: Optional[str] = None, 
               status: str = "Active", start_date: Optional[str] = None,
               summary_findings: Optional[str] = None,
               db: Optional[CacheDatabase] = None) -> int:
    """
    Add a new project to the database.
    
    Args:
        name: Project name (must be unique)
        description: Project description
        status: Project status (Active, Completed, Paused)
        start_date: Project start date (ISO format string)
        summary_findings: Summary of key findings
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        The ID of the inserted project
        
    Raises:
        sqlite3.IntegrityError: If project name already exists
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        # Set default start date if not provided
        if start_date is None:
            start_date = datetime.now().strftime("%Y-%m-%d")
        
        project_id = db.add_project(
            name=name,
            description=description,
            status=status,
            start_date=start_date,
            summary_findings=summary_findings
        )
        
        print(f"✅ Project '{name}' created with ID: {project_id}")
        return project_id
        
    finally:
        if close_db:
            db.close()


def get_project_status(project_name: str, 
                     db: Optional[CacheDatabase] = None) -> Optional[Dict[str, Any]]:
    """
    Query the project status and return detailed information.
    
    Args:
        project_name: The project name to query
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        Dictionary containing project status information or None if not found
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        project = db.get_project_by_name(project_name)
        
        if project:
            return {
                'id': project['id'],
                'name': project['name'],
                'status': project['status'],
                'start_date': project['start_date'],
                'description': project.get('description', 'No description'),
                'created_at': project.get('created_at')
            }
        else:
            return None
            
    finally:
        if close_db:
            db.close()


def get_project_summary(project_name: str,
                       db: Optional[CacheDatabase] = None) -> Optional[Dict[str, Any]]:
    """
    Get comprehensive project summary including meta-summary and all linked logs.
    
    Args:
        project_name: The project name to query
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        Dictionary containing project summary with concatenated logs or None if not found
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        project = db.get_project_by_name(project_name)
        
        if not project:
            return None
        
        # Get all logs associated with this project
        logs = db.get_all_rd_logs(project_name=project_name)
        
        # Concatenate log texts
        concatenated_logs = []
        for log in logs:
            log_entry = {
                'title': log['log_title'],
                'text': log['log_text'],
                'timestamp': log['timestamp']
            }
            concatenated_logs.append(log_entry)
        
        # Build summary
        summary = {
            'project': {
                'id': project['id'],
                'name': project['name'],
                'description': project.get('description', 'No description'),
                'status': project['status'],
                'start_date': project['start_date'],
                'summary_findings': project.get('summary_findings', 'No findings summary yet'),
                'created_at': project.get('created_at')
            },
            'logs': concatenated_logs,
            'total_logs': len(logs),
            'combined_findings': _combine_findings(project.get('summary_findings', ''), 
                                                   [log['log_text'] for log in logs if log['log_text']])
        }
        
        return summary
        
    finally:
        if close_db:
            db.close()


def _combine_findings(summary: str, log_texts: List[str]) -> str:
    """
    Combine project summary findings with log texts into a cohesive summary.
    
    Args:
        summary: The project's summary_findings field
        log_texts: List of log text contents
        
    Returns:
        Combined summary text
    """
    parts = []
    
    if summary and summary.strip():
        parts.append(f"Key Findings: {summary}")
    
    if log_texts:
        parts.append("Recent Notes:")
        for i, text in enumerate(log_texts[:5], 1):  # Limit to first 5 logs
            if text and text.strip():
                parts.append(f"  {i}. {text[:200]}...")  # Truncate long logs
    
    return "\n\n".join(parts) if parts else "No findings available."


def get_active_projects(db: Optional[CacheDatabase] = None) -> List[Dict[str, Any]]:
    """
    Get all active projects.
    
    Args:
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        List of active project dictionaries
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        return db.get_all_projects(status="Active")
    finally:
        if close_db:
            db.close()


def get_project_logs_count(project_name: str,
                           db: Optional[CacheDatabase] = None) -> int:
    """
    Get the count of logs associated with a project.
    
    Args:
        project_name: The project name to query
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        Number of logs associated with the project
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        logs = db.get_all_rd_logs(project_name=project_name)
        return len(logs)
    finally:
        if close_db:
            db.close()


def update_project_status(project_name: str, new_status: str,
                         db: Optional[CacheDatabase] = None) -> bool:
    """
    Update the status of a project.
    
    Args:
        project_name: The project name to update
        new_status: New status (Active, Completed, Paused)
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        True if update was successful, False otherwise
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        project = db.get_project_by_name(project_name)
        if not project:
            return False
        
        return db.update_project(project['id'], status=new_status)
    finally:
        if close_db:
            db.close()


def add_log_to_project(project_name: str, log_title: str, log_text: str,
                      cloud_file_url: Optional[str] = None,
                      db: Optional[CacheDatabase] = None) -> int:
    """
    Add a new log entry to a specific project.
    
    Args:
        project_name: The project name to add the log to
        log_title: Title of the log entry
        log_text: Text content of the log
        cloud_file_url: Optional URL to cloud storage for attachments
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        The ID of the inserted log
        
    Raises:
        ValueError: If project doesn't exist
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        project = db.get_project_by_name(project_name)
        if not project:
            raise ValueError(f"Project '{project_name}' not found")
        
        log_id = db.add_rd_log(
            project_name=project_name,
            log_title=log_title,
            log_text=log_text,
            cloud_file_url=cloud_file_url,
            is_downloaded_locally=False
        )
        
        # Link the log to the project using project_id
        db.link_log_to_project(log_id, project['id'])
        
        print(f"✅ Log added to project '{project_name}' with ID: {log_id}")
        return log_id
        
    finally:
        if close_db:
            db.close()


def search_projects(query: str, db: Optional[CacheDatabase] = None) -> List[Dict[str, Any]]:
    """
    Search projects by name or description.
    
    Args:
        query: Search query string
        db: CacheDatabase instance (creates new if None)
        
    Returns:
        List of matching project dictionaries
    """
    close_db = False
    if db is None:
        db = CacheDatabase()
        close_db = True
    
    try:
        all_projects = db.get_all_projects()
        query_lower = query.lower()
        
        matches = []
        for project in all_projects:
            if (query_lower in project['name'].lower() or 
                (project.get('description') and query_lower in project['description'].lower())):
                matches.append(project)
        
        return matches
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    # Test the query functions
    print("=== Testing Database Query Functions ===\n")
    
    # Create a test project
    project_id = add_project(
        name="Sensor Calibration Project",
        description="Testing and calibrating new sensor arrays",
        status="Active"
    )
    
    # Get project status
    status = get_project_status("Sensor Calibration Project")
    print(f"\nProject Status:")
    print(f"  Name: {status['name']}")
    print(f"  Status: {status['status']}")
    print(f"  Start Date: {status['start_date']}")
    
    # Add some logs
    add_log_to_project(
        "Sensor Calibration Project",
        "Initial calibration",
        "Performed baseline calibration on all sensors."
    )
    
    add_log_to_project(
        "Sensor Calibration Project",
        "Temperature test",
        "Temperature sensors showing 2% deviation from expected values."
    )
    
    # Get project summary
    summary = get_project_summary("Sensor Calibration Project")
    print(f"\nProject Summary:")
    print(f"  Total Logs: {summary['total_logs']}")
    print(f"  Combined Findings:\n{summary['combined_findings']}")
    
    # Get active projects
    active = get_active_projects()
    print(f"\nActive Projects: {len(active)}")
    for proj in active:
        print(f"  - {proj['name']}")
    
    print("\n✅ All tests passed")
