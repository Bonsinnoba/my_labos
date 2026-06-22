# Lab Inventory & Research Logs Application

A cross-platform (Desktop and Mobile) application for R&D labs to track tool inventory and document research logs with heavy data analysis.

## Architecture: Sync & Cache (Local-First)

- **Local SQLite Cache**: All structured text data cached locally for offline access
- **Cloud Sync**: Asynchronous sync with PostgreSQL (e.g., Supabase)
- **Lazy Loading**: Heavy attachments (CSV, images) downloaded on-demand only

## Tech Stack

- **Backend**: Python FastAPI
- **Frontend**: Web UI (HTML/CSS/JavaScript) served by FastAPI
- **Desktop**: Electron with embedded Python backend
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
├── web/
│   ├── templates/        # HTML templates
│   └── static/          # CSS, JavaScript, images
└── voice/
    ├── listener.py      # Voice command recognition
    └── interpreter.py   # Voice command processing
```

## Installation

```bash
pip install -r requirements.txt
```

## Running the Application

### Start Web Server
```bash
python start_web_app.py
```

### Start Desktop App (Electron)
```bash
cd electron-app
npm start
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

### 3. Web UI
- Modern web interface with sidebar navigation
- Offline/Online status indicator
- Full CRUD operations for projects, equipment, research logs
- Data visualization and analysis tools
- Voice command integration

### 4. Desktop App (Electron)
- Native desktop application with embedded Python backend
- Offline-first experience
- Cross-platform support (Windows, macOS, Linux)
- No browser required

## Next Steps

1. Implement `analysis/chart_generator.py` for data visualization
2. Integrate actual cloud storage SDK (Supabase, AWS S3, etc.)
3. Add authentication and user management
4. Implement real-time sync status indicators
5. Add desktop app packaging and distribution
