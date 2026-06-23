# Complete Deployment Guide - Lab R&D Operating System

This guide walks you through setting up the complete three-tier architecture for the Lab R&D Operating System.

## Prerequisites

- Python 3.9+ installed
- Node.js 18+ installed (for React Native mobile app)
- Backblaze B2 account(s)
- Supabase account
- A cloud server for Instapods Hub (or local testing)

---

## Step 1: Set Up Backblaze B2

### 1.1 Create B2 Accounts

For free tier maximization (20GB per account), create two separate B2 accounts:

**Account #1 (Heavy Storage - files >= 50MB)**
1. Sign up at https://www.backblaze.com/b2/cloud-storage.html
2. Go to "Buckets" → "Create a Bucket"
3. Name: `lab-heavy-storage`
4. Files in Bucket: Private
5. Note the bucket name and endpoint URL (e.g., `https://s3.us-east-005.backblazeb2.com`)

**Account #2 (Light Storage - files < 50MB and sync bundles)**
1. Create a second B2 account
2. Go to "Buckets" → "Create a Bucket"
3. Name: `lab-light-storage`
4. Files in Bucket: Private
5. Note the bucket name and endpoint URL

### 1.2 Generate Application Keys

For each account:
1. Go to "App Keys" → "Add a New Application Key"
2. Key Name: `Lab R&D System`
3. Allow access to: `lab-heavy-storage` or `lab-light-storage` bucket
4. Type of Access: `Read and Write`
5. Note the Key ID and Application Key

### 1.3 Add to Environment Variables

Add these to your `.env` file (see ENV_SETUP.md for details):

```bash
# Account #1 - Heavy Storage
ACCOUNT_1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_1_KEY_ID=your_account1_key_id
ACCOUNT_1_APPLICATION_KEY=your_account1_application_key
ACCOUNT_1_BUCKET=lab-heavy-storage

# Account #2 - Light Storage
ACCOUNT_2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_2_KEY_ID=your_account2_key_id
ACCOUNT_2_APPLICATION_KEY=your_account2_application_key
ACCOUNT_2_BUCKET=lab-light-storage
```

---

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Sign up at https://supabase.com
2. Click "New Project"
3. Name: `Lab R&D System`
4. Database Password: Generate a strong password (save it!)
5. Region: Choose closest to your location
6. Wait for project to be ready (2-3 minutes)

### 2.2 Get Credentials

1. Go to Project Settings → API
2. Copy:
   - **Project URL** (e.g., `https://xxxxxxxx.supabase.co`)
   - **anon/public key** (for mobile app)
   - **service_role key** (for server-side - keep secret!)

### 2.3 Run Database Migration

1. Go to SQL Editor in Supabase dashboard
2. Open the file `supabase/migrations/001_initial_schema.sql`
3. Copy the entire content
4. Paste into SQL Editor
5. Click "Run" to execute the migration
6. Verify all tables were created successfully

### 2.4 Add to Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

---

## Step 3: Install Python Dependencies

### 3.1 Update requirements.txt

Add the Supabase Python client to your requirements.txt:

```bash
pip install supabase
```

Or add to requirements.txt:
```
supabase>=2.0.0
```

### 3.2 Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Step 4: Configure Lab PCs

### 4.1 Create .env File

Create a `.env` file in the project root:

```bash
# Backblaze B2 Configuration
ACCOUNT_1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_1_KEY_ID=your_account1_key_id
ACCOUNT_1_APPLICATION_KEY=your_account1_application_key
ACCOUNT_1_BUCKET=lab-heavy-storage

ACCOUNT_2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_2_KEY_ID=your_account2_key_id
ACCOUNT_2_APPLICATION_KEY=your_account2_application_key
ACCOUNT_2_BUCKET=lab-light-storage

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Database Configuration
DATABASE_PATH=local_cache.db
```

### 4.2 Test Mesh Sync Coordinator

