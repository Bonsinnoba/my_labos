import axios, { AxiosInstance } from 'axios';

export interface MobileCloudConfig {
  cloudApiUrl: string;
  account2Endpoint: string;
  account2KeyId: string;
  account2ApplicationKey: string;
  meshSyncBucket: string;
}

export interface MeshTransaction {
  tx_id: string;
  table_name: string;
  operation: string;
  payload: any;
  timestamp: number;
  device_origin: string;
}

export class MobileCloudApiClient {
  private client: AxiosInstance;
  private config: MobileCloudConfig;

  constructor(config: MobileCloudConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.cloudApiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getCloudStatus(): Promise<any> {
    try {
      const response = await this.client.get('/api/mobile/cloud-status');
      return response.data;
    } catch (error) {
      console.error('[MobileCloudAPI] Error getting cloud status:', error);
      throw error;
    }
  }

  async getTransactions(sinceTimestamp?: number): Promise<{ transactions: MeshTransaction[]; count: number }> {
    try {
      const params = sinceTimestamp ? { since_timestamp: sinceTimestamp } : {};
      const response = await this.client.get('/api/mobile/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('[MobileCloudAPI] Error getting transactions:', error);
      throw error;
    }
  }

  async getDbSnapshot(): Promise<any> {
    try {
      const response = await this.client.get('/api/mobile/db-snapshot');
      return response.data;
    } catch (error) {
      console.error('[MobileCloudAPI] Error getting DB snapshot:', error);
      throw error;
    }
  }

  async getFileUrl(fileName: string, fileSize: number): Promise<{ url: string }> {
    try {
      const response = await this.client.get('/api/mobile/file-url', {
        params: { file_name: fileName, file_size: fileSize }
      });
      return response.data;
    } catch (error) {
      console.error('[MobileCloudAPI] Error getting file URL:', error);
      throw error;
    }
  }

  async pushTransaction(transaction: Partial<MeshTransaction>): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post('/api/mobile/push-transaction', transaction);
      return response.data;
    } catch (error) {
      console.error('[MobileCloudAPI] Error pushing transaction:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(this.config.account2KeyId && this.config.account2ApplicationKey);
  }
}

// Create singleton instance from environment variables
const createMobileCloudApiClient = (): MobileCloudApiClient | null => {
  const cloudApiUrl = process.env.EXPO_PUBLIC_CLOUD_API_URL || process.env.CLOUD_API_URL;
  const account2Endpoint = process.env.EXPO_PUBLIC_ACCOUNT_2_ENDPOINT || process.env.ACCOUNT_2_ENDPOINT;
  const account2KeyId = process.env.EXPO_PUBLIC_ACCOUNT_2_KEY_ID || process.env.ACCOUNT_2_KEY_ID;
  const account2ApplicationKey = process.env.EXPO_PUBLIC_ACCOUNT_2_APPLICATION_KEY || process.env.ACCOUNT_2_APPLICATION_KEY;
  const meshSyncBucket = process.env.EXPO_PUBLIC_MESH_SYNC_BUCKET || process.env.MESH_SYNC_BUCKET;

  if (!cloudApiUrl || !account2KeyId || !account2ApplicationKey) {
    console.log('[MobileCloudAPI] Cloud API credentials not configured');
    return null;
  }

  const config: MobileCloudConfig = {
    cloudApiUrl,
    account2Endpoint: account2Endpoint || 'https://s3.us-east-005.backblazeb2.com',
    account2KeyId,
    account2ApplicationKey,
    meshSyncBucket: meshSyncBucket || 'lab-mesh-sync',
  };

  return new MobileCloudApiClient(config);
};

export const mobileCloudApiClient = createMobileCloudApiClient();
export default mobileCloudApiClient;
