"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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

  console.log('🔄 AuthProvider State:', {
    hasUser: !!user,
    userEmail: user?.email,
    hasTokens: !!tokens,
    isLoading,
    error,
  });

  // Check for existing authentication
  const checkAuth = async () => {
    console.log('🔍 checkAuth: Starting authentication check...');
    
    // Set a timeout to ensure loading state doesn't hang forever
    const timeoutId = setTimeout(() => {
      console.warn('⏰ checkAuth: Taking longer than expected (10s timeout)');
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
        console.log('✅ checkAuth: Auth state refreshed from storage');
        console.log('User:', authData.user?.email || authData.user?.sub);
      } else {
        setTokens(null);
        setUser(null);
        console.log('⚠️ checkAuth: No valid auth data found in storage');
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
      console.log('✅ checkAuth: Complete');
    }
  };

  // Check for existing authentication on mount
  useEffect(() => {
    console.log('🚀 AuthProvider: Initializing auth on mount...');
    // Wrap in try-catch to ensure errors don't break the app
    const initAuth = async () => {
      try {
        console.log('🚀 AuthProvider: Calling checkAuth...');
        await checkAuth();
        console.log('✅ AuthProvider: checkAuth complete');
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
    console.log('🔐 AuthContext.login: Starting login...', { username: credentials.username });
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔐 AuthContext.login: Calling loginWithCredentials...');

      const response = await loginWithCredentials(credentials);
      console.log('🔐 AuthContext.login: Login successful, received tokens');
      
      // Store tokens and user data in unified storage
      console.log('🔐 AuthContext.login: Resolving user profile...');
      const userProfile = await resolveUserProfile(response);
      console.log('🔐 AuthContext.login: User profile decoded:', { email: userProfile.email, sub: userProfile.sub });

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

      console.log('🔐 AuthContext.login: Storing auth data in localStorage...');
      AuthStorage.setAuthData(authData);
      console.log('🔐 AuthContext.login: Setting state (tokens & user)...');
      setTokens(response);
      setUser(userProfile);
      console.log('✅ AuthContext.login: Login complete!');
    } catch (error: any) {
      console.error('❌ AuthContext.login: Login failed:', error.message);
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      console.log('🔐 AuthContext.login: Setting isLoading = false');
      setIsLoading(false);
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    console.log('📝 AuthContext.signup: Starting signup...', { email: credentials.email });
    try {
      setIsLoading(true);
      setError(null);
      console.log('📝 AuthContext.signup: Calling signupWithCredentials...');

      const response = await signupWithCredentials(credentials);
      console.log('📝 AuthContext.signup: Signup successful, received tokens');
      
      // Store tokens and user data in unified storage
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
    console.log('🔑 getAccessToken: Called');
    try {
      // First try to get token from state
      if (tokens?.access_token) {
        console.log('🔑 getAccessToken: Found token in state', {
          hasAccessToken: !!tokens.access_token,
          hasIdToken: !!tokens.id_token,
          accessTokenPrefix: tokens.access_token?.substring(0, 30) + '...',
          idTokenPrefix: tokens.id_token?.substring(0, 30) + '...',
        });
        
        // Check if token is expired and refresh if needed
        const authData = AuthStorage.getAuthData();
        if (authData) {
          const now = Date.now();
          const isExpired = authData.expires_at <= now;
          console.log('🔑 getAccessToken: Token expiry check', {
            expiresAt: new Date(authData.expires_at).toISOString(),
            now: new Date(now).toISOString(),
            isExpired,
          });
          
          if (isExpired) {
            console.log('⚠️ getAccessToken: Token expired, refreshing...');
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
        console.log('🔑 getAccessToken: Token format check', {
          isEncrypted,
          accessTokenParts: tokens.access_token.split('.').length,
          willUseIdToken: isEncrypted,
        });
        
        if (isEncrypted) {
          console.log('🔑 getAccessToken: Returning ID token (access token is encrypted)');
          return tokens.id_token;
        }
        
        console.log('🔑 getAccessToken: Returning access token');
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
