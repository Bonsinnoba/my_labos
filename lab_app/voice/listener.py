"""
Voice Listener Module

This module handles background microphone monitoring and wake word detection.
It runs on a separate thread to avoid blocking the main application loop.
"""

import speech_recognition as sr
import threading
import time
import sys
from pathlib import Path
from typing import Optional, Callable

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from voice.speaker import Speaker
from voice.interpreter import VoiceInterpreter


class VoiceListener:
    """Background voice listener with wake word detection."""
    
    def __init__(self, 
                 wake_word: str = "jarvis",
                 db_path: str = "local_cache.db",
                 on_command_processed: Optional[Callable[[str], None]] = None):
        """
        Initialize the voice listener.
        
        Args:
            wake_word: The wake word to trigger command listening
            db_path: Path to the SQLite database file
            on_command_processed: Callback function called after processing a command
        """
        self.wake_word = wake_word.lower()
        self.db_path = db_path
        self.on_command_processed = on_command_processed
        
        # Audio components
        self.recognizer = sr.Recognizer()
        self.microphone: Optional[sr.Microphone] = None
        self.speaker = Speaker()
        self.interpreter = VoiceInterpreter(db_path)
        
        # Thread control
        self.listening_thread: Optional[threading.Thread] = None
        self.is_running = False
        self.is_listening_for_command = False
        
        # Audio settings
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        self.recognizer.phrase_threshold = 0.3
        self.recognizer.non_speaking_duration = 0.5
        
        print("✅ Voice listener initialized")
    
    def _initialize_microphone(self) -> bool:
        """
        Initialize the microphone.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # List available microphones
            mic_list = sr.Microphone.list_microphone_names()
            print(f"🎤 Available microphones: {len(mic_list)}")
            for i, name in enumerate(mic_list[:3]):  # Show first 3
                print(f"   [{i}] {name}")
            
            # Use default microphone
            self.microphone = sr.Microphone()
            
            # Calibrate for ambient noise
            print("🔧 Calibrating microphone for ambient noise...")
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
            
            print(f"✅ Microphone initialized (threshold: {self.recognizer.energy_threshold})")
            return True
            
        except Exception as e:
            print(f"❌ Failed to initialize microphone: {e}")
            print("   Please ensure a microphone is connected and permissions are granted.")
            return False
    
    def _listen_for_wake_word(self) -> Optional[str]:
        """
        Continuously listen for the wake word.
        
        Returns:
            The detected text if wake word is found, None otherwise
        """
        if self.microphone is None:
            return None
        
        try:
            with self.microphone as source:
                print("👂 Listening for wake word...")
                audio = self.recognizer.listen(source, timeout=None, phrase_time_limit=5)
            
            # Try to recognize speech
            try:
                text = self.recognizer.recognize_google(audio, language="en-US").lower()
                print(f"🎤 Heard: '{text}'")
                
                # Check for wake word
                if self.wake_word in text:
                    print(f"✨ Wake word detected!")
                    self.speaker.play_chime("wake")
                    return text
                
            except sr.UnknownValueError:
                # Speech was unintelligible
                pass
            except sr.RequestError as e:
                print(f"❌ Speech recognition service error: {e}")
            
        except sr.WaitTimeoutError:
            # Listening timeout, continue
            pass
        except Exception as e:
            print(f"❌ Error listening for wake word: {e}")
        
        return None
    
    def _listen_for_command(self) -> Optional[str]:
        """
        Listen for a command after wake word is detected.
        
        Returns:
            The detected command text, or None if failed
        """
        if self.microphone is None:
            return None
        
        try:
            with self.microphone as source:
                print("👂 Listening for command...")
                self.speaker.say("Yes?", block=False)
                
                # Listen with a longer timeout for commands
                audio = self.recognizer.listen(source, timeout=10, phrase_time_limit=10)
            
            # Try to recognize speech
            try:
                text = self.recognizer.recognize_google(audio, language="en-US")
                print(f"🎤 Command: '{text}'")
                return text
                
            except sr.UnknownValueError:
                print("❌ Could not understand the command")
                self.speaker.say("I didn't catch that.", block=False)
                return None
            except sr.RequestError as e:
                print(f"❌ Speech recognition service error: {e}")
                self.speaker.say("Sorry, I'm having trouble hearing you.", block=False)
                return None
            
        except sr.WaitTimeoutError:
            print("⏱️  Command listening timeout")
            self.speaker.say("I didn't hear anything.", block=False)
            return None
        except Exception as e:
            print(f"❌ Error listening for command: {e}")
            return None
    
    def _process_command(self, command_text: str) -> None:
        """
        Process a voice command through the interpreter.
        
        Args:
            command_text: The command text to process
        """
        try:
            print(f"🔄 Processing command...")
            response = self.interpreter.process_command(command_text)
            print(f"🔊 Response: {response}")
            
            # Speak the response
            self.speaker.say(response, block=False)
            
            # Call callback if provided
            if self.on_command_processed:
                self.on_command_processed(command_text)
            
            # Play success chime
            time.sleep(0.5)
            self.speaker.play_chime("success")
            
        except Exception as e:
            print(f"❌ Error processing command: {e}")
            self.speaker.say("Sorry, I encountered an error.", block=False)
    
    def _listening_loop(self) -> None:
        """
        Main listening loop that runs in the background thread.
        """
        print("🚀 Voice listener thread started")
        
        while self.is_running:
            try:
                # Listen for wake word
                wake_text = self._listen_for_wake_word()
                
                if wake_text and self.is_running:
                    # Wake word detected, now listen for command
                    self.is_listening_for_command = True
                    command = self._listen_for_command()
                    self.is_listening_for_command = False
                    
                    if command and self.is_running:
                        # Process the command
                        self._process_command(command)
                    
                    # Small delay before listening for wake word again
                    time.sleep(1)
                
            except Exception as e:
                print(f"❌ Error in listening loop: {e}")
                time.sleep(2)  # Wait before retrying
        
        print("🛑 Voice listener thread stopped")
    
    def start(self) -> bool:
        """
        Start the background voice listener thread.
        
        Returns:
            True if started successfully, False otherwise
        """
        if self.is_running:
            print("⚠️  Voice listener is already running")
            return False
        
        # Initialize microphone
        if not self._initialize_microphone():
            return False
        
        # Start listening thread
        self.is_running = True
        self.listening_thread = threading.Thread(
            target=self._listening_loop,
            daemon=True
        )
        self.listening_thread.start()
        
        print("✅ Voice listener started")
        return True
    
    def stop(self) -> None:
        """Stop the background voice listener thread."""
        if not self.is_running:
            return
        
        print("🛑 Stopping voice listener...")
        self.is_running = False
        
        # Wait for thread to finish (with timeout)
        if self.listening_thread:
            self.listening_thread.join(timeout=3)
        
        # Cleanup
        self.speaker.stop()
        self.interpreter.close()
        
        print("✅ Voice listener stopped")
    
    def is_active(self) -> bool:
        """
        Check if the voice listener is currently running.
        
        Returns:
            True if running, False otherwise
        """
        return self.is_running
    
    def manual_command(self, command_text: str) -> str:
        """
        Manually process a command (for testing or UI integration).
        
        Args:
            command_text: The command text to process
            
        Returns:
            The response message
        """
        return self.interpreter.process_command(command_text)


if __name__ == "__main__":
    # Test the listener
    print("=== Testing Voice Listener ===\n")
    print("Say 'Jarvis' followed by a command.")
    print("Try: 'Jarvis, status of spectrometer'")
    print("Try: 'Jarvis, take notes: Test note'")
    print("\nPress Ctrl+C to stop.\n")
    
    listener = VoiceListener()
    
    try:
        listener.start()
        
        # Keep main thread alive
        while listener.is_active():
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping listener...")
        listener.stop()
    
    print("✅ Test complete")
