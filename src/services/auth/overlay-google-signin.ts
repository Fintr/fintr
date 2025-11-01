/**
 * Overlay-based Google Sign-In for iOS
 * This creates a full-screen overlay that looks more native than popup
 */

import { verifyState, generateRandomState } from './google-signin';

export interface OverlayGoogleSignInOptions {
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
 * Creates a full-screen overlay with Google Sign-In
 */
const createSignInOverlay = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
      background: white;
      border-radius: 16px;
      width: 95%;
      max-width: 400px;
      height: 85%;
      max-height: 700px;
      position: relative;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      background: #f8f9fa;
      padding: 16px 20px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Sign in with Google';
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    `;

    closeButton.onmouseover = () => {
      closeButton.style.backgroundColor = '#e9ecef';
    };
    closeButton.onmouseout = () => {
      closeButton.style.backgroundColor = 'transparent';
    };

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create iframe container
    const iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = `
      flex: 1;
      position: relative;
    `;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    // Assemble overlay
    iframeContainer.appendChild(iframe);
    container.appendChild(header);
    container.appendChild(iframeContainer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Handle close
    const closeOverlay = () => {
      document.body.removeChild(overlay);
      reject(new Error('Sign-in cancelled'));
    };

    closeButton.onclick = closeOverlay;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeOverlay();
    };

    // Listen for messages from iframe
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GOOGLE_SIGNIN_SUCCESS') {
        document.body.removeChild(overlay);
        window.removeEventListener('message', messageHandler);
        resolve();
      } else if (event.data.type === 'GOOGLE_SIGNIN_ERROR') {
        document.body.removeChild(overlay);
        window.removeEventListener('message', messageHandler);
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageHandler);

    // Auto-close after 5 minutes
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        closeOverlay();
      }
    }, 300000);
  });
};

/**
 * Initiates Google Sign-In using overlay approach
 */
export const initiateOverlayGoogleSignIn = async (options?: OverlayGoogleSignInOptions) => {
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

  console.log('🔍 Overlay Google Sign-In Debug Info:');
  console.log('  - Auth0 Domain:', auth0Domain);
  console.log('  - Client ID:', clientId);
  console.log('  - App Base URL:', appBaseUrl);
  console.log('  - Generated Redirect URI:', redirectUri);
  console.log('  - Authorization URL:', authorizationUrl.toString());

  try {
    await createSignInOverlay(authorizationUrl.toString());
  } catch (error) {
    console.error('❌ Overlay sign-in error:', error);
    throw error;
  }
};

/**
 * Smart Google Sign-In that chooses the best method based on device
 */
export const smartOverlayGoogleSignIn = async (options?: OverlayGoogleSignInOptions) => {
  console.log('🚀 Starting smart overlay Google Sign-In...');
  
  if (isMobileDevice()) {
    try {
      console.log('📱 Using overlay for Google Sign-In on mobile');
      return await initiateOverlayGoogleSignIn(options);
    } catch (error) {
      console.warn('⚠️ Overlay failed, falling back to redirect:', error);
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

