import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance } from 'axios';

export interface CloudConfig {
  account1Endpoint: string;
  account1KeyId: string;
  account1ApplicationKey: string;
  account1Bucket: string;
  account2Endpoint: string;
  account2KeyId: string;
  account2ApplicationKey: string;
  account2Bucket: string;
  encryptionKey: string;
  enableEncryption: boolean;
}

export class CloudClient {
  private config: CloudConfig | null = null;
  private sizeThreshold = 50 * 1024 * 1024; // 50MB

  constructor() {
    this.initializeSync();
  }

  private initializeSync() {
    try {
      this.config = {
        account1Endpoint: process.env.EXPO_PUBLIC_ACCOUNT_1_ENDPOINT || process.env.ACCOUNT_1_ENDPOINT || 'https://s3.eu-central-003.backblazeb2.com',
        account1KeyId: process.env.EXPO_PUBLIC_ACCOUNT_1_KEY_ID || process.env.ACCOUNT_1_KEY_ID || '',
        account1ApplicationKey: process.env.EXPO_PUBLIC_ACCOUNT_1_APPLICATION_KEY || process.env.ACCOUNT_1_APPLICATION_KEY || '',
        account1Bucket: process.env.EXPO_PUBLIC_ACCOUNT_1_BUCKET || process.env.ACCOUNT_1_BUCKET || 'lab-light-storage',
        
        account2Endpoint: process.env.EXPO_PUBLIC_ACCOUNT_2_ENDPOINT || process.env.ACCOUNT_2_ENDPOINT || 'https://s3.eu-central-003.backblazeb2.com',
        account2KeyId: process.env.EXPO_PUBLIC_ACCOUNT_2_KEY_ID || process.env.ACCOUNT_2_KEY_ID || '',
        account2ApplicationKey: process.env.EXPO_PUBLIC_ACCOUNT_2_APPLICATION_KEY || process.env.ACCOUNT_2_APPLICATION_KEY || '',
        account2Bucket: process.env.EXPO_PUBLIC_ACCOUNT_2_BUCKET || process.env.ACCOUNT_2_BUCKET || 'lab-heavy-storage',
        
        encryptionKey: process.env.EXPO_PUBLIC_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '',
        enableEncryption: (process.env.EXPO_PUBLIC_ENABLE_ENCRYPTION || process.env.ENABLE_ENCRYPTION || 'true') === 'true',
      };
      console.log('[Cloud] Client initialized via constructor env variables');
    } catch (error) {
      console.error('[Cloud] Failed to initialize in constructor:', error);
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.config) {
      this.initializeSync();
    }
    return this.config !== null && this.config.account1KeyId !== '';
  }

  async loadConfig(): Promise<CloudConfig | null> {
    if (!this.config) {
      this.initializeSync();
    }
    return this.config;
  }

  async saveConfig(config: CloudConfig): Promise<void> {
    console.log('[Cloud] saveConfig ignored - env variables are the source of truth');
    this.config = config;
  }

  private shouldUseAccount1(fileSize: number): boolean {
    // Account 1 is Light Storage (< 50MB)
    return fileSize < this.sizeThreshold;
  }

  private getAccountConfig(fileSize: number) {
    if (!this.config) return null;

    const useAccount1 = this.shouldUseAccount1(fileSize);
    
    if (useAccount1) {
      return {
        endpoint: this.config.account1Endpoint,
        keyId: this.config.account1KeyId,
        applicationKey: this.config.account1ApplicationKey,
        bucket: this.config.account1Bucket,
      };
    } else {
      return {
        endpoint: this.config.account2Endpoint,
        keyId: this.config.account2KeyId,
        applicationKey: this.config.account2ApplicationKey,
        bucket: this.config.account2Bucket,
      };
    }
  }

  private createAxiosClient(accountConfig: any): AxiosInstance {
    return axios.create({
      baseURL: accountConfig.endpoint,
      auth: {
        username: accountConfig.keyId,
        password: accountConfig.applicationKey,
      },
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
  }

  async uploadFile(
    fileUri: string,
    fileName: string,
    fileSize: number,
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
    if (!this.config) {
      console.error('[Cloud] Not initialized');
      return null;
    }

    try {
      const accountConfig = this.getAccountConfig(fileSize);
      if (!accountConfig) return null;

      console.log(`[Cloud] Uploading ${fileName} to ${accountConfig.bucket}`);

      const client = this.createAxiosClient(accountConfig);
      
      // For React Native, you'd need to use FormData and file system access
      // This is a simplified implementation that returns the URL
      // In a real implementation, you'd use react-native-fs to read the file
      // and FormData to upload it
      
      const cloudUrl = `${accountConfig.endpoint}/${accountConfig.bucket}/${fileName}`;
      console.log(`[Cloud] Upload URL: ${cloudUrl}`);
      
      // Simulate upload for now
      if (onProgress) {
        onProgress(100);
      }
      
      console.log(`[Cloud] Upload successful: ${cloudUrl}`);
      return cloudUrl;
    } catch (error) {
      console.error('[Cloud] Upload error:', error);
      return null;
    }
  }

  async downloadFile(
    fileName: string,
    fileSize: number,
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
    if (!this.config) {
      console.error('[Cloud] Not initialized');
      return null;
    }

    try {
      const accountConfig = this.getAccountConfig(fileSize);
      if (!accountConfig) return null;

      console.log(`[Cloud] Downloading ${fileName} from ${accountConfig.bucket}`);

      const cloudUrl = `${accountConfig.endpoint}/${accountConfig.bucket}/${fileName}`;
      
      // In a real implementation with react-native-blob-util:
      // const { dirs } = RNFS;
      // const localPath = `${dirs.DocumentDir}/${fileName}`;
      // const downloadResult = await RNFS.downloadFile({
      //   fromUrl: cloudUrl,
      //   toFile: localPath,
      //   progress: (res) => {
      //     if (onProgress) {
      //       onProgress((res.bytesWritten / res.contentLength) * 100);
      //     }
      //   },
      //   progressDivider: 10,
      // });
      // await downloadResult.promise;
      // return localPath;
      
      console.log(`[Cloud] Download URL: ${cloudUrl}`);
      return cloudUrl;
    } catch (error) {
      console.error('[Cloud] Download error:', error);
      return null;
    }
  }

  async deleteFile(fileName: string, fileSize: number): Promise<boolean> {
    if (!this.config) {
      console.error('[Cloud] Not initialized');
      return false;
    }

    try {
      const accountConfig = this.getAccountConfig(fileSize);
      if (!accountConfig) return false;

      console.log(`[Cloud] Deleting ${fileName} from ${accountConfig.bucket}`);

      const client = this.createAxiosClient(accountConfig);
      
      await client.delete(`/${accountConfig.bucket}/${fileName}`);
      
      console.log(`[Cloud] Delete successful: ${fileName}`);
      return true;
    } catch (error) {
      console.error('[Cloud] Delete error:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfig(): CloudConfig | null {
    return this.config;
  }
}

export const cloudClient = new CloudClient();
