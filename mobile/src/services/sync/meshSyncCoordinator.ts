import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api';
import { cacheService } from '../cache';

export interface MeshTransaction {
  tx_id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
  device_origin: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  pendingTransactions: number;
}

class MeshSyncCoordinator {
  private deviceId: string | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  private readonly DEVICE_ID_KEY = '@mesh_device_id';
  private readonly TRANSACTIONS_KEY = '@mesh_transactions';
  private readonly SYNC_INTERVAL_MS = 3600000; // 1 hour (save-driven sync, low B2 pressure)

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.getOrCreateDeviceId();
    this.setupNetworkListener();
    this.startSyncPolling();
  }

  private async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
      
      if (!deviceId) {
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      }
      
      this.deviceId = deviceId;
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return 'UNKNOWN_DEVICE';
    }
  }

  private generateDeviceId(): string {
    return `MOBILE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const isOnline = state.isConnected ?? false;
      this.notifyListeners({ isOnline, isSyncing: this.isSyncing, lastSync: null, pendingTransactions: 0 });
      
      if (isOnline && !this.isSyncing) {
        this.sync().catch(err => console.error('Error during network-change sync:', err));
      }
    });
  }

  private startSyncPolling(): void {
    this.syncInterval = setInterval(async () => {
      const isOnline = await this.isNetworkAvailable();
      if (isOnline && !this.isSyncing) {
        await this.sync();
      }
    }, this.SYNC_INTERVAL_MS);
  }

  private stopSyncPolling(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async isNetworkAvailable(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network availability:', error);
      return false;
    }
  }

  /**
   * Log a local mutation for mesh sync
   */
  async logMutation(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any,
    recordId?: number
  ): Promise<void> {
    try {
      if (!this.deviceId) {
        await this.getOrCreateDeviceId();
      }

      const transaction: MeshTransaction = {
        tx_id: this.generateTxId(),
        table_name: tableName,
        operation,
        payload: recordId ? { ...payload, _record_id: recordId } : payload,
        timestamp: Date.now(),
        device_origin: this.deviceId || 'UNKNOWN',
      };

      const transactions = await this.getPendingTransactions();
      transactions.push(transaction);
      await this.saveTransactions(transactions);

      this.notifyListeners({
        isOnline: await this.isNetworkAvailable(),
        isSyncing: this.isSyncing,
        lastSync: null,
        pendingTransactions: transactions.length,
      });

      // Trigger sync immediately on save/mutation
      const isOnline = await this.isNetworkAvailable();
      if (isOnline) {
        this.sync().catch(err => console.error('Error during auto-sync:', err));
      }
    } catch (error) {
      console.error('Error logging mutation:', error);
    }
  }

  private generateTxId(): string {
    return `${this.deviceId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async getPendingTransactions(): Promise<MeshTransaction[]> {
    try {
      const transactionsJson = await AsyncStorage.getItem(this.TRANSACTIONS_KEY);
      return transactionsJson ? JSON.parse(transactionsJson) : [];
    } catch (error) {
      console.error('Error getting pending transactions:', error);
      return [];
    }
  }

  private async saveTransactions(transactions: MeshTransaction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(transactions));
    } catch (error) {
      console.error('Error saving transactions:', error);
    }
  }

  /**
   * Sync pending transactions with the server
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners({
        isOnline: await this.isNetworkAvailable(),
        isSyncing: true,
        lastSync: null,
        pendingTransactions: (await this.getPendingTransactions()).length,
      });

      const transactions = await this.getPendingTransactions();
      
      if (transactions.length === 0) {
        await this.fetchServerUpdates();
        return;
      }

      // Send transactions to server
      const client = apiClient.getClient();
      await client.post('/api/sync/transactions', { transactions });

      // Clear synced transactions
      await this.saveTransactions([]);
      
      // Fetch server updates
      await this.fetchServerUpdates();

      // Update last sync time
      await AsyncStorage.setItem('@last_sync', Date.now().toString());
      
      this.notifyListeners({
        isOnline: await this.isNetworkAvailable(),
        isSyncing: false,
        lastSync: Date.now(),
        pendingTransactions: 0,
      });
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch updates from the server
   */
  private async fetchServerUpdates(): Promise<void> {
    try {
      const lastSync = await AsyncStorage.getItem('@last_sync');
      const client = apiClient.getClient();
      
      const response = await client.get('/api/sync/updates', {
        params: { since: lastSync },
      });

      const updates = response.data;
      
      // Apply updates to local cache
      for (const update of updates) {
        switch (update.table_name) {
          case 'projects':
            await this.handleProjectUpdate(update);
            break;
          case 'experiments':
            await this.handleExperimentUpdate(update);
            break;
          case 'resources':
            await this.handleResourceUpdate(update);
            break;
          case 'findings':
            await this.handleFindingUpdate(update);
            break;
        }
      }
    } catch (error) {
      console.error('Error fetching server updates:', error);
    }
  }

  private async handleProjectUpdate(update: any): Promise<void> {
    // Invalidate project cache
    const projectId = update.payload._record_id || update.payload.id;
    if (projectId) {
      await cacheService.remove(`project_${projectId}`);
    }
    await cacheService.remove('projects');
  }

  private async handleExperimentUpdate(update: any): Promise<void> {
    // Invalidate experiment cache
    const experimentId = update.payload._record_id || update.payload.id;
    if (experimentId) {
      await cacheService.remove(`experiment_${experimentId}`);
    }
    await cacheService.remove('experiments');
  }

  private async handleResourceUpdate(update: any): Promise<void> {
    // Invalidate resource cache
    const resourceId = update.payload._record_id || update.payload.id;
    if (resourceId) {
      await cacheService.remove(`resource_${resourceId}`);
    }
    await cacheService.remove('resources');
  }

  private async handleFindingUpdate(update: any): Promise<void> {
    // Invalidate finding cache
    const findingId = update.payload._record_id || update.payload.id;
    if (findingId) {
      await cacheService.remove(`finding_${findingId}`);
    }
    await cacheService.remove('findings');
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus): void {
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const transactions = await this.getPendingTransactions();
    const lastSync = await AsyncStorage.getItem('@last_sync');
    
    return {
      isOnline: await this.isNetworkAvailable(),
      isSyncing: this.isSyncing,
      lastSync: lastSync ? parseInt(lastSync, 10) : null,
      pendingTransactions: transactions.length,
    };
  }

  /**
   * Force sync
   */
  async forceSync(): Promise<void> {
    await this.sync();
  }

  /**
   * Clear all pending transactions
   */
  async clearPendingTransactions(): Promise<void> {
    await this.saveTransactions([]);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopSyncPolling();
    this.listeners.clear();
  }
}

export const meshSyncCoordinator = new MeshSyncCoordinator();
export default meshSyncCoordinator;
