import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { getPublicBackendUrl } from '@/lib/public-backend-url';
import { triggerSessionExpiration } from './session-expiration-handler';
import { AuthStorage } from '@/lib/auth-storage';

const AUTH_BOOTSTRAP_PATHS = ["/auth/private"];

const isAuthBootstrapRequest = (url?: string) => {
  if (!url) {
    return false;
  }

  return AUTH_BOOTSTRAP_PATHS.some((path) => url.includes(path));
};

const hasFreshAuthSession = () => {
  const authData = AuthStorage.getAuthData();

  if (!authData?.issued_at) {
    return false;
  }

  return Date.now() - authData.issued_at < 15000;
};

/**
 * rack-mini-profiler patches `window.fetch` to read `X-MiniProfiler-Ids` from API responses.
 * Its XMLHttpRequest hook explicitly ignores cross-origin responses (SPA on :5173 vs API on :3001),
 * so Axios must use the fetch adapter in the browser during development; default is XHR-first.
 *
 * @see https://github.com/MiniProfiler/rack-mini-profiler/blob/main/lib/html/includes.js (XHR load handler)
 */
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "development"
) {
  axios.defaults.adapter = ["fetch", "xhr", "http"];
}

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
  
  if (
    errorMessage.includes('Bad credentials: Signature has expired') ||
    errorMessage.includes('Bad credentials: Not enough or too many segments')
  ) {
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

    if (isAuthBootstrapRequest(url) && hasFreshAuthSession()) {
      console.warn('⚠️ 401 during auth bootstrap — allowing retry without clearing session');
      return Promise.reject(error);
    }

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

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const resolved = getPublicBackendUrl();
  if (resolved) {
    config.baseURL = resolved;
  }
  return config;
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
      const resolved = getPublicBackendUrl() ?? process.env.NEXT_PUBLIC_BE_URL;
      if (resolved) {
        config.baseURL = `${resolved}/api/v1`;
      }

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
