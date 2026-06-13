# Lab R&D Mobile App - React Native Setup Guide

## Project Overview

Mobile companion app for the Lab R&D Operating System. Provides data access, quick updates, and offline synchronization for researchers on-the-go.

## Tech Stack

- **Framework**: React Native 0.73+
- **Language**: TypeScript
- **Navigation**: React Navigation 6
- **State Management**: Zustand
- **UI Components**: React Native Paper
- **Storage**: AsyncStorage
- **Networking**: Axios
- **Animations**: React Native Reanimated
- **Gestures**: React Native Gesture Handler
- **Icons**: React Native Vector Icons

## Prerequisites

- Node.js 18+ and npm
- React Native CLI or Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- CocoaPods (for iOS dependencies)

## Installation

### Option 1: Using Expo (Recommended for faster development)

```bash
# Install Expo CLI
npm install -g expo-cli

# Create new project
npx create-expo-app lab-rd-mobile --template blank-typescript

# Navigate to project
cd lab-rd-mobile

# Install dependencies
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install zustand axios @react-native-async-storage/async-storage
npm install react-native-paper react-native-vector-icons
npm install @react-native-community/netinfo
```

### Option 2: Using React Native CLI (For native features)

```bash
# Install React Native CLI
npm install -g react-native-cli

# Create new project
npx react-native init LabRDMobile --template react-native-template-typescript

# Navigate to project
cd LabRDMobile

# Install dependencies
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install zustand axios @react-native-async-storage/async-storage
npm install react-native-paper react-native-vector-icons
npm install @react-native-community/netinfo

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..
```

## Project Structure

```
lab-rd-mobile/
├── src/
│   ├── api/
│   │   ├── client.ts           # Axios configuration
│   │   ├── endpoints.ts        # API endpoint definitions
│   │   └── types.ts            # TypeScript types for API responses
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx      # Reusable button component
│   │   │   ├── Card.tsx        # Card component
│   │   │   ├── StatusBadge.tsx # Status badge component
│   │   │   └── SearchBar.tsx   # Search bar component
│   │   ├── layout/
│   │   │   ├── Screen.tsx      # Base screen component
│   │   │   └── TabBar.tsx      # Custom tab bar
│   │   └── lists/
│   │       ├── ProjectCard.tsx # Project list item
│   │       ├── ExperimentCard.tsx # Experiment list item
│   │       └── ResourceCard.tsx # Resource list item
│   ├── screens/
│   │   ├── Dashboard/
│   │   │   ├── index.tsx       # Dashboard screen
│   │   │   ├── QuickStats.tsx  # Quick stats component
│   │   │   └── RecentActivity.tsx # Recent activity component
│   │   ├── Projects/
│   │   │   ├── index.tsx       # Projects list screen
│   │   │   ├── ProjectDetail.tsx # Project detail screen
│   │   │   └── ProjectTabs.tsx # Project tabs component
│   │   ├── Experiments/
│   │   │   ├── index.tsx       # Experiments list screen
│   │   │   ├── ExperimentDetail.tsx # Experiment detail screen
│   │   │   └── ExperimentTabs.tsx # Experiment tabs component
│   │   ├── Resources/
│   │   │   ├── index.tsx       # Resources list screen
│   │   │   ├── ResourceDetail.tsx # Resource detail screen
│   │   │   └── ResourceGrid.tsx # Resource grid component
│   │   ├── Findings/
│   │   │   ├── index.tsx       # Findings list screen
│   │   │   ├── FindingDetail.tsx # Finding detail screen
│   │   │   └── SeverityBadge.tsx # Severity badge component
│   │   ├── Inventory/
│   │   │   ├── index.tsx       # Inventory list screen
│   │   │   ├── EquipmentCard.tsx # Equipment card
│   │   │   └── BarcodeScanner.tsx # Barcode scanner
│   │   └── Settings/
│   │       ├── index.tsx       # Settings screen
│   │       ├── SyncSettings.tsx # Sync settings
│   │       └── ThemeSettings.tsx # Theme settings
│   ├── store/
│   │   ├── index.ts            # Store configuration
│   │   ├── authSlice.ts        # Authentication state
│   │   ├── projectsSlice.ts    # Projects state
│   │   ├── experimentsSlice.ts # Experiments state
│   │   └── syncSlice.ts        # Sync state
│   ├── services/
│   │   ├── syncService.ts      # Mesh sync coordinator integration
│   │   ├── cacheService.ts     # AsyncStorage wrapper
│   │   └── notificationService.ts # Push notification service
│   ├── hooks/
│   │   ├── useSync.ts          # Sync hook
│   │   ├── useOffline.ts       # Offline detection hook
│   │   └── useTheme.ts         # Theme hook
│   ├── utils/
│   │   ├── theme.ts            # Theme configuration
│   │   ├── constants.ts        # App constants
│   │   └── helpers.ts          # Helper functions
│   ├── navigation/
│   │   ├── AppNavigator.tsx    # Main navigator
│   │   ├── TabNavigator.tsx    # Bottom tab navigator
│   │   └── linking.ts          # Deep linking configuration
│   └── types/
│       ├── index.ts            # Global TypeScript types
│       ├── project.ts          # Project types
│       ├── experiment.ts       # Experiment types
│       └── sync.ts             # Sync types
├── assets/
│   ├── images/
│   ├── fonts/
│   └── icons/
├── android/                    # Android native code
├── ios/                        # iOS native code
├── App.tsx                     # App entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration Files

### package.json (Key Dependencies)

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@react-navigation/stack": "^6.3.20",
    "react-native-screens": "^3.29.0",
    "react-native-safe-area-context": "^4.8.2",
    "zustand": "^4.4.7",
    "axios": "^1.6.2",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "react-native-paper": "^5.11.3",
    "react-native-vector-icons": "^10.0.3",
    "@react-native-community/netinfo": "^11.2.1",
    "react-native-reanimated": "^3.6.0",
    "react-native-gesture-handler": "^2.14.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "@types/react-native": "^0.72.8",
    "typescript": "^5.3.3",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "commonjs",
    "lib": ["es2017"],
    "jsx": "react-native",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@components/*": ["components/*"],
      "@screens/*": ["screens/*"],
      "@api/*": ["api/*"],
      "@store/*": ["store/*"],
      "@services/*": ["services/*"],
      "@utils/*": ["utils/*"],
      "@types/*": ["types/*"]
    }
  },
  "include": ["src/**/*", "App.tsx"],
  "exclude": ["node_modules", "android", "ios"]
}
```

