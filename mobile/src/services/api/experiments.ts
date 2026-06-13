import apiClient from './client';

export interface Experiment {
  id: number;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  project_id?: number;
  project_name?: string;
  date?: string;
  expected_outcome?: string;
  actual_outcome?: string;
  findings?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExperimentRequest {
  title: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  project_id?: number;
  date?: string;
  expected_outcome?: string;
  actual_outcome?: string;
  findings?: string;
}

export interface UpdateExperimentRequest {
  title?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  project_id?: number;
  date?: string;
  expected_outcome?: string;
  actual_outcome?: string;
  findings?: string;
}

export const experimentsApi = {
  // Get all experiments
  getAll: async (): Promise<Experiment[]> => {
    return apiClient.get<Experiment[]>('/api/experiments');
  },

  // Get experiments by project ID
  getByProject: async (projectId: number): Promise<Experiment[]> => {
    return apiClient.get<Experiment[]>(`/api/projects/${projectId}/experiments`);
  },

  // Get experiment by ID
  getById: async (id: number): Promise<Experiment> => {
    return apiClient.get<Experiment>(`/api/experiments/${id}`);
  },

  // Create new experiment
  create: async (data: CreateExperimentRequest): Promise<Experiment> => {
    return apiClient.post<Experiment>('/api/experiments', data);
  },

  // Update experiment
  update: async (id: number, data: UpdateExperimentRequest): Promise<Experiment> => {
    return apiClient.put<Experiment>(`/api/experiments/${id}`, data);
  },

  // Delete experiment
  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/experiments/${id}`);
  },
};
