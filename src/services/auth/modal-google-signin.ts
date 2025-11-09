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

  // Check if we're in Capacitor environment
  const isCapacitor = isCapacitorEnvironment();

  // Use environment variable for redirect URI to ensure consistency
  // For Capacitor with server hostname configured, use http://localhost
  // This works because Capacitor serves the app on http://localhost in the Browser plugin
  let redirectUri = options?.redirectUri;
  
  if (!redirectUri) {
    if (isCapacitor) {
      // For Capacitor, use custom URL scheme directly
      // Auth0 will redirect to fintrapp://auth-callback?code=...
      // Safari will show "invalid address" error (this is expected and harmless)
      // iOS intercepts the custom URL scheme and opens the app
      // The deep link handler catches it and routes to /auth-callback
      redirectUri = 'fintrapp://auth-callback';
      console.log('Using custom URL scheme for redirect URI:', redirectUri);
      console.log('Note: Safari may show an error, but iOS will intercept and open the app');
      console.log('The deep link handler will route to /auth-callback with the auth code');
    } else if (appBaseUrl && !appBaseUrl.includes('localhost')) {
      // For web, use app base URL if it's not localhost
      redirectUri = `${appBaseUrl}/auth-callback`;
    } else if (typeof window !== 'undefined') {
      // Fallback to current origin for web
      redirectUri = `${window.location.origin}/auth-callback`;
    } else {
      // Last resort for web development
      redirectUri = 'http://localhost:5173/auth-callback';
    }
  }

  // Generate state for CSRF protection
  // For Capacitor, we need to encode that this is a Capacitor flow in the state
  const randomState = options?.state || generateRandomState();
  
  // Encode Capacitor flag in state: randomState|isCapacitor
  const state = `${randomState}|${isCapacitor ? 'true' : 'false'}`;
  
  // Store original state and redirect URI for verification and backend token exchange
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('auth0_state', randomState);
    sessionStorage.setItem('auth0_redirect_origin', window.location.pathname);
    // Store the redirect URI so backend can use the same one for token exchange
    sessionStorage.setItem('auth0_redirect_uri', redirectUri);
  }

  // Build Auth0 authorization URL with Google connection
  const authorizationUrl = new URL(`https://${auth0Domain}/authorize`);
  
  // URL encode the redirect URI to ensure it's properly formatted
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  
  authorizationUrl.searchParams.append('response_type', 'code');
  authorizationUrl.searchParams.append('client_id', clientId);
  authorizationUrl.searchParams.append('redirect_uri', redirectUri); // Auth0 expects the actual URI, not encoded
  authorizationUrl.searchParams.append('scope', 'openid profile email read:current_user read:users read:transactions offline_access');
  authorizationUrl.searchParams.append('state', state);
  authorizationUrl.searchParams.append('connection', 'google-oauth2'); // Specify Google connection
  authorizationUrl.searchParams.append('response_mode', 'query');
  
  if (audience) {
    authorizationUrl.searchParams.append('audience', audience);
  }

  // Debug logging - these will appear in terminal/npm console
  console.log('\n=== Google Sign-In Debug Info ===');
  console.log('Auth0 Domain:', auth0Domain);
  console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'NOT SET');
  console.log('Is Capacitor Environment:', isCapacitor);
  console.log('App Base URL:', appBaseUrl || 'NOT SET');
  console.log('Redirect URI:', redirectUri);
  console.log('Full Authorization URL:', authorizationUrl.toString());
  console.log('===================================\n');

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
        let resolved = false;

        // Set up listener for when browser finishes
        // This will fire when:
        // 1. User manually closes the browser
        // 2. Browser redirects to fintrapp://auth-callback (custom URL scheme triggers browser close)
        const browserFinishedListener = await Browser.addListener('browserFinished', () => {
          console.log('\n✅ Browser finished event received - closing authentication flow\n');
          if (!resolved) {
            resolved = true;
            browserFinishedListener.remove();
            resolve();
          }
        });

        console.log('\n=== Opening Browser Plugin ===');
        console.log('Authorization URL:', authorizationUrl.toString());
        console.log('Expected Redirect URI:', redirectUri);
        console.log('===============================\n');

        // Open in-app browser with native popup
        await Browser.open({
          url: authorizationUrl.toString(),
          windowName: '_self',
          presentationStyle: 'popover',
          toolbarColor: '#ffffff',
          showTitle: true
        }).catch((error) => {
          console.error('\n❌ Browser.open error:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          console.error('==========================\n');
          if (!resolved) {
            resolved = true;
            browserFinishedListener.remove();
            reject(error);
          }
        });

        // Timeout fallback - if browser doesn't close within 5 minutes, resolve anyway
        // (User might have completed auth but browserFinished event didn't fire)
        setTimeout(() => {
          if (!resolved) {
            console.warn('\n⚠️ Browser timeout after 5 minutes - resolving promise anyway\n');
            resolved = true;
            browserFinishedListener.remove();
            resolve();
          }
        }, 300000); // 5 minutes
      } catch (error) {
        console.error('\n❌ Browser setup error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('===========================\n');
        reject(error);
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error('\n❌ Google Sign-In Error:', errorMessage);
    console.error('Error object:', error);
    console.error('==========================\n');
    
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