# Lab Inventory & Research Logs Application

A cross-platform (Desktop and Mobile) application for R&D labs to track tool inventory and document research logs with heavy data analysis.

## Architecture: Sync & Cache (Local-First)

- **Local SQLite Cache**: All structured text data cached locally for offline access
- **Cloud Sync**: Asynchronous sync with PostgreSQL (e.g., Supabase)
- **Lazy Loading**: Heavy attachments (CSV, images) downloaded on-demand only

## Tech Stack

- **Backend**: Python FastAPI
- **Desktop**: Electron with embedded Python backend
- **Mobile**: React Native
- **Data Analysis**: Pandas, NumPy
- **Database**: SQLite (local cache)

## Project Structure

```
lab_app/
├── database/
│   ├── cache_db.py       # Local SQLite storage operations
│   └── cloud_sync_engine.py # Cloud sync logic
├── analysis/
│   ├── data_processor.py # Data loading & statistics
│   └── chart_generator.py # Visualization (to be implemented)
└── voice/
    ├── listener.py      # Voice command recognition
    └── interpreter.py   # Voice command processing

electron-app/
├── main.js              # Electron main process
├── preload.js           # Preload script for IPC
└── renderer/            # Electron renderer (UI)

mobile/
├── src/
│   ├── screens/         # React Native screens
│   ├── services/        # API services
│   └── components/      # React Native components
```

## Installation

```bash
pip install -r requirements.txt
```

## Running the Application

### Start Desktop App (Electron)
```bash
cd electron-app
npm start
```

### Start Mobile App (React Native)
```bash
cd mobile
npm install
npx react-native run-android  # or run-ios
```

## Features Implemented

### 1. Database (`cache_db.py`)
- SQLite database with multiple tables (projects, equipment, rd_logs, etc.)
- Full CRUD operations for all tables
- Offline-first design with timestamp tracking
- Context manager support for safe connection handling

### 2. Data Processor (`data_processor.py`)
- Lazy loading from cloud storage
- Mock download simulation (replace with actual cloud SDK)
- Pandas-based statistical analysis (mean, max, min, std, median)
- Support for CSV, Excel, JSON, Parquet formats
- Local caching of downloaded files

### 3. Desktop App (Electron)
- Native desktop application with embedded Python backend
- Offline-first experience
- Cross-platform support (Windows, macOS, Linux)
- No browser required

### 4. Mobile App (React Native)
- Cross-platform mobile application
- Offline-first with local caching
- Full CRUD operations for projects, equipment, research logs
- Real-time sync with cloud

## Next Steps

1. Implement `analysis/chart_generator.py` for data visualization
2. Integrate actual cloud storage SDK (Supabase, AWS S3, etc.)
3. Add authentication and user management
4. Implement real-time sync status indicators
5. Add desktop app packaging and distribution
6. Add mobile app distribution (Play Store, App Store)
