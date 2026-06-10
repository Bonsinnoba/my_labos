"""
Gemini Lab Assistant Service
Contextual AI Engineering Intelligence layer for Lab Management
"""

import os
import json
from typing import Dict, List, Any, Generator

# Optional import - will fail gracefully if SDK not installed
try:
    import google.generativeai as genai
    from google.generativeai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None
    types = None


class GeminiLabAssistant:
    """Contextual AI co-pilot for Lab Management using Gemini 2.5 Flash"""
    
    def __init__(self, api_key: str = None):
        """
        Initialize the Gemini Lab Assistant
        
        Args:
            api_key: Google API key for Gemini. If None, reads from GEMINI_API_KEY env var
        """
        if not GENAI_AVAILABLE:
            raise ImportError("Google GenAI SDK not installed. Install with: pip install google-generativeai")
        
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable must be set")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(
            model_name="gemini-3.5-flash",
            system_instruction=self._get_system_instruction()
        )
    
    def _get_system_instruction(self) -> str:
        """System instruction for the AI assistant"""
        return """You are a professional Hardware Research & Development Assistant. 
You prioritize safety, thermal management, and precision in circuit analysis.
Your responses should be:
- technically accurate and specific
- focused on engineering best practices
- safety-conscious, especially regarding voltage, current, and thermal limits
- structured and easy to read
- practical and actionable"""
    
    def _sanitize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize context data to ensure only necessary technical strings are sent to API
        Removes sensitive or unnecessary data before sending to Gemini
        """
        sanitized = {}
        
        # Only include technical fields
        allowed_fields = {
            'stage_name', 'stage_goals', 'status', 'start_time', 'end_time',
            'experiment_title', 'experiment_outcome', 'experiment_details',
            'component_name', 'component_type', 'voltage_rating', 'current_rating',
            'package_type', 'description', 'specifications', 'notes'
        }
        
        for key, value in context.items():
            if key in allowed_fields and value:
                sanitized[key] = value
        
        return sanitized
    
    def review_stage_data(self, stage_context: Dict[str, Any]) -> Generator[str, None, None]:
        """
        Feature A: Stage Design Reviewer
        Analyze project stage for thermal risks, component mismatches, or logic flaws
        
        Args:
            stage_context: Dictionary containing Stage Goals, Experiment Logs, and Parts used
            
        Yields:
            Streaming response tokens
        """
        sanitized_context = self._sanitize_context(stage_context)
        
        prompt = f"""Analyze this specific project stage. Identify thermal risks, component mismatches (e.g., voltage ratings), or logic flaws. Provide a structured engineering critique.

Stage Context:
{json.dumps(sanitized_context, indent=2)}

Please provide:
1. Thermal Analysis: Identify any thermal management concerns
2. Component Compatibility: Check for voltage/current mismatches
3. Logic Flow: Identify any logical flaws in the design
4. Safety Concerns: Highlight any safety issues
5. Recommendations: Provide actionable improvements"""
        
        try:
            response = self.model.generate_content_stream(prompt)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Error generating review: {str(e)}"
    
    def find_alternates(self, component_details: str) -> Generator[str, None, None]:
        """
        Feature B: Smart Substitute Finder
        Find pin-compatible, drop-in alternatives for components
        
        Args:
            component_details: String describing the component (name, specs, etc.)
            
        Yields:
            Streaming response tokens
        """
        prompt = f"""Find 3 pin-compatible, drop-in alternatives for this component. Compare Voltage, Current, and Package Type. Highlight any minor parameter deviations.

Component Details:
{component_details}

For each alternative, provide:
1. Component Name and Part Number
2. Key Specifications (Voltage, Current, Package)
3. Compatibility Notes (pin-compatible, form factor, etc.)
4. Parameter Deviations (any differences from original)
5. Availability Considerations"""
        
        try:
            response = self.model.generate_content_stream(prompt)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Error finding alternatives: {str(e)}"
    
    def diagnose_failure(self, observation: str, experiment_history: List[Dict[str, Any]]) -> Generator[str, None, None]:
        """
        Feature C: Failure Mode Analyzer
        Diagnose circuit failures based on observations and experiment history
        
        Args:
            observation: Raw user observation of the failure
            experiment_history: List of recent experiment data
            
        Yields:
            Streaming response tokens
        """
        sanitized_history = [self._sanitize_context(exp) for exp in experiment_history]
        
        prompt = f"""Act as a veteran bench technician. Based on this circuit failure, suggest 3 specific diagnostic steps (e.g., probing specific nodes, checking inductor saturation).

Failure Observation:
{observation}

Recent Experiment History:
{json.dumps(sanitized_history, indent=2)}

Please provide:
1. Most Likely Cause: Based on the symptoms
2. Diagnostic Step 1: Specific measurement or check to perform
3. Diagnostic Step 2: Additional verification step
4. Diagnostic Step 3: Confirmation or isolation step
5. Safety Precautions: Any safety considerations during diagnosis"""
        
        try:
            response = self.model.generate_content_stream(prompt)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Error diagnosing failure: {str(e)}"
    
    def generate_test_script(self, requirement: str, language: str = "python") -> Generator[str, None, None]:
        """
        Feature D: Lab Automation Scripting
        Generate production-ready test automation scripts
        
        Args:
            requirement: Description of the test requirement
            language: Target language (python, cpp, arduino)
            
        Yields:
            Streaming response tokens
        """
        if language == "python":
            lib_info = "Use pyserial for serial communication and SCPI commands for instruments"
        elif language == "cpp":
            lib_info = "Use standard C++ with appropriate hardware libraries"
        elif language == "arduino":
            lib_info = "Use Arduino framework with standard libraries"
        else:
            lib_info = "Use appropriate libraries for the target platform"
        
        prompt = f"""Generate production-ready {language} code for this test automation requirement.

Requirement:
{requirement}

{lib_info}

Please provide:
1. Complete, runnable code
2. Clear comments explaining each section
3. Error handling
4. Configuration parameters at the top
5. Usage instructions in comments
6. Safety considerations (if applicable)"""
        
        try:
            response = self.model.generate_content_stream(prompt)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Error generating script: {str(e)}"
    
    def chat(self, message: str, conversation_history: List[Dict[str, str]] = None) -> Generator[str, None, None]:
        """
        General Chat Interface
        Handle general conversations with Gemini
        
        Args:
            message: User's message
            conversation_history: Optional list of previous messages for context
            
        Yields:
            Streaming response tokens
        """
        try:
            if conversation_history and len(conversation_history) > 0:
                # Build conversation context
                chat = self.model.start_chat(history=conversation_history)
                response = chat.send_message(message, stream=True)
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            else:
                # Simple one-off query
                response = self.model.generate_content_stream(message)
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
        except Exception as e:
            yield f"Error generating response: {str(e)}"


# Singleton instance
_gemini_assistant = None


def get_gemini_assistant() -> GeminiLabAssistant:
    """Get or create the singleton Gemini assistant instance"""
    global _gemini_assistant
    if _gemini_assistant is None:
        _gemini_assistant = GeminiLabAssistant()
    return _gemini_assistant
