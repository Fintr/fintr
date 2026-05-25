/**
 * Custom Auth0 login service using Resource Owner Password Grant
 * This allows direct username/password authentication without redirects
 */

import { getPublicBackendUrl } from '@/lib/public-backend-url';
import {
  parseApiErrorMessage,
  parseAuthTokenPayload,
} from '@/services/auth/parse-auth-response';

export interface LoginCredentials {
  username: string; // Can be email or username
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface LoginError {
  error: string;
  error_description: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SignupResponse extends LoginResponse {
  message?: string;
}

/**
 * Authenticate user with username/password via backend API
 * This is the most secure approach as it keeps credentials server-side
 */
export const loginWithCredentials = async (
  credentials: LoginCredentials
): Promise<LoginResponse> => {
  console.log('🔐 loginWithCredentials: Starting...', { username: credentials.username });
  const backendUrl = getPublicBackendUrl();

  if (!backendUrl) {
    console.error('❌ loginWithCredentials: Backend URL not configured');
    throw new Error('Backend URL is not configured. Please check your environment variables.');
  }

  console.log('🔐 loginWithCredentials: Calling backend:', `${backendUrl}/api/v1/auth/login`);

  try {
    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('🔐 loginWithCredentials: Response received', {
      status: response.status,
      ok: response.ok,
    });

    const data = await response.json();
    console.log('🔐 loginWithCredentials: Response data', {
      hasData: !!data,
      hasValue: !!data?.data?.value,
      dataKeys: Object.keys(data),
    });

    if (!response.ok) {
      const errorMessage = parseApiErrorMessage(data, "Login failed");
      console.error('❌ loginWithCredentials: Login failed', {
        status: response.status,
        message: errorMessage,
      });
      throw new Error(errorMessage);
    }

    console.log('✅ loginWithCredentials: Login successful');
    return parseAuthTokenPayload(data);
  } catch (error) {
    console.error('❌ loginWithCredentials: Exception thrown', error);
    throw error;
  }
};

/**
 * Get user profile information using the access token
 */
export const getUserProfile = async (accessToken: string) => {
  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
  
  if (!auth0Domain) {
    throw new Error('Auth0 domain is not configured');
  }

  const userInfoUrl = `https://${auth0Domain}/userinfo`;

  try {
    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Register a new user via backend API
 * The backend handles Auth0 signup and automatically logs in the user
 */
export const signupWithCredentials = async (
  credentials: SignupCredentials
): Promise<SignupResponse> => {
  const backendUrl = getPublicBackendUrl();

  if (!backendUrl) {
    throw new Error('Backend URL is not configured. Please check your environment variables.');
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        first_name: credentials.firstName,
        last_name: credentials.lastName,
        full_name: `${credentials.firstName} ${credentials.lastName}`.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(parseApiErrorMessage(data, "Signup failed"));
    }

    return parseAuthTokenPayload(data);
  } catch (error) {
    throw error;
  }
};

/**
 * Refresh access token using refresh token via backend
 */
export const refreshAccessToken = async (refreshToken: string): Promise<LoginResponse> => {
  const backendUrl = getPublicBackendUrl();

  if (!backendUrl) {
    throw new Error('Backend URL is not configured');
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(parseApiErrorMessage(data, "Token refresh failed"));
    }

    return parseAuthTokenPayload(data);
  } catch (error) {
    throw error;
  }
};
