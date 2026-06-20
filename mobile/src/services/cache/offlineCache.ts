import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CachedData<T> {
  data: T;
  timestamp: number;
  version: number;
}

export class OfflineCache {
  private static instance: OfflineCache;
  private cachePrefix = 'offline_cache_';
  private version = 1;

  private constructor() {}

  static getInstance(): OfflineCache {
    if (!OfflineCache.instance) {
      OfflineCache.instance = new OfflineCache();
    }
    return OfflineCache.instance;
  }

  async set<T>(key: string, data: T): Promise<void> {
    try {
      const cacheItem: CachedData<T> = {
        data,
        timestamp: Date.now(),
        version: this.version,
      };
      await AsyncStorage.setItem(`${this.cachePrefix}${key}`, JSON.stringify(cacheItem));
      console.log(`[OfflineCache] Cached data for key: ${key}`);
    } catch (error) {
      console.error(`[OfflineCache] Error caching data for key ${key}:`, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.cachePrefix}${key}`);
      if (!cached) {
        return null;
      }

      const cacheItem: CachedData<T> = JSON.parse(cached);
      console.log(`[OfflineCache] Retrieved cached data for key: ${key}, age: ${Date.now() - cacheItem.timestamp}ms`);
      return cacheItem.data;
    } catch (error) {
      console.error(`[OfflineCache] Error retrieving cached data for key ${key}:`, error);
      return null;
    }
  }

  async getWithTimestamp<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.cachePrefix}${key}`);
      if (!cached) {
        return null;
      }

      const cacheItem: CachedData<T> = JSON.parse(cached);
      return {
        data: cacheItem.data,
        timestamp: cacheItem.timestamp,
      };
    } catch (error) {
      console.error(`[OfflineCache] Error retrieving cached data with timestamp for key ${key}:`, error);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.cachePrefix}${key}`);
      console.log(`[OfflineCache] Removed cached data for key: ${key}`);
    } catch (error) {
      console.error(`[OfflineCache] Error removing cached data for key ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[OfflineCache] Cleared ${cacheKeys.length} cached items`);
    } catch (error) {
      console.error('[OfflineCache] Error clearing cache:', error);
    }
  }

  async isExpired(key: string, maxAge: number): Promise<boolean> {
    try {
      const cached = await AsyncStorage.getItem(`${this.cachePrefix}${key}`);
      if (!cached) {
        return true;
      }

      const cacheItem: CachedData<any> = JSON.parse(cached);
      const age = Date.now() - cacheItem.timestamp;
      return age > maxAge;
    } catch (error) {
      console.error(`[OfflineCache] Error checking expiration for key ${key}:`, error);
      return true;
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      return cacheKeys.length;
    } catch (error) {
      console.error('[OfflineCache] Error getting cache size:', error);
      return 0;
    }
  }
}

export const offlineCache = OfflineCache.getInstance();
