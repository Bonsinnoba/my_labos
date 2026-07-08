"""
Voice Command Interpreter Module

This module parses voice commands and executes corresponding actions.
It handles equipment status queries and research note insertion by integrating
with the local SQLite database.
"""

import re
import sys
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase
# from database import queries  # Temporarily disabled - queries module not found


class VoiceInterpreter:
    """Interprets voice commands and executes database operations."""
    
    def __init__(self, db_path: str = "local_cache.db"):
        """
        Initialize the voice interpreter.
        
        Args:
            db_path: Path to the SQLite database file
        """
        self.db_path = db_path
        self.db: Optional[CacheDatabase] = None
        self._initialize_database()
        
        # Command patterns
        self.wake_word = "jarvis"
        self.status_patterns = [
            r"status\s+(?:of\s+)?(.+)",
            r"what\s+(?:is\s+)?(?:the\s+)?status\s+(?:of\s+)?(.+)",
            r"how\s+(?:is\s+)?(.+)",
            r"check\s+(?:the\s+)?status\s+(?:of\s+)?(.+)",
            r"tell\s+me\s+about\s+(.+)"
        ]
        
        self.note_patterns = [
            r"take\s+notes?(?:\s*:)?\s*(.+)",
            r"add\s+a\s+note(?:\s*:)?\s*(.+)",
            r"log\s+this(?:\s*:)?\s*(.+)",
            r"record\s+(?:this\s+)?note(?:\s*:)?\s*(.+)",
            r"new\s+note(?:\s*:)?\s*(.+)"
        ]
        
        self.project_patterns = [
            r"project\s+(?:named\s+)?(.+)",
            r"for\s+(?:project\s+)?(.+)"
        ]
        
        # Project-specific command patterns
        self.create_project_patterns = [
            r"create\s+(?:a\s+)?(?:new\s+)?project\s+(?:called\s+)?(.+)",
            r"start\s+(?:a\s+)?project\s+(?:called\s+)?(.+)",
            r"new\s+project\s+(?:called\s+)?(.+)",
            r"add\s+project\s+(?:called\s+)?(.+)"
        ]
        
        self.project_status_patterns = [
            r"project\s+status\s+(?:of\s+)?(.+)",
            r"status\s+(?:of\s+)?project\s+(.+)",
            r"how\s+is\s+(?:the\s+)?project\s+(.+)",
            r"what\s+(?:is\s+)?(?:the\s+)?status\s+(?:of\s+)?project\s+(.+)"
        ]
        
        self.project_findings_patterns = [
            r"findings\s+(?:for\s+)?(?:project\s+)?(.+)",
            r"results\s+(?:for\s+)?(?:project\s+)?(.+)",
            r"show\s+(?:me\s+)?(?:the\s+)?findings\s+(?:for\s+)?(?:project\s+)?(.+)",
            r"summary\s+(?:of\s+)?(?:project\s+)?(.+)",
            r"what\s+(?:are\s+)?(?:the\s+)?findings\s+(?:for\s+)?(?:project\s+)?(.+)"
        ]
        
        print("[OK] Voice interpreter initialized")
    
    def _initialize_database(self) -> None:
        """Initialize database connection."""
        try:
            self.db = CacheDatabase(self.db_path)
            print("[OK] Database connection established")
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            self.db = None
    
    def parse_voice_command(self, command_text: str) -> Tuple[str, Dict[str, Any]]:
        """
        Parse a voice command and determine the intent.
        
        Args:
            command_text: The raw text from speech recognition
            
        Returns:
            Tuple of (intent_type, parsed_data)
            intent_type can be: 'query_status', 'take_note', 'create_project', 
                              'project_status', 'project_findings', 'unknown', 'error'
        """
        if not command_text or not command_text.strip():
            return "error", {"error": "Empty command"}
        
        # Normalize the command
        command = command_text.strip().lower()
        print(f"🎯 Parsing command: {command}")
        
        # Check for wake word (optional, can be handled in listener)
        if command.startswith(self.wake_word):
            command = command[len(self.wake_word):].strip()
        
        # Try to match create project patterns (check first to avoid conflicts)
        for pattern in self.create_project_patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                project_name = match.group(1).strip()
                print(f"   → Detected create project: {project_name}")
                return "create_project", {"project_name": project_name}
        
        # Try to match project status patterns
        for pattern in self.project_status_patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                project_name = match.group(1).strip()
                print(f"   → Detected project status query for: {project_name}")
                return "project_status", {"project_name": project_name}
        
        # Try to match project findings patterns
        for pattern in self.project_findings_patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                project_name = match.group(1).strip()
                print(f"   → Detected project findings query for: {project_name}")
                return "project_findings", {"project_name": project_name}
        
        # Try to match status query patterns (equipment)
        for pattern in self.status_patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                equipment_name = match.group(1).strip()
                print(f"   → Detected status query for: {equipment_name}")
                return "query_status", {"equipment_name": equipment_name}
        
        # Try to match note-taking patterns
        for pattern in self.note_patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                note_text = match.group(1).strip()
                
                # Extract project name if present
                project_name = "General"
                for proj_pattern in self.project_patterns:
                    proj_match = re.search(proj_pattern, note_text, re.IGNORECASE)
                    if proj_match:
                        project_name = proj_match.group(1).strip()
                        # Remove project name from note text
                        note_text = re.sub(proj_pattern, "", note_text, flags=re.IGNORECASE).strip()
                        break
                
                print(f"   → Detected note for project '{project_name}': {note_text}")
                return "take_note", {
                    "project_name": project_name,
                    "note_text": note_text
                }
        
        # If no pattern matched
        print(f"   → Unknown command pattern")
        return "unknown", {"raw_command": command}
    
    def execute_command(self, intent_type: str, parsed_data: Dict[str, Any]) -> str:
        """
        Execute the parsed command and return a response message.
        
        Args:
            intent_type: The type of intent ('query_status', 'take_note', 'create_project', 
                                      'project_status', 'project_findings', 'unknown', 'error')
            parsed_data: Dictionary containing parsed command data
            
        Returns:
            Response message to be spoken to the user
        """
        if self.db is None:
            return "I'm sorry, I cannot access the database right now."
        
        try:
            if intent_type == "query_status":
                return self._handle_status_query(parsed_data)
            elif intent_type == "take_note":
                return self._handle_note_insertion(parsed_data)
            elif intent_type == "create_project":
                return self._handle_create_project(parsed_data)
            elif intent_type == "project_status":
                return self._handle_project_status(parsed_data)
            elif intent_type == "project_findings":
                return self._handle_project_findings(parsed_data)
            elif intent_type == "unknown":
                return self._handle_unknown_command(parsed_data)
            elif intent_type == "error":
                return "I didn't catch that. Could you please repeat?"
            else:
                return "I'm not sure how to help with that."
                
        except Exception as e:
            print(f"❌ Error executing command: {e}")
            return f"Sorry, I encountered an error: {str(e)}"
    
    def _handle_status_query(self, data: Dict[str, Any]) -> str:
        """
        Handle equipment status query.
        
        Args:
            data: Dictionary containing 'equipment_name'
            
        Returns:
            Response message with equipment status
        """
        equipment_name = data.get("equipment_name", "").strip()
        
        if not equipment_name:
            return "Which equipment would you like to check?"
        
        # Search for equipment by name (partial match)
        all_equipment = self.db.get_all_equipment()
        matches = [
            eq for eq in all_equipment 
            if equipment_name.lower() in eq['name'].lower()
        ]
        
        if not matches:
            return f"I couldn't find any equipment matching '{equipment_name}'."
        
        if len(matches) == 1:
            eq = matches[0]
            response = f"{eq['name']} is currently {eq['status']}"
            if eq['model']:
                response += f". It's a {eq['model']}"
            if eq['calibration_date']:
                response += f", last calibrated on {eq['calibration_date']}"
            return response + "."
        else:
            # Multiple matches
            names = [eq['name'] for eq in matches[:3]]  # Limit to first 3
            response = f"I found {len(matches)} items: {', '.join(names)}"
            if len(matches) > 3:
                response += f", and {len(matches) - 3} more"
            return response + ". Which one would you like to check?"
    
    def _handle_note_insertion(self, data: Dict[str, Any]) -> str:
        """
        Handle research note insertion.
        
        Args:
            data: Dictionary containing 'project_name' and 'note_text'
            
        Returns:
            Response message confirming note insertion
        """
        project_name = data.get("project_name", "General").strip()
        note_text = data.get("note_text", "").strip()
        
        if not note_text:
            return "What would you like me to note down?"
        
        # Generate a log title from the first few words
        words = note_text.split()
        title = " ".join(words[:5])
        if len(words) > 5:
            title += "..."
        
        # Insert into database
        log_id = self.db.add_rd_log(
            project_name=project_name,
            log_title=title,
            log_text=note_text,
            cloud_file_url=None,
            is_downloaded_locally=True
        )
        
        if log_id:
            return f"I've saved your note for project {project_name}. Log entry {log_id} created."
        else:
            return "Sorry, I couldn't save the note. Please try again."
    
    def _handle_create_project(self, data: Dict[str, Any]) -> str:
        """
        Handle project creation.
        
        Args:
            data: Dictionary containing 'project_name'
            
        Returns:
            Response message confirming project creation
        """
        project_name = data.get("project_name", "").strip()
        
        if not project_name:
            return "What would you like to name the project?"
        
        try:
            # Use the queries module to create the project
            project_id = queries.add_project(
                name=project_name,
                description=None,
                status="Active",
                db=self.db
            )
            
            return f"I've created project {project_name} with ID {project_id}."
            
        except Exception as e:
            if "UNIQUE constraint" in str(e) or "already exists" in str(e):
                return f"Project {project_name} already exists."
            return f"Sorry, I couldn't create the project: {str(e)}"
    
    def _handle_project_status(self, data: Dict[str, Any]) -> str:
        """
        Handle project status query.
        
        Args:
            data: Dictionary containing 'project_name'
            
        Returns:
            Response message with project status
        """
        project_name = data.get("project_name", "").strip()
        
        if not project_name:
            return "Which project would you like to check?"
        
        # Use the queries module to get project status
        status_info = queries.get_project_status(project_name, db=self.db)
        
        if not status_info:
            return f"I couldn't find a project named {project_name}."
        
        response = f"Project {status_info['name']} is currently {status_info['status']}"
        if status_info.get('start_date'):
            response += f", started on {status_info['start_date']}"
        if status_info.get('description'):
            response += f". {status_info['description']}"
        return response + "."
    
    def _handle_project_findings(self, data: Dict[str, Any]) -> str:
        """
        Handle project findings query.
        
        Args:
            data: Dictionary containing 'project_name'
            
        Returns:
            Response message with project findings summary
        """
        project_name = data.get("project_name", "").strip()
        
        if not project_name:
            return "Which project's findings would you like to see?"
        
        # Use the queries module to get project summary
        summary = queries.get_project_summary(project_name, db=self.db)
        
        if not summary:
            return f"I couldn't find a project named {project_name}."
        
        project = summary['project']
        total_logs = summary['total_logs']
        
        # Build a spoken-friendly response
        response = f"Project {project['name']} has {total_logs} research log"
        response += "s" if total_logs != 1 else ""
        
        if project.get('summary_findings') and project['summary_findings'].strip():
            response += f". Key findings: {project['summary_findings'][:200]}"
        
        if total_logs > 0:
            response += f". Recent notes include: "
            recent_notes = [log['text'][:100] for log in summary['logs'][:3] if log.get('text')]
            response += "; ".join(recent_notes)
        
        return response + "."
    
    def _handle_unknown_command(self, data: Dict[str, Any]) -> str:
        """
        Handle unknown commands.
        
        Args:
            data: Dictionary containing 'raw_command'
            
        Returns:
            Response message asking for clarification
        """
        raw_command = data.get("raw_command", "")
        return f"I'm not sure how to help with '{raw_command}'. You can ask about equipment status or say 'take notes' to record something."
    
    def process_command(self, command_text: str) -> str:
        """
        Complete pipeline: parse and execute a voice command.
        
        Args:
            command_text: The raw text from speech recognition
            
        Returns:
            Response message to be spoken to the user
        """
        intent_type, parsed_data = self.parse_voice_command(command_text)
        response = self.execute_command(intent_type, parsed_data)
        return response
    
    def close(self) -> None:
        """Close database connection."""
        if self.db:
            self.db.close()
            print("🔌 Database connection closed")


