/**
 * In-App Browser Google Sign-In for iOS using Capacitor Browser plugin
 * This provides a native in-app browser experience instead of redirecting to Safari
 */

import { verifyState, generateRandomState } from './google-signin';

export interface InAppBrowserOptions {
  redirectUri?: string;
  state?: string;
}

/**
 * Check if we're running in a Capacitor environment
 */
const isCapacitorEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
};

/**
 * Initiates Google Sign-In using Capacitor's in-app browser
 * This shows a native popup that slides up from the bottom
 */
export const initiateInAppBrowserGoogleSignIn = async (options?: InAppBrowserOptions) => {
  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

  if (!auth0Domain || !clientId) {
    throw new Error('Auth0 configuration is missing. Please check your environment variables.');
  }

  // Use environment variable for redirect URI to ensure consistency
  // For Capacitor, we still need a regular HTTP URL (Auth0 requirement)
  let redirectUri = options?.redirectUri;
  
  if (!redirectUri) {
    if (appBaseUrl) {
      redirectUri = `${appBaseUrl}/auth-callback`;
    } else if (typeof window !== 'undefined') {
      // Fallback to current origin
      redirectUri = `${window.location.origin}/auth-callback`;
    } else {
      // Last resort
      redirectUri = 'http://localhost:5173/auth-callback';
    }
  }

  // Generate state for CSRF protection
  // For Capacitor, we need to encode that this is a Capacitor flow in the state
  const isCapacitor = isCapacitorEnvironment();
  const randomState = options?.state || generateRandomState();
  
  // Encode Capacitor flag in state: randomState|isCapacitor
  const state = `${randomState}|${isCapacitor}`;
  
  // Store original state in sessionStorage for verification (web only)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('auth0_state', randomState);
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
  authorizationUrl.searchParams.append('response_mode', 'query');
  
  if (audience) {
    authorizationUrl.searchParams.append('audience', audience);
  }

  // Verify the URL is an Auth0 URL
  if (!authorizationUrl.toString().includes(auth0Domain)) {
    throw new Error(`Invalid authorization URL - expected Auth0 domain: ${auth0Domain}`);
  }
  
  try {
    // Import Capacitor Browser plugin
    const { Browser } = await import('@capacitor/browser');

    // Return a promise that resolves when the browser closes
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Set up listener for when browser finishes
        const browserFinishedListener = await Browser.addListener('browserFinished', () => {
          browserFinishedListener.remove();
          resolve();
        });

        // Open in-app browser with native popup
        
        await Browser.open({
          url: authorizationUrl.toString(),
          windowName: '_self',
          presentationStyle: 'popover', // This makes it slide up from bottom on iOS
          toolbarColor: '#ffffff'
        });
      } catch (error) {
        reject(error);
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // If it's an import error, provide a more helpful message
    if (errorMessage?.includes('Cannot resolve module')) {
      throw new Error('Browser plugin not found. Make sure @capacitor/browser is installed and synced.');
    }
    
    throw new Error('Failed to open sign-in browser');
  }
};

/**
 * Close the in-app browser (useful for cleanup)
 */
export const closeInAppBrowser = async () => {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch (error) {
    // Silent fail if browser is already closed
  }
};

/**
 * Smart Google Sign-In that chooses the best method based on environment
 */
export const smartInAppBrowserGoogleSignIn = async (options?: InAppBrowserOptions) => {
  if (isCapacitorEnvironment()) {
    try {
      return await initiateInAppBrowserGoogleSignIn(options);
    } catch (error) {
      // Fallback to regular redirect method if in-app browser fails
      const { initiateGoogleSignIn } = await import('./google-signin');
      return initiateGoogleSignIn(options);
    }
  } else {
    // Fallback to regular redirect method for web
    const { initiateGoogleSignIn } = await import('./google-signin');
    return initiateGoogleSignIn(options);
  }
};