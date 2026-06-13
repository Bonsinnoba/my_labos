import apiClient from './client';

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: 'Active' | 'Completed' | 'Paused';
  start_date?: string;
  project_outcome?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: 'Active' | 'Completed' | 'Paused';
  start_date?: string;
  project_outcome?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'Active' | 'Completed' | 'Paused';
  start_date?: string;
  project_outcome?: string;
}

export const projectsApi = {
  // Get all projects
  getAll: async (): Promise<Project[]> => {
    return apiClient.get<Project[]>('/api/projects');
  },

  // Get project by ID
  getById: async (id: number): Promise<Project> => {
    return apiClient.get<Project>(`/api/projects/${id}`);
  },

  // Create new project
  create: async (data: CreateProjectRequest): Promise<Project> => {
    return apiClient.post<Project>('/api/projects', data);
  },

  // Update project
  update: async (id: number, data: UpdateProjectRequest): Promise<Project> => {
    return apiClient.put<Project>(`/api/projects/${id}`, data);
  },

  // Delete project
  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/projects/${id}`);
  },
};
