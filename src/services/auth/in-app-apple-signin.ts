/**
 * In-App Apple Sign-In for iOS using Capacitor Browser
 * This provides a native popup experience instead of redirecting to Safari
 */

import { verifyState, generateRandomState } from './apple-signin';

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

  // Use environment variable for redirect URI to ensure consistency
  const redirectUri = options?.redirectUri || `${appBaseUrl || window.location.origin}/auth-callback`;

  // Generate state for CSRF protection
  const state = options?.state || generateRandomState();
  
  // Store state in sessionStorage for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('auth0_state', state);
    sessionStorage.setItem('auth0_redirect_origin', window.location.pathname);
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
  console.log('🍎 In-App Apple Sign-In Debug Info:');
  console.log('  - Auth0 Domain:', auth0Domain);
  console.log('  - Client ID:', clientId);
  console.log('  - App Base URL:', appBaseUrl);
  console.log('  - Generated Redirect URI:', redirectUri);
  console.log('  - Authorization URL:', authorizationUrl.toString());

  try {
    console.log('🔧 Attempting to load Capacitor Browser plugin...');
    
    // Dynamically import Browser plugin
    if (!Browser) {
      console.log('📦 Loading @capacitor/browser...');
      const { Browser: BrowserPlugin } = await import('@capacitor/browser');
      Browser = BrowserPlugin;
      console.log('✅ Browser plugin loaded successfully');
    } else {
      console.log('✅ Browser plugin already loaded');
    }

    console.log('🚀 Opening in-app browser with URL:', authorizationUrl.toString());
    
    // Open in-app browser with native popup
    const result = await Browser.open({
      url: authorizationUrl.toString(),
      windowName: '_self',
      presentationStyle: 'popover', // This makes it slide up from bottom on iOS
      toolbarColor: '#ffffff',
      showTitle: true,
      title: 'Sign in with Apple',
      closeButtonCaption: 'Cancel'
    });

    console.log('🔍 Browser result:', result);
    
    // The browser will redirect to our callback URL
    // The callback page will handle the token exchange
    return result;
  } catch (error) {
    console.error('❌ In-app browser error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
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
 * Check if we're running in a Capacitor environment
 */
export const isCapacitorEnvironment = (): boolean => {
  const isCapacitor = typeof window !== 'undefined' && 
                      (window as any).Capacitor !== undefined;
  
  console.log('🔍 Capacitor Environment Check:');
  console.log('  - Window exists:', typeof window !== 'undefined');
  console.log('  - Capacitor exists:', !!(window as any)?.Capacitor);
  console.log('  - Is Capacitor environment:', isCapacitor);
  
  return isCapacitor;
};

/**
 * Smart Apple Sign-In that chooses the best method based on environment
 */
export const smartAppleSignIn = async (options?: InAppAppleSignInOptions) => {
  console.log('🚀 Starting smart Apple Sign-In...');
  
  if (isCapacitorEnvironment()) {
    try {
      console.log('📱 Using in-app browser for Apple Sign-In');
      return await initiateInAppAppleSignIn(options);
    } catch (error) {
      console.warn('⚠️ In-app browser failed, falling back to redirect:', error);
      // Fallback to regular redirect method if in-app browser fails
      const { initiateAppleSignIn } = await import('./apple-signin');
      return initiateAppleSignIn(options);
    }
  } else {
    console.log('🌐 Using redirect for Apple Sign-In (not in Capacitor environment)');
    // Fallback to regular redirect method for web
    const { initiateAppleSignIn } = await import('./apple-signin');
    return initiateAppleSignIn(options);
  }
};
