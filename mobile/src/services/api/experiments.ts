import apiClient from './client';
import { offlineCache } from '../cache/offlineCache';

export interface Experiment {
  id: string;
  log_title?: string;
  log_text?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  project_id?: string;
  project_name?: string;
  timestamp?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExperimentRequest {
  log_title?: string;
  log_text?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  project_id?: string;
  timestamp?: string;
}

export interface UpdateExperimentRequest {
  log_title?: string;
  log_text?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  project_id?: string;
  timestamp?: string;
}

export const experimentsApi = {
  // Get all experiments
  getAll: async (): Promise<Experiment[]> => {
    try {
      const experiments = await apiClient.get<Experiment[]>('/api/experiments');
      await offlineCache.set('experiments', experiments);
      return experiments;
    } catch (error) {
      console.error('[experimentsApi] Cloud API failed, using cache:', error);
      const cachedExperiments = await offlineCache.get<Experiment[]>('experiments');
      if (cachedExperiments) {
        console.log('[experimentsApi] Using cached experiments');
        return cachedExperiments;
      }
      throw error;
    }
  },

  // Get experiments by project ID
  getByProject: async (projectId: string): Promise<Experiment[]> => {
    try {
      return await apiClient.get<Experiment[]>(`/api/projects/${projectId}/experiments`);
    } catch (error) {
      console.error('[experimentsApi] Cloud API failed for getByProject:', error);
      const cachedExperiments = await offlineCache.get<Experiment[]>('experiments');
      if (cachedExperiments) {
        return cachedExperiments.filter(e => e.project_id === projectId);
      }
      throw error;
    }
  },

  // Get experiment by ID
  getById: async (id: string): Promise<Experiment> => {
    try {
      return await apiClient.get<Experiment>(`/api/experiments/${id}`);
    } catch (error) {
      console.error('[experimentsApi] Cloud API failed for getById:', error);
      const cachedExperiments = await offlineCache.get<Experiment[]>('experiments');
      if (cachedExperiments) {
        const experiment = cachedExperiments.find(e => e.id === id);
        if (experiment) {
          console.log('[experimentsApi] Using cached experiment');
          return experiment;
        }
      }
      throw error;
    }
  },

  // Create new experiment
  create: async (data: CreateExperimentRequest): Promise<Experiment> => {
    const experiment = await apiClient.post<Experiment>('/api/experiments', data);
    await offlineCache.remove('experiments');
    return experiment;
  },

  // Update experiment
  update: async (id: string, data: UpdateExperimentRequest): Promise<Experiment> => {
    const experiment = await apiClient.put<Experiment>(`/api/experiments/${id}`, data);
    await offlineCache.remove('experiments');
    return experiment;
  },

  // Delete experiment
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/experiments/${id}`);
    await offlineCache.remove('experiments');
  },
};
