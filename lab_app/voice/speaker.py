"""
Text-to-Speech Speaker Module

This module provides offline text-to-speech capabilities using pyttsx3.
It handles speech synthesis with configurable rate, volume, and voice selection.
"""

import pyttsx3
import threading
from typing import Optional
import time


class Speaker:
    """Manages text-to-speech output for the voice assistant."""
    
    def __init__(self, rate: int = 160, volume: float = 0.9):
        """
        Initialize the TTS engine.
        
        Args:
            rate: Speech rate in words per minute (default: 160)
            volume: Speech volume from 0.0 to 1.0 (default: 0.9)
        """
        self.engine: Optional[pyttsx3.Engine] = None
        self.rate = rate
        self.volume = volume
        self._lock = threading.Lock()
        self._initialize_engine()
    
    def _initialize_engine(self) -> None:
        """Initialize the pyttsx3 engine with optimal settings."""
        try:
            self.engine = pyttsx3.init()
            
            # Set speech rate (words per minute)
            self.engine.setProperty('rate', self.rate)
            
            # Set volume
            self.engine.setProperty('volume', self.volume)
            
            # Try to set a natural voice (prefer female if available)
            voices = self.engine.getProperty('voices')
            if voices and len(voices) > 0:
                # Prefer the second voice if available (often female/natural)
                if len(voices) > 1:
                    self.engine.setProperty('voice', voices[1].id)
                else:
                    self.engine.setProperty('voice', voices[0].id)
            
            print("✅ TTS engine initialized successfully")
            
        except Exception as e:
            print(f"❌ Failed to initialize TTS engine: {e}")
            self.engine = None
    
    def say(self, text_message: str, block: bool = False) -> bool:
        """
        Speak a text message aloud.
        
        Args:
            text_message: The text to speak
            block: If True, block until speech completes. If False, speak in background.
            
        Returns:
            True if speech was initiated successfully, False otherwise
        """
        if not text_message or not text_message.strip():
            return False
        
        if self.engine is None:
            print(f"⚠️  TTS engine not available. Would say: {text_message}")
            return False
        
        try:
            with self._lock:
                print(f"🔊 Speaking: {text_message}")
                
                if block:
                    # Blocking speech - waits until complete
                    self.engine.say(text_message)
                    self.engine.runAndWait()
                else:
                    # Non-blocking speech - runs in separate thread
                    speech_thread = threading.Thread(
                        target=self._speak_async,
                        args=(text_message,),
                        daemon=True
                    )
                    speech_thread.start()
                
                return True
                
        except Exception as e:
            print(f"❌ Error speaking text: {e}")
            return False
    
    def _speak_async(self, text_message: str) -> None:
        """
        Internal method for asynchronous speech.
        
        Args:
            text_message: The text to speak
        """
        try:
            # Create a new engine instance for this thread
            # pyttsx3 is not thread-safe, so each thread needs its own engine
            thread_engine = pyttsx3.init()
            thread_engine.setProperty('rate', self.rate)
            thread_engine.setProperty('volume', self.volume)
            
            voices = thread_engine.getProperty('voices')
            if voices and len(voices) > 0:
                if len(voices) > 1:
                    thread_engine.setProperty('voice', voices[1].id)
                else:
                    thread_engine.setProperty('voice', voices[0].id)
            
            thread_engine.say(text_message)
            thread_engine.runAndWait()
            
        except Exception as e:
            print(f"❌ Error in async speech: {e}")
    
    def play_chime(self, chime_type: str = "success") -> bool:
        """
        Play a short audio chime to confirm actions.
        
        Args:
            chime_type: Type of chime ("success", "error", "info", "wake")
            
        Returns:
            True if chime was played successfully, False otherwise
        """
        chime_messages = {
            "success": "Ding!",
            "error": "Bzzt.",
            "info": "Blip.",
            "wake": "Beep."
        }
        
        message = chime_messages.get(chime_type, "Beep.")
        return self.say(message, block=False)
    
    def stop(self) -> None:
        """Stop any ongoing speech and cleanup resources."""
        try:
            if self.engine:
                self.engine.stop()
                print("🔇 Speech stopped")
        except Exception as e:
            print(f"❌ Error stopping speech: {e}")
    
    def set_rate(self, rate: int) -> None:
        """
        Change the speech rate.
        
        Args:
            rate: New speech rate in words per minute
        """
        self.rate = rate
        if self.engine:
            try:
                self.engine.setProperty('rate', rate)
            except Exception as e:
                print(f"❌ Error setting rate: {e}")
    
    def set_volume(self, volume: float) -> None:
        """
        Change the speech volume.
        
        Args:
            volume: New volume from 0.0 to 1.0
        """
        self.volume = max(0.0, min(1.0, volume))
        if self.engine:
            try:
                self.engine.setProperty('volume', self.volume)
            except Exception as e:
                print(f"❌ Error setting volume: {e}")


# Global speaker instance for easy access
_speaker_instance: Optional[Speaker] = None


def get_speaker(rate: int = 160, volume: float = 0.9) -> Speaker:
    """
    Get or create the global speaker instance.
    
    Args:
        rate: Speech rate in words per minute
        volume: Speech volume from 0.0 to 1.0
        
    Returns:
        Speaker instance
    """
    global _speaker_instance
    if _speaker_instance is None:
        _speaker_instance = Speaker(rate, volume)
    return _speaker_instance


def say(text_message: str, block: bool = False) -> bool:
    """
    Convenience function to speak text using the global speaker.
    
    Args:
        text_message: The text to speak
        block: If True, block until speech completes
        
    Returns:
        True if speech was initiated successfully
    """
    speaker = get_speaker()
    return speaker.say(text_message, block)


def play_chime(chime_type: str = "success") -> bool:
    """
    Convenience function to play a chime.
    
    Args:
        chime_type: Type of chime
        
    Returns:
        True if chime was played successfully
    """
    speaker = get_speaker()
    return speaker.play_chime(chime_type)


if __name__ == "__main__":
    # Test the speaker
    print("=== Testing Speaker Module ===\n")
    
    speaker = Speaker()
    
    # Test basic speech
    speaker.say("Hello, I am Jarvis, your lab assistant.", block=True)
    time.sleep(0.5)
    
    # Test non-blocking speech
    speaker.say("I can help you with equipment status and research notes.", block=False)
    time.sleep(1)
    
    # Test chimes
    print("\nTesting chimes:")
    speaker.play_chime("success")
    time.sleep(0.5)
    speaker.play_chime("error")
    time.sleep(0.5)
    speaker.play_chime("wake")
    
    print("\n✅ Speaker test complete")
