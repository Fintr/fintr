import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useMemo } from 'react';
import { createAuthenticatedClient } from '@/lib/api';
import { AxiosInstance } from 'axios';
import { useRouter } from 'next/navigation';

/**
 * Custom hook that provides an authenticated Axios instance using Auth0 tokens
 * @param options Optional configuration options
 * @param options.scope Custom scopes to request (defaults to 'openid profile email')
 */
export const useAuthApi = (options?: {
  scope?: string;
}): {
  api: AxiosInstance;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
} => {
  const {
    getAccessTokenSilently,
    loginWithRedirect,
    isAuthenticated,
    isLoading,
    error,
  } = useAuth0();
  const router = useRouter();

  // Create a function to get tokens with error handling
  const getToken = useCallback(async (): Promise<string> => {
    console.log('🔐 Getting access token...');
    console.log('🔐 Auth audience:', process.env.NEXT_PUBLIC_BE_URL);
    console.log('🔐 Is authenticated:', isAuthenticated);
    
    // Use custom scope from options if provided, otherwise use default
    const scope = options?.scope || 'openid profile email';

    const params = {
      audience: process.env.NEXT_PUBLIC_BE_URL,
      scope,
    }
    
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: params,
      });
      console.log('🔐 Token obtained successfully');
      return token;
    } catch (e: any) {
      console.error('Error getting access token:', e);
      // If consent is required, redirect to the consent page
      if (e.error === 'consent_required') {
        router.push('/consent');
      } else if (e.error === 'login_required') {
        await loginWithRedirect();
      }
      throw e;
    }
  }, [getAccessTokenSilently, options?.scope]);

  // Create an authenticated API client
  const api = useMemo(() => createAuthenticatedClient(getToken), [getToken]);

  return {
    api,
    isAuthenticated,
    isLoading,
    error: error as Error | null,
  };
};

export default useAuthApi; 
