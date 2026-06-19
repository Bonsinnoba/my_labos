import apiClient from './client';

// Types
export interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Experiment {
  id: number;
  title: string;
  description: string;
  status: string;
  project_id: number;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: number;
  title: string;
  description: string;
  file_path: string;
  project_id: number;
  created_at: string;
}

export interface NotebookEntry {
  id: number;
  title: string;
  content: string;
  entry_type: string;
  project_id?: number;
  experiment_id?: number;
  tags?: string[];
  attachments?: string[];
  created_at: string;
}

export interface SyncTransaction {
  id: number;
  entity_type: string;
  entity_id: number;
  operation: string;
  timestamp: string;
  synced: boolean;
}

// Projects API
export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    return apiClient.get<Project[]>('/api/projects');
  },

  getById: async (id: number): Promise<Project> => {
    return apiClient.get<Project>(`/api/projects/${id}`);
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    return apiClient.post<Project>('/api/projects', data);
  },

  update: async (id: number, data: Partial<Project>): Promise<Project> => {
    return apiClient.put<Project>(`/api/projects/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/projects/${id}`);
  },
};

// Experiments API (Mobile-compatible)
export const experimentsApi = {
  getAll: async (): Promise<Experiment[]> => {
    return apiClient.get<Experiment[]>('/api/experiments');
  },

  getById: async (id: number): Promise<Experiment> => {
    return apiClient.get<Experiment>(`/api/experiments/${id}`);
  },

  getByProject: async (projectId: number): Promise<Experiment[]> => {
    return apiClient.get<Experiment[]>('/api/experiments', { project_id: projectId });
  },

  create: async (data: Partial<Experiment>): Promise<Experiment> => {
    return apiClient.post<Experiment>('/api/experiments', data);
  },

  update: async (id: number, data: Partial<Experiment>): Promise<Experiment> => {
    return apiClient.put<Experiment>(`/api/experiments/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/experiments/${id}`);
  },
};

// Resources API (Mobile-compatible)
export const resourcesApi = {
  getAll: async (): Promise<Resource[]> => {
    return apiClient.get<Resource[]>('/api/resources');
  },

  getById: async (id: number): Promise<Resource> => {
    return apiClient.get<Resource>(`/api/resources/${id}`);
  },

  getByProject: async (projectId: number): Promise<Resource[]> => {
    return apiClient.get<Resource[]>('/api/resources', { project_id: projectId });
  },

  create: async (data: Partial<Resource>): Promise<Resource> => {
    return apiClient.post<Resource>('/api/resources', data);
  },

  update: async (id: number, data: Partial<Resource>): Promise<Resource> => {
    return apiClient.put<Resource>(`/api/resources/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    return apiClient.delete<void>(`/api/resources/${id}`);
  },
};

// Notebook API (Mobile)
export const notebookApi = {
  create: async (data: Partial<NotebookEntry>): Promise<{ entry_id: number }> => {
    return apiClient.post<{ entry_id: number }>('/api/notebook/mobile', data);
  },

  getById: async (id: number): Promise<{ data: NotebookEntry }> => {
    return apiClient.get<{ data: NotebookEntry }>(`/api/notebook/mobile/${id}`);
  },

  update: async (id: number, data: Partial<NotebookEntry>): Promise<{ success: boolean }> => {
    return apiClient.put<{ success: boolean }>(`/api/notebook/mobile/${id}`, data);
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/api/notebook/mobile/${id}`);
  },
};

// Tools/Calculator API
export const toolsApi = {
  ohmsLaw: async (data: { voltage?: number; current?: number; resistance?: number }) => {
    return apiClient.post('/api/tools/ohms-law', data);
  },

  voltageDivider: async (data: { vin: number; r1: number; r2: number }) => {
    return apiClient.post('/api/tools/voltage-divider', data);
  },

  power: async (data: { voltage?: number; current?: number; resistance?: number }) => {
    return apiClient.post('/api/tools/power', data);
  },

  ledResistor: async (data: { voltage: number; led_voltage: number; led_current: number }) => {
    return apiClient.post('/api/tools/led-resistor', data);
  },

  batteryRuntime: async (data: { capacity: number; current_draw: number }) => {
    return apiClient.post('/api/tools/battery-runtime', data);
  },

  rcTimeConstant: async (data: { resistance: number; capacitance: number }) => {
    return apiClient.post('/api/tools/rc-time-constant', data);
  },

  lcResonantFrequency: async (data: { inductance: number; capacitance: number }) => {
    return apiClient.post('/api/tools/lc-resonant-frequency', data);
  },

  scientificCalculator: async (data: { expression: string }) => {
    return apiClient.post('/api/tools/scientific-calculator', data);
  },

  statistics: async (data: { data: number[] }) => {
    return apiClient.post('/api/tools/statistics', data);
  },

  matrixMultiply: async (data: { matrix_a: number[][]; matrix_b: number[][] }) => {
    return apiClient.post('/api/tools/matrix-multiply', data);
  },
};

// Sync API
export const syncApi = {
  getTransactions: async (params?: { since?: string; limit?: number }): Promise<SyncTransaction[]> => {
    return apiClient.get<SyncTransaction[]>('/api/sync/transactions', params);
  },

  getUpdates: async (params?: { since?: string; entity_type?: string }): Promise<any[]> => {
    return apiClient.get<any[]>('/api/sync/updates', params);
  },

  pushTransaction: async (data: Partial<SyncTransaction>): Promise<SyncTransaction> => {
    return apiClient.post<SyncTransaction>('/api/sync/transactions', data);
  },
};

// Connection Test
export const connectionApi = {
  test: async (): Promise<{ success: boolean; message: string }> => {
    try {
      await apiClient.get('/api/health');
      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, message: 'Connection failed' };
    }
  },
};
