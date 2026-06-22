# Lab R&D Desktop App (Electron)

Desktop application for Lab R&D Operating System using Electron with embedded Python backend.

## Architecture

- **Electron** - Desktop app shell
- **Embedded Python** - Backend server bundled with PyInstaller
- **FastAPI** - Python backend serves the web UI
- **SQLite** - Local database
- **Mesh Sync** - Peer-to-peer synchronization

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- PyInstaller

### Install Dependencies

```bash
cd electron-app
npm install
pip install pyinstaller
```

### Run in Development Mode

```bash
npm start
```

This will:
1. Start the Electron app
2. Launch the Python backend (system Python)
3. Load the web UI from http://localhost:8000

## Building for Production

### Step 1: Build Python Backend

```bash
npm run build-python
```

This uses PyInstaller to bundle the Python backend into a single executable.

### Step 2: Build Electron App

```bash
npm run build
```

This creates platform-specific installers in the `dist/` directory.

### Step 3: Distribute

- **Windows**: `dist/Lab R&D Setup.exe`
- **macOS**: `dist/Lab R&D.dmg`
- **Linux**: `dist/Lab R&D.AppImage`

## Features

- **Offline-first** - Works without internet connection
- **Local database** - SQLite for offline storage
- **Mesh sync** - Syncs with other lab PCs when online
- **Desktop experience** - Native desktop app feel
- **Backend restart** - Can restart Python backend from UI

## File Structure

```
electron-app/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── package.json         # Node dependencies
├── build_python.py      # PyInstaller build script
├── renderer/            # UI files
│   ├── index.html
│   ├── styles.css
│   └── renderer.js
├── resources/           # Icons and assets
└── python-dist/         # Bundled Python backend (generated)
```

## Configuration

Environment variables are loaded from the parent directory's `.env` file.

## Troubleshooting

### Backend won't start
- Check that Python is installed
- Verify dependencies are installed in parent directory
- Check logs in Electron DevTools (F12)

### Python build fails
- Ensure PyInstaller is installed: `pip install pyinstaller`
- Check that all Python dependencies are in requirements.txt
- Verify file paths in build_python.py

### App won't start
- Check that python-dist/ exists and contains the bundled backend
- Verify Electron dependencies are installed
- Check platform-specific build configuration

## Next Steps

- [ ] Add app icons for all platforms
- [ ] Implement auto-updater
- [ ] Add crash reporting
- [ ] Optimize bundle size
- [ ] Add offline file caching
