import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { triggerSessionExpiration } from './session-expiration-handler';

// Shared response error handler
const handleResponseError = (error: AxiosError) => {
  const status = error.response?.status;
  const url = error.config?.url;
  console.error("❌ API Response Error:", {
    status,
    url,
    message: error.message,
    responseData: error.response?.data,
  });

  // Check for session expiration error
  const responseData = error.response?.data as {
    message?: string;
    details?: any;
    error?: string | { message?: string; details?: any };
  } | undefined;
  const errorMessage = typeof responseData?.error === "string"
    ? responseData.error
    : responseData?.error?.message || responseData?.message || "";
  
  console.error('❌ API Error Details:', {
    message: responseData?.message,
    error: responseData?.error,
    details: responseData?.details,
  });
  
  if (errorMessage.includes('Bad credentials: Signature has expired')) {
    console.error('Session expired: Signature has expired');
    // Only trigger if we're not already on a public route
    if (typeof window !== 'undefined') {
      const publicRoutes = ['/login', '/auth', '/auth-callback'];
      const currentPath = window.location.pathname;
      if (!publicRoutes.some(route => currentPath.startsWith(route))) {
        triggerSessionExpiration();
      }
    }
    return Promise.reject(error);
  }

  if (status === 401) {
    console.error('Authentication error: Unauthorized');
    // Clear auth and redirect to login
    if (typeof window !== 'undefined') {
      const publicRoutes = ['/login', '/auth', '/auth-callback', '/consent', '/', '/pricing', '/contact-us', '/privacy-policy', '/terms-of-service', '/waitlist', '/whats-next'];
      const currentPath = window.location.pathname;
      if (!publicRoutes.some(route => currentPath.startsWith(route))) {
        console.log('🔒 401: Redirecting to login...');
        // Clear storage
        localStorage.removeItem('fintr_auth_data');
        sessionStorage.clear();
        // Redirect to login
        window.location.href = '/login';
      }
    }
  } else if (status === 403) {
    console.error('Authorization error: Forbidden - Access denied');
    // For 403, we might not have permission to a specific space/resource
    // Don't automatically logout, but log clearly
    if (typeof window !== 'undefined') {
      // Check if this is a space-related 403
      const url = error.config?.url || '';
      if (url.includes('/spaces') || url.includes('/transactions')) {
        console.warn('⚠️ 403: No access to this space or resource');
        // User might need to select a different space or request access
      }
    }
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
  (response: AxiosResponse) => {
    console.log('✅ API Response Success:', {
      status: response.status,
      url: response.config.url,
      dataKeys: response.data ? Object.keys(response.data) : [],
    });
    return response;
  },
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
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
      });
      
      try {
        console.log('🔑 Getting auth token...');
        const token = await getToken();
        if (token) {
          const tokenParts = token.split('.');
          console.log('✅ Auth token obtained', {
            tokenLength: token.length,
            tokenParts: tokenParts.length,
            tokenType: tokenParts.length === 3 ? 'JWT' : tokenParts.length === 5 ? 'JWE' : 'Unknown',
            prefix: token.substring(0, 50) + '...',
            suffix: '...' + token.substring(token.length - 20),
          });
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          console.warn('⚠️ No auth token available');
        }
        
        const spaceCode = localStorage.getItem('spaceCode');
        if (spaceCode) {
          console.log('🏢 Adding space code to request:', spaceCode);
          config.headers.set('X-Space-Code', spaceCode);
        }
        
        return config;
      } catch (error) {
        console.error('❌ Error getting auth token:', error);
        return config;
      }
    }
  );
  
  // Add the same response interceptor
  authClient.interceptors.response.use(
    (response: AxiosResponse) => {
      console.log('✅ API Response Success:', {
        status: response.status,
        url: response.config.url,
        dataKeys: response.data ? Object.keys(response.data) : [],
      });
      return response;
    },
    handleResponseError
  );
  
  return authClient;
};

export default apiClient; 