```bash
python -c "from lab_app.database.mesh_sync_coordinator import MeshSyncCoordinator; coord = MeshSyncCoordinator(); print('Mesh sync initialized')"
```

Expected output:
```
[mesh_sync] Generated new device ID: LAB_PC_XXXXXX
[mesh_sync] B2 client initialized for bucket: lab-light-storage
[mesh_sync] Supabase client initialized for mirroring
Mesh sync initialized
```

### 4.3 Start the Application

```bash
python start_web_app.py
```

The mesh sync will automatically start in the background and:
- Pull transactions from B2 every 7.5 seconds
- Mirror to Supabase
- Pull mobile notes from Supabase
- Push local transactions to B2
- Keep Supabase alive every 3 days

---

## Step 5: Deploy Instapods Hub

### 5.1 Create .env File for Instapods

Create a `.env` file on the Instapods server:

```bash
# Backblaze B2 Configuration
ACCOUNT_1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_1_KEY_ID=your_account1_key_id
ACCOUNT_1_APPLICATION_KEY=your_account1_application_key
ACCOUNT_1_BUCKET=lab-heavy-storage

ACCOUNT_2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_2_KEY_ID=your_account2_key_id
ACCOUNT_2_APPLICATION_KEY=your_account2_application_key
ACCOUNT_2_BUCKET=lab-light-storage

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Database Configuration
DATABASE_PATH=local_cache.db

# Instapods Hub Configuration
INSTAPODS_DEVICE_ID=INSTAPODS_HUB
INSTAPODS_HOST=0.0.0.0
INSTAPODS_PORT=8001
JWT_SECRET=your_jwt_secret_here
```

### 5.2 Generate JWT Secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output and set it as `JWT_SECRET` in the .env file.

### 5.3 Deploy to Server

Option A: Direct Deployment
```bash
# Copy files to server
scp -r lab_app instapods_hub.py requirements.txt user@your-server:/path/to/deploy/

# SSH into server
ssh user@your-server

# Install dependencies
pip install -r requirements.txt

# Start Instapods Hub
python instapods_hub.py
```

Option B: Using systemd (recommended for production)

Create `/etc/systemd/system/instapods-hub.service`:

```ini
[Unit]
Description=Instapods Hub - Lab R&D Sync Coordinator
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/deploy
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python instapods_hub.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable instapods-hub
sudo systemctl start instapods-hub
sudo systemctl status instapods-hub
```

### 5.4 Test Instapods Hub

```bash
# Test health endpoint
curl http://your-server:8001/health

# Expected response:
# {"status":"ok","device_id":"INSTAPODS_HUB","last_sync":0,"last_sync_iso":null}

# Test signed URL endpoint (with JWT)
curl -H "Authorization: Bearer YOUR_JWT_SECRET" "http://your-server:8001/signed-url?filename=test.txt"
```

---

## Step 6: Set Up React Native Mobile App

### 6.1 Initialize React Native App (if not already done)

```bash
npx create-expo-app lab-mobile-app
cd lab-mobile-app
```

### 6.2 Install Dependencies

```bash
npm install @supabase/supabase-js
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo
```

### 6.3 Create Environment File

