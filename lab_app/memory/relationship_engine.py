"""
Lab Memory Relationships Engine

This module provides automatic relationship detection and connection between
entities in the lab system. It detects and connects projects, components, equipment,
experiments, calculations, findings, notes, and documents to create a self-growing
knowledge network.
"""

import re
from typing import Optional, Dict, Any, List
from datetime import datetime

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class RelationshipEngine:
    """Manages automatic relationship detection and connection."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the relationship engine.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        print("[OK] Relationship Engine initialized")
    
    def add_relationship(self, source_type: str, source_id: int, target_type: str,
                        target_id: int, relationship_type: str, confidence: float = 1.0) -> int:
        """
        Add a relationship between entities.
        
        Args:
            source_type: Type of source entity (project, component, equipment, etc.)
            source_id: ID of source entity
            target_type: Type of target entity
            target_id: ID of target entity
            relationship_type: Type of relationship (uses, references, related_to, etc.)
            confidence: Confidence score (0.0 to 1.0)
            
        Returns:
            The ID of the inserted relationship
        """
        return self.db.add_relationship(
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            relationship_type=relationship_type,
            confidence=confidence
        )
    
    def get_relationships(self, source_type: Optional[str] = None, source_id: Optional[int] = None,
                        target_type: Optional[str] = None, relationship_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieve relationships, optionally filtered.
        
        Args:
            source_type: Filter by source type
            source_id: Filter by source ID
            target_type: Filter by target type
            relationship_type: Filter by relationship type
            
        Returns:
            List of relationships
        """
        return self.db.get_relationships(
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            relationship_type=relationship_type
        )
    
    def get_related_entities(self, entity_type: str, entity_id: int) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all entities related to a given entity.
        
        Args:
            entity_type: Type of the entity
            entity_id: ID of the entity
            
        Returns:
            Dictionary mapping relationship types to lists of related entities
        """
        relationships = self.get_relationships(source_type=entity_type, source_id=entity_id)
        
        related = {}
        for rel in relationships:
            rel_type = rel['relationship_type']
            if rel_type not in related:
                related[rel_type] = []
            
            # Get the actual entity data
            target_entity = self._get_entity(rel['target_type'], rel['target_id'])
            if target_entity:
                related[rel_type].append({
                    'entity': target_entity,
                    'confidence': rel['confidence']
                })
        
        return related
    
    def _get_entity(self, entity_type: str, entity_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve an entity by type and ID.
        
        Args:
            entity_type: Type of entity
            entity_id: Entity ID
            
        Returns:
            Entity dictionary or None
        """
        try:
            if entity_type == 'project':
                return self.db.get_project(entity_id)
            elif entity_type == 'component':
                return self.db.get_component(entity_id)
            elif entity_type == 'equipment':
                return self.db.get_equipment(entity_id)
            elif entity_type == 'finding':
                return self.db.get_finding(entity_id)
            elif entity_type == 'calculation':
                return self.db.get_calculation(entity_id)
            elif entity_type == 'document':
                return self.db.get_document(entity_id)
            elif entity_type == 'notebook_entry':
                return self.db.get_notebook_entry(entity_id)
            else:
                return None
        except Exception:
            return None
    
    # Automatic Relationship Detection Methods
    
    def detect_component_references(self, text: str) -> List[str]:
        """
        Detect component references in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of component part numbers found
        """
        # Get all components
        components = self.db.get_all_components()
        
        found = []
        for comp in components:
            if comp.get('part_number'):
                # Search for part number (case-insensitive)
                pattern = re.compile(re.escape(comp['part_number']), re.IGNORECASE)
                if pattern.search(text):
                    found.append(comp['part_number'])
        
        return found
    
    def detect_equipment_references(self, text: str) -> List[int]:
        """
        Detect equipment references in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of equipment IDs found
        """
        equipment = self.db.get_all_equipment()
        
        found = []
        for eq in equipment:
            # Search for equipment name (case-insensitive)
            pattern = re.compile(re.escape(eq['name']), re.IGNORECASE)
            if pattern.search(text):
                found.append(eq['id'])
        
        return found
    
    def auto_link_project_components(self, project_id: int) -> int:
        """
        Automatically link components used in a project based on logs and notes.
        
        Args:
            project_id: Project ID
            
        Returns:
            Number of relationships created
        """
        # Get project
        project = self.db.get_project(project_id)
        if not project:
            return 0
        
        # Get all logs for the project
        logs = self.db.get_all_rd_logs(project_name=project['name'])
        
        # Get all notebook entries for the project
        notebook_entries = self.db.get_all_notebook_entries(project_id=project_id)
        
        # Combine all text
        all_text = ""
        for log in logs:
            all_text += log.get('log_text', '') + " "
        for entry in notebook_entries:
            all_text += entry.get('content', '') + " "
        
        # Detect component references
        component_part_numbers = self.detect_component_references(all_text)
        
        # Create relationships
        relationships_created = 0
        for part_number in component_part_numbers:
            component = self.db.get_component_by_part_number(part_number)
            if component:
                self.add_relationship(
                    source_type='project',
                    source_id=project_id,
                    target_type='component',
                    target_id=component['id'],
                    relationship_type='uses',
                    confidence=0.8
                )
                relationships_created += 1
        
        return relationships_created
    
    def auto_link_project_equipment(self, project_id: int) -> int:
        """
        Automatically link equipment used in a project based on logs and notes.
        
        Args:
            project_id: Project ID
            
        Returns:
            Number of relationships created
        """
        # Get project
        project = self.db.get_project(project_id)
        if not project:
            return 0
        
        # Get all logs for the project
        logs = self.db.get_all_rd_logs(project_name=project['name'])
        
        # Get all notebook entries for the project
        notebook_entries = self.db.get_all_notebook_entries(project_id=project_id)
        
        # Combine all text
        all_text = ""
        for log in logs:
            all_text += log.get('log_text', '') + " "
        for entry in notebook_entries:
            all_text += entry.get('content', '') + " "
        
        # Detect equipment references
        equipment_ids = self.detect_equipment_references(all_text)
        
        # Create relationships
        relationships_created = 0
        for eq_id in equipment_ids:
            self.add_relationship(
                source_type='project',
                source_id=project_id,
                target_type='equipment',
                target_id=eq_id,
                relationship_type='uses',
                confidence=0.8
            )
            relationships_created += 1
        
        return relationships_created
    
    def auto_link_findings_to_projects(self, finding_id: int) -> int:
        """
        Automatically link findings to projects based on content similarity.
        
        Args:
            finding_id: Finding ID
            
        Returns:
            Number of relationships created
        """
        finding = self.db.get_finding(finding_id)
        if not finding:
            return 0
        
        # Get all projects
        projects = self.db.get_all_projects()
        
        relationships_created = 0
        for project in projects:
            # Check if finding mentions project name
            if project['name'].lower() in finding['description'].lower():
                self.add_relationship(
                    source_type='finding',
                    source_id=finding_id,
                    target_type='project',
                    target_id=project['id'],
                    relationship_type='related_to',
                    confidence=0.7
                )
                relationships_created += 1
        
        return relationships_created
    
    def build_project_knowledge_graph(self, project_id: int) -> Dict[str, Any]:
        """
        Build a complete knowledge graph for a project.
        
        Args:
            project_id: Project ID
            
        Returns:
            Dictionary with all related entities
        """
        project = self.db.get_project(project_id)
        if not project:
            return {}
        
        # Get all relationships for the project
        related = self.get_related_entities('project', project_id)
        
        # Get project logs
        logs = self.db.get_all_rd_logs(project_name=project['name'])
        
        # Get project notebook entries
        notebook_entries = self.db.get_all_notebook_entries(project_id=project_id)
        
        # Get project findings
        findings = self.db.get_all_findings(project_id=project_id)
        
        # Get project calculations
        calculations = self.db.get_all_calculations(project_id=project_id)
        
        # Get project documents
        documents = self.db.get_all_documents(project_id=project_id)
        
        # Get components used in project
        component_usage = self.db.get_component_usage(project_id=project_id)
        components_used = []
        for usage in component_usage:
            comp = self.db.get_component(usage['component_id'])
            if comp:
                components_used.append({
                    'component': comp,
                    'quantity_used': usage['quantity_used'],
                    'usage_date': usage['usage_date']
                })
        
        return {
            'project': project,
            'related_entities': related,
            'logs': logs,
            'notebook_entries': notebook_entries,
            'findings': findings,
            'calculations': calculations,
            'documents': documents,
            'components_used': components_used
        }
    
    def delete_relationship(self, source_type: str, source_id: int, target_type: str,
                          target_id: int, relationship_type: str) -> bool:
        """
        Delete a specific relationship.
        
        Args:
            source_type: Type of source entity
            source_id: ID of source entity
            target_type: Type of target entity
            target_id: ID of target entity
            relationship_type: Type of relationship
            
        Returns:
            True if successful
        """
        return self.db.delete_relationship(
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            relationship_type=relationship_type
        )
    
    def get_relationship_stats(self) -> Dict[str, Any]:
        """
        Get statistics about relationships in the system.
        
        Returns:
            Dictionary with relationship statistics
        """
        all_relationships = self.db.get_relationships()
        
        # Count by relationship type
        type_counts = {}
        # Count by source type
        source_counts = {}
        # Count by target type
        target_counts = {}
        
        for rel in all_relationships:
            rel_type = rel['relationship_type']
            type_counts[rel_type] = type_counts.get(rel_type, 0) + 1
            
            source = rel['source_type']
            source_counts[source] = source_counts.get(source, 0) + 1
            
            target = rel['target_type']
            target_counts[target] = target_counts.get(target, 0) + 1
        
        return {
            'total_relationships': len(all_relationships),
            'by_type': type_counts,
            'by_source': source_counts,
            'by_target': target_counts
        }
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the relationship engine
    print("=== Testing Relationship Engine ===\n")
    
    engine = RelationshipEngine()
    
    try:
        # Add a test relationship
        rel_id = engine.add_relationship(
            source_type='project',
            source_id=1,
            target_type='component',
            target_id=1,
            relationship_type='uses',
            confidence=0.9
        )
        
        print(f"[OK] Relationship added (ID: {rel_id})")
        
        # Get relationships
        rels = engine.get_relationships(source_type='project', source_id=1)
        print(f"\nRelationships for project 1: {len(rels)}")
        
        # Get stats
        stats = engine.get_relationship_stats()
        print(f"\nRelationship stats: {stats}")
        
        # Cleanup
        engine.delete_relationship('project', 1, 'component', 1, 'uses')
        print("\n[OK] Test relationship deleted")
        
    finally:
        engine.close()
    
    print("\n[OK] All tests passed")
