import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Enhanced authentication hook that provides both popup and redirect login options
 * while maintaining all required Auth0 attributes and scopes
 */
export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    loginWithPopup,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
  } = useAuth0();
  
  const router = useRouter();

  // Common authorization parameters to ensure consistency
  const authParams = {
    audience: process.env.NEXT_PUBLIC_BE_URL,
    scope: 'openid profile email read:current_user read:users read:transactions offline_access',
  };

  /**
   * Login using redirect (preferred for iOS apps)
   * This works better in mobile app environments
   */
  const loginWithRedirectAuth = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: authParams,
      });
    } catch (error) {
      console.error('Redirect login failed:', error);
      throw error;
    }
  }, [loginWithRedirect]);

  /**
   * Login using popup (fallback option)
   * Use this if redirect doesn't work in certain environments
   */
  const loginWithPopupAuth = useCallback(async () => {
    try {
      await loginWithPopup({
        authorizationParams: authParams,
      });
    } catch (error) {
      console.error('Popup login failed:', error);
      throw error;
    }
  }, [loginWithPopup]);

  /**
   * Smart login that uses redirect for iOS apps
   */
  const login = useCallback(async () => {
    try {
      await loginWithRedirectAuth();
    } catch (error) {
      console.warn('Redirect login failed, trying popup:', error);
      await loginWithPopupAuth();
    }
  }, [loginWithRedirectAuth, loginWithPopupAuth]);

  /**
   * Get access token silently
   */
  const getAccessToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: authParams,
      });
    } catch (error: any) {
      console.error('Error getting access token:', error);
      
      // Handle specific error cases
      if (error.error === 'consent_required') {
        router.push('/consent');
      } else if (error.error === 'login_required') {
        await login();
      }
      
      throw error;
    }
  }, [getAccessTokenSilently, login, router]);

  /**
   * Get access token with popup (for consent scenarios)
   */
  const getAccessTokenWithPopupAuth = useCallback(async () => {
    try {
      return await getAccessTokenWithPopup({
        authorizationParams: authParams,
      });
    } catch (error) {
      console.error('Error getting access token with popup:', error);
      throw error;
    }
  }, [getAccessTokenWithPopup]);

  /**
   * Logout with return URL
   */
  const logoutAuth = useCallback(() => {
    logout({
      logoutParams: {
        returnTo: process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin,
      },
    });
  }, [logout]);

  return {
    // Auth0 state
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // Login methods
    login,
    loginWithPopup: loginWithPopupAuth,
    loginWithRedirect: loginWithRedirectAuth,
    
    // Token methods
    getAccessToken,
    getAccessTokenWithPopup: getAccessTokenWithPopupAuth,
    
    // Logout
    logout: logoutAuth,
    
    // Auth parameters (for reference)
    authParams,
  };
};

export default useAuth;
