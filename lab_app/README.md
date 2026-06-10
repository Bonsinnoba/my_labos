# Lab Inventory & Research Logs Application

A cross-platform (Desktop and Mobile) application for R&D labs to track tool inventory and document research logs with heavy data analysis.

## Architecture: Sync & Cache (Local-First)

- **Local SQLite Cache**: All structured text data cached locally for offline access
- **Cloud Sync**: Asynchronous sync with PostgreSQL (e.g., Supabase)
- **Lazy Loading**: Heavy attachments (CSV, images) downloaded on-demand only

## Tech Stack

- **Frontend**: Flet (Python-based Flutter framework)
- **Data Analysis**: Pandas, NumPy
- **Database**: SQLite (local cache)

## Project Structure

```
lab_app/
├── database/
│   ├── cache_db.py       # Local SQLite storage operations
│   └── sync_engine.py     # Cloud sync logic (to be implemented)
├── analysis/
│   ├── data_processor.py # Data loading & statistics
│   └── chart_generator.py # Visualization (to be implemented)
└── ui/
    ├── main.py           # Application entry point
    ├── inventory_view.py  # Inventory UI (to be implemented)
    └── rd_analysis_view.py # Analysis UI (to be implemented)
```

## Installation

```bash
pip install -r requirements.txt
```

## Running the Application

### Test Database Module
```bash
python lab_app/database/cache_db.py
```

### Test Data Processor
```bash
python lab_app/analysis/data_processor.py
```

### Run Main Application
```bash
python lab_app/ui/main.py
```

## Features Implemented

### 1. Database (`cache_db.py`)
- SQLite database with `equipment` and `rd_logs` tables
- Full CRUD operations for both tables
- Offline-first design with timestamp tracking
- Context manager support for safe connection handling

### 2. Data Processor (`data_processor.py`)
- Lazy loading from cloud storage
- Mock download simulation (replace with actual cloud SDK)
- Pandas-based statistical analysis (mean, max, min, std, median)
- Support for CSV, Excel, JSON, Parquet formats
- Local caching of downloaded files

### 3. Main UI (`main.py`)
- Flet-based cross-platform UI
- Sidebar navigation (Inventory / R&D Analysis)
- Offline/Online status indicator with cloud icon
- Toggle connection button for testing offline mode
- Sample inventory table and research log cards

## Next Steps

1. Implement `database/sync_engine.py` for cloud sync logic
2. Implement `analysis/chart_generator.py` for data visualization
3. Create dedicated view modules (`inventory_view.py`, `rd_analysis_view.py`)
4. Integrate actual cloud storage SDK (Supabase, AWS S3, etc.)
5. Add authentication and user management
6. Implement real-time sync status indicators
