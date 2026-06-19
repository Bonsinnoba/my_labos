# Sync Architecture Implementation

## Overview

This document describes the implemented sync architecture that enables:
1. **Lab computers** to sync to the cloud and between themselves (mesh network)
2. **Mobile devices** to fetch data directly from the cloud (not from lab computers)
3. **Data accessibility** from anywhere with internet connection

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Backblaze B2 Cloud                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Account 1: lab-heavy-storage (files >= 50MB)           │  │
│  │  Account 2: lab-light-storage (files < 50MB)            │  │
│  │  Mesh Sync Bucket: lab-mesh-sync (transactions)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│ Lab Computer 1 │  │ Lab Computer 2 │  │ Lab Computer N │
│                │  │                │  │                │
│ - Local DB     │  │ - Local DB     │  │ - Local DB     │
│ - Mesh Sync    │  │ - Mesh Sync    │  │ - Mesh Sync    │
│ - Cloud Sync   │  │ - Cloud Sync   │  │ - Cloud Sync   │
│ - API Server   │  │ - API Server   │  │ - API Server   │
└────────────────┘  └────────────────┘  └────────────────┘
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                    Peer-to-Peer Mesh Sync
                    (Transaction Deltas)
                              │
                              ▼
        ┌──────────────────────────────────────────────┐
        │              Mobile Device                   │
        │                                              │
        │  - Mobile Cloud API Client                   │
        │  - Direct Cloud Access (B2)                  │
        │  - No local lab computer dependency          │
        │  - Works from anywhere with internet         │
        └──────────────────────────────────────────────┘
```

## Implementation Details

### 1. Lab Computer Mesh Sync

**File**: `lab_app/database/mesh_sync_coordinator.py`

The mesh sync coordinator enables peer-to-peer synchronization between lab computers:

- **Transaction Logging**: Every data mutation (INSERT, UPDATE, DELETE) is logged to the `mesh_transactions` table
- **Cloud Storage**: Transactions are uploaded to Backblaze B2 as compressed JSON bundles
- **Conflict Resolution**: Uses Last-Write-Wins with timestamp + device_origin tiebreaker
- **Automatic Sync**: Background sync loop runs every 7.5 seconds
- **Offline Support**: Transactions are queued locally when offline, synced when online

**API Endpoints** (in `lab_app/api_server.py`):
- `GET /api/mesh/status` - Get mesh sync status
- `POST /api/mesh/trigger` - Manually trigger mesh sync
- `GET /api/mesh/transactions` - Get pending transactions
- `POST /api/mesh/register-device` - Register a device for garbage collection

### 2. Mobile Cloud API

**File**: `lab_app/database/mobile_cloud_api.py`

The mobile cloud API provides direct cloud access for mobile devices:

- **Transaction Fetching**: Mobile devices can fetch transactions directly from B2
- **Database Snapshots**: Mobile devices can fetch the latest database state
- **File URLs**: Mobile devices can get public URLs for cloud-stored files
- **Mobile Push**: Mobile devices can push their own transactions to cloud

**API Endpoints** (in `lab_app/api_server.py`):
- `GET /api/mobile/cloud-status` - Get mobile cloud API status
- `GET /api/mobile/transactions` - Get transactions from cloud
- `GET /api/mobile/db-snapshot` - Get latest database snapshot
- `GET /api/mobile/file-url` - Get public URL for a file
- `POST /api/mobile/push-transaction` - Push transaction from mobile to cloud

### 3. Mobile App Integration

**Files**: 
- `mobile/src/services/api/mobileCloud.ts` - Mobile cloud API client
- `mobile/src/services/sync/syncService.ts` - Updated to use cloud API

The mobile app now:
- **Prioritizes Cloud API**: Tries cloud API first, falls back to local lab API
- **Direct Cloud Access**: Fetches data directly from B2 without lab computer dependency
- **Seamless Fallback**: Automatically falls back to local API if cloud unavailable
- **Type Safety**: Proper TypeScript types for cloud API responses

## Configuration

### Lab Computer Environment Variables

Add to `.env` file:

```bash
# Cloud Sync Configuration (Backblaze B2)
ACCOUNT_1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_1_KEY_ID=your_account_1_key_id_here
ACCOUNT_1_APPLICATION_KEY=your_account_1_application_key_here
ACCOUNT_1_BUCKET=lab-light-storage

ACCOUNT_2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_2_KEY_ID=your_account_2_key_id_here
ACCOUNT_2_APPLICATION_KEY=your_account_2_application_key_here
ACCOUNT_2_BUCKET=lab-heavy-storage

# Mesh Sync Configuration
MESH_SYNC_BUCKET=lab-mesh-sync
```

### Mobile App Environment Variables

Add to `mobile/.env` file:

```bash
# Cloud API Configuration
EXPO_PUBLIC_CLOUD_API_URL=http://YOUR_CLOUD_API_URL:8000
CLOUD_API_URL=http://YOUR_CLOUD_API_URL:8000

# Fallback to local lab API
EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_IP:8000
API_BASE_URL=http://YOUR_PC_IP:8000

