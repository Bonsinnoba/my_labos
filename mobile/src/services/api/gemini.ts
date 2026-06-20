import apiClient from './client';

export interface StageReviewRequest {
  stage_context: Record<string, any>;
}

export interface ComponentAlternatesRequest {
  component_details: string;
}

export interface FailureDiagnosisRequest {
  observation: string;
  experiment_history: Record<string, any>[];
}

export interface TestScriptRequest {
  requirement: string;
  language?: string;
}

export interface ChatRequest {
  message: string;
  conversation_history?: { role: string; parts: string }[];
}

export const geminiApi = {
  // Feature A: Stage Design Reviewer
  reviewStageDesign: async (request: StageReviewRequest): Promise<string> => {
    const response = await apiClient.post<string>('/api/mobile/ai/stage-review', request);
    return response.data;
  },

  // Feature B: Smart Substitute Finder
  findComponentAlternates: async (request: ComponentAlternatesRequest): Promise<string> => {
    const response = await apiClient.post<string>('/api/mobile/ai/component-alternates', request);
    return response.data;
  },

  // Feature C: Failure Mode Analyzer
  diagnoseCircuitFailure: async (request: FailureDiagnosisRequest): Promise<string> => {
    const response = await apiClient.post<string>('/api/mobile/ai/failure-diagnosis', request);
    return response.data;
  },

  // Feature D: Lab Automation Scripting
  generateTestScript: async (request: TestScriptRequest): Promise<string> => {
    const response = await apiClient.post<string>('/api/mobile/ai/test-script', request);
    return response.data;
  },

  // General Chat Interface
  chat: async (request: ChatRequest): Promise<string> => {
    const response = await apiClient.post<string>('/api/mobile/ai/chat', request);
    return response.data;
  },
};
