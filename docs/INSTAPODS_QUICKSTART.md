# Instapods Hub Quick Start Guide

## What I Created For You

1. **deploy_instapods.sh** - Automated deployment script
2. **test_instapods.sh** - Pre-deployment test script
3. **This guide** - Quick reference

## Deployment Steps

### 1. Upload to Instapods Server

```bash
# From your local machine
scp -r instapods_hub.py lab_app requirements.txt deploy_instapods.sh test_instapods.sh user@your-instapods-server:~/lab-instapods/
```

### 2. SSH Into Instapods Server

```bash
ssh user@your-instapods-server
cd ~/lab-instapods
```

### 3. Run Deployment Script

```bash
chmod +x deploy_instapods.sh
./deploy_instapods.sh
```

This will:
- Create deployment directory
- Copy files
- Create virtual environment
- Install dependencies
- Create .env template
- Create systemd service file

### 4. Configure Environment Variables

```bash
nano ~/lab-instapods/.env
```

Replace placeholder values with your actual credentials:
- B2 keys and bucket names
- Supabase URL and service key
- JWT_SECRET (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)

### 5. Run Test Script

```bash
chmod +x test_instapods.sh
./test_instapods.sh
```

This verifies:
- Python imports work
- Environment variables are set
- MeshSyncCoordinator initializes

### 6. Start Instapods Hub (Manual Test)

```bash
cd ~/lab-instapods
source venv/bin/activate
python instapods_hub.py
```

Press Ctrl+C to stop after verifying it starts successfully.

### 7. Enable Systemd Service (Production)

```bash
sudo systemctl daemon-reload
sudo systemctl enable instapods-hub
sudo systemctl start instapods-hub
sudo systemctl status instapods-hub
```

### 8. Test Endpoints

```bash
# Health check
curl http://localhost:8001/health

# Expected response:
# {"status":"ok","device_id":"INSTAPODS_HUB","last_sync":0,"last_sync_iso":null}
```

### 9. Configure Firewall (If Needed)

```bash
sudo ufw allow 8001/tcp
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -u instapods-hub -f

# Check if port is in use
sudo lsof -i :8001
```

### Environment Variables Not Loading
```bash
# Verify .env file exists and has correct permissions
ls -la ~/lab-instapods/.env
cat ~/lab-instapods/.env
```

### Python Dependencies Missing
```bash
cd ~/lab-instapods
source venv/bin/activate
pip install -r requirements.txt
```

## Next Steps After Deployment

1. **Configure mobile app** with INSTAPODS_URL and JWT_SECRET
2. **Test mobile file upload** to /upload endpoint
3. **Test mobile file download** via /signed-url endpoint
4. **Monitor sync logs** to verify mesh sync is working
5. **Check Supabase** to verify mirroring is working

## Files Deployed

```
~/lab-instapods/
├── instapods_hub.py          # Main application
├── lab_app/                  # Shared module
│   └── database/
│       ├── mesh_sync_coordinator.py
│       ├── cache_db.py
│       └── cloud_sync_engine.py
├── requirements.txt           # Python dependencies
├── venv/                     # Virtual environment
├── .env                      # Environment variables (you configure this)
└── local_cache.db            # SQLite database (created automatically)
```

## Systemd Service Location

```
/etc/systemd/system/instapods-hub.service
```

## Logs Location

```bash
sudo journalctl -u instapods-hub -f
```

## Port Configuration

- **Default**: 8001
- **Change via**: INSTAPODS_PORT in .env
- **Firewall**: Ensure port 8001 is open

## Done!

Your Instapods Hub is now running and will:
- Sync with B2 every 30 seconds
- Mirror to Supabase
- Pull mobile notes
- Serve signed URLs for file downloads
- Accept file uploads from mobile
- Keep Supabase alive every 3 days
