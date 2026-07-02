import './polyfills'; // ⚠️ Must be first – patches URL for Hermes before supabase loads
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { darkTheme, lightTheme, getThemeColors } from './src/utils/theme';
import { useThemeStore } from './src/store/themeStore';
import { useSettingsStore } from './src/store/settingsStore';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { flushQueue, setupNetworkListener } from './src/services/offlineQueue';

export default function App() {
  const { isDark } = useThemeStore();
  const { themeColor } = useSettingsStore();
  const themeColors = getThemeColors(themeColor);

  useEffect(() => {
    const unsubscribe = setupNetworkListener();

    flushQueue().catch((error) => {
      console.error('[App] Failed to flush offline queue on startup:', error);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  
  // Create dynamic theme with selected color
  const baseTheme = isDark ? darkTheme : lightTheme;
  const dynamicTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: themeColors.primary,
    },
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={dynamicTheme}>
          <NavigationContainer theme={dynamicTheme as any}>
            <AppNavigator />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
