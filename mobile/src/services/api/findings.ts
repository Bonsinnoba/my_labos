import apiClient from './client';

export interface Finding {
  id: number;
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  experiment_id?: number;
  experiment_name?: string;
  date?: string;
  description?: string;
  root_cause?: string;
  recommended_action?: string;
  assigned_to?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFindingRequest {
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  experiment_id?: number;
  date?: string;
  description?: string;
  root_cause?: string;
  recommended_action?: string;
  assigned_to?: string;
  priority?: string;
}

export interface UpdateFindingRequest {
  title?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  experiment_id?: number;
  date?: string;
  description?: string;
  root_cause?: string;
  recommended_action?: string;
  assigned_to?: string;
  priority?: string;
}

export const findingsApi = {
  // Get all findings
  getAll: async (): Promise<Finding[]> => {
    return apiClient.get<Finding[]>('/api/findings');
  },

  // Get findings by experiment ID
  getByExperiment: async (experimentId: number): Promise<Finding[]> => {
    return apiClient.get<Finding[]>(`/api/experiments/${experimentId}/findings`);
  },

  // Get findings by severity
  getBySeverity: async (severity: 'HIGH' | 'MEDIUM' | 'LOW'): Promise<Finding[]> => {
    return apiClient.get<Finding[]>(`/api/findings?severity=${severity}`);
  },

  // Get finding by ID
  getById: async (id: number): Promise<Finding> => {
    return apiClient.get<Finding>(`/api/findings/${id}`);
  },

  // Create new finding
  create: async (data: CreateFindingRequest): Promise<Finding> => {
    return apiClient.post<Finding>('/api/findings', data);
  },

  // Update finding
  update: async (id: number, data: UpdateFindingRequest): Promise<Finding> => {
    return apiClient.put<Finding>(`/api/findings/${id}`, data);
  },

  // Delete finding
  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/findings/${id}`);
  },

  // Update finding status
  updateStatus: async (id: number, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'): Promise<Finding> => {
    return apiClient.patch<Finding>(`/api/findings/${id}/status`, { status });
  },
};
