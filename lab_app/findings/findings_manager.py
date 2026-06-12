"""
Findings and Lessons Database Module

This module manages the findings repository where users can save discoveries,
problems encountered, root causes, solutions, and recommendations. Every finding
is linked to projects and experiments for easy retrieval and context.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class FindingsManager:
    """Manages findings and lessons learned repository."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the findings manager.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        print("✅ Findings Manager initialized")
    
    def add_finding(self, title: str, finding_type: str, description: str,
                   root_cause: Optional[str] = None, solution: Optional[str] = None,
                   recommendations: Optional[str] = None, project_id: Optional[int] = None,
                   experiment_id: Optional[int] = None, severity: str = "medium",
                   status: str = "open", stage_id: Optional[int] = None) -> int:
        """
        Add a new finding or lesson learned.
        
        Args:
            title: Finding title
            finding_type: Type of finding (discovery, problem, lesson, observation, failure)
            description: Detailed description
            root_cause: Root cause analysis
            solution: Solution implemented
            recommendations: Recommendations for future work
            project_id: Associated project ID
            experiment_id: Associated experiment ID
            severity: Severity level (low, medium, high, critical)
            status: Status (open, in_progress, resolved)
            stage_id: Associated experiment stage ID
            
        Returns:
            The ID of the inserted finding
        """
        finding_id = self.db.add_finding(
            title=title,
            finding_type=finding_type,
            description=description,
            root_cause=root_cause,
            solution=solution,
            recommendations=recommendations,
            project_id=project_id,
            experiment_id=experiment_id,
            severity=severity,
            status=status,
            stage_id=stage_id
        )
        
        print(f"✅ Finding added: {title} (ID: {finding_id})")
        return finding_id
    
    def get_finding(self, finding_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a finding by ID."""
        return self.db.get_finding(finding_id)
    
    def get_all_findings(self, project_id: Optional[int] = None, status: Optional[str] = None,
                        severity: Optional[str] = None, experiment_id: Optional[int] = None,
                        stage_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Retrieve findings, optionally filtered.
        
        Args:
            project_id: Filter by project ID
            status: Filter by status
            severity: Filter by severity
            experiment_id: Filter by experiment ID
            stage_id: Filter by stage ID
            
        Returns:
            List of findings
        """
        return self.db.get_all_findings(
            project_id=project_id,
            status=status,
            severity=severity,
            experiment_id=experiment_id,
            stage_id=stage_id
        )
    
    def search_findings(self, query: str, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Search findings by query string.
        
        Args:
            query: Search query (searches title, description, root_cause, solution)
            project_id: Optional project filter
            
        Returns:
            List of matching findings
        """
        findings = self.get_all_findings(project_id=project_id)
        query_lower = query.lower()
        
        matches = []
        for finding in findings:
            if (query_lower in finding['title'].lower() or
                query_lower in finding['description'].lower() or
                (finding.get('root_cause') and query_lower in finding['root_cause'].lower()) or
                (finding.get('solution') and query_lower in finding['solution'].lower()) or
                (finding.get('recommendations') and query_lower in finding['recommendations'].lower())):
                matches.append(finding)
        
        return matches
    
    def get_findings_by_type(self, finding_type: str, 
                            project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get findings by type.
        
        Args:
            finding_type: Type of finding
            project_id: Optional project filter
            
        Returns:
            List of findings of the specified type
        """
        findings = self.get_all_findings(project_id=project_id)
        return [f for f in findings if f['finding_type'].lower() == finding_type.lower()]
    
    def get_open_findings(self, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all open findings.
        
        Args:
            project_id: Optional project filter
            
        Returns:
            List of open findings
        """
        return self.get_all_findings(project_id=project_id, status="open")
    
    def get_critical_findings(self, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all critical findings.
        
        Args:
            project_id: Optional project filter
            
        Returns:
            List of critical findings
        """
        return self.get_all_findings(project_id=project_id, severity="critical")
    
    def update_finding(self, finding_id: int, **kwargs) -> bool:
        """
        Update a finding.
        
        Args:
            finding_id: Finding ID
            **kwargs: Fields to update
            
        Returns:
            True if successful
        """
        return self.db.update_finding(finding_id, **kwargs)
    
    def resolve_finding(self, finding_id: int, solution: Optional[str] = None,
                       recommendations: Optional[str] = None) -> bool:
        """
        Mark a finding as resolved.
        
        Args:
            finding_id: Finding ID
            solution: Solution implemented
            recommendations: Recommendations for future
            
        Returns:
            True if successful
        """
        updates = {'resolved': True}
        if solution:
            updates['solution'] = solution
        if recommendations:
            updates['recommendations'] = recommendations
        
        return self.db.update_finding(finding_id, **updates)
    
    def delete_finding(self, finding_id: int) -> bool:
        """
        Delete a finding.
        
        Args:
            finding_id: Finding ID
            
        Returns:
            True if successful
        """
        return self.db.delete_finding(finding_id)
    
    def get_findings_for_project(self, project_id: int) -> List[Dict[str, Any]]:
        """
        Get all findings associated with a project.
        
        Args:
            project_id: Project ID
            
        Returns:
            List of findings
        """
        return self.get_all_findings(project_id=project_id)
    
    def get_similar_findings(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Find findings similar to a query (for surfacing related findings).
        
        Args:
            query: Query string
            limit: Maximum number of results
            
        Returns:
            List of similar findings
        """
        similar = self.search_findings(query)
        return similar[:limit]
    
    def get_findings_summary(self, project_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get a summary of findings statistics.
        
        Args:
            project_id: Optional project filter
            
        Returns:
            Dictionary with findings summary
        """
        findings = self.get_all_findings(project_id=project_id)
        
        # Count by type
        type_counts = {}
        # Count by severity
        severity_counts = {}
        # Count by status
        status_counts = {}
        
        for finding in findings:
            ftype = finding['finding_type']
            type_counts[ftype] = type_counts.get(ftype, 0) + 1
            
            severity = finding['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            status = finding['status']
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'total_findings': len(findings),
            'by_type': type_counts,
            'by_severity': severity_counts,
            'by_status': status_counts,
            'open_count': status_counts.get('open', 0),
            'resolved_count': status_counts.get('resolved', 0),
            'critical_count': severity_counts.get('critical', 0)
        }
    
    def get_lessons_learned(self, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all lessons learned findings.
        
        Args:
            project_id: Optional project filter
            
        Returns:
            List of lesson findings
        """
        return self.get_findings_by_type("lesson", project_id=project_id)
    
    def get_problems_encountered(self, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all problem findings.
        
        Args:
            project_id: Optional project filter
            
        Returns:
            List of problem findings
        """
        return self.get_findings_by_type("problem", project_id=project_id)
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the findings manager
    print("=== Testing Findings Manager ===\n")
    
    manager = FindingsManager()
    
    try:
        # Add a finding
        finding_id = manager.add_finding(
            title="Thermal Issue with Power Regulator",
            finding_type="problem",
            description="The power regulator overheats when drawing more than 2A",
            root_cause="Insufficient heatsinking",
            solution="Added larger heatsink and improved airflow",
            recommendations="Always perform thermal analysis before final design",
            severity="high",
            status="resolved"
        )
        
        # Retrieve finding
        finding = manager.get_finding(finding_id)
        print(f"\nRetrieved finding: {finding['title']}")
        print(f"Type: {finding['finding_type']}")
        print(f"Severity: {finding['severity']}")
        
        # Search findings
        results = manager.search_findings("thermal")
        print(f"\nSearch results for 'thermal': {len(results)} findings")
        
        # Get summary
        summary = manager.get_findings_summary()
        print(f"\nFindings summary: {summary}")
        
        # Cleanup
        manager.delete_finding(finding_id)
        print("\n✅ Test finding deleted")
        
    finally:
        manager.close()
    
    print("\n✅ All tests passed")
