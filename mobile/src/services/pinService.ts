import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_STORAGE_KEY = '@app_pin';
const PIN_ENABLED_KEY = '@pin_enabled';
const PIN_ATTEMPTS_KEY = '@pin_attempts';
const PIN_LOCKOUT_KEY = '@pin_lockout_until';

class PinService {
  private static instance: PinService;

  private constructor() {
    // No encryption key needed
  }

  static getInstance(): PinService {
    if (!PinService.instance) {
      PinService.instance = new PinService();
    }
    return PinService.instance;
  }

  async hasPin(): Promise<boolean> {
    try {
      const pin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      return pin !== null;
    } catch (error) {
      console.error('Error checking PIN:', error);
      return false;
    }
  }

  async isPinEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(PIN_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking PIN enabled status:', error);
      return false;
    }
  }

  async setPin(pin: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.validatePin(pin)) {
        return { success: false, message: 'PIN must be exactly 6 digits' };
      }

      await AsyncStorage.setItem(PIN_STORAGE_KEY, pin);
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
      await this.resetAttempts();
      
      return { success: true, message: 'PIN set successfully' };
    } catch (error) {
      console.error('Error setting PIN:', error);
      return { success: false, message: 'Failed to set PIN' };
    }
  }

  async verifyPin(pin: string): Promise<{ success: boolean; message: string; attemptsRemaining?: number }> {
    try {
      // Check if locked out
      const lockoutUntil = await AsyncStorage.getItem(PIN_LOCKOUT_KEY);
      if (lockoutUntil) {
        const lockoutTime = parseInt(lockoutUntil);
        if (Date.now() < lockoutTime) {
          const remainingMinutes = Math.ceil((lockoutTime - Date.now()) / 60000);
          return { 
            success: false, 
            message: `Too many failed attempts. Try again in ${remainingMinutes} minutes` 
          };
        } else {
          // Lockout period expired, reset
          await this.resetAttempts();
        }
      }

      const storedPin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      if (!storedPin) {
        // No PIN set - reset enabled state to prevent lock screen
        await AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
        return { success: false, message: 'No PIN set. Please set a PIN first.' };
      }
      
      if (pin === storedPin) {
        await this.resetAttempts();
        return { success: true, message: 'PIN verified' };
      } else {
        const attempts = await this.incrementAttempts();
        const attemptsRemaining = 5 - attempts;
        
        if (attemptsRemaining <= 0) {
          // Lock out for 5 minutes
          await AsyncStorage.setItem(PIN_LOCKOUT_KEY, (Date.now() + 5 * 60 * 1000).toString());
          return { 
            success: false, 
            message: 'Too many failed attempts. Locked for 5 minutes' 
          };
        }
        
        return { 
          success: false, 
          message: `Incorrect PIN. ${attemptsRemaining} attempts remaining`,
          attemptsRemaining 
        };
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return { success: false, message: 'Error verifying PIN' };
    }
  }

  async changePin(oldPin: string, newPin: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify old PIN first
      const verification = await this.verifyPin(oldPin);
      if (!verification.success) {
        return { success: false, message: verification.message };
      }

      if (!this.validatePin(newPin)) {
        return { success: false, message: 'New PIN must be exactly 6 digits' };
      }

      if (oldPin === newPin) {
        return { success: false, message: 'New PIN must be different from old PIN' };
      }

      await AsyncStorage.setItem(PIN_STORAGE_KEY, newPin);
      
      return { success: true, message: 'PIN changed successfully' };
    } catch (error) {
      console.error('Error changing PIN:', error);
      return { success: false, message: 'Failed to change PIN' };
    }
  }

  async removePin(): Promise<{ success: boolean; message: string }> {
    try {
      await AsyncStorage.removeItem(PIN_STORAGE_KEY);
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
      await this.resetAttempts();
      
      return { success: true, message: 'PIN removed successfully' };
    } catch (error) {
      console.error('Error removing PIN:', error);
      return { success: false, message: 'Failed to remove PIN' };
    }
  }

  async clearPinState(): Promise<{ success: boolean; message: string }> {
    try {
      // Clear all PIN-related storage
      await AsyncStorage.removeItem(PIN_STORAGE_KEY);
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
      await AsyncStorage.removeItem(PIN_ATTEMPTS_KEY);
      await AsyncStorage.removeItem(PIN_LOCKOUT_KEY);
      
      return { success: true, message: 'PIN state cleared successfully' };
    } catch (error) {
      console.error('Error clearing PIN state:', error);
      return { success: false, message: 'Failed to clear PIN state' };
    }
  }

  async togglePinEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const hasPin = await this.hasPin();
      if (!hasPin && enabled) {
        return { success: false, message: 'Set a PIN first before enabling' };
      }

      await AsyncStorage.setItem(PIN_ENABLED_KEY, enabled.toString());
      return { success: true, message: enabled ? 'PIN enabled' : 'PIN disabled' };
    } catch (error) {
      console.error('Error toggling PIN:', error);
      return { success: false, message: 'Failed to toggle PIN' };
    }
  }

  private async incrementAttempts(): Promise<number> {
    try {
      const attempts = await AsyncStorage.getItem(PIN_ATTEMPTS_KEY);
      const newAttempts = attempts ? parseInt(attempts) + 1 : 1;
      await AsyncStorage.setItem(PIN_ATTEMPTS_KEY, newAttempts.toString());
      return newAttempts;
    } catch (error) {
      console.error('Error incrementing attempts:', error);
      return 1;
    }
  }

  private async resetAttempts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PIN_ATTEMPTS_KEY);
      await AsyncStorage.removeItem(PIN_LOCKOUT_KEY);
    } catch (error) {
      console.error('Error resetting attempts:', error);
    }
  }

  validatePin(pin: string): boolean {
    return /^\d{6}$/.test(pin);
  }

  async getAttemptsRemaining(): Promise<number> {
    try {
      const attempts = await AsyncStorage.getItem(PIN_ATTEMPTS_KEY);
      return attempts ? 5 - parseInt(attempts) : 5;
    } catch (error) {
      console.error('Error getting attempts remaining:', error);
      return 5;
    }
  }
}

export const pinService = PinService.getInstance();
