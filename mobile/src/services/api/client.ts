import { Platform } from 'react-native';
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cloudClient } from '../cloud/cloudClient';

const DEFAULT_LOCAL_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const DEFAULT_CLOUD_API_BASE_URL = process.env.EXPO_PUBLIC_CLOUD_API_URL || process.env.CLOUD_API_URL || ''; 

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private cloudMode: boolean = false;
  private localApiUrl: string = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '';
  private cloudApiUrl: string = DEFAULT_CLOUD_API_BASE_URL;
  private ready: Promise<void>;

  constructor() {
    this.baseURL = this.localApiUrl || DEFAULT_LOCAL_API_BASE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT || 30000),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.ready = this.initialize();
  }

  private async initialize() {
    await this.loadApiUrl();
    await this.loadCloudMode();
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
        return;
      }

      if (this.localApiUrl) {
        this.baseURL = this.localApiUrl;
        this.client.defaults.baseURL = this.localApiUrl;
      } else {
        this.baseURL = DEFAULT_LOCAL_API_BASE_URL;
        this.client.defaults.baseURL = DEFAULT_LOCAL_API_BASE_URL;
      }
    } catch (error) {
      console.error('Error loading API URL:', error);
    }
  }

  private async loadCloudMode() {
    try {
      const savedCloudMode = await AsyncStorage.getItem('@cloud_enabled');
      this.cloudMode = savedCloudMode === 'true';
      if (this.cloudMode && this.cloudApiUrl) {
        this.baseURL = this.cloudApiUrl;
      } else {
        const savedApiUrl = await AsyncStorage.getItem('@api_base_url');
        this.baseURL = this.localApiUrl || savedApiUrl || DEFAULT_LOCAL_API_BASE_URL;
      }
      this.client.defaults.baseURL = this.baseURL;
      console.log(`[ApiClient] Cloud mode loaded: ${this.cloudMode}, baseURL: ${this.baseURL}`);
    } catch (error) {
      console.error('Error loading cloud mode:', error);
    }
  }

  public async updateBaseURL(newUrl: string) {
    this.baseURL = newUrl;
    this.client.defaults.baseURL = newUrl;
    await AsyncStorage.setItem('@api_base_url', newUrl);
  }

  public async setCloudMode(enabled: boolean) {
    this.cloudMode = enabled;
    await AsyncStorage.setItem('@cloud_enabled', enabled ? 'true' : 'false');

    if (enabled && this.cloudApiUrl) {
      this.baseURL = this.cloudApiUrl;
    } else {
      const savedApiUrl = await AsyncStorage.getItem('@api_base_url');
      this.baseURL = this.localApiUrl || savedApiUrl || DEFAULT_LOCAL_API_BASE_URL;
    }
    this.client.defaults.baseURL = this.baseURL;
    console.log(`[ApiClient] setCloudMode: ${this.cloudMode}, baseURL: ${this.baseURL}`);
  }

  public isCloudMode(): boolean {
    return this.cloudMode;
  }

  public getBaseURL(): string {
    return this.baseURL;
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

  private async ensureReady() {
    await this.ready;
  }

  // Generic GET request
  public async get<T>(url: string, params?: any): Promise<T> {
    await this.ensureReady();
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  // Generic POST request
  public async post<T>(url: string, data?: any): Promise<T> {
    await this.ensureReady();
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  // Generic PUT request
  public async put<T>(url: string, data?: any): Promise<T> {
    await this.ensureReady();
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  // Generic DELETE request
  public async delete<T>(url: string): Promise<T> {
    await this.ensureReady();
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // Generic PATCH request
  public async patch<T>(url: string, data?: any): Promise<T> {
    await this.ensureReady();
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