# Backblaze B2 Configuration
EXPO_PUBLIC_ACCOUNT_2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
ACCOUNT_2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
EXPO_PUBLIC_ACCOUNT_2_KEY_ID=your_account_2_key_id_here
ACCOUNT_2_KEY_ID=your_account_2_key_id_here
EXPO_PUBLIC_ACCOUNT_2_APPLICATION_KEY=your_account_2_application_key_here
ACCOUNT_2_APPLICATION_KEY=your_account_2_application_key_here
EXPO_PUBLIC_ACCOUNT_2_BUCKET=lab-heavy-storage
ACCOUNT_2_BUCKET=lab-heavy-storage

# Mesh Sync Configuration
EXPO_PUBLIC_MESH_SYNC_BUCKET=lab-mesh-sync
MESH_SYNC_BUCKET=lab-mesh-sync
```

## Setup Instructions

### 1. Backblaze B2 Setup

1. Create two Backblaze B2 accounts (for 20GB free tier maximization)
2. Create buckets:
   - `lab-light-storage` (Account 2) - for files < 50MB
   - `lab-heavy-storage` (Account 1) - for files >= 50MB
   - `lab-mesh-sync` (Account 2) - for mesh transactions
3. Generate application keys for each account
4. Configure environment variables with credentials

### 2. Lab Computer Setup

1. Update `.env` file with B2 credentials
2. Start the lab app server:
   ```bash
   cd lab_app
   python api_server.py
   ```
3. Verify mesh sync is running:
   ```bash
   curl http://localhost:8000/api/mesh/status
   ```

### 3. Mobile App Setup

1. Update `mobile/.env` file with B2 credentials
2. Set `EXPO_PUBLIC_CLOUD_API_URL` to your cloud-hosted API endpoint
3. Start the mobile app:
   ```bash
   cd mobile
   npm start
   ```

### 4. Cloud API Setup (Optional)

For true cloud access, deploy the API server to a cloud service:
- **Option 1**: Use a cloud VM (AWS EC2, DigitalOcean, etc.)
- **Option 2**: Use serverless functions (AWS Lambda, Cloudflare Workers)
- **Option 3**: Use a PaaS (Render, Railway, etc.)

The mobile app will then use the cloud API URL instead of the local lab computer IP.

## Testing the Sync Flow

### Test 1: Lab Computer Mesh Sync

1. Start the lab app server on two different computers
2. Make a change on Computer 1 (e.g., add a project)
3. Wait 7.5 seconds for sync
4. Check Computer 2 - the change should appear
5. Verify with API:
   ```bash
   curl http://localhost:8000/api/mesh/transactions
   ```

### Test 2: Cloud Sync

1. Make a change on a lab computer
2. Wait for cloud sync (5 minutes by default, or trigger manually)
3. Check B2 bucket - transaction file should be uploaded
4. Trigger manual sync:
   ```bash
   curl -X POST http://localhost:8000/api/sync/trigger
   ```

### Test 3: Mobile Cloud Access

1. Ensure mobile app has cloud API credentials configured
2. Start mobile app
3. Mobile app should fetch data from cloud API
4. Verify cloud status:
   ```bash
   curl http://YOUR_CLOUD_API_URL:8000/api/mobile/cloud-status
   ```

### Test 4: End-to-End Sync

1. Make a change on Lab Computer 1
2. Wait for mesh sync to propagate to Lab Computer 2
3. Wait for cloud sync to upload to B2
4. Open mobile app
5. Mobile app should fetch the change from cloud
6. Verify mobile app shows the same data as lab computers

## Troubleshooting

### Mesh Sync Not Working

- Check B2 credentials in `.env`
- Verify `MESH_SYNC_BUCKET` exists in B2
- Check logs: `[mesh]` prefix messages
- Ensure network connectivity

### Mobile Cloud Access Not Working

- Check mobile app `.env` has correct B2 credentials
- Verify `EXPO_PUBLIC_CLOUD_API_URL` is set correctly
- Check mobile app logs for `[MobileCloudAPI]` messages
- Ensure cloud API server is accessible from mobile device

### Transactions Not Syncing

- Check transaction logs in database: `SELECT * FROM mesh_transactions`
- Verify B2 bucket has transaction files
- Check device IDs are unique per computer
- Review conflict resolution logs

## Benefits

1. **Offline Support**: Lab computers work offline, sync when online
2. **Peer-to-Peer**: Lab computers sync directly with each other
3. **Cloud Backup**: All data backed up to cloud
4. **Mobile Access**: Mobile devices access data from anywhere
5. **Conflict Resolution**: Automatic conflict resolution with Last-Write-Wins
6. **Scalable**: Add unlimited lab computers to the mesh
7. **Cost-Effective**: Uses dual B2 accounts for 40GB free storage

## Security Considerations

- All files encrypted with AES-256-GCM before upload
- B2 credentials should be kept secure
- Use environment variables, never hardcode credentials
- Consider adding authentication for cloud API endpoints
- Implement rate limiting for public API endpoints

## Future Enhancements

- Add real-time sync with WebSocket connections
- Implement delta compression for faster sync
- Add mobile-to-lab sync (mobile changes propagate to lab)
- Implement selective sync (sync only specific data)
- Add sync analytics and monitoring dashboard
- Implement conflict resolution UI for manual resolution
