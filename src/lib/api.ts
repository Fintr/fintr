import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { triggerSessionExpiration } from './session-expiration-handler';

// Shared response error handler
const handleResponseError = (error: AxiosError) => {
  const status = error.response?.status;
  console.error("API Response Error:", status, error.config?.url, error.message);

  // Check for session expiration error
  const responseData = error.response?.data as { message?: string } | undefined;
  const errorMessage = responseData?.message || '';
  
  if (errorMessage.includes('Bad credentials: Signature has expired')) {
    console.error('Session expired: Signature has expired');
    triggerSessionExpiration();
    return Promise.reject(error);
  }

  if (status === 401) {
    console.error('Authentication error: Unauthorized');
    // Potentially trigger re-authentication or redirect
  } else if (status === 403) {
    console.error('Authorization error: Forbidden');
  } else if (status === 404) {
    console.error('Resource not found');
  } else if (status && status >= 500) {
    console.error('Server error');
  }

  return Promise.reject(error);
};

// Base API client configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  handleResponseError
);

// Create an authenticated API client factory
export const createAuthenticatedClient = (getToken: () => Promise<string>): AxiosInstance => {
  const authClient = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_BE_URL}/api/v1`,
    headers: {
      'Content-Type': 'application/json',
      },
  });
  
  // Add auth token to all requests from this client
  authClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
        const spaceCode = localStorage.getItem('spaceCode');
        if (spaceCode) {
          config.headers.set('X-Space-Code', spaceCode);
        }
        return config;
      } catch (error) {
        console.error('Error getting auth token:', error);
        return config;
      }
    }
  );
  
  // Add the same response interceptor
  authClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    handleResponseError
  );
  
  return authClient;
};

export default apiClient; 
