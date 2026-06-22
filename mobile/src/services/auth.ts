/**
 * Simple Authentication Service for Mobile App
 * 
 * This provides simple username/password authentication for internal lab workers.
 * It communicates with the Instapods Hub for session management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Get Instapods Hub URL from environment
const INSTAPODS_HUB_URL = process.env.EXPO_PUBLIC_INSTAPODS_HUB_URL || 'http://localhost:8001';

interface AuthResponse {
  success: boolean;
  session_token?: string;
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
  message?: string;
}

interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: string;
}

class AuthService {
  private sessionToken: string | null = null;
  private userInfo: UserInfo | null = null;

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${INSTAPODS_HUB_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.sessionToken = data.session_token;
        this.userInfo = data.user;
        
        // Store session locally
        await AsyncStorage.setItem('session_token', data.session_token);
        await AsyncStorage.setItem('user_info', JSON.stringify(data.user));
        
        return data;
      } else {
        return {
          success: false,
          message: data.message || 'Login failed',
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Network error during login',
      };
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<boolean> {
    try {
      if (this.sessionToken) {
        await fetch(`${INSTAPODS_HUB_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.sessionToken}`,
          },
        });
      }

      // Clear local storage
      this.sessionToken = null;
      this.userInfo = null;
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user_info');

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if API call fails
      this.sessionToken = null;
      this.userInfo = null;
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user_info');
      return false;
    }
  }

  /**
   * Restore session from local storage
   */
  async restoreSession(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const userInfoStr = await AsyncStorage.getItem('user_info');

      if (token && userInfoStr) {
        this.sessionToken = token;
        this.userInfo = JSON.parse(userInfoStr);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Session restore error:', error);
      return false;
    }
  }

  /**
   * Get current session token
   */
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Get current user info
   */
  getUserInfo(): UserInfo | null {
    return this.userInfo;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.sessionToken !== null && this.userInfo !== null;
  }

  /**
   * Get authorization header for API requests
   */
  getAuthHeader(): { Authorization: string } | {} {
    if (this.sessionToken) {
      return { Authorization: `Bearer ${this.sessionToken}` };
    }
    return {};
  }
}

// Export singleton instance
export default new AuthService();
