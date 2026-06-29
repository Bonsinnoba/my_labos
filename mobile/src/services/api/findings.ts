import apiClient from './client';
import { offlineCache } from '../cache/offlineCache';

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
    try {
      const response = await apiClient.get<{findings: Finding[]}>('/api/findings');
      const findings = response.findings || [];
      await offlineCache.set('findings', findings);
      return findings;
    } catch (error) {
      console.error('[findingsApi] Cloud API failed, using cache:', error);
      const cachedFindings = await offlineCache.get<Finding[]>('findings');
      if (cachedFindings) {
        console.log('[findingsApi] Using cached findings');
        return cachedFindings;
      }
      throw error;
    }
  },

  // Get findings by experiment ID
  getByExperiment: async (experimentId: number): Promise<Finding[]> => {
    try {
      return await apiClient.get<Finding[]>(`/api/experiments/${experimentId}/findings`);
    } catch (error) {
      console.error('[findingsApi] Cloud API failed for getByExperiment:', error);
      const cachedFindings = await offlineCache.get<Finding[]>('findings');
      if (cachedFindings) {
        return cachedFindings.filter(f => f.experiment_id === experimentId);
      }
      throw error;
    }
  },

  // Get findings by severity
  getBySeverity: async (severity: 'HIGH' | 'MEDIUM' | 'LOW'): Promise<Finding[]> => {
    try {
      return await apiClient.get<Finding[]>(`/api/findings?severity=${severity}`);
    } catch (error) {
      console.error('[findingsApi] Cloud API failed for getBySeverity:', error);
      const cachedFindings = await offlineCache.get<Finding[]>('findings');
      if (cachedFindings) {
        return cachedFindings.filter(f => f.severity === severity);
      }
      throw error;
    }
  },

  // Get finding by ID
  getById: async (id: number): Promise<Finding> => {
    try {
      return await apiClient.get<Finding>(`/api/findings/${id}`);
    } catch (error) {
      console.error('[findingsApi] Cloud API failed for getById:', error);
      const cachedFindings = await offlineCache.get<Finding[]>('findings');
      if (cachedFindings) {
        const finding = cachedFindings.find(f => f.id === id);
        if (finding) {
          console.log('[findingsApi] Using cached finding');
          return finding;
        }
      }
      throw error;
    }
  },

  // Create new finding
  create: async (data: CreateFindingRequest): Promise<Finding> => {
    const finding = await apiClient.post<Finding>('/api/findings', data);
    await offlineCache.remove('findings');
    return finding;
  },

  // Update finding
  update: async (id: number, data: UpdateFindingRequest): Promise<Finding> => {
    const finding = await apiClient.put<Finding>(`/api/findings/${id}`, data);
    await offlineCache.remove('findings');
    return finding;
  },

  // Delete finding
  delete: async (id: number): Promise<void> => {
    await apiClient.delete<void>(`/api/findings/${id}`);
    await offlineCache.remove('findings');
  },

  // Update finding status
  updateStatus: async (id: number, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'): Promise<Finding> => {
    const finding = await apiClient.patch<Finding>(`/api/findings/${id}/status`, { status });
    await offlineCache.remove('findings');
    return finding;
  },
};
