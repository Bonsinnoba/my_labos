import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from './settingsStore';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: true,
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  loadTheme: async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        set({ isDark: savedTheme === 'dark' });
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  },
}));