Create `.env` in the React Native project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_INSTAPODS_URL=https://your-instapods-domain.com
```

### 6.4 Create API Files

Follow the instructions in `MOBILE_CHANGES.md` to create:
- `lib/supabase.js` - Supabase client initialization
- `lib/api.js` - API functions for data access
- `lib/offlineQueue.js` - Offline queue management

### 6.5 Test Mobile App

```bash
npm start
```

Scan the QR code with Expo Go app on your phone to test.

---

## Step 7: Verify End-to-End Integration

### 7.1 Test Lab PC → Supabase Mirroring

1. On a Lab PC, create a new equipment entry:
```python
from lab_app.database.cache_db import CacheDatabase
db = CacheDatabase()
db.add_equipment("Test Equipment", "Model X", "available")
```

2. Check Supabase dashboard → Table Editor → equipment
3. Verify the new equipment appears there

### 7.2 Test Mobile → Supabase → Mesh Sync

1. On mobile app, create a note:
```javascript
import { createNote } from './lib/api'
await createNote({ title: 'Mobile Test', content: 'Test from phone' })
```

2. Wait 30 seconds for Instapods Hub to pull
3. Check Lab PC local database (should have the note)
4. Check Supabase dashboard → notebook_entries (source should be 'mobile')

### 7.3 Test Mesh Sync Between Lab PCs

1. On Lab PC #1, create a project
2. Wait 15 seconds
3. On Lab PC #2, check if project appears
4. Verify in B2 bucket that sync bundle was uploaded

### 7.4 Test Supabase Keep-Alive

1. Check for `.mesh_supabase_ping_timestamp` file
2. Wait 3 days (or manually set timestamp to trigger)
3. Verify ping executes and updates timestamp

---

## Step 8: Monitor and Maintain

### 8.1 Monitor Instapods Hub

```bash
# Check logs
sudo journalctl -u instapods-hub -f

# Check health
curl http://your-server:8001/health
```

### 8.2 Monitor B2 Storage

Check B2 dashboard for:
- Storage usage (should stay under 20GB per account)
- Sync bundle accumulation
- File upload/download activity

### 8.3 Monitor Supabase

Check Supabase dashboard for:
- Database size
- API usage
- Auth sessions (if using Supabase Auth)

### 8.4 Backup Strategy

- B2 is your backup for mesh transactions
- Supabase has built-in backups (paid tier)
- Consider periodic SQLite database dumps from Lab PCs

---

## Troubleshooting

### Lab PC Issues

**Mesh sync not starting:**
- Check B2 credentials in .env
- Verify network connectivity
- Check logs for error messages

**Supabase mirroring disabled:**
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY
- Check Supabase project is active
- Ensure supabase package is installed

### Instapods Hub Issues

**Hub not starting:**
- Check all environment variables are set
- Verify JWT_SECRET is set
- Check port 8001 is not in use

**Signed URL failing:**
- Verify JWT_SECRET matches between hub and mobile
- Check B2 credentials are correct
- Ensure file exists in B2 bucket

### Mobile App Issues

**Supabase connection failed:**
- Verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
- Check Supabase project is active
- Ensure network connectivity

**Offline queue not flushing:**
- Verify NetInfo is working
- Check network status detection
- Manually call flushQueue() for testing

---

## Security Checklist

- [ ] Never commit .env files to version control
- [ ] Rotate B2 keys regularly
- [ ] Rotate Supabase service_role key if compromised
- [ ] Use strong JWT secret
- [ ] Enable HTTPS for Instapods Hub in production
- [ ] Restrict B2 bucket access to specific IPs if possible
- [ ] Enable Supabase RLS policies (already in migration)
- [ ] Use VPN for Lab PC to Instapods communication if needed

---

## Performance Tuning

### Lab PCs

- Adjust polling interval in mesh_sync_coordinator.py (default 7.5s)
- Increase for less frequent sync, decrease for more real-time

### Instapods Hub

- Adjust sync interval in instapods_hub.py (default 30s)
- Increase to reduce load, decrease for faster mobile sync

### Supabase

- Monitor query performance
- Add indexes as needed for mobile queries
- Consider connection pooling for high traffic

---

## Next Steps

1. **Set up monitoring** - Use Prometheus/Grafana or similar
2. **Add alerting** - Notify on sync failures or storage limits
3. **Implement authentication** - Add user auth to mobile app
4. **Add analytics** - Track usage patterns
5. **Scale as needed** - Add more Lab PCs or upgrade B2/Supabase plans

---

## Support

For issues:
- Check logs in respective services
- Review ENV_SETUP.md for environment variable details
- Review MOBILE_CHANGES.md for mobile app details
- Check Supabase and B2 documentation

---

## Summary of Architecture

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

All components are now wired together and ready for deployment!
