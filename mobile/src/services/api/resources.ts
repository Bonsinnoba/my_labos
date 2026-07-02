import apiClient from './client';
import { offlineCache } from '../cache/offlineCache';

export interface Resource {
  id: number;
  title: string;
  type: 'PDF' | 'CSV' | 'IMAGE' | 'VIDEO' | 'OTHER';
  size?: string;
  file_path?: string;
  cloud_file_url?: string;
  thumbnail_url?: string;
  date?: string;
  uploaded_by?: string;
  project_id?: number;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateResourceRequest {
  title: string;
  type: 'PDF' | 'CSV' | 'IMAGE' | 'VIDEO' | 'OTHER';
  file_path?: string;
  cloud_file_url?: string;
  project_id?: number;
  tags?: string[];
}

export interface UpdateResourceRequest {
  title?: string;
  type?: 'PDF' | 'CSV' | 'IMAGE' | 'VIDEO' | 'OTHER';
  file_path?: string;
  cloud_file_url?: string;
  project_id?: number;
  tags?: string[];
}

export const resourcesApi = {
  // Get all resources
  getAll: async (): Promise<Resource[]> => {
    try {
      const resources = await apiClient.get<Resource[]>('/api/resources');
      await offlineCache.set('resources', resources);
      return resources;
    } catch (error) {
      console.error('[resourcesApi] Cloud API failed, using cache:', error);
      const cachedResources = await offlineCache.get<Resource[]>('resources');
      if (cachedResources) {
        console.log('[resourcesApi] Using cached resources');
        return cachedResources;
      }
      throw error;
    }
  },

  // Get resources by project ID
  getByProject: async (projectId: number): Promise<Resource[]> => {
    try {
      return await apiClient.get<Resource[]>(`/api/projects/${projectId}/resources`);
    } catch (error) {
      console.error('[resourcesApi] Cloud API failed for getByProject:', error);
      const cachedResources = await offlineCache.get<Resource[]>('resources');
      if (cachedResources) {
        return cachedResources.filter(r => r.project_id === projectId);
      }
      throw error;
    }
  },

  // Get resource by ID
  getById: async (id: number): Promise<Resource> => {
    try {
      return await apiClient.get<Resource>(`/api/resources/${id}`);
    } catch (error) {
      console.error('[resourcesApi] Cloud API failed for getById:', error);
      const cachedResources = await offlineCache.get<Resource[]>('resources');
      if (cachedResources) {
        const resource = cachedResources.find(r => r.id === id);
        if (resource) {
          console.log('[resourcesApi] Using cached resource');
          return resource;
        }
      }
      throw error;
    }
  },

  // Create new resource
  create: async (data: CreateResourceRequest): Promise<Resource> => {
    const resource = await apiClient.post<Resource>('/api/resources', data);
    await offlineCache.remove('resources');
    return resource;
  },

  // Update resource
  update: async (id: number, data: UpdateResourceRequest): Promise<Resource> => {
    const resource = await apiClient.put<Resource>(`/api/resources/${id}`, data);
    await offlineCache.remove('resources');
    return resource;
  },

  // Delete resource
  delete: async (id: number): Promise<void> => {
    await apiClient.delete<void>(`/api/resources/${id}`);
    await offlineCache.remove('resources');
  },

  // Upload file
  upload: async (file: FormData): Promise<Resource> => {
    const client = apiClient.getClient();
    const response = await client.post<Resource>('/api/resources/upload', file, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    await offlineCache.remove('resources');
    return response.data;
  },
};
