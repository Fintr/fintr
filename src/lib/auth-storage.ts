/**
 * Unified Auth Storage Utility
 * 
 * This utility provides a consistent storage interface that mimics Auth0 SDK's storage format
 * while working with our custom authentication flow. This ensures compatibility between
 * the web app (Auth0 SDK) and iOS app (custom auth) storage patterns.
 */

export interface AuthTokens {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  desktop_tutorial?: string | null;
  mobile_tutorial?: string | null;
  [key: string]: any;
}

export interface AuthStorageData {
  tokens: AuthTokens;
  user: AuthUser;
  expires_at: number; // Unix timestamp
  issued_at: number; // Unix timestamp when token was issued
}

// Auth0 SDK compatible localStorage keys
const AUTH0_KEYS = {
  ACCESS_TOKEN: '@@auth0@@.access_token',
  ID_TOKEN: '@@auth0@@.id_token', 
  REFRESH_TOKEN: '@@auth0@@.refresh_token',
  EXPIRES_AT: '@@auth0@@.expires_at',
  USER: '@@auth0@@.user',
  SCOPE: '@@auth0@@.scope',
} as const;

// Our custom storage key (fallback)
const CUSTOM_AUTH_KEY = 'auth_tokens';

/**
 * Check if we're running in a browser environment
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Get Auth0-compatible storage key with domain suffix
 */
const getAuth0Key = (key: string): string => {
  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN?.replace(/\./g, '_') || 'default';
  return `${key}.${domain}`;
};

/**
 * Unified Auth Storage Class
 */
export class AuthStorage {
  /**
   * Store authentication data in Auth0-compatible format
   */
  static setAuthData(data: AuthStorageData): void {
    if (!isBrowser) return;

    try {
      const { tokens, user, expires_at, issued_at } = data;
      
      // Store tokens in Auth0-compatible format
      localStorage.setItem(getAuth0Key(AUTH0_KEYS.ACCESS_TOKEN), tokens.access_token);
      localStorage.setItem(getAuth0Key(AUTH0_KEYS.ID_TOKEN), tokens.id_token);
      localStorage.setItem(getAuth0Key(AUTH0_KEYS.REFRESH_TOKEN), tokens.refresh_token || '');
      localStorage.setItem(getAuth0Key(AUTH0_KEYS.EXPIRES_AT), expires_at.toString());
      localStorage.setItem(getAuth0Key(AUTH0_KEYS.USER), JSON.stringify(user));
      localStorage.setItem(getAuth0Key(AUTH0_KEYS.SCOPE), tokens.scope);
      
      // Store issued_at separately
      localStorage.setItem(getAuth0Key('@@auth0@@.issued_at'), issued_at.toString());
      
      // Also store in our custom format for backward compatibility
      localStorage.setItem(CUSTOM_AUTH_KEY, JSON.stringify(tokens));
    } catch (error) {
      // Silent fail on storage error
    }
  }

