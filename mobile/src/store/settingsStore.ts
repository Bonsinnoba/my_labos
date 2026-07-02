import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // Sync settings
  autoSync: boolean;
  
  // Notification settings
  pushNotifications: boolean;
  emailNotifications: boolean;
  
  // Account settings
  userName: string;
  
  // Appearance settings
  themeColor: string;
  
  // API settings
  apiBaseUrl: string;
  
  // Actions
  setAutoSync: (value: boolean) => void;
  setPushNotifications: (value: boolean) => void;
  setEmailNotifications: (value: boolean) => void;
  setUserName: (name: string) => void;
  setThemeColor: (color: string) => void;
  setApiBaseUrl: (url: string) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  autoSync: true,
  pushNotifications: true,
  emailNotifications: false,
  userName: 'Dr. Smith',
  themeColor: 'Orange',
  apiBaseUrl: 'http://192.168.100.5:8000',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      
      setAutoSync: (value) => set({ autoSync: value }),
      setPushNotifications: (value) => set({ pushNotifications: value }),
      setEmailNotifications: (value) => set({ emailNotifications: value }),
      setUserName: (name) => set({ userName: name }),
      setThemeColor: (color) => set({ themeColor: color }),
      setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
      
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
