# Instapods Native Deployment Guide

This guide walks you through deploying to Instapods using their native deployment option.

## Prerequisites

- GitHub repository with your code
- Instapods account
- All environment variables ready

## Step 1: Push Code to GitHub

```bash
cd my_lab
git init
git add .
git commit -m "Initial commit with Instapods Hub"
git branch -M main
git remote add origin https://github.com/your-username/my_lab.git
git push -u origin main
```

## Step 2: Connect GitHub to Instapods

1. Log in to your Instapods dashboard
2. Navigate to "Applications" or "Deployments"
3. Click "New Application" or "Deploy from GitHub"
4. Authorize Instapods to access your GitHub account
5. Select the `my_lab` repository
6. Select the `main` branch

## Step 3: Configure Build Settings

### Build Configuration
- **Build Type**: Python
- **Python Version**: 3.12
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python instapods_hub.py`

### Working Directory
- Set to root of repository (or specify if different)

## Step 4: Configure Environment Variables

Add these in Instapods dashboard under "Environment Variables":

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

## Step 5: Configure Port

- Set port to `8001` (or match INSTAPODS_PORT)
- Enable public access if needed for mobile app

## Step 6: Deploy

1. Click "Deploy" or "Create Application"
2. Wait for build to complete
3. Instapods will automatically:
   - Clone your repository
   - Install dependencies
   - Start the application

## Step 7: Verify Deployment

Check the deployment logs and test the health endpoint:

```bash
curl https://your-app.instapods.io/health
```

Expected response:
```json
{
  "status": "ok",
  "device_id": "INSTAPODS_HUB",
  "last_sync": 0,
  "last_sync_iso": null
}
```

## Step 8: Configure Auto-Deploy

Enable automatic deployments on push to main:
- In Instapods dashboard, enable "Auto-deploy on push"
- Now every push to GitHub main branch will trigger a new deployment

## Step 9: Update Mobile App Configuration

Update your mobile app's `.env` with the Instapods URL:

```bash
EXPO_PUBLIC_INSTAPODS_URL=https://your-app.instapods.io
```

## Troubleshooting

### Build Fails
- Check build logs in Instapods dashboard
- Verify Python version matches
- Check requirements.txt has all dependencies

### Application Won't Start
- Check runtime logs
- Verify all environment variables are set
- Check port configuration

### Health Endpoint Fails
- Verify port is accessible
- Check firewall settings
- Verify JWT_SECRET is set

### Environment Variables Not Loading
- Verify variable names match exactly
- Check for typos in values
- Ensure sensitive variables are marked as secret

## Advantages of Native Deployment

- **Automatic builds** on git push
- **Zero-downtime deployments**
- **Built-in monitoring** and logs
- **Automatic SSL** certificates
- **Scaling options** available
- **Easy rollback** to previous versions

## Next Steps

1. Test the deployment thoroughly
2. Set up monitoring alerts
3. Configure custom domain (optional)
4. Set up backup strategy
