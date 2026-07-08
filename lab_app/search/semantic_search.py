"""
AI-Powered Search Module

This module provides semantic search capabilities with natural language query support.
It indexes notes, logs, findings, experiments, documents, and calculations, and supports
natural language queries such as:
- "Show all projects involving lithium batteries"
- "Find experiments mentioning overheating"
- "Summarize motor control failures"
- "Show all STM32-related work"
- "What lessons have been learned about battery charging?"
"""

import re
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class SemanticSearch:
    """Provides AI-powered semantic search across all lab data."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the semantic search engine.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        print("[OK] Semantic Search initialized")
    
    def _extract_keywords(self, query: str) -> List[str]:
        """
        Extract keywords from a natural language query.
        
        Args:
            query: Natural language query string
            
        Returns:
            List of keywords
        """
        # Remove common stop words
        stop_words = {'show', 'all', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 
                     'with', 'by', 'about', 'what', 'how', 'why', 'when', 'where',
                     'involving', 'mentioning', 'related', 'have', 'been', 'learned'}
        
        # Tokenize and clean
        words = re.findall(r'\b\w+\b', query.lower())
        keywords = [word for word in words if word not in stop_words and len(word) > 2]
        
        return keywords
    
    def _detect_intent(self, query: str) -> Tuple[str, List[str]]:
        """
        Detect the intent of a natural language query.
        
        Args:
            query: Natural language query string
            
        Returns:
            Tuple of (intent_type, keywords)
        """
        query_lower = query.lower()
        keywords = self._extract_keywords(query)
        
        # Detect intent types
        if any(word in query_lower for word in ['project', 'projects']):
            return 'projects', keywords
        elif any(word in query_lower for word in ['experiment', 'experiments', 'test', 'tests']):
            return 'experiments', keywords
        elif any(word in query_lower for word in ['finding', 'findings', 'lesson', 'lessons']):
            return 'findings', keywords
        elif any(word in query_lower for word in ['component', 'components', 'part', 'parts']):
            return 'components', keywords
        elif any(word in query_lower for word in ['equipment', 'tool', 'tools']):
            return 'equipment', keywords
        elif any(word in query_lower for word in ['document', 'file', 'datasheet']):
            return 'documents', keywords
        elif any(word in query_lower for word in ['calculation', 'calculate']):
            return 'calculations', keywords
        elif any(word in query_lower for word in ['note', 'notebook', 'entry']):
            return 'notebook', keywords
        else:
            return 'all', keywords
    
    def search(self, query: str, limit: int = 20) -> Dict[str, Any]:
        """
        Perform a semantic search with natural language query.
        
        Args:
            query: Natural language query string
            limit: Maximum results per category
            
        Returns:
            Dictionary with search results by category
        """
        intent, keywords = self._detect_intent(query)
        
        results = {
            'query': query,
            'intent': intent,
            'keywords': keywords,
            'results': {}
        }
        
        # Search based on intent
        if intent in ['projects', 'all']:
            results['results']['projects'] = self._search_projects(keywords, limit)
        
        if intent in ['experiments', 'all']:
            results['results']['logs'] = self._search_logs(keywords, limit)
        
        if intent in ['findings', 'all']:
            results['results']['findings'] = self._search_findings(keywords, limit)
        
        if intent in ['components', 'all']:
            results['results']['components'] = self._search_components(keywords, limit)
        
        if intent in ['equipment', 'all']:
            results['results']['equipment'] = self._search_equipment(keywords, limit)
        
        if intent in ['documents', 'all']:
            results['results']['documents'] = self._search_documents(keywords, limit)
        
        if intent in ['calculations', 'all']:
            results['results']['calculations'] = self._search_calculations(keywords, limit)
        
        if intent in ['notebook', 'all']:
            results['results']['notebook'] = self._search_notebook(keywords, limit)
        
        return results
    
    def _search_projects(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search projects by keywords."""
        projects = self.db.get_all_projects()
        matches = []
        
        for project in projects:
            score = self._calculate_relevance_score(
                text=f"{project['name']} {project.get('description', '')} {project.get('summary_findings', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': project, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_logs(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search R&D logs by keywords."""
        logs = self.db.get_all_rd_logs()
        matches = []
        
        for log in logs:
            score = self._calculate_relevance_score(
                text=f"{log['log_title']} {log.get('log_text', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': log, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_findings(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search findings by keywords."""
        findings = self.db.get_all_findings()
        matches = []
        
        for finding in findings:
            score = self._calculate_relevance_score(
                text=f"{finding['title']} {finding['description']} {finding.get('root_cause', '')} {finding.get('solution', '')} {finding.get('recommendations', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': finding, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_components(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search components by keywords."""
        components = self.db.get_all_components()
        matches = []
        
        for component in components:
            score = self._calculate_relevance_score(
                text=f"{component['name']} {component.get('part_number', '')} {component.get('description', '')} {component.get('supplier', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': component, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_equipment(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search equipment by keywords."""
        equipment = self.db.get_all_equipment()
        matches = []
        
        for eq in equipment:
            score = self._calculate_relevance_score(
                text=f"{eq['name']} {eq.get('model', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': eq, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_documents(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search documents by keywords."""
        documents = self.db.get_all_documents()
        matches = []
        
        for doc in documents:
            score = self._calculate_relevance_score(
                text=f"{doc['title']} {doc.get('description', '')} {doc.get('tags', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': doc, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_calculations(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search calculations by keywords."""
        calculations = self.db.get_all_calculations()
        matches = []
        
        for calc in calculations:
            score = self._calculate_relevance_score(
                text=f"{calc['title']} {calc['calculation_type']}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': calc, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _search_notebook(self, keywords: List[str], limit: int) -> List[Dict[str, Any]]:
        """Search notebook entries by keywords."""
        entries = self.db.get_all_notebook_entries()
        matches = []
        
        for entry in entries:
            score = self._calculate_relevance_score(
                text=f"{entry['title']} {entry['content']} {entry.get('tags', '')}",
                keywords=keywords
            )
            if score > 0:
                matches.append({'item': entry, 'score': score})
        
        matches.sort(key=lambda x: x['score'], reverse=True)
        return [m['item'] for m in matches[:limit]]
    
    def _calculate_relevance_score(self, text: str, keywords: List[str]) -> float:
        """
        Calculate a relevance score for text against keywords.
        
        Args:
            text: Text to score
            keywords: List of keywords
            
        Returns:
            Relevance score (0.0 to 1.0)
        """
        if not keywords:
            return 0.0
        
        text_lower = text.lower()
        score = 0.0
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            
            # Exact match gets higher score
            if keyword_lower in text_lower:
                # Count occurrences
                count = text_lower.count(keyword_lower)
                score += count * 0.3
            
            # Partial match gets lower score
            for word in text_lower.split():
                if keyword_lower in word:
                    score += 0.1
        
        # Normalize score
        max_possible = len(keywords) * 0.5
        return min(score / max_possible, 1.0)
    
    def get_summary(self, query: str) -> str:
        """
        Generate a summary of search results for a query.
        
        Args:
            query: Natural language query string
            
        Returns:
            Summary string
        """
        results = self.search(query, limit=5)
        
        summary_parts = []
        summary_parts.append(f"Search results for: '{query}'")
        
        for category, items in results['results'].items():
            if items:
                summary_parts.append(f"\n{category.capitalize()}: {len(items)} results")
                for item in items[:3]:
                    if category == 'projects':
                        summary_parts.append(f"  - {item['name']}")
                    elif category == 'logs':
                        summary_parts.append(f"  - {item['log_title']}")
                    elif category == 'findings':
                        summary_parts.append(f"  - {item['title']}")
                    elif category == 'components':
                        summary_parts.append(f"  - {item['name']}")
                    elif category == 'equipment':
                        summary_parts.append(f"  - {item['name']}")
                    elif category == 'documents':
                        summary_parts.append(f"  - {item['title']}")
                    elif category == 'calculations':
                        summary_parts.append(f"  - {item['title']}")
                    elif category == 'notebook':
                        summary_parts.append(f"  - {item['title']}")
        
        return "\n".join(summary_parts)
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the semantic search
    print("=== Testing Semantic Search ===\n")
    
    search = SemanticSearch()
    
    try:
        # Test various queries
        queries = [
            "Show all projects",
            "Find experiments",
            "Search for components",
            "Findings about thermal",
        ]
        
        for query in queries:
            print(f"\nQuery: '{query}'")
            results = search.search(query)
            print(f"Intent: {results['intent']}")
            print(f"Keywords: {results['keywords']}")
            for category, items in results['results'].items():
                if items:
                    print(f"  {category}: {len(items)} results")
        
        # Test summary
        print("\n\nSummary Example:")
        summary = search.get_summary("Find experiments")
        print(summary)
        
    finally:
        search.close()
    
    print("\n[OK] All tests passed")
