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
    const params = {
      audience: process.env.NEXT_PUBLIC_BE_URL,
      scope: 'openid profile email read:current_user read:users read:transactions offline_access',
      // Important NOTE: for the Safari / Mobile apps to work and not infinitely reload, the scope has to be the same as the one set in the Auth0Provider. 
    }
    
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: params,
      });
      return token;
    } catch (e: any) {
      console.error('Error getting access token:', e);
      // If consent is required, redirect to the consent page
      if (e.error === 'consent_required') {
        router.push('/consent');
      } else if (e.error === 'login_required') {
        console.log('login_required');
        await loginWithRedirect();
      }
      throw e;
      // return '';
    }
  }, [getAccessTokenSilently, loginWithRedirect, router, options?.scope]);

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
