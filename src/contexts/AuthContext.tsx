"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithCredentials, signupWithCredentials, refreshAccessToken, LoginCredentials, SignupCredentials, LoginResponse } from '@/services/auth/login';
import { AuthStorage, AuthUser, AuthStorageData, AuthTokens } from '@/lib/auth-storage';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
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

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
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
        // Clear invalid data
        AuthStorage.clearAuthData();
        setTokens(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
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
      setIsLoading(true);
      setError(null);

      const response = await loginWithCredentials(credentials);
      
      // Store tokens and user data in unified storage
      const userProfile = AuthStorage.decodeJWT(response.id_token);
      if (!userProfile) {
        throw new Error('Failed to decode user profile from token');
      }

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
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await signupWithCredentials(credentials);
      
      // Store tokens and user data in unified storage
      const userProfile = AuthStorage.decodeJWT(response.id_token);
      if (!userProfile) {
        throw new Error('Failed to decode user profile from token');
      }

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
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    setError(null);
    AuthStorage.clearAuthData();
    router.push('/login');
  };

  const getAccessToken = async (): Promise<string | null> => {
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
                
                // Check if new access token is also encrypted
                const newIsEncrypted = newTokens.access_token.includes('..') && newTokens.access_token.split('.').length === 5;
                return newIsEncrypted ? newTokens.id_token : newTokens.access_token;
              }
            } catch (error) {
              logout();
              return null;
            }
          }
        }
        
        // Check if access token is encrypted (JWE format)
        const isEncrypted = tokens.access_token.includes('..') && tokens.access_token.split('.').length === 5;
        
        if (isEncrypted) {
          return tokens.id_token;
        }
        
        return tokens.access_token;
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
        return authData.tokens.access_token;
      }

      return null;
    } catch (error) {
      return null;
    }
  };

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
