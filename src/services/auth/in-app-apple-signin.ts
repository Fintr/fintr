/**
 * In-App Apple Sign-In for iOS using Capacitor Browser
 * This provides a native popup experience instead of redirecting to Safari
 */

import { verifyState, generateRandomState } from './apple-signin';
import { isNativeCapacitor, isNativeCapacitorAsync } from '@/lib/capacitor';
import { initCapacitorBridgeIfNeeded } from '@/lib/capacitor-bridge-init';

// Dynamic import for Capacitor Browser to avoid build issues
let Browser: any = null;

export interface InAppAppleSignInOptions {
  redirectUri?: string;
  state?: string;
}

/**
 * Initiates Apple Sign-In using Capacitor's in-app browser
 * This shows a native popup that slides up from the bottom
 */
export const initiateInAppAppleSignIn = async (options?: InAppAppleSignInOptions) => {
  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

  if (!auth0Domain || !clientId) {
    throw new Error('Auth0 configuration is missing. Please check your environment variables.');
  }

  // Use the async version to handle Android's delayed bridge injection.
  const isNativeApp = await isNativeCapacitorAsync();

  // Use environment variable for redirect URI to ensure consistency
  // For Capacitor, use custom URL scheme to return to app
  let redirectUri = options?.redirectUri;
  
  if (!redirectUri) {
    if (isNativeApp) {
      // For native Capacitor (iOS/Android), use custom URL scheme directly.
      // Auth0 will redirect to fintrapp://auth-callback?code=...
      // The OS intercepts the custom URL scheme and opens the app via appUrlOpen.
      redirectUri = 'fintrapp://auth-callback';
      console.log('🍎 Native app detected – using redirect URI:', redirectUri);
    } else {
      const base =
        appBaseUrl && !String(appBaseUrl).includes('undefined')
          ? String(appBaseUrl).replace(/\/+$/, '')
          : typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'http://localhost:5173';
      redirectUri = `${base}/auth-callback`;
      console.log('🌐 Web detected – using redirect URI:', redirectUri);
    }
  }

  // Generate state for CSRF protection
  // Encode native Capacitor flag in state: randomState|isNativeApp
  const randomState = options?.state || generateRandomState();
  
  const state = `${randomState}|${isNativeApp ? 'true' : 'false'}`;
  
  // Store original state and redirect URI for verification and backend token exchange
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('auth0_state', randomState);
    sessionStorage.setItem('auth0_redirect_origin', window.location.pathname);
    // Store the redirect URI so backend can use the same one for token exchange
    sessionStorage.setItem('auth0_redirect_uri', redirectUri);
  }

  // Build Auth0 authorization URL with Apple connection
  const authorizationUrl = new URL(`https://${auth0Domain}/authorize`);
  
  authorizationUrl.searchParams.append('response_type', 'code');
  authorizationUrl.searchParams.append('client_id', clientId);
  authorizationUrl.searchParams.append('redirect_uri', redirectUri);
  authorizationUrl.searchParams.append('scope', 'openid profile email read:current_user read:users read:transactions offline_access');
  authorizationUrl.searchParams.append('state', state);
  authorizationUrl.searchParams.append('connection', 'apple'); // Specify Apple connection
  authorizationUrl.searchParams.append('response_mode', 'query');
  
  if (audience) {
    authorizationUrl.searchParams.append('audience', audience);
  }

  // Debug logging
  console.log('\n=== Apple Sign-In Debug Info ===');
  console.log('Auth0 Domain:', auth0Domain);
  console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'NOT SET');
  console.log('Is native Capacitor app (fintrapp used):', isNativeApp);
  console.log('App Base URL:', appBaseUrl || 'NOT SET');
  console.log('Redirect URI:', redirectUri);
  console.log('Full Authorization URL:', authorizationUrl.toString());
  console.log('===================================\n');

  // Verify the URL is an Auth0 URL
  if (!authorizationUrl.toString().includes(auth0Domain)) {
    throw new Error(`Invalid authorization URL - expected Auth0 domain: ${auth0Domain}`);
  }
  
  try {
    // Ensure the native Capacitor bridge is set up before importing any plugin.
    // On Android with server.url, the bridge injection via handleProxyRequest can
    // silently fail (URL path mismatch or Brotli encoding), leaving PluginHeaders
    // unset and all plugins permanently registered with their web fallback.
    initCapacitorBridgeIfNeeded();

    // Dynamically import Browser plugin
    if (!Browser) {
      console.log('📦 Loading @capacitor/browser...');
      const { Browser: BrowserPlugin } = await import('@capacitor/browser');
      Browser = BrowserPlugin;
      console.log('✅ Browser plugin loaded successfully');
    }

    // Return a promise that resolves when the browser closes.
    // Same dual-signal approach as Google sign-in:
    // - browserFinished: reliable on iOS; may not fire on Android for custom-scheme redirects.
    // - appStateChange (isActive: true): reliable on Android when app returns to foreground.
    return new Promise<void>(async (resolve, reject) => {
      try {
        let resolved = false;

        const finish = (label: string) => {
          if (!resolved) {
            console.log(`\n✅ Browser closed (${label}) - completing authentication flow\n`);
            resolved = true;
            browserFinishedListener?.remove();
            appStateListener?.remove();
            resolve();
          }
        };

        const browserFinishedListener = await Browser.addListener('browserFinished', () => {
          finish('browserFinished');
        });

        // Android: resolve when the app returns to the foreground
        let appStateListener: { remove: () => void } | null = null;
        try {
          const { App } = await import('@capacitor/app');
          appStateListener = await App.addListener(
            'appStateChange',
            ({ isActive }: { isActive: boolean }) => {
              if (isActive) finish('appStateChange');
            }
          );
        } catch {
          // @capacitor/app not available or not on native - ignore
        }

        console.log('\n=== Opening Browser Plugin ===');
        console.log('Authorization URL:', authorizationUrl.toString());
        console.log('Expected Redirect URI:', redirectUri);
        console.log('===============================\n');

        // Open in-app browser. presentationStyle is iOS-only; Android uses Chrome Custom Tab.
        await Browser.open({
          url: authorizationUrl.toString(),
          presentationStyle: 'popover',
          toolbarColor: '#ffffff',
        }).catch((error) => {
          console.error('\n❌ Browser.open error:', error);
          if (!resolved) {
            resolved = true;
            browserFinishedListener.remove();
            appStateListener?.remove();
            reject(error);
          }
        });

        // Safety timeout — resolves after 5 minutes if no other signal fires.
        setTimeout(() => finish('timeout'), 300000);
      } catch (error) {
        console.error('\n❌ Browser setup error:', error);
        reject(error);
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error('\n❌ Apple Sign-In Error:', errorMessage);
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
    if (!Browser) {
      const { Browser: BrowserPlugin } = await import('@capacitor/browser');
      Browser = BrowserPlugin;
    }
    await Browser.close();
  } catch (error) {
    console.error('Error closing browser:', error);
  }
};

/**
 * Smart Apple Sign-In that chooses the best method based on environment.
 * Uses isNativeCapacitorAsync to wait for the Capacitor bridge to initialize
 * on Android before making the decision (avoids race conditions where the bridge
 * isn't injected yet when this function is first called).
 */
export const smartAppleSignIn = async (options?: InAppAppleSignInOptions) => {
  const isNative = await isNativeCapacitorAsync();
  if (isNative) {
    try {
      return await initiateInAppAppleSignIn(options);
    } catch (error) {
      // Fallback: still use fintrapp:// as redirect URI so the OS routes back to the app
      const { initiateAppleSignIn } = await import('./apple-signin');
      return initiateAppleSignIn({
        ...options,
        redirectUri: options?.redirectUri ?? 'fintrapp://auth-callback',
      });
    }
  }
  // Web (browser or Capacitor in web): always use redirect with web URL
  const { initiateAppleSignIn } = await import('./apple-signin');
  return initiateAppleSignIn(options);
};