  /**
   * Get authentication data from storage
   */
  static getAuthData(): AuthStorageData | null {
    if (!isBrowser) return null;

    try {
      // Try Auth0-compatible format first
      const accessToken = localStorage.getItem(getAuth0Key(AUTH0_KEYS.ACCESS_TOKEN));
      const idToken = localStorage.getItem(getAuth0Key(AUTH0_KEYS.ID_TOKEN));
      const refreshToken = localStorage.getItem(getAuth0Key(AUTH0_KEYS.REFRESH_TOKEN));
      const expiresAt = localStorage.getItem(getAuth0Key(AUTH0_KEYS.EXPIRES_AT));
      const userStr = localStorage.getItem(getAuth0Key(AUTH0_KEYS.USER));
      const scope = localStorage.getItem(getAuth0Key(AUTH0_KEYS.SCOPE));
      const issuedAt = localStorage.getItem(getAuth0Key('@@auth0@@.issued_at'));

      if (accessToken && idToken && userStr && expiresAt) {
        const user = JSON.parse(userStr);
        const tokens: AuthTokens = {
          access_token: accessToken,
          id_token: idToken,
          refresh_token: refreshToken || undefined,
          expires_in: Math.floor((parseInt(expiresAt) - Date.now()) / 1000),
          token_type: 'Bearer',
          scope: scope || 'openid profile email read:current_user read:users read:transactions offline_access',
        };

        return {
          tokens,
          user,
          expires_at: parseInt(expiresAt),
          issued_at: issuedAt ? parseInt(issuedAt) : Date.now() - (tokens.expires_in * 1000),
        };
      }

      // Fallback to custom format
      const customAuth = localStorage.getItem(CUSTOM_AUTH_KEY);
      
      if (customAuth) {
        try {
          const customTokens = JSON.parse(customAuth);
          
          // Validate that we have the required token fields
          if (!customTokens.id_token || !customTokens.access_token) {
            return null;
          }
          
          const tokens: AuthTokens = {
            ...customTokens,
            scope: customTokens.scope || 'openid profile email read:current_user read:users read:transactions offline_access',
          };
          const user = this.decodeJWT(tokens.id_token);
          
          if (user) {
            const expires_at = Date.now() + (tokens.expires_in * 1000);
            const issued_at = Date.now() - (tokens.expires_in * 1000);
            return { tokens, user, expires_at, issued_at };
          }
        } catch (error) {
          // Clear invalid data
          localStorage.removeItem(CUSTOM_AUTH_KEY);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all authentication data
   */
  static clearAuthData(): void {
    if (!isBrowser) return;

    try {
      // Clear Auth0-compatible keys
      Object.values(AUTH0_KEYS).forEach(key => {
        localStorage.removeItem(getAuth0Key(key));
      });
      
      // Clear custom key
      localStorage.removeItem(CUSTOM_AUTH_KEY);
    } catch (error) {
      // Silent fail on storage error
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const authData = this.getAuthData();
    if (!authData) {
      return false;
    }

    // Check if token is expired
    const now = Date.now();
    const isExpired = authData.expires_at <= now;

    return !isExpired;
  }

  /**
   * Get access token
   */
  static getAccessToken(): string | null {
    const authData = this.getAuthData();
    return authData?.tokens.access_token || null;
  }

  /**
   * Get refresh token
   */
  static getRefreshToken(): string | null {
    const authData = this.getAuthData();
    return authData?.tokens.refresh_token || null;
  }

  /**
   * Get user data
   */
  static getUser(): AuthUser | null {
    const authData = this.getAuthData();
    return authData?.user || null;
  }

  /**
   * Check if token needs refresh (expires in next 5 minutes)
   */
  static needsRefresh(): boolean {
    const authData = this.getAuthData();
    if (!authData) return false;

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return authData.expires_at - now < fiveMinutes;
  }

  /**
   * Decode JWT token to extract user data
   */
  static decodeJWT(token: string): AuthUser | null {
    try {
      // Check if token exists and has the correct format
      if (!token || typeof token !== 'string') {
        return null;
      }

      // Check if token has the correct JWT format (3 parts separated by dots)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const base64Url = parts[1];
      if (!base64Url) {
        return null;
      }

      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  }

  /**
   * Migrate from old storage format to new format
   */
  static migrateFromOldFormat(): void {
    if (!isBrowser) return;

    try {
      // Check if we have old format data
      const oldTokens = localStorage.getItem(CUSTOM_AUTH_KEY);
      if (!oldTokens) return;

      const customTokens = JSON.parse(oldTokens);
      
      // Validate old tokens before migration
      if (!customTokens.id_token || !customTokens.access_token) {
        localStorage.removeItem(CUSTOM_AUTH_KEY);
        return;
      }

      const tokens: AuthTokens = {
        ...customTokens,
        scope: customTokens.scope || 'openid profile email read:current_user read:users read:transactions offline_access',
      };
      const user = this.decodeJWT(tokens.id_token);
      
      if (user) {
        const expires_at = Date.now() + (tokens.expires_in * 1000);
        const issued_at = Date.now() - (tokens.expires_in * 1000);
        this.setAuthData({ tokens, user, expires_at, issued_at });
      } else {
        localStorage.removeItem(CUSTOM_AUTH_KEY);
      }
    } catch (error) {
      // Clear invalid old data
      localStorage.removeItem(CUSTOM_AUTH_KEY);
    }
  }
}

/**
 * Hook for using Auth0-compatible storage
 */
export const useAuthStorage = () => {
  const getAuthData = () => AuthStorage.getAuthData();
  const setAuthData = (data: AuthStorageData) => AuthStorage.setAuthData(data);
  const clearAuthData = () => AuthStorage.clearAuthData();
  const isAuthenticated = () => AuthStorage.isAuthenticated();
  const getAccessToken = () => AuthStorage.getAccessToken();
  const getRefreshToken = () => AuthStorage.getRefreshToken();
  const getUser = () => AuthStorage.getUser();
  const needsRefresh = () => AuthStorage.needsRefresh();

  return {
    getAuthData,
    setAuthData,
    clearAuthData,
    isAuthenticated,
    getAccessToken,
    getRefreshToken,
    getUser,
    needsRefresh,
  };
};
