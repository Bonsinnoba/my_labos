import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncConflict {
  entityType: 'project' | 'experiment' | 'resource' | 'finding';
  entityId: string;
  localVersion: any;
  cloudVersion: any;
  lastModified: {
    local: number;
    cloud: number;
  };
}

export interface ConflictResolution {
  entityType: string;
  entityId: string;
  resolution: 'local' | 'cloud' | 'merge';
  resolvedData?: any;
}

export class ConflictResolver {
  private static readonly CONFLICTS_KEY = '@sync_conflicts';

  static async detectConflicts(
    localData: any[],
    cloudData: any[],
    entityType: string
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    // Create maps for easier lookup
    const localMap = new Map(localData.map(item => [item.id, item]));
    const cloudMap = new Map(cloudData.map(item => [item.id, item]));

    // Check for conflicts
    const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

    for (const id of allIds) {
      const localItem = localMap.get(id);
      const cloudItem = cloudMap.get(id);

      if (localItem && cloudItem) {
        // Both exist - check for modification conflicts
        const localModified = localItem.updated_at || localItem.modified_at || 0;
        const cloudModified = cloudItem.updated_at || cloudItem.modified_at || 0;

        // If both were modified after last sync, it's a conflict
        const lastSync = await this.getLastSyncTime(entityType, id);
        if (localModified > lastSync && cloudModified > lastSync) {
          conflicts.push({
            entityType: entityType as any,
            entityId: id,
            localVersion: localItem,
            cloudVersion: cloudItem,
            lastModified: {
              local: localModified,
              cloud: cloudModified,
            },
          });
        }
      }
    }

    return conflicts;
  }

  static async saveConflicts(conflicts: SyncConflict[]): Promise<void> {
    try {
      const existingConflicts = await this.getConflicts();
      const conflictsMap = new Map(
        existingConflicts.map(c => [`${c.entityType}:${c.entityId}`, c] as [string, SyncConflict])
      );
      
      for (const conflict of conflicts) {
        conflictsMap.set(`${conflict.entityType}:${conflict.entityId}`, conflict);
      }

      await AsyncStorage.setItem(
        this.CONFLICTS_KEY,
        JSON.stringify(Array.from(conflictsMap.values()))
      );
    } catch (error) {
      console.error('[ConflictResolver] Failed to save conflicts:', error);
    }
  }

  static async getConflicts(): Promise<SyncConflict[]> {
    try {
      const conflictsJson = await AsyncStorage.getItem(this.CONFLICTS_KEY);
      return conflictsJson ? JSON.parse(conflictsJson) : [];
    } catch (error) {
      console.error('[ConflictResolver] Failed to load conflicts:', error);
      return [];
    }
  }

  static async resolveConflict(
    resolution: ConflictResolution
  ): Promise<void> {
    try {
      const conflicts = await this.getConflicts();
      const filteredConflicts = conflicts.filter(
        c => !(c.entityType === resolution.entityType && c.entityId === resolution.entityId)
      );
      
      await AsyncStorage.setItem(
        this.CONFLICTS_KEY,
        JSON.stringify(filteredConflicts)
      );

      // Update last sync time for this entity
      await this.updateLastSyncTime(resolution.entityType, resolution.entityId);
    } catch (error) {
      console.error('[ConflictResolver] Failed to resolve conflict:', error);
    }
  }

  static async clearAllConflicts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CONFLICTS_KEY);
    } catch (error) {
      console.error('[ConflictResolver] Failed to clear conflicts:', error);
    }
  }

  private static async getLastSyncTime(entityType: string, entityId: string): Promise<number> {
    try {
      const key = `@last_sync_${entityType}_${entityId}`;
      const lastSync = await AsyncStorage.getItem(key);
      return lastSync ? parseInt(lastSync, 10) : 0;
    } catch (error) {
      console.error('[ConflictResolver] Failed to get last sync time:', error);
      return 0;
    }
  }

  private static async updateLastSyncTime(entityType: string, entityId: string): Promise<void> {
    try {
      const key = `@last_sync_${entityType}_${entityId}`;
      await AsyncStorage.setItem(key, Date.now().toString());
    } catch (error) {
      console.error('[ConflictResolver] Failed to update last sync time:', error);
    }
  }

  static async updateEntitySyncTime(entityType: string, entityId: string): Promise<void> {
    await this.updateLastSyncTime(entityType, entityId);
  }

  static mergeData(localData: any, cloudData: any): any {
    // Simple merge strategy - prefer cloud data for most fields,
    // but keep local modifications to certain fields
    const merged = { ...cloudData };

    // Fields that should prefer local version
    const localPriorityFields = ['local_notes', 'mobile_tags', 'user_preferences'];

    for (const field of localPriorityFields) {
      if (localData[field] !== undefined) {
        merged[field] = localData[field];
      }
    }

    // Merge arrays (like tags, attachments)
    const arrayFields = ['tags', 'attachments'];
    for (const field of arrayFields) {
      if (localData[field] && cloudData[field]) {
        const localSet = new Set(localData[field]);
        const cloudSet = new Set(cloudData[field]);
        merged[field] = Array.from(new Set([...localSet, ...cloudSet]));
      } else if (localData[field]) {
        merged[field] = localData[field];
      }
    }

    return merged;
  }

  static getConflictCount(): Promise<number> {
    return this.getConflicts().then(conflicts => conflicts.length);
  }
}

export default ConflictResolver;
