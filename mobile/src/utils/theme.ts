import { MD3DarkTheme, MD3LightTheme, MD3Theme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from '@react-navigation/native';

declare module 'react-native-paper' {
  export function useTheme<T = MD3Theme>(): T & {
    colors: T extends MD3Theme ? T['colors'] & {
      warning: string;
      success: string;
      info: string;
      border: string;
    } : any;
  };
}

const colorPalette: Record<string, { primary: string; primaryDark: string }> = {
  'Orange': { primary: '#ff6b35', primaryDark: '#e55a2b' },
  'Blue': { primary: '#2196F3', primaryDark: '#1976D2' },
  'Green': { primary: '#4CAF50', primaryDark: '#388E3C' },
  'Purple': { primary: '#9C27B0', primaryDark: '#7B1FA2' },
  'Red': { primary: '#F44336', primaryDark: '#D32F2F' },
  'Teal': { primary: '#009688', primaryDark: '#00796B' },
};

const defaultColor = colorPalette['Orange'];

const customColors = {
  primary: defaultColor.primary,
  primaryDark: defaultColor.primaryDark,
  secondary: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
  success: '#4ade80',
};

export const getThemeColors = (colorName: string = 'Orange') => {
  const selectedColor = colorPalette[colorName] || defaultColor;
  return {
    primary: selectedColor.primary,
    primaryDark: selectedColor.primaryDark,
  };
};

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationLightTheme,
  reactNavigationDark: NavigationDarkTheme,
});

export const darkTheme: any = {
  ...MD3DarkTheme,
  ...DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...DarkTheme.colors,
    primary: customColors.primary,
    secondary: customColors.secondary,
    error: customColors.error,
    background: '#1a1a1a',
    surface: '#242424',
    surfaceVariant: '#2d2d2d',
    onBackground: '#e0e0e0',
    onSurface: '#e0e0e0',
    onSurfaceVariant: '#a0a0a0',
    warning: customColors.warning,
    success: customColors.success,
    info: customColors.info,
    border: '#2d2d2d',
  },
};

export const lightTheme: any = {
  ...MD3LightTheme,
  ...LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...LightTheme.colors,
    primary: customColors.primary,
    secondary: customColors.secondary,
    error: customColors.error,
    background: '#ffffff',
    surface: '#f5f5f5',
    surfaceVariant: '#e8e8e8',
    onBackground: '#1a1a1a',
    onSurface: '#1a1a1a',
    onSurfaceVariant: '#4a4a4a',
    warning: customColors.warning,
    success: customColors.success,
    info: customColors.info,
    border: '#e8e8e8',
  },
};

export const statusColors = {
  active: customColors.success,
  completed: customColors.info,
  paused: customColors.warning,
  pending: customColors.warning,
  pass: customColors.success,
  fail: customColors.error,
  available: customColors.success,
  in_use: customColors.warning,
  maintenance: customColors.error,
  high: customColors.error,
  medium: customColors.warning,
  low: customColors.info,
};
