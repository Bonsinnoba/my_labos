# Instapods Hub

Standalone cloud hub for Lab R&D Operating System mesh synchronization.

## Features

- Mesh sync coordination with B2
- Supabase mirroring
- Mobile note ingestion
- File upload/download via signed URLs
- Supabase keep-alive (prevents free tier pausing)

## Deployment

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Backblaze B2 Configuration
B2_ACCOUNT1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_ACCOUNT1_KEY_ID=your_account1_key_id
B2_ACCOUNT1_APPLICATION_KEY=your_account1_application_key
B2_ACCOUNT1_BUCKET=lab-heavy-storage

B2_ACCOUNT2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_ACCOUNT2_KEY_ID=your_account2_key_id
B2_ACCOUNT2_APPLICATION_KEY=your_account2_application_key
B2_ACCOUNT2_BUCKET=lab-light-storage

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Database Configuration
DATABASE_PATH=local_cache.db

# Instapods Hub Configuration
INSTAPODS_DEVICE_ID=INSTAPODS_HUB
INSTAPODS_HOST=0.0.0.0
INSTAPODS_PORT=8001
JWT_SECRET=your_jwt_secret_here
```

### Quick Start

```bash
pip install -r requirements.txt
python instapods_hub.py
```

### Instapods Native Deployment

1. Push this repository to GitHub
2. Connect to Instapods dashboard
3. Configure build settings (Python 3.12)
4. Add environment variables
5. Deploy

## Endpoints

- `GET /health` - Health check (no authentication)
- `GET /signed-url?filename=` - Get B2 signed URL (JWT authentication required)
- `POST /upload` - Upload file to B2 (JWT authentication required)

## Architecture

```
Instapods Hub (Python/FastAPI)
    ↓
Mesh Sync Coordinator
    ↓
B2 (Backblaze B2) - Mesh transactions and files
    ↓
Supabase - Structured data mirror
    ↓
Mobile App (React Native)
```

## License

Part of Lab R&D Operating System
