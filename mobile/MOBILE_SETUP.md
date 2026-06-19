# Mobile App Setup Instructions

## Step 1: Create .env File

Create a `.env` file in the `mobile` directory with the following configuration:

```bash
# API Configuration
API_BASE_URL=http://192.168.100.5:8000
API_TIMEOUT=30000

# Sync Configuration
SYNC_INTERVAL=7500
DEVICE_ID=MOBILE_DEVICE_01

# Backblaze B2 Configuration (Dual-Account for 20GB Free Tier Maximization)
# Account #1 - Light Storage Bucket (files < 50MB)
ACCOUNT_1_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_1_KEY_ID=your_account_1_key_id_here
ACCOUNT_1_APPLICATION_KEY=your_account_1_application_key_here
ACCOUNT_1_BUCKET=lab-light-storage

# Account #2 - Heavy Storage Bucket (files >= 50MB)
ACCOUNT_2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
ACCOUNT_2_KEY_ID=your_account_2_key_id_here
ACCOUNT_2_APPLICATION_KEY=your_account_2_application_key_here
ACCOUNT_2_BUCKET=lab-heavy-storage

# Encryption Configuration
ENCRYPTION_KEY=your_64_character_hex_key_here
ENABLE_ENCRYPTION=true
```

## Step 2: Update API_BASE_URL

Replace `192.168.100.5` with your PC's actual IP address if different. You can find your IP address by running:
- Windows: `ipconfig`
- Mac/Linux: `ifconfig` or `ip addr`

## Step 3: Configure Backblaze (Optional)

If you want to use cloud sync, replace the placeholder values with your actual Backblaze B2 credentials:
- Get your keys from: https://www.backblaze.com/b2/cloud-storage.html
- Create two buckets: `lab-light-storage` and `lab-heavy-storage`
- Generate application keys for each bucket

## Step 4: Start Desktop API Server

In the `lab_app` directory, run:
```bash
python api_server.py
```

The server will start on `http://0.0.0.0:8000`

## Step 5: Start Mobile App

In the `mobile` directory, run:
```bash
npm start
```

Or for Android:
```bash
npm run android
```

Or for iOS:
```bash
npm run ios
```

## Step 6: Test Connection

The mobile app should now be able to:
- Fetch projects, experiments, resources, and findings from the desktop API
- Sync data between mobile and desktop
- Access engineering calculators and notebook tools
