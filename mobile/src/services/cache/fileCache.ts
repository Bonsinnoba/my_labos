import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { downloadFile as downloadFromServer } from '../api';

interface CachedFile {
  filename: string;
  localUri: string;
  fileSize: number;
  downloadedAt: string;
  lastAccessed: string;
  accessCount: number;
  permanent: boolean; // If true, file is never deleted
}

const CACHE_KEY = 'file_cache';
const CACHE_EXPIRY_HOURS = 72;

// File types that should be cached permanently
const PERMANENT_FILE_TYPES = [
  'note',
  'notes',
  'chat',
  'history',
  'txt',
  'md',
  'json',
  'log',
];

// File size threshold for permanent caching (1MB)
const PERMANENT_FILE_SIZE_THRESHOLD = 1024 * 1024;

class FileCacheManager {
  private cache: Map<string, CachedFile> = new Map();
  private initialized = false;

  private shouldCachePermanently(filename: string, fileSize: number): boolean {
    // Check file extension
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    if (PERMANENT_FILE_TYPES.includes(extension)) {
      return true;
    }

    // Check if filename contains permanent keywords
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.includes('note') || lowerFilename.includes('chat') || lowerFilename.includes('history')) {
      return true;
    }

    // Check file size - small files (< 1MB) are cached permanently
    if (fileSize < PERMANENT_FILE_SIZE_THRESHOLD) {
      return true;
    }

    return false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const files: CachedFile[] = JSON.parse(cachedData);
        files.forEach(file => {
          this.cache.set(file.filename, file);
        });
        console.log('[FileCache] Loaded cache with', this.cache.size, 'files');
      }
      this.initialized = true;
    } catch (error) {
      console.error('[FileCache] Failed to initialize:', error);
    }
  }

  async getFile(filename: string, fileSize?: number): Promise<string | null> {
    await this.initialize();

    const cached = this.cache.get(filename);
    
    if (cached) {
      // File exists in cache - update access time
      const updated: CachedFile = {
        ...cached,
        lastAccessed: new Date().toISOString(),
        accessCount: cached.accessCount + 1,
      };
      this.cache.set(filename, updated);
      await this.saveCache();
      
      // Check if file still exists locally
      const fileInfo = await FileSystem.getInfoAsync(cached.localUri);
      if (fileInfo.exists) {
        console.log('[FileCache] Cache hit:', filename);
        return cached.localUri;
      } else {
        // File doesn't exist locally - remove from cache
        this.cache.delete(filename);
        await this.saveCache();
      }
    }

    // File not cached - download from server
    return this.downloadFile(filename, fileSize);
  }

  private async downloadFile(filename: string, fileSize?: number): Promise<string | null> {
    try {
      console.log('[FileCache] Downloading file:', filename);
      
      // Download file from Instapods Hub
      const fileBlob = await downloadFromServer(filename, fileSize);
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileBlob);
      });
      
      // Save to local cache directory
      const cacheDir = FileSystem.documentDirectory + 'file_cache/';
      
      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }
      
      const localUri = cacheDir + filename;
      
      // Write file
      await FileSystem.writeAsStringAsync(localUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const actualSize = fileInfo.size || 0;
      
      // Add to cache
      const isPermanent = this.shouldCachePermanently(filename, actualSize);
      const cachedFile: CachedFile = {
        filename,
        localUri,
        fileSize: actualSize,
        downloadedAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        permanent: isPermanent,
      };
      
      this.cache.set(filename, cachedFile);
      await this.saveCache();
      
      console.log('[FileCache] Downloaded and cached:', filename, `(${actualSize} bytes)`);
      return localUri;
      
    } catch (error) {
      console.error('[FileCache] Download failed:', error);
      return null;
    }
  }

  async cleanupExpiredFiles(): Promise<number> {
    await this.initialize();

    const now = new Date();
    const expiryThreshold = new Date(now.getTime() - CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [filename, cachedFile] of this.cache.entries()) {
      // Skip permanent files
      if (cachedFile.permanent) {
        continue;
      }

      const lastAccessed = new Date(cachedFile.lastAccessed);
      
      if (lastAccessed < expiryThreshold) {
        try {
          // Delete local file
          const fileInfo = await FileSystem.getInfoAsync(cachedFile.localUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(cachedFile.localUri);
            console.log('[FileCache] Deleted expired file:', filename);
          }
          
          // Remove from cache
          this.cache.delete(filename);
          deletedCount++;
        } catch (error) {
          console.error('[FileCache] Failed to delete expired file:', filename, error);
        }
      }
    }

    if (deletedCount > 0) {
      await this.saveCache();
      console.log('[FileCache] Cleanup completed:', deletedCount, 'files deleted');
    }

    return deletedCount;
  }

  async clearCache(): Promise<void> {
    await this.initialize();

    for (const [filename, cachedFile] of this.cache.entries()) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cachedFile.localUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(cachedFile.localUri);
        }
      } catch (error) {
        console.error('[FileCache] Failed to delete file:', filename, error);
      }
    }

    this.cache.clear();
    await this.saveCache();
    console.log('[FileCache] Cache cleared');
  }

  private async saveCache(): Promise<void> {
    try {
      const files = Array.from(this.cache.values());
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(files));
    } catch (error) {
      console.error('[FileCache] Failed to save cache:', error);
    }
  }

  getCacheStats(): {
    totalFiles: number;
    totalSize: number;
    permanentFiles: number;
    temporaryFiles: number;
    expiredFiles: number;
    expiryHours: number;
  } {
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() - CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
    
    let totalSize = 0;
    let permanentCount = 0;
    let temporaryCount = 0;
    let expiredCount = 0;

    for (const cachedFile of this.cache.values()) {
      totalSize += cachedFile.fileSize;
      
      if (cachedFile.permanent) {
        permanentCount++;
      } else {
        temporaryCount++;
        const lastAccessed = new Date(cachedFile.lastAccessed);
        if (lastAccessed < expiryThreshold) {
          expiredCount++;
        }
      }
    }

    return {
      totalFiles: this.cache.size,
      totalSize,
      permanentFiles: permanentCount,
      temporaryFiles: temporaryCount,
      expiredFiles: expiredCount,
      expiryHours: CACHE_EXPIRY_HOURS,
    };
  }
}

export const fileCacheManager = new FileCacheManager();
