"""
Simple Authentication Module for Lab Data

This module handles simple user authentication for audit tracking.
It focuses on identifying who did what when, without complex permissions.
"""

import sqlite3
import hashlib
import secrets
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path


class AuthManager:
    """
    Simple authentication manager for identifying users.
    
    Features:
    - User registration and authentication
    - Session management with expiration
    - Password hashing with salt
    - Simple user identification (no complex roles/permissions)
    """
    
    def __init__(self, db_path: str = "local_cache.db", session_expiry_hours: int = 24):
        """
        Initialize the AuthManager.
        
        Args:
            db_path: Path to the SQLite database
            session_expiry_hours: Session token expiry time in hours
        """
        self.db_path = db_path
        self.session_expiry_hours = session_expiry_hours
        self._initialize_database()
        
        print("[OK] Simple AuthManager initialized")
    
    def _initialize_database(self) -> None:
        """Initialize simple authentication tables in the database."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create users table (simplified - no roles)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    personnel_name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            """)
            
            # Create sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    session_token TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            
            # Create default admin user if no users exist
            cursor.execute("SELECT COUNT(*) FROM users")
            if cursor.fetchone()[0] == 0:
                self._create_default_admin(cursor)
            
            conn.commit()
            conn.close()
            
            print("[OK] Simple authentication database initialized")
            
        except sqlite3.Error as e:
            print(f"❌ Failed to initialize authentication database: {e}")
            raise
    
    def _create_default_admin(self, cursor) -> None:
        """Create a default admin user."""
        default_username = "admin"
        default_password = "admin123"  # Should be changed on first login
        
        salt = secrets.token_hex(16)
        password_hash = self._hash_password(default_password, salt)
        
        cursor.execute("""
            INSERT INTO users (username, email, password_hash, salt, personnel_name)
            VALUES (?, ?, ?, ?, ?)
        """, (default_username, "admin@lab.local", password_hash, salt, 'Lab Administrator'))
        
        print(f"⚠️  Created default admin user: {default_username} / {default_password}")
        print("   Please change the default password after first login!")
    
    def _hash_password(self, password: str, salt: str) -> str:
        """
        Hash a password with salt using SHA-256.
        
        Args:
            password: Plain text password
            salt: Salt string
            
        Returns:
            Hashed password string
        """
        salted_password = password + salt
        return hashlib.sha256(salted_password.encode()).hexdigest()
    
    def _generate_session_token(self) -> str:
        """Generate a secure random session token."""
        return secrets.token_urlsafe(32)
    
    def register_user(self, username: str, password: str, email: Optional[str] = None,
                     personnel_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a new user.
        
        Args:
            username: Username (must be unique)
            password: Plain text password
            email: Optional email address
            personnel_name: Optional personnel name for audit tracking
            
        Returns:
            Dictionary with success status and message
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if username already exists
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                conn.close()
                return {"success": False, "message": "Username already exists"}
            
            # Check if email already exists
            if email:
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    conn.close()
                    return {"success": False, "message": "Email already registered"}
            
            # Generate salt and hash password
            salt = secrets.token_hex(16)
            password_hash = self._hash_password(password, salt)
            
            # Insert new user
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, salt, personnel_name)
                VALUES (?, ?, ?, ?, ?)
            """, (username, email, password_hash, salt, personnel_name))
            
            conn.commit()
            conn.close()
            
            print(f"[OK] User registered: {username}")
            return {"success": True, "message": "User registered successfully"}
            
        except sqlite3.Error as e:
            print(f"❌ Failed to register user: {e}")
            return {"success": False, "message": f"Database error: {e}"}
    
    def authenticate_user(self, username: str, password: str, 
                        ip_address: Optional[str] = None,
                        user_agent: Optional[str] = None) -> Dict[str, Any]:
        """
        Authenticate a user and create a session.
        
        Args:
            username: Username
            password: Plain text password
            ip_address: Optional IP address for session tracking
            user_agent: Optional user agent for session tracking
            
        Returns:
            Dictionary with success status, session token, and user info
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get user by username
            cursor.execute("""
                SELECT id, username, email, password_hash, salt, personnel_name, is_active
                FROM users WHERE username = ?
            """, (username,))
            
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return {"success": False, "message": "Invalid username or password"}
            
            user_id, username, email, password_hash, salt, personnel_name, is_active = user
            
            # Check if user is active
            if not is_active:
                conn.close()
                return {"success": False, "message": "Account is disabled"}
            
            # Verify password
            computed_hash = self._hash_password(password, salt)
            if computed_hash != password_hash:
                conn.close()
                return {"success": False, "message": "Invalid username or password"}
            
            # Generate session token
            session_token = self._generate_session_token()
            expires_at = datetime.now() + timedelta(hours=self.session_expiry_hours)
            
            # Create session
            cursor.execute("""
                INSERT INTO sessions (user_id, session_token, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, session_token, expires_at, ip_address, user_agent))
            
            # Update last login
            cursor.execute("""
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
            """, (user_id,))
            
            conn.commit()
            conn.close()
            
            print(f"[OK] User authenticated: {username}")
            
            return {
                "success": True,
                "session_token": session_token,
                "user": {
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "personnel_name": personnel_name
                }
            }
            
        except sqlite3.Error as e:
            print(f"❌ Authentication failed: {e}")
            return {"success": False, "message": f"Database error: {e}"}
    
    def validate_session(self, session_token: str) -> Dict[str, Any]:
        """
        Validate a session token and return user information.
        
        Args:
            session_token: Session token to validate
            
        Returns:
            Dictionary with validation status and user info if valid
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get session and user info
            cursor.execute("""
                SELECT s.user_id, s.expires_at, u.username, u.email, u.personnel_name, u.is_active
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = ?
            """, (session_token,))
            
            result = cursor.fetchone()
            
            if not result:
                conn.close()
                return {"valid": False, "message": "Invalid session token"}
            
            user_id, expires_at, username, email, personnel_name, is_active = result
            
            # Check if session is expired
            if datetime.now() > datetime.strptime(expires_at, '%Y-%m-%d %H:%M:%S'):
                # Delete expired session
                cursor.execute("DELETE FROM sessions WHERE session_token = ?", (session_token,))
                conn.commit()
                conn.close()
                return {"valid": False, "message": "Session expired"}
            
            # Check if user is active
            if not is_active:
                conn.close()
                return {"valid": False, "message": "Account is disabled"}
            
            conn.close()
            
            return {
                "valid": True,
                "user": {
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "personnel_name": personnel_name
                }
            }
            
        except sqlite3.Error as e:
            print(f"❌ Session validation failed: {e}")
            return {"valid": False, "message": f"Database error: {e}"}
    
    def logout_user(self, session_token: str) -> Dict[str, Any]:
        """
        Logout a user by invalidating their session.
        
        Args:
            session_token: Session token to invalidate
            
        Returns:
            Dictionary with success status
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM sessions WHERE session_token = ?", (session_token,))
            rows_affected = cursor.rowcount
            
            conn.commit()
            conn.close()
            
            if rows_affected > 0:
                print("[OK] User logged out successfully")
                return {"success": True, "message": "Logged out successfully"}
            else:
                return {"success": False, "message": "Session not found"}
            
        except sqlite3.Error as e:
            print(f"❌ Logout failed: {e}")
            return {"success": False, "message": f"Database error: {e}"}
    
    def get_user_info(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user information by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with user information or None if not found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, username, email, personnel_name, created_at, last_login, is_active
                FROM users WHERE id = ?
            """, (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if not result:
                return None
            
            user_id, username, email, personnel_name, created_at, last_login, is_active = result
            
            return {
                "id": user_id,
                "username": username,
                "email": email,
                "personnel_name": personnel_name,
                "created_at": created_at,
                "last_login": last_login,
                "is_active": is_active
            }
            
        except sqlite3.Error as e:
            print(f"❌ Failed to get user info: {e}")
            return None
    
    def list_users(self) -> List[Dict[str, Any]]:
        """
        List all users in the system.
        
        Returns:
            List of user dictionaries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, username, email, personnel_name, created_at, last_login, is_active
                FROM users ORDER BY created_at DESC
            """)
            
            results = cursor.fetchall()
            conn.close()
            
            users = []
            for result in results:
                user_id, username, email, personnel_name, created_at, last_login, is_active = result
                users.append({
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "personnel_name": personnel_name,
                    "created_at": created_at,
                    "last_login": last_login,
                    "is_active": is_active
                })
            
            return users
            
        except sqlite3.Error as e:
            print(f"❌ Failed to list users: {e}")
            return []
    
    def cleanup_expired_sessions(self) -> int:
        """
        Remove expired sessions from the database.
        
        Returns:
            Number of sessions cleaned up
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP
            """)
            
            rows_affected = cursor.rowcount
            conn.commit()
            conn.close()
            
            if rows_affected > 0:
                print(f"[OK] Cleaned up {rows_affected} expired sessions")
            
            return rows_affected
            
        except sqlite3.Error as e:
            print(f"❌ Failed to cleanup sessions: {e}")
            return 0
    
    def change_password(self, user_id: int, old_password: str, new_password: str) -> Dict[str, Any]:
        """
        Change a user's password.
        
        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password
            
        Returns:
            Dictionary with success status
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get current password hash
            cursor.execute("""
                SELECT password_hash, salt FROM users WHERE id = ?
            """, (user_id,))
            
            result = cursor.fetchone()
            
            if not result:
                conn.close()
                return {"success": False, "message": "User not found"}
            
            password_hash, salt = result
            
            # Verify old password
            computed_hash = self._hash_password(old_password, salt)
            if computed_hash != password_hash:
                conn.close()
                return {"success": False, "message": "Current password is incorrect"}
            
            # Generate new salt and hash
            new_salt = secrets.token_hex(16)
            new_password_hash = self._hash_password(new_password, new_salt)
            
            # Update password
            cursor.execute("""
                UPDATE users SET password_hash = ?, salt = ? WHERE id = ?
            """, (new_password_hash, new_salt, user_id))
            
            conn.commit()
            conn.close()
            
            print(f"[OK] Password changed for user {user_id}")
            return {"success": True, "message": "Password changed successfully"}
            
        except sqlite3.Error as e:
            print(f"❌ Failed to change password: {e}")
            return {"success": False, "message": f"Database error: {e}"}


# Convenience functions for quick authentication
def create_auth_manager(db_path: str = "local_cache.db") -> AuthManager:
    """
    Create and initialize an AuthManager instance.
    
    Args:
        db_path: Path to the SQLite database
        
    Returns:
        AuthManager instance
    """
    return AuthManager(db_path)


if __name__ == "__main__":
    # Test the simple authentication system
    print("=== Testing Simple AuthManager ===\n")
    
    auth = create_auth_manager()
    
    # Test user registration
    print("Testing user registration...")
    result = auth.register_user("testuser", "testpass123", "test@example.com", "Test User")
    print(f"   Registration: {result}")
    
    # Test authentication
    print("\nTesting authentication...")
    result = auth.authenticate_user("testuser", "testpass123")
    print(f"   Authentication: {result}")
    
    if result["success"]:
        session_token = result["session_token"]
        
        # Test session validation
        print("\nTesting session validation...")
        result = auth.validate_session(session_token)
        print(f"   Session validation: {result}")
        
        # Test logout
        print("\nTesting logout...")
        result = auth.logout_user(session_token)
        print(f"   Logout: {result}")
    
    # Test admin authentication
    print("\nTesting admin authentication...")
    result = auth.authenticate_user("admin", "admin123")
    print(f"   Admin authentication: {result}")
    
    # List users
    print("\nListing users...")
    users = auth.list_users()
    for user in users:
        print(f"   - {user['username']} ({user['personnel_name']})")
    
    print("\n[OK] All simple authentication tests completed!")
