"""
Lab Dashboard Module

This module provides a comprehensive dashboard with:
- Active Projects (status, progress, last activity)
- Recent Experiments (recent test results, failed tests, completed tests)
- Inventory Alerts (low stock components, critical shortages)
- Equipment Status (available equipment, maintenance due, calibration due)
- Recent Findings (new discoveries, lessons learned)
- AI Insights (most used components, common failure patterns, active research areas, frequently referenced equipment)
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase
from inventory.component_manager import ComponentManager
from equipment.equipment_manager import EquipmentManager
from findings.findings_manager import FindingsManager
from memory.relationship_engine import RelationshipEngine


class LabDashboard:
    """Provides comprehensive dashboard views for the lab system."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the lab dashboard.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        self.component_manager = ComponentManager(db=self.db)
        self.equipment_manager = EquipmentManager(db=self.db)
        self.findings_manager = FindingsManager(db=self.db)
        self.relationship_engine = RelationshipEngine(db=self.db)
        print("[OK] Lab Dashboard initialized")
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """
        Get comprehensive dashboard data.
        
        Returns:
            Dictionary with all dashboard sections
        """
        return {
            'active_projects': self.get_active_projects(),
            'recent_experiments': self.get_recent_experiments(),
            'inventory_alerts': self.get_inventory_alerts(),
            'equipment_status': self.get_equipment_status(),
            'recent_findings': self.get_recent_findings(),
            'ai_insights': self.get_ai_insights()
        }
    
    def get_active_projects(self) -> Dict[str, Any]:
        """
        Get active projects with status and activity.
        
        Returns:
            Dictionary with active projects data
        """
        projects = self.db.get_all_projects(status="Active")
        
        project_data = []
        for project in projects:
            # Get log count
            logs = self.db.get_all_rd_logs(project_name=project['name'])
            
            # Get findings
            findings = self.db.get_all_findings(project_id=project['id'])
            
            # Calculate progress (based on findings resolved vs total)
            total_findings = len(findings)
            resolved_findings = len([f for f in findings if f['status'] == 'resolved'])
            progress = (resolved_findings / total_findings * 100) if total_findings > 0 else 0
            
            # Get last activity date
            last_activity = project.get('created_at')
            if logs:
                last_log_date = max(log['timestamp'] for log in logs if log.get('timestamp'))
                last_activity = last_log_date if last_log_date > last_activity else last_activity
            
            project_data.append({
                'project': project,
                'log_count': len(logs),
                'finding_count': total_findings,
                'progress': round(progress, 1),
                'last_activity': last_activity
            })
        
        # Sort by last activity
        project_data.sort(key=lambda x: x['last_activity'], reverse=True)
        
        return {
            'total_active': len(projects),
            'projects': project_data[:10]  # Top 10 most recently active
        }
    
    def get_recent_experiments(self) -> Dict[str, Any]:
        """
        Get recent experiments with test results.
        
        Returns:
            Dictionary with recent experiments data
        """
        logs = self.db.get_all_rd_logs()
        
        # Categorize by status (simulated based on log content)
        recent_logs = logs[:20]  # Last 20 logs
        
        completed = []
        failed = []
        in_progress = []
        
        for log in recent_logs:
            log_text = log.get('log_text', '').lower()
            if any(word in log_text for word in ['failed', 'error', 'issue', 'problem']):
                failed.append(log)
            elif any(word in log_text for word in ['completed', 'success', 'finished', 'done']):
                completed.append(log)
            else:
                in_progress.append(log)
        
        return {
            'total_recent': len(recent_logs),
            'completed': len(completed),
            'failed': len(failed),
            'in_progress': len(in_progress),
            'recent_logs': recent_logs[:10]
        }
    
    def get_inventory_alerts(self) -> Dict[str, Any]:
        """
        Get inventory alerts for low stock components.
        
        Returns:
            Dictionary with inventory alerts
        """
        low_stock = self.component_manager.get_low_stock_components()
        
        # Categorize by severity
        critical = []
        warning = []
        
        for component in low_stock:
            if component['quantity'] == 0:
                critical.append(component)
            else:
                warning.append(component)
        
        return {
            'total_low_stock': len(low_stock),
            'critical_count': len(critical),
            'warning_count': len(warning),
            'critical_components': critical,
            'warning_components': warning
        }
    
    def get_equipment_status(self) -> Dict[str, Any]:
        """
        Get equipment status including maintenance and calibration due.
        
        Returns:
            Dictionary with equipment status
        """
        all_equipment = self.db.get_all_equipment()
        
        # Count by status
        available = [eq for eq in all_equipment if eq['status'] == 'available']
        in_use = [eq for eq in all_equipment if eq['status'] == 'in_use']
        maintenance = [eq for eq in all_equipment if eq['status'] == 'maintenance']
        
        # Get calibration and maintenance due
        calibration_due = self.equipment_manager.get_calibration_due_soon()
        maintenance_due = self.equipment_manager.get_maintenance_due_soon()
        
        return {
            'total_equipment': len(all_equipment),
            'available': len(available),
            'in_use': len(in_use),
            'maintenance': len(maintenance),
            'calibration_due_count': len(calibration_due),
            'maintenance_due_count': len(maintenance_due),
            'calibration_due': calibration_due[:5],
            'maintenance_due': maintenance_due[:5]
        }
    
    def get_recent_findings(self) -> Dict[str, Any]:
        """
        Get recent findings and lessons learned.
        
        Returns:
            Dictionary with recent findings
        """
        findings = self.db.get_all_findings()
        
        # Get recent findings (last 30 days)
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        recent_findings = [f for f in findings if f['created_at'] >= thirty_days_ago]
        
        # Categorize by type
        discoveries = [f for f in recent_findings if f['finding_type'] == 'discovery']
        problems = [f for f in recent_findings if f['finding_type'] == 'problem']
        lessons = [f for f in recent_findings if f['finding_type'] == 'lesson']
        
        # Get open findings
        open_findings = [f for f in findings if f['status'] == 'open']
        
        return {
            'total_recent': len(recent_findings),
            'discoveries': len(discoveries),
            'problems': len(problems),
            'lessons': len(lessons),
            'open_count': len(open_findings),
            'recent_findings': recent_findings[:10],
            'open_findings': open_findings[:5]
        }
    
    def get_ai_insights(self) -> Dict[str, Any]:
        """
        Generate AI insights from lab data.
        
        Returns:
            Dictionary with AI-generated insights
        """
        # Most used components
        all_components = self.db.get_all_components()
        component_usage = self.db.get_component_usage()
        
        component_usage_counts = {}
        for usage in component_usage:
            cid = usage['component_id']
            component_usage_counts[cid] = component_usage_counts.get(cid, 0) + usage['quantity_used']
        
        # Sort by usage
        sorted_components = sorted(component_usage_counts.items(), key=lambda x: x[1], reverse=True)
        most_used_components = []
        for cid, count in sorted_components[:10]:
            comp = self.db.get_component(cid)
            if comp:
                most_used_components.append({
                    'component': comp,
                    'usage_count': count
                })
        
        # Common failure patterns (from findings)
        findings = self.db.get_all_findings()
        problem_findings = [f for f in findings if f['finding_type'] == 'problem']
        
        # Extract common keywords from problem descriptions
        from collections import Counter
        problem_keywords = []
        for finding in problem_findings:
            words = finding['description'].lower().split()
            problem_keywords.extend(words)
        
        common_keywords = Counter(problem_keywords).most_common(10)
        
        # Active research areas (from project descriptions)
        projects = self.db.get_all_projects(status="Active")
        research_areas = []
        for project in projects:
            if project.get('description'):
                research_areas.append(project['description'])
        
        # Frequently referenced equipment (from relationships)
        equipment_relationships = self.db.get_relationships(target_type='equipment')
        equipment_counts = {}
        for rel in equipment_relationships:
            eid = rel['target_id']
            equipment_counts[eid] = equipment_counts.get(eid, 0) + 1
        
        sorted_equipment = sorted(equipment_counts.items(), key=lambda x: x[1], reverse=True)
        frequently_used_equipment = []
        for eid, count in sorted_equipment[:5]:
            eq = self.db.get_equipment(eid)
            if eq:
                frequently_used_equipment.append({
                    'equipment': eq,
                    'reference_count': count
                })
        
        return {
            'most_used_components': most_used_components,
            'common_failure_keywords': common_keywords,
            'active_research_areas': research_areas[:5],
            'frequently_used_equipment': frequently_used_equipment,
            'total_findings': len(findings),
            'problem_findings_count': len(problem_findings)
        }
    
    def get_summary_stats(self) -> Dict[str, Any]:
        """
        Get summary statistics for the lab.
        
        Returns:
            Dictionary with summary statistics
        """
        dashboard_data = self.get_dashboard_data()
        
        return {
            'total_projects': dashboard_data['active_projects']['total_active'],
            'total_experiments': dashboard_data['recent_experiments']['total_recent'],
            'low_stock_alerts': dashboard_data['inventory_alerts']['total_low_stock'],
            'recent_findings': dashboard_data['recent_findings']['total_recent'],
            'open_issues': dashboard_data['recent_findings']['open_count']
        }
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the lab dashboard
    print("=== Testing Lab Dashboard ===\n")
    
    dashboard = LabDashboard()
    
    try:
        # Get dashboard data
        data = dashboard.get_dashboard_data()
        
        print("Active Projects:")
        print(f"  Total: {data['active_projects']['total_active']}")
        
        print("\nRecent Experiments:")
        print(f"  Total: {data['recent_experiments']['total_recent']}")
        print(f"  Completed: {data['recent_experiments']['completed']}")
        print(f"  Failed: {data['recent_experiments']['failed']}")
        
        print("\nInventory Alerts:")
        print(f"  Low Stock: {data['inventory_alerts']['total_low_stock']}")
        print(f"  Critical: {data['inventory_alerts']['critical_count']}")
        
        print("\nEquipment Status:")
        print(f"  Total: {data['equipment_status']['total_equipment']}")
        print(f"  Available: {data['equipment_status']['available']}")
        print(f"  Calibration Due: {data['equipment_status']['calibration_due_count']}")
        
        print("\nRecent Findings:")
        print(f"  Total: {data['recent_findings']['total_recent']}")
        print(f"  Open: {data['recent_findings']['open_count']}")
        
        print("\nAI Insights:")
        print(f"  Most Used Components: {len(data['ai_insights']['most_used_components'])}")
        print(f"  Problem Findings: {data['ai_insights']['problem_findings_count']}")
        
        # Get summary stats
        summary = dashboard.get_summary_stats()
        print(f"\nSummary Stats: {summary}")
        
    finally:
        dashboard.close()
    
    print("\n[OK] All tests passed")
