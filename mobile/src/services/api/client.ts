import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cloudClient } from '../cloud/cloudClient';

const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_CLOUD_API_URL || process.env.CLOUD_API_URL || 'http://192.168.100.5:8000';

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private cloudMode: boolean = true;

  constructor() {
    const envApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
    this.baseURL = envApiUrl || DEFAULT_API_BASE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT || 30000),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadApiUrl();
    this.loadCloudMode();
  }

  private async loadApiUrl() {
    try {
      const envApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
      if (envApiUrl) {
        this.baseURL = envApiUrl;
        this.client.defaults.baseURL = envApiUrl;
        console.log(`[ApiClient] Enforcing API base URL from env: ${envApiUrl}`);
        return;
      }

      const savedApiUrl = await AsyncStorage.getItem('@api_base_url');
      if (savedApiUrl) {
        this.baseURL = savedApiUrl;
        this.client.defaults.baseURL = savedApiUrl;
      }
    } catch (error) {
      console.error('Error loading API URL:', error);
    }
  }

  private async loadCloudMode() {
    this.cloudMode = true; // Always enable cloud mode
    console.log(`[ApiClient] Cloud mode enforced: ${this.cloudMode}`);
  }

  public async updateBaseURL(newUrl: string) {
    this.baseURL = newUrl;
    this.client.defaults.baseURL = newUrl;
    await AsyncStorage.setItem('@api_base_url', newUrl);
  }

  public async setCloudMode(enabled: boolean) {
    this.cloudMode = true; // Always enable cloud mode
    console.log(`[ApiClient] setCloudMode call ignored - cloud mode is enforced`);
  }

  public isCloudMode(): boolean {
    return true; // Enforced for direct cloud-only operation
  }

  public async getCloudClient() {
    return cloudClient;
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          await AsyncStorage.removeItem('auth_token');
          // TODO: Navigate to login screen
        }
        return Promise.reject(error);
      }
    );
  }

  public getClient(): AxiosInstance {
    return this.client;
  }

  // Generic GET request
  public async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  // Generic POST request
  public async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  // Generic PUT request
  public async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  // Generic DELETE request
  public async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // Generic PATCH request
  public async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
