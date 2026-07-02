import { syncApi, SyncTransaction } from '../api';
import mobileCloudApiClient from '../api/mobileCloud';
import { offlineCache } from '../cache/offlineCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  lastSync: string | null;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: true,
  interval: 300000,
  lastSync: null,
};

export class SyncService {
  private static instance: SyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  private constructor() {
    this.initialize().catch((error) => {
      console.error('[SyncService] Initialization failed:', error);
    });
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private async initialize(): Promise<void> {
    const config = await this.getSyncConfig();
    if (config.enabled) {
      this.startAutoSync();
    }
  }

  async getSyncConfig(): Promise<SyncConfig> {
    try {
      const config = await AsyncStorage.getItem('@sync_config');
      return config ? JSON.parse(config) : DEFAULT_SYNC_CONFIG;
    } catch (error) {
      console.error('Error getting sync config:', error);
      return DEFAULT_SYNC_CONFIG;
    }
  }

  async saveSyncConfig(config: SyncConfig): Promise<void> {
    try {
      await AsyncStorage.setItem('@sync_config', JSON.stringify(config));
    } catch (error) {
      console.error('Error saving sync config:', error);
    }
  }

  async syncNow(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;

      let transactions: any[] = [];

      // Only use cloud API - no lab computer fallback
      if (mobileCloudApiClient && mobileCloudApiClient.isConfigured()) {
        console.log('[SyncService] Using cloud API for sync');
        try {
          // Get last sync timestamp for difference detection
          const cachedData = await offlineCache.getWithTimestamp<{ lastSyncTimestamp: number }>('sync_metadata');
          const sinceTimestamp = cachedData?.timestamp || 0;

          const cloudResponse = await mobileCloudApiClient.getTransactions(sinceTimestamp);
          transactions = cloudResponse.transactions;
          console.log(`[SyncService] Fetched ${transactions.length} transactions from cloud since ${sinceTimestamp}`);

          // Cache transactions for offline use
          if (transactions.length > 0) {
            await offlineCache.set('transactions', transactions);
            await offlineCache.set('sync_metadata', { lastSyncTimestamp: Date.now() });
            console.log('[SyncService] Cached transactions for offline use');
          }
        } catch (cloudError) {
          console.error('[SyncService] Cloud API sync failed:', cloudError);
          // Return cached data if available
          const cachedTransactions = await offlineCache.get<any[]>('transactions');
          if (cachedTransactions && cachedTransactions.length > 0) {
            console.log('[SyncService] Using cached transactions (offline mode)');
            return {
              success: true,
              message: `Using ${cachedTransactions.length} cached transactions (offline mode)`
            };
          }
          return { success: false, message: 'Cloud sync failed - check internet connection' };
        }
      } else {
        console.error('[SyncService] Cloud API not configured');
        return { success: false, message: 'Cloud API not configured - add B2 credentials' };
      }

      // Update last sync time
      const config = await this.getSyncConfig();
      config.lastSync = new Date().toISOString();
      await this.saveSyncConfig(config);

      return {
        success: true,
        message: `Synced ${transactions.length} transactions from cloud`
      };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, message: 'Sync failed' };
    } finally {
      this.isSyncing = false;
    }
  }

  async pushTransaction(transaction: Partial<SyncTransaction>): Promise<SyncTransaction | null> {
    try {
      // Only use cloud API - no lab computer fallback
      if (mobileCloudApiClient && mobileCloudApiClient.isConfigured()) {
        console.log('[SyncService] Pushing transaction to cloud');
        try {
          // Convert timestamp to number for cloud API
          const cloudTransaction = {
            ...transaction,
            timestamp: transaction.timestamp ? new Date(transaction.timestamp).getTime() : Date.now()
          };
          const result = await mobileCloudApiClient.pushTransaction(cloudTransaction);
          if (result.success) {
            console.log('[SyncService] Transaction pushed to cloud successfully');
            return transaction as SyncTransaction;
          } else {
            console.error('[SyncService] Cloud API push returned failure');
            return null;
          }
        } catch (cloudError) {
          console.error('[SyncService] Cloud API push failed:', cloudError);
          return null;
        }
      } else {
        console.error('[SyncService] Cloud API not configured');
        return null;
      }
    } catch (error) {
      console.error('Error pushing transaction:', error);
      return null;
    }
  }

  startAutoSync(): void {
    this.getSyncConfig().then((config) => {
      if (config.enabled && config.interval > 0) {
        this.syncInterval = setInterval(() => {
          this.syncNow();
        }, config.interval);
      }
    });
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async updateSyncInterval(interval: number): Promise<void> {
    const config = await this.getSyncConfig();
    config.interval = interval;
    await this.saveSyncConfig(config);
    
    // Restart auto sync with new interval
    this.stopAutoSync();
    if (config.enabled) {
      this.startAutoSync();
    }
  }

  async toggleSync(enabled: boolean): Promise<void> {
    const config = await this.getSyncConfig();
    config.enabled = enabled;
    await this.saveSyncConfig(config);

    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

export const syncService = SyncService.getInstance();
