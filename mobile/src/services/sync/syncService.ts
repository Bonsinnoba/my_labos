import { syncApi, SyncTransaction } from '../api';
import mobileCloudApiClient from '../api/mobileCloud';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  lastSync: string | null;
}

export class SyncService {
  private static instance: SyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async getSyncConfig(): Promise<SyncConfig> {
    try {
      const config = await AsyncStorage.getItem('@sync_config');
      return config ? JSON.parse(config) : { enabled: true, interval: 7500, lastSync: null };
    } catch (error) {
      console.error('Error getting sync config:', error);
      return { enabled: true, interval: 7500, lastSync: null };
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
      let updates: any[] = [];

      // Try cloud API first (direct cloud access)
      if (mobileCloudApiClient && mobileCloudApiClient.isConfigured()) {
        console.log('[SyncService] Using cloud API for sync');
        try {
          const cloudResponse = await mobileCloudApiClient.getTransactions();
          transactions = cloudResponse.transactions;
          console.log(`[SyncService] Fetched ${transactions.length} transactions from cloud`);
        } catch (cloudError) {
          console.error('[SyncService] Cloud API sync failed, falling back to desktop API:', cloudError);
        }
      }

      // Fallback to desktop API if cloud not available or failed
      if (transactions.length === 0) {
        console.log('[SyncService] Using desktop API for sync');
        transactions = await syncApi.getTransactions();
        updates = await syncApi.getUpdates();
      }

      // Update last sync time
      const config = await this.getSyncConfig();
      config.lastSync = new Date().toISOString();
      await this.saveSyncConfig(config);

      return { 
        success: true, 
        message: `Synced ${transactions.length} transactions and ${updates.length} updates` 
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
      // Try cloud API first (direct cloud access)
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
          }
        } catch (cloudError) {
          console.error('[SyncService] Cloud API push failed, falling back to desktop API:', cloudError);
        }
      }

      // Fallback to desktop API
      console.log('[SyncService] Pushing transaction to desktop API');
      const result = await syncApi.pushTransaction(transaction);
      return result;
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