# Convenience function for quick command processing
def process_voice_command(command_text: str, db_path: str = "local_cache.db") -> str:
    """
    Process a voice command and return the response.
    
    Args:
        command_text: The raw text from speech recognition
        db_path: Path to the SQLite database file
        
    Returns:
        Response message to be spoken to the user
    """
    interpreter = VoiceInterpreter(db_path)
    try:
        response = interpreter.process_command(command_text)
        return response
    finally:
        interpreter.close()


if __name__ == "__main__":
    # Test the interpreter
    print("=== Testing Voice Interpreter ===\n")
    
    interpreter = VoiceInterpreter()
    
    # Test status queries
    test_commands = [
        "Jarvis, status of spectrometer",
        "What is the status of centrifuge",
        "How is the microscope",
        "Take notes: Calibrated the sensors today",
        "Jarvis, take notes: Project Alpha - Initial test results show 95% efficiency",
        "Add a note: Need to order more reagents",
        "Log this: Meeting with team at 3 PM",
        "Jarvis, create project Sensor Calibration",
        "Project status of Sensor Calibration",
        "Jarvis, findings for Sensor Calibration",
        "Unknown command test"
    ]
    
    for cmd in test_commands:
        print(f"\n🎤 Command: {cmd}")
        response = interpreter.process_command(cmd)
        print(f"🔊 Response: {response}")
    
    interpreter.close()
    print("\n[OK] Interpreter test complete")
