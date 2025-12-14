/**
 * Google Sign-In via Auth0 Social Connection
 * Uses Auth0's /authorize endpoint to initiate OAuth flow
 */

export interface GoogleSignInOptions {
  redirectUri?: string;
  state?: string;
}

/**
 * Initiates Google Sign-In via Auth0
 * Redirects user to Auth0's Universal Login with Google connection
 */
export const initiateGoogleSignIn = (options?: GoogleSignInOptions) => {
  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

  if (!auth0Domain || !clientId) {
    throw new Error('Auth0 configuration is missing. Please check your environment variables.');
  }

  // Use environment variable for redirect URI to ensure consistency
  const redirectUri = options?.redirectUri || `${appBaseUrl || window.location.origin}/auth-callback`;

  // Generate state for CSRF protection
  const state = options?.state || generateRandomState();
  
  // Store state in sessionStorage for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('auth0_state', state);
    sessionStorage.setItem('auth0_redirect_origin', window.location.pathname);
  }

  // Build Auth0 authorization URL with Google connection
  const authorizationUrl = new URL(`https://${auth0Domain}/authorize`);
  
  authorizationUrl.searchParams.append('response_type', 'code');
  authorizationUrl.searchParams.append('client_id', clientId);
  authorizationUrl.searchParams.append('redirect_uri', redirectUri);
  authorizationUrl.searchParams.append('scope', 'openid profile email read:current_user read:users read:transactions offline_access');
  authorizationUrl.searchParams.append('state', state);
  authorizationUrl.searchParams.append('connection', 'google-oauth2'); // Specify Google connection
  
  if (audience) {
    authorizationUrl.searchParams.append('audience', audience);
  }

  // Add response_mode to ensure we get regular JWT tokens
  authorizationUrl.searchParams.append('response_mode', 'query');

  // Redirect to Auth0
  window.location.href = authorizationUrl.toString();
};

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify state parameter to prevent CSRF attacks
 */
export function verifyState(receivedState: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const storedState = sessionStorage.getItem('auth0_state');
  
  if (!storedState || storedState !== receivedState) {
    return false;
  }
  
  sessionStorage.removeItem('auth0_state');
  
  return true;
}

/**
 * Get the original redirect path before OAuth flow
 * Never returns auth pages - always redirects to dashboard after successful auth
 */
export function getOriginalRedirectPath(): string {
  if (typeof window === 'undefined') return '/dashboard';
  
  const path = sessionStorage.getItem('auth0_redirect_origin');
  sessionStorage.removeItem('auth0_redirect_origin');
  
  // If the stored path is an auth page, redirect to dashboard instead
  // This prevents the brief flash of login page after successful authentication
  const authPages = ['/login', '/auth', '/auth-callback', '/consent'];
  if (path && !authPages.includes(path)) {
    return path;
  }
  
  return '/dashboard';
}

