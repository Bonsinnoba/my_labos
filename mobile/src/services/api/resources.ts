import apiClient from './client';

export interface Resource {
  id: number;
  title: string;
  type: 'PDF' | 'CSV' | 'IMAGE' | 'VIDEO' | 'OTHER';
  size?: string;
  file_path?: string;
  cloud_file_url?: string;
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
    return apiClient.get<Resource[]>('/api/resources');
  },

  // Get resources by project ID
  getByProject: async (projectId: number): Promise<Resource[]> => {
    return apiClient.get<Resource[]>(`/api/projects/${projectId}/resources`);
  },

  // Get resource by ID
  getById: async (id: number): Promise<Resource> => {
    return apiClient.get<Resource>(`/api/resources/${id}`);
  },

  // Create new resource
  create: async (data: CreateResourceRequest): Promise<Resource> => {
    return apiClient.post<Resource>('/api/resources', data);
  },

  // Update resource
  update: async (id: number, data: UpdateResourceRequest): Promise<Resource> => {
    return apiClient.put<Resource>(`/api/resources/${id}`, data);
  },

  // Delete resource
  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/resources/${id}`);
  },

  // Upload file
  upload: async (file: FormData): Promise<Resource> => {
    const client = apiClient.getClient();
    const response = await client.post<Resource>('/api/resources/upload', file, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
