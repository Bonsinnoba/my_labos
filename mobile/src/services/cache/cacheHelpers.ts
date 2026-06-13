import cacheService from './cacheService';
import { Project, Experiment, Resource, Finding } from '../api';

// Cache keys
export const CACHE_KEYS = {
  PROJECTS: 'projects',
  PROJECT: (id: number) => `project_${id}`,
  EXPERIMENTS: 'experiments',
  EXPERIMENT: (id: number) => `experiment_${id}`,
  EXPERIMENTS_BY_PROJECT: (projectId: number) => `project_${projectId}_experiments`,
  RESOURCES: 'resources',
  RESOURCE: (id: number) => `resource_${id}`,
  RESOURCES_BY_PROJECT: (projectId: number) => `project_${projectId}_resources`,
  FINDINGS: 'findings',
  FINDING: (id: number) => `finding_${id}`,
  FINDINGS_BY_EXPERIMENT: (experimentId: number) => `experiment_${experimentId}_findings`,
  DASHBOARD_STATS: 'dashboard_stats',
  RECENT_ACTIVITY: 'recent_activity',
};

// Cache expiry times (in milliseconds)
export const CACHE_EXPIRY = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
};

export const projectCache = {
  getAll: async (): Promise<Project[] | null> => {
    return cacheService.get<Project[]>(CACHE_KEYS.PROJECTS);
  },
  setAll: async (projects: Project[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.PROJECTS, projects, CACHE_EXPIRY.MEDIUM);
  },
  getById: async (id: number): Promise<Project | null> => {
    return cacheService.get<Project>(CACHE_KEYS.PROJECT(id));
  },
  setById: async (id: number, project: Project): Promise<void> => {
    return cacheService.set(CACHE_KEYS.PROJECT(id), project, CACHE_EXPIRY.LONG);
  },
  invalidate: async (id?: number): Promise<void> => {
    if (id) {
      await cacheService.remove(CACHE_KEYS.PROJECT(id));
    }
    await cacheService.remove(CACHE_KEYS.PROJECTS);
  },
};

export const experimentCache = {
  getAll: async (): Promise<Experiment[] | null> => {
    return cacheService.get<Experiment[]>(CACHE_KEYS.EXPERIMENTS);
  },
  setAll: async (experiments: Experiment[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.EXPERIMENTS, experiments, CACHE_EXPIRY.SHORT);
  },
  getById: async (id: number): Promise<Experiment | null> => {
    return cacheService.get<Experiment>(CACHE_KEYS.EXPERIMENT(id));
  },
  setById: async (id: number, experiment: Experiment): Promise<void> => {
    return cacheService.set(CACHE_KEYS.EXPERIMENT(id), experiment, CACHE_EXPIRY.LONG);
  },
  getByProject: async (projectId: number): Promise<Experiment[] | null> => {
    return cacheService.get<Experiment[]>(CACHE_KEYS.EXPERIMENTS_BY_PROJECT(projectId));
  },
  setByProject: async (projectId: number, experiments: Experiment[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.EXPERIMENTS_BY_PROJECT(projectId), experiments, CACHE_EXPIRY.MEDIUM);
  },
  invalidate: async (id?: number, projectId?: number): Promise<void> => {
    if (id) {
      await cacheService.remove(CACHE_KEYS.EXPERIMENT(id));
    }
    if (projectId) {
      await cacheService.remove(CACHE_KEYS.EXPERIMENTS_BY_PROJECT(projectId));
    }
    await cacheService.remove(CACHE_KEYS.EXPERIMENTS);
  },
};

export const resourceCache = {
  getAll: async (): Promise<Resource[] | null> => {
    return cacheService.get<Resource[]>(CACHE_KEYS.RESOURCES);
  },
  setAll: async (resources: Resource[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.RESOURCES, resources, CACHE_EXPIRY.MEDIUM);
  },
  getById: async (id: number): Promise<Resource | null> => {
    return cacheService.get<Resource>(CACHE_KEYS.RESOURCE(id));
  },
  setById: async (id: number, resource: Resource): Promise<void> => {
    return cacheService.set(CACHE_KEYS.RESOURCE(id), resource, CACHE_EXPIRY.LONG);
  },
  getByProject: async (projectId: number): Promise<Resource[] | null> => {
    return cacheService.get<Resource[]>(CACHE_KEYS.RESOURCES_BY_PROJECT(projectId));
  },
  setByProject: async (projectId: number, resources: Resource[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.RESOURCES_BY_PROJECT(projectId), resources, CACHE_EXPIRY.MEDIUM);
  },
  invalidate: async (id?: number, projectId?: number): Promise<void> => {
    if (id) {
      await cacheService.remove(CACHE_KEYS.RESOURCE(id));
    }
    if (projectId) {
      await cacheService.remove(CACHE_KEYS.RESOURCES_BY_PROJECT(projectId));
    }
    await cacheService.remove(CACHE_KEYS.RESOURCES);
  },
};

export const findingCache = {
  getAll: async (): Promise<Finding[] | null> => {
    return cacheService.get<Finding[]>(CACHE_KEYS.FINDINGS);
  },
  setAll: async (findings: Finding[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.FINDINGS, findings, CACHE_EXPIRY.SHORT);
  },
  getById: async (id: number): Promise<Finding | null> => {
    return cacheService.get<Finding>(CACHE_KEYS.FINDING(id));
  },
  setById: async (id: number, finding: Finding): Promise<void> => {
    return cacheService.set(CACHE_KEYS.FINDING(id), finding, CACHE_EXPIRY.LONG);
  },
  getByExperiment: async (experimentId: number): Promise<Finding[] | null> => {
    return cacheService.get<Finding[]>(CACHE_KEYS.FINDINGS_BY_EXPERIMENT(experimentId));
  },
  setByExperiment: async (experimentId: number, findings: Finding[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.FINDINGS_BY_EXPERIMENT(experimentId), findings, CACHE_EXPIRY.MEDIUM);
  },
  invalidate: async (id?: number, experimentId?: number): Promise<void> => {
    if (id) {
      await cacheService.remove(CACHE_KEYS.FINDING(id));
    }
    if (experimentId) {
      await cacheService.remove(CACHE_KEYS.FINDINGS_BY_EXPERIMENT(experimentId));
    }
    await cacheService.remove(CACHE_KEYS.FINDINGS);
  },
};

export const dashboardCache = {
  getStats: async (): Promise<any | null> => {
    return cacheService.get(CACHE_KEYS.DASHBOARD_STATS);
  },
  setStats: async (stats: any): Promise<void> => {
    return cacheService.set(CACHE_KEYS.DASHBOARD_STATS, stats, CACHE_EXPIRY.SHORT);
  },
  getRecentActivity: async (): Promise<any[] | null> => {
    return cacheService.get(CACHE_KEYS.RECENT_ACTIVITY);
  },
  setRecentActivity: async (activity: any[]): Promise<void> => {
    return cacheService.set(CACHE_KEYS.RECENT_ACTIVITY, activity, CACHE_EXPIRY.SHORT);
  },
  invalidate: async (): Promise<void> => {
    await cacheService.remove(CACHE_KEYS.DASHBOARD_STATS);
    await cacheService.remove(CACHE_KEYS.RECENT_ACTIVITY);
  },
};
