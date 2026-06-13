import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@lab_cache_';
const CACHE_EXPIRY_PREFIX = '@lab_cache_expiry_';

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry?: number;
}

class CacheService {
  /**
   * Store data in cache with optional expiry time (in milliseconds)
   */
  async set<T>(key: string, data: T, expiryMs?: number): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const expiryKey = `${CACHE_EXPIRY_PREFIX}${key}`;
      
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiry: expiryMs ? Date.now() + expiryMs : undefined,
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(item));
      
      if (expiryMs) {
        await AsyncStorage.setItem(expiryKey, (Date.now() + expiryMs).toString());
      }
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  /**
   * Retrieve data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const expiryKey = `${CACHE_EXPIRY_PREFIX}${key}`;
      
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) {
        return null;
      }
      
      const item: CacheItem<T> = JSON.parse(cached);
      
      // Check if expired
      if (item.expiry && Date.now() > item.expiry) {
        await this.remove(key);
        return null;
      }
      
      return item.data;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  /**
   * Remove specific item from cache
   */
  async remove(key: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const expiryKey = `${CACHE_EXPIRY_PREFIX}${key}`;
      
      await AsyncStorage.removeItem(cacheKey);
      await AsyncStorage.removeItem(expiryKey);
    } catch (error) {
      console.error('Error removing cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_EXPIRY_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Check if cache exists and is valid
   */
  async isValid(key: string): Promise<boolean> {
    try {
      const expiryKey = `${CACHE_EXPIRY_PREFIX}${key}`;
      const expiry = await AsyncStorage.getItem(expiryKey);
      
      if (!expiry) {
        // No expiry set, check if data exists
        const cacheKey = `${CACHE_PREFIX}${key}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        return cached !== null;
      }
      
      // Check if expired
      return Date.now() < parseInt(expiry, 10);
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Get cache size in bytes
   */
  async getSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      let totalSize = 0;
      
      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Clear expired cache items
   */
  async clearExpired(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const expiryKeys = keys.filter(key => key.startsWith(CACHE_EXPIRY_PREFIX));
      
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const expiryKey of expiryKeys) {
        const expiry = await AsyncStorage.getItem(expiryKey);
        if (expiry && parseInt(expiry, 10) < now) {
          const cacheKey = expiryKey.replace(CACHE_EXPIRY_PREFIX, CACHE_PREFIX);
          expiredKeys.push(cacheKey, expiryKey);
        }
      }
      
      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
