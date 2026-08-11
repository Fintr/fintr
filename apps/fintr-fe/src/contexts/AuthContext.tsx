"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  loginWithCredentials,
  signupWithCredentials,
  refreshAccessToken,
  getUserProfile,
  LoginCredentials,
  SignupCredentials,
  LoginResponse,
} from '@/services/auth/login';
import {
  AuthStorage,
  AuthUser,
  AuthStorageData,
  AuthTokens,
  isJwtToken,
  resolveApiBearerToken,
} from '@/lib/auth-storage';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<LoginResponse | null>(null);
  const router = useRouter();

  const resolveUserProfile = async (
    response: LoginResponse
  ): Promise<AuthUser> => {
    const decodedProfile = response.id_token
      ? AuthStorage.decodeJWT(response.id_token)
      : null;

    if (decodedProfile) {
      return decodedProfile;
    }

    const profileFromUserInfo = await getUserProfile(response.access_token);
    if (!profileFromUserInfo?.sub) {
      throw new Error('Failed to decode user profile from token');
    }

    return {
      ...profileFromUserInfo,
      name:
        profileFromUserInfo.name ||
        profileFromUserInfo.nickname ||
        profileFromUserInfo.email ||
        profileFromUserInfo.sub,
      email: profileFromUserInfo.email || '',
    } as AuthUser;
  };

  // Check for existing authentication
  const checkAuth = async () => {
    // Set a timeout to ensure loading state doesn't hang forever
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 10000); // 10 second timeout
    
    try {
      setIsLoading(true);
      
      // Migrate from old storage format if needed
      AuthStorage.migrateFromOldFormat();
      
      // Get auth data from unified storage
      const authData = AuthStorage.getAuthData();
      
      if (authData && AuthStorage.isAuthenticated()) {
        // Convert AuthTokens to LoginResponse format for compatibility
        const loginResponse: LoginResponse = {
          access_token: authData.tokens.access_token,
          id_token: authData.tokens.id_token,
          refresh_token: authData.tokens.refresh_token,
          expires_in: authData.tokens.expires_in,
          token_type: authData.tokens.token_type,
          scope: authData.tokens.scope,
        };
        setTokens(loginResponse);
        setUser(authData.user);
      } else {
        setTokens(null);
        setUser(null);
      }
    } catch (error) {
      console.error('❌ checkAuth error:', error);
      // Clear invalid data
      AuthStorage.clearAuthData();
      setTokens(null);
      setUser(null);
    } finally {
      clearTimeout(timeoutId); // Clear the timeout if we finish normally
      setIsLoading(false);
    }
  };

  // Check for existing authentication on mount
  useEffect(() => {
    // Wrap in try-catch to ensure errors don't break the app
    const initAuth = async () => {
      try {
        await checkAuth();
      } catch (error) {
        console.error('❌ AuthProvider: Failed to initialize auth:', error);
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!tokens?.refresh_token) return;

    const refreshInterval = setInterval(async () => {
      try {
        if (!tokens.refresh_token) return;
        const newTokens = await refreshAccessToken(tokens.refresh_token);
        setTokens(newTokens);
        
        // Update storage with new tokens
        const authData = AuthStorage.getAuthData();
        if (authData) {
          // Convert LoginResponse to AuthTokens format
          const authTokens: AuthTokens = {
            access_token: newTokens.access_token,
            id_token: newTokens.id_token,
            refresh_token: newTokens.refresh_token,
            expires_in: newTokens.expires_in,
            token_type: newTokens.token_type,
            scope: newTokens.scope,
          };

          const updatedAuthData: AuthStorageData = {
            ...authData,
            tokens: authTokens,
            expires_at: Date.now() + (newTokens.expires_in * 1000),
            issued_at: Date.now(),
          };
          AuthStorage.setAuthData(updatedAuthData);
          
          // Update user profile from new ID token
          const userProfile = AuthStorage.decodeJWT(newTokens.id_token);
          if (userProfile) {
            setUser(userProfile);
            updatedAuthData.user = userProfile;
            AuthStorage.setAuthData(updatedAuthData);
          }
        }
      } catch (error) {
        logout();
      }
    }, (tokens.expires_in - 60) * 1000); // Refresh 1 minute before expiry

    return () => clearInterval(refreshInterval);
  }, [tokens]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setError(null);

      const response = await loginWithCredentials(credentials);

      const userProfile = await resolveUserProfile(response);

      // Convert LoginResponse to AuthTokens format
      const authTokens: AuthTokens = {
        access_token: response.access_token,
        id_token: response.id_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
        token_type: response.token_type,
        scope: response.scope,
      };

      const authData: AuthStorageData = {
        tokens: authTokens,
        user: userProfile,
        expires_at: Date.now() + (response.expires_in * 1000),
        issued_at: Date.now(),
      };

      AuthStorage.setAuthData(authData);
      setTokens(response);
      setUser(userProfile);
    } catch (error: any) {
      console.error('❌ AuthContext.login: Login failed:', error.message);
      setError(error.message || 'Login failed');
      throw error;
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    try {
      setError(null);

      const response = await signupWithCredentials(credentials);

      const userProfile = await resolveUserProfile(response);

      // Convert SignupResponse to AuthTokens format
      const authTokens: AuthTokens = {
        access_token: response.access_token,
        id_token: response.id_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
        token_type: response.token_type,
        scope: response.scope,
      };

      const authData: AuthStorageData = {
        tokens: authTokens,
        user: userProfile,
        expires_at: Date.now() + (response.expires_in * 1000),
        issued_at: Date.now(),
      };

      AuthStorage.setAuthData(authData);
      setTokens(response);
      setUser(userProfile);
    } catch (error: any) {
      setError(error.message || 'Signup failed');
      throw error;
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setTokens(null);
    setError(null);
    AuthStorage.clearAuthData();
    router.push('/login');
  }, [router]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      // First try to get token from state
      if (tokens?.access_token) {
        // Check if token is expired and refresh if needed
        const authData = AuthStorage.getAuthData();
        if (authData) {
          const now = Date.now();
          const isExpired = authData.expires_at <= now;

          if (isExpired) {
            try {
              if (tokens.refresh_token) {
                const newTokens = await refreshAccessToken(tokens.refresh_token);
                setTokens(newTokens);
                
                // Update storage with new tokens
                const authTokens: AuthTokens = {
                  access_token: newTokens.access_token,
                  id_token: newTokens.id_token,
                  refresh_token: newTokens.refresh_token,
                  expires_in: newTokens.expires_in,
                  token_type: newTokens.token_type,
                  scope: newTokens.scope,
                };

                const updatedAuthData: AuthStorageData = {
                  ...authData,
                  tokens: authTokens,
                  expires_at: Date.now() + (newTokens.expires_in * 1000),
                  issued_at: Date.now(),
                };
                AuthStorage.setAuthData(updatedAuthData);
                
                const refreshedApiToken = resolveApiBearerToken(newTokens);
                if (!isJwtToken(refreshedApiToken)) {
                  console.error('🔑 getAccessToken: Refreshed tokens are not valid JWTs');
                  logout();
                  return null;
                }

                return refreshedApiToken;
              }
            } catch (error) {
              logout();
              return null;
            }
          }
        }
        
        const apiToken = resolveApiBearerToken(tokens);

        if (!isJwtToken(apiToken)) {
          console.error('🔑 getAccessToken: No valid JWT for API requests');
          return null;
        }

        return apiToken;
      }

      // Fallback: try to get token from storage directly
      const authData = AuthStorage.getAuthData();
      if (authData && AuthStorage.isAuthenticated()) {
        // Update state with data from storage if state is not populated
        if (!tokens) {
          const loginResponse: LoginResponse = {
            access_token: authData.tokens.access_token,
            id_token: authData.tokens.id_token,
            refresh_token: authData.tokens.refresh_token,
            expires_in: authData.tokens.expires_in,
            token_type: authData.tokens.token_type,
            scope: authData.tokens.scope,
          };
          setTokens(loginResponse);
          setUser(authData.user);
        }

        const storedApiToken = resolveApiBearerToken(authData.tokens);
        if (!isJwtToken(storedApiToken)) {
          console.error('🔑 getAccessToken: Stored tokens are not valid JWTs');
          return null;
        }

        return storedApiToken;
      }

      return null;
    } catch (error) {
      return null;
    }
  }, [tokens, logout]);

  // Calculate isAuthenticated more efficiently
  const isAuthenticated = useMemo(() => {
    // Check if we have both user and tokens
    if (!user || !tokens?.access_token) {
      return false;
    }
    
    // Check token expiration
    const authData = AuthStorage.getAuthData();
    if (authData) {
      const now = Date.now();
      const isExpired = authData.expires_at <= now;
      return !isExpired;
    }
    
    // Fallback: if we have user and tokens but no authData, assume authenticated
    return true;
  }, [user, tokens]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    logout,
    getAccessToken,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
