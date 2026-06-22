# Lab R&D Operating System

A comprehensive local-first laboratory management system with cloud synchronization and mobile access.

## Features

- **Local-first architecture** - SQLite database on lab PCs with offline capability
- **Mesh synchronization** - Decentralized peer-to-peer sync across multiple lab PCs via Backblaze B2
- **Supabase mirroring** - Structured data mirror for mobile access and backup
- **Mobile app** - React Native app for remote access and note creation
- **Instapods Hub** - Cloud coordinator for continuous sync and mobile note ingestion
- **Knowledge vault** - Document repository with semantic search
- **Engineering notebook** - Rich text notes with attachments
- **Equipment management** - Calibration tracking and maintenance records
- **Inventory management** - Component tracking with low-stock warnings
- **Findings repository** - Discoveries, problems, and solutions
- **AI assistant** - Gemini-powered lab assistant (optional)

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Lab PC #1     │         │   Instapods Hub   │         │   Lab PC #2     │
│                 │         │  (Always-on)      │         │                 │
│  SQLite DB      │◄────────┤  Mesh Sync       │────────►│  SQLite DB      │
│  Mesh Sync      │  B2     │  Coordinator     │  B2     │  Mesh Sync      │
│  Supabase Mirror│         │  Supabase Mirror │         │  Supabase Mirror│
└────────┬────────┘         └────────┬──────────┘         └────────┬────────┘
         │                            │                            │
         │ Supabase                   │ Supabase                   │ Supabase
         ▼                            ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Supabase PostgreSQL                             │
│                    (Structured Data Mirror)                                │
└─────────────────────────────────────────────────────────────────────────┘
         ▲                            ▲
         │ Supabase                   │ B2 (Signed URLs)
         │                            │
┌────────┴────────┐         ┌────────┴────────┐
│  Mobile App     │────────►│  Instapods Hub  │
│  (React Native) │  Upload │  /upload        │
│  - Read data    │────────►│  /signed-url    │
│  - Create notes │ Download│                 │
│  - Upload files│────────►│                 │
│  - Download files│         │                 │
└─────────────────┘         └─────────────────┘
```

## Installation

### Prerequisites

- Python 3.9+
- Node.js 18+ (for mobile app)
- Backblaze B2 account(s)
- Supabase account

### Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Run the application
python start_web_app.py
```

### Mobile App Setup

```bash
cd mobile
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

### Instapods Hub Deployment

See `docs/INSTAPODS_NATIVE_DEPLOY.md` for detailed deployment instructions.

## Documentation

- `docs/DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `docs/ENV_SETUP.md` - Environment variables documentation
- `docs/INSTAPODS_HUB.md` - Instapods Hub documentation
- `docs/INSTAPODS_NATIVE_DEPLOY.md` - Instapods native deployment guide
- `docs/INSTAPODS_QUICKSTART.md` - Quick start for Instapods
- `docs/MOBILE_CHANGES.md` - Mobile app integration guide

## License

Proprietary - Lab R&D Operating System 
