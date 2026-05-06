/**
 * Popup-based Google Sign-In for iOS
 * This creates a popup window that works better on mobile than full redirect
 */

import { verifyState, generateRandomState } from './google-signin';

export interface PopupGoogleSignInOptions {
  redirectUri?: string;
  state?: string;
}

/**
 * Check if we're on a mobile device
 */
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Initiates Google Sign-In using popup window
 * This provides a better mobile experience than full redirect
 */
export const initiatePopupGoogleSignIn = async (options?: PopupGoogleSignInOptions) => {
  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

  if (!auth0Domain || !clientId) {
    throw new Error('Auth0 configuration is missing. Please check your environment variables.');
  }

  const redirectUri = options?.redirectUri || `${appBaseUrl || window.location.origin}/auth-callback`;
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
  authorizationUrl.searchParams.append('connection', 'google-oauth2');
  authorizationUrl.searchParams.append('response_mode', 'query');
  
  if (audience) {
    authorizationUrl.searchParams.append('audience', audience);
  }

  console.log('🔍 Popup Google Sign-In Debug Info:');
  console.log('  - Auth0 Domain:', auth0Domain);
  console.log('  - Client ID:', clientId);
  console.log('  - App Base URL:', appBaseUrl);
  console.log('  - Generated Redirect URI:', redirectUri);
  console.log('  - Authorization URL:', authorizationUrl.toString());

  // Create popup window with mobile-optimized dimensions
  const popupWidth = isMobileDevice() ? Math.min(400, window.innerWidth - 40) : 500;
  const popupHeight = isMobileDevice() ? Math.min(600, window.innerHeight - 100) : 700;
  
  const left = (window.innerWidth - popupWidth) / 2;
  const top = (window.innerHeight - popupHeight) / 2;

  const popup = window.open(
    authorizationUrl.toString(),
    'google-signin',
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
  );

  if (!popup) {
    throw new Error('Failed to open sign-in window. Please allow popups for this site.');
  }

  // Focus the popup
  popup.focus();

  // Return a promise that resolves when the popup completes
  return new Promise((resolve, reject) => {
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error('Sign-in window was closed'));
      }
    }, 1000);

    // Listen for messages from the popup (if using postMessage)
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GOOGLE_SIGNIN_SUCCESS') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        popup.close();
        resolve(event.data);
      } else if (event.data.type === 'GOOGLE_SIGNIN_ERROR') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        popup.close();
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageHandler);

    // Auto-close after 5 minutes
    setTimeout(() => {
      if (!popup.closed) {
        popup.close();
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        reject(new Error('Sign-in timeout'));
      }
    }, 300000);
  });
};

/**
 * Smart Google Sign-In that chooses the best method based on device
 */
export const smartPopupGoogleSignIn = async (options?: PopupGoogleSignInOptions) => {
  console.log('🚀 Starting smart popup Google Sign-In...');
  
  if (isMobileDevice()) {
    try {
      console.log('📱 Using popup for Google Sign-In on mobile');
      return await initiatePopupGoogleSignIn(options);
    } catch (error) {
      console.warn('⚠️ Popup failed, falling back to redirect:', error);
      // Fallback to regular redirect method
      const { initiateGoogleSignIn } = await import('./google-signin');
      return initiateGoogleSignIn(options);
    }
  } else {
    console.log('🌐 Using redirect for Google Sign-In on desktop');
    // Use regular redirect method for desktop
    const { initiateGoogleSignIn } = await import('./google-signin');
    return initiateGoogleSignIn(options);
  }
};



