# Environment Variables Setup Guide

This document describes all environment variables required for the three-tier Lab R&D Operating System architecture.

## Overview

The system consists of three tiers:
1. **Lab PCs** - Heavy Python desktop app with local SQLite and mesh sync
2. **Instapods Hub** - Cloud-hosted Python/FastAPI server (always-on)
3. **Mobile** - React Native app for remote access

## Lab PCs (.env or config file)

These environment variables are required on each lab workstation running the mesh sync coordinator.

### Backblaze B2 Configuration (Dual-Account for 20GB Free Tier Maximization)

```bash
# Account #1 - Heavy Storage Bucket (files >= 50MB)
B2_ACCOUNT1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_ACCOUNT1_KEY_ID=your_account1_key_id
B2_ACCOUNT1_APPLICATION_KEY=your_account1_application_key
B2_ACCOUNT1_BUCKET=lab-heavy-storage

# Account #2 - Light Storage Bucket (files < 50MB and sync bundles)
B2_ACCOUNT2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_ACCOUNT2_KEY_ID=your_account2_key_id
B2_ACCOUNT2_APPLICATION_KEY=your_account2_application_key
B2_ACCOUNT2_BUCKET=lab-light-storage
```

### Supabase Configuration (for mirroring)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### Database Configuration

```bash
DATABASE_PATH=local_cache.db
```

### Optional: Legacy Single-Account B2 Configuration

If you're using the legacy single-account setup (not recommended for new deployments):

```bash
B2_ENDPOINT_URL=https://s3.us-east-005.backblazeb2.com
B2_ACCESS_KEY_ID=your_key_id
B2_SECRET_ACCESS_KEY=your_secret_key
B2_BUCKET=your_bucket_name
```

---

## Instapods Hub (Server Environment Variables)

These environment variables are required on the Instapods cloud server running `instapods_hub.py`.

### All Lab PC Variables

Instapods Hub requires all the same variables as Lab PCs (B2 and Supabase configuration).

### Instapods-Specific Configuration

```bash
# Device ID for the hub (fixed value)
INSTAPODS_DEVICE_ID=INSTAPODS_HUB

# FastAPI Server Configuration
INSTAPODS_HOST=0.0.0.0
INSTAPODS_PORT=8001

# JWT Secret for signed URL endpoint authentication
JWT_SECRET=your_jwt_secret_here
```

### Complete Instapods .env Example

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

---

## React Native (.env)

These environment variables are required for the mobile app.

### Supabase Configuration

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Instapods Hub Configuration

```bash
EXPO_PUBLIC_INSTAPODS_URL=https://your-instapods-domain.com
```

### Complete React Native .env Example

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_INSTAPODS_URL=https://your-instapods-domain.com
```

---

## Getting Credentials

### Backblaze B2 Credentials

1. Sign up at https://www.backblaze.com/b2/cloud-storage.html
2. Create two separate B2 accounts (for dual-account 20GB free tier maximization)
3. For each account:
   - Create an Application Key
   - Note the Key ID and Application Key
   - Create a bucket (e.g., `lab-heavy-storage` and `lab-light-storage`)
   - Note the bucket name and endpoint URL

### Supabase Credentials

1. Sign up at https://supabase.com
2. Create a new project
3. Go to Project Settings > API
4. Copy:
   - Project URL (SUPABASE_URL)
   - anon/public key (SUPABASE_ANON_KEY for mobile)
   - service_role key (SUPABASE_SERVICE_KEY for server-side)
5. Run the migration file `supabase/migrations/001_initial_schema.sql` in the SQL Editor

### JWT Secret

Generate a secure random string for JWT authentication:

```bash
# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Using OpenSSL
openssl rand -base64 32
```

---

## Security Notes

- **Never commit .env files to version control**
- **Use different keys for development and production**
- **Rotate keys regularly**
- **Supabase service_role key has full admin access - keep it secret**
- **JWT secret should be strong and unique**
- **B2 keys should have minimal required permissions**

---

## Testing Configuration

### Lab PCs

```bash
# Test mesh sync coordinator
python -c "from lab_app.database.mesh_sync_coordinator import MeshSyncCoordinator; coord = MeshSyncCoordinator(); print('Mesh sync initialized')"

# Test Supabase connection
python -c "from supabase import create_client; import os; client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY')); print('Supabase connected')"
```

### Instapods Hub

```bash
# Run the hub
python instapods_hub.py

# Test health endpoint
curl http://localhost:8001/health

# Test signed URL endpoint (with JWT)
curl -H "Authorization: Bearer YOUR_JWT_SECRET" "http://localhost:8001/signed-url?filename=test.txt"
```

### Mobile

```bash
# Test Supabase connection from React Native
# (This would be done in the app code)
```

---

## Troubleshooting

### Common Issues

1. **B2 Connection Failed**
   - Verify endpoint URL format
   - Check key ID and application key
   - Ensure bucket exists and is accessible

2. **Supabase Mirroring Disabled**
   - Check SUPABASE_URL and SUPABASE_SERVICE_KEY are set
   - Verify Supabase project is active
   - Check network connectivity

3. **Mobile Notes Not Syncing**
   - Verify Instapods Hub is running
   - Check Supabase notebook_entries table has source='mobile' records
   - Ensure mobile app is using correct Supabase credentials

4. **JWT Authentication Failed**
   - Verify JWT_SECRET matches between Instapods Hub and mobile app
   - Check Authorization header format: `Bearer <token>`

---

## File Locations

- **Lab PCs**: `.env` in project root or `lab_app/` directory
- **Instapods**: Server environment variables or `.env` in deployment directory
- **Mobile**: `.env` in React Native project root (use EXPO_PUBLIC_ prefix for Expo)

---

## Additional Resources

- [Backblaze B2 Documentation](https://www.backblaze.com/b2/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Environment Variables](https://fastapi.tiangolo.com/advanced/settings/)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
