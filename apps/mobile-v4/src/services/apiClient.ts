/**
 * API client for making requests to the backend
 * 
 * IMPORTANT: Update DEV_MACHINE_IP to your development machine's IP address
 * Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
 * Look for the 192.168.x.x or similar address on your local network
 */

import { Platform } from 'react-native';

// CHANGE THIS to your development machine's IP address
// This is needed because iOS simulator can't access localhost/127.0.0.1 on the host machine
const DEV_MACHINE_IP = '192.168.86.35';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Determine default URL based on platform
    // iOS simulator needs the host machine's IP address
    // Android emulator can use 10.0.2.2 to access host machine
    let defaultUrl: string;
    
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host machine's localhost
      defaultUrl = 'http://10.0.2.2:8787';
    } else {
      // iOS simulator needs the actual machine IP address
      defaultUrl = `http://${DEV_MACHINE_IP}:8787`;
    }
    
    // Use environment variable if set, otherwise use platform-appropriate default
    this.baseUrl = baseUrl || process.env.EXPO_PUBLIC_API_URL || defaultUrl;
    
    // Log the URL being used (only in development)
    if (__DEV__) {
      console.log(`[ApiClient] Platform: ${Platform.OS}`);
      console.log(`[ApiClient] Using API URL: ${this.baseUrl}`);
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      if (__DEV__) {
        console.log(`[ApiClient] GET ${url}`);
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      // Wrap network errors to preserve error type information
      // Network errors typically throw TypeError with messages like "Network request failed", "Failed to fetch", "Network request timed out", etc.
      if (err instanceof TypeError && (
        err.message.includes('Network request failed') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('Network request timed out') ||
        err.message.includes('timed out') ||
        err.message.includes('network')
      )) {
        if (__DEV__) {
          console.error(`[ApiClient] Network error for ${url}:`, err);
        }
        const networkError = new Error(`Network request failed - API server may not be running (tried: ${url})`);
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = err;
        (networkError as any).url = url;
        throw networkError;
      }
      throw err;
    }
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      // Wrap network errors to preserve error type information
      // Network errors typically throw TypeError with messages like "Network request failed", "Failed to fetch", "Network request timed out", etc.
      if (err instanceof TypeError && (
        err.message.includes('Network request failed') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('Network request timed out') ||
        err.message.includes('timed out') ||
        err.message.includes('network')
      )) {
        const networkError = new Error('Network request failed - API server may not be running');
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = err;
        throw networkError;
      }
      throw err;
    }
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      // Wrap network errors to preserve error type information
      // Network errors typically throw TypeError with messages like "Network request failed", "Failed to fetch", "Network request timed out", etc.
      if (err instanceof TypeError && (
        err.message.includes('Network request failed') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('Network request timed out') ||
        err.message.includes('timed out') ||
        err.message.includes('network')
      )) {
        const networkError = new Error('Network request failed - API server may not be running');
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = err;
        throw networkError;
      }
      throw err;
    }
  }

  async delete<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      // Wrap network errors to preserve error type information
      // Network errors typically throw TypeError with messages like "Network request failed", "Failed to fetch", "Network request timed out", etc.
      if (err instanceof TypeError && (
        err.message.includes('Network request failed') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('Network request timed out') ||
        err.message.includes('timed out') ||
        err.message.includes('network')
      )) {
        const networkError = new Error('Network request failed - API server may not be running');
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = err;
        throw networkError;
      }
      throw err;
    }
  }
}

export const apiClient = new ApiClient();
