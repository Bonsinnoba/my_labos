import apiClient from './client';
import { offlineCache } from '../cache/offlineCache';

export interface Project {
  id: string;
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
    try {
      const response = await apiClient.get<{projects: Project[]}>('/api/projects');
      const projects = response.projects || [];
      await offlineCache.set('projects', projects);
      return projects;
    } catch (error) {
      console.error('[projectsApi] Cloud API failed, using cache:', error);
      const cachedProjects = await offlineCache.get<Project[]>('projects');
      if (cachedProjects) {
        console.log('[projectsApi] Using cached projects');
        return cachedProjects;
      }
      throw error;
    }
  },

  // Get project by ID
  getById: async (id: string): Promise<Project> => {
    try {
      const response = await apiClient.get<{success: boolean, data: Project}>(`/api/projects/${id}`);
      return response.data;
    } catch (error) {
      console.error('[projectsApi] Cloud API failed for getById:', error);
      const cachedProjects = await offlineCache.get<Project[]>('projects');
      if (cachedProjects) {
        const project = cachedProjects.find(p => p.id === id);
        if (project) {
          console.log('[projectsApi] Using cached project');
          return project;
        }
      }
      throw error;
    }
  },

  // Create new project
  create: async (data: CreateProjectRequest): Promise<Project> => {
    const project = await apiClient.post<Project>('/api/projects', data);
    await offlineCache.remove('projects');
    return project;
  },

  // Update project
  update: async (id: string, data: UpdateProjectRequest): Promise<Project> => {
    const project = await apiClient.put<Project>(`/api/projects/${id}`, data);
    await offlineCache.remove('projects');
    return project;
  },

  // Delete project
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/projects/${id}`);
    await offlineCache.remove('projects');
  },
};
