import apiClient from './apiClient';

interface HealthCheckResponse {
  status: string;
  version: string;
  timestamp: string;
}

const healthCheckService = {
  checkBackendHealth: async () => {
    try {
      const response = await apiClient.get<HealthCheckResponse>('/health');
      return response;
    } catch (error) {
      console.error('Backend health check failed:', error);
      throw error;
    }
  },
};

export default healthCheckService;
