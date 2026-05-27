import { useCallback, useMemo } from 'react';
import { createAuthenticatedClient } from '@/lib/api';
import { AxiosInstance } from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { isPublicPath } from '@/lib/public-routes';

/**
 * Custom hook that provides an authenticated Axios instance using Auth0 tokens
 * This hook is compatible with the web app's useAuthApi interface
 * @param options Optional configuration options
 * @param options.scope Custom scopes to request (defaults to 'openid profile email')
 */
export const useAuthApi = (options?: {
  scope?: string;
}): {
  api: AxiosInstance;
  getToken: () => Promise<string>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
} => {
  const {
    getAccessToken,
    isAuthenticated,
    isLoading,
    error,
  } = useAuth();
  const router = useRouter();

  // Create a function to get tokens with error handling (compatible with web app)
  const getToken = useCallback(async (): Promise<string> => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }
      return token;
    } catch (e: any) {
      console.error('Error getting access token:', e);
      if (
        typeof window !== "undefined"
        && !isPublicPath(window.location.pathname)
      ) {
        router.push("/login");
      }
      throw e;
    }
  }, [getAccessToken, router]);

  // Create an authenticated API client
  const api = useMemo(() => createAuthenticatedClient(getToken), [getToken]);

  return {
    api,
    getToken,
    isAuthenticated,
    isLoading,
    error: error as Error | null,
  };
};

export default useAuthApi; 
