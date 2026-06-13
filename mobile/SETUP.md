# React Native Mobile App - Quick Start

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (if using Expo)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Installation Steps

### 1. Install Dependencies

```bash
cd mobile
npm install
```

**Note**: The TypeScript errors you're seeing are expected and will be resolved once dependencies are installed.

### 2. Configure Environment

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set your API base URL:
```
API_BASE_URL=http://YOUR_PC_IP:8000
```

Replace `YOUR_PC_IP` with your PC's local IP address (e.g., `192.168.1.100`).

### 3. Start the Development Server

#### Using Expo (Recommended)

```bash
npm start
```

Then:
- Press `a` to run on Android
- Press `i` to run on iOS (macOS only)
- Scan the QR code with Expo Go app on your phone

#### Using React Native CLI

```bash
# Android
npm run android

# iOS (macOS only)
npm run ios
```

## Project Structure

```
mobile/
├── src/
│   ├── api/           # API client and endpoints
│   ├── components/    # Reusable UI components
│   ├── screens/       # Screen components
│   ├── store/         # State management (Zustand)
│   ├── services/      # Business logic services
│   ├── utils/         # Utilities and helpers
│   ├── navigation/    # Navigation configuration
│   └── types/         # TypeScript types
├── App.tsx            # App entry point
├── package.json       # Dependencies
└── tsconfig.json      # TypeScript configuration
```

## Current Status

✅ Project structure created
✅ Navigation setup (bottom tabs + stack navigation)
✅ Theme configuration (dark/light)
✅ State management (Zustand)
✅ Screen stubs created
✅ TypeScript configuration

## Next Steps

1. **Install dependencies**: Run `npm install` to resolve TypeScript errors
2. **Configure API**: Set your PC's IP address in `.env` file
3. **Test the app**: Run `npm start` and verify the app loads
4. **Implement API client**: Create API client to communicate with FastAPI backend
5. **Implement screens**: Add real data and functionality to screens
6. **Add offline sync**: Integrate mesh sync coordinator
7. **Add UI components**: Create reusable components (cards, badges, etc.)

## Troubleshooting

### TypeScript Errors After Installation

If you still see TypeScript errors after running `npm install`, try:

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

### Metro Bundler Issues

```bash
# Clear Metro cache
npx expo start -c
```

### Android Build Issues

```bash
# Clean Android build
cd android
./gradlew clean
cd ..
npm run android
```

### iOS Build Issues (macOS only)

```bash
# Clean iOS build
cd ios
pod install
cd ..
npm run ios
```

## Development Workflow

1. Make changes to code
2. Hot reload will automatically update the app
3. For navigation changes, you may need to restart the bundler
4. Test on both Android and iOS if possible

## API Integration

The mobile app will communicate with your existing FastAPI backend. The API client is configured in `src/api/client.ts` and will use the endpoints defined in `src/api/endpoints.ts`.

## Offline Sync

The mesh sync coordinator from the PC version can be adapted for mobile use. The sync logic is in `lab_app/database/mesh_sync_coordinator.py` and can be ported to TypeScript/JavaScript for the mobile app.