## Environment Configuration

Create a `.env` file in the project root:

```env
# API Configuration
API_BASE_URL=http://YOUR_PC_IP:8000
API_TIMEOUT=30000

# Sync Configuration
SYNC_INTERVAL=7500
DEVICE_ID=MOBILE_DEVICE_01

# B2 Configuration (Optional - for cloud sync)
B2_BUCKET_NAME=your-bucket-name
B2_ENDPOINT_URL=https://s3.us-west-004.backblazeb2.com
B2_ACCESS_KEY_ID=your-access-key
B2_SECRET_ACCESS_KEY=your-secret-key
```

## Theme Configuration

Create `src/utils/theme.ts`:

```typescript
import { MD3Theme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from '@react-navigation/native';

const customColors = {
  primary: '#ff6b35',
  primaryDark: '#e55a2b',
  secondary: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
  success: '#4ade80',
};

export const darkTheme: MD3Theme = {
  ...adaptNavigationTheme({ reactNavigationTheme: NavigationDarkTheme }),
  colors: {
    ...NavigationDarkTheme.colors,
    primary: customColors.primary,
    secondary: customColors.secondary,
    error: customColors.error,
    background: '#1a1a1a',
    surface: '#242424',
    surfaceVariant: '#2d2d2d',
    onBackground: '#e0e0e0',
    onSurface: '#e0e0e0',
    onSurfaceVariant: '#a0a0a0',
  },
};

export const lightTheme: MD3Theme = {
  ...adaptNavigationTheme({ reactNavigationTheme: NavigationLightTheme }),
  colors: {
    ...NavigationLightTheme.colors,
    primary: customColors.primary,
    secondary: customColors.secondary,
    error: customColors.error,
    background: '#ffffff',
    surface: '#f5f5f5',
    surfaceVariant: '#e8e8e8',
    onBackground: '#1a1a1a',
    onSurface: '#1a1a1a',
    onSurfaceVariant: '#4a4a4a',
  },
};
```

## API Client Setup

Create `src/api/client.ts`:

```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      await AsyncStorage.removeItem('auth_token');
      // Navigate to login screen
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## Running the App

### Development

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run with Expo
npx expo start
```

### Production Build

```bash
# Android
cd android
./gradlew assembleRelease

# iOS (macOS only)
cd ios
pod install
# Then build in Xcode
```

## Next Steps

1. Set up navigation structure (bottom tabs, stack navigation)
2. Implement core screens (Dashboard, Projects, Experiments)
3. Integrate API client with FastAPI backend
4. Implement AsyncStorage for local caching
5. Integrate mesh sync coordinator for offline sync
6. Add UI components (cards, lists, status badges)
7. Implement Resources and Findings screens
8. Add offline support and sync indicators
9. Add push notifications

## Notes

- The mobile app will communicate with the existing FastAPI backend
- Use the same API endpoints as the web frontend
- Implement the mesh sync coordinator for offline synchronization
- Cache frequently accessed data using AsyncStorage
- Show sync status indicators in the UI
- Implement pull-to-refresh for manual sync
