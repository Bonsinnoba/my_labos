import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  isOnline: boolean;
  lastSync: number | null;
  deviceId: string;
  setOnlineStatus: (status: boolean) => void;
  setLastSync: (timestamp: number) => void;
  setDeviceId: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: true,
      lastSync: null,
      deviceId: '',
      setOnlineStatus: (status) => set({ isOnline: status }),
      setLastSync: (timestamp) => set({ lastSync: timestamp }),
      setDeviceId: (id) => set({ deviceId: id }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
