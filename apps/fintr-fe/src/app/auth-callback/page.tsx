"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyState, getOriginalRedirectPath } from '@/services/auth/google-signin';
import { AuthStorage, AuthStorageData, AuthTokens } from '@/lib/auth-storage';
import { resetGlobalAuthLock } from '@/components/deep-link-handler';
import { isNativeCapacitor } from '@/lib/capacitor';
import { getPublicBackendUrl } from '@/lib/public-backend-url';
import { initCapacitorBridgeIfNeeded } from '@/lib/capacitor-bridge-init';

// Helper function to detect if we're on iOS mobile
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);

  return isIOS;
};

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, checkAuth } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showOpenAppButton, setShowOpenAppButton] = useState<boolean>(false);
  const [showCloseBrowserButton, setShowCloseBrowserButton] = useState<boolean>(false);
  const [isCapacitorFlow, setIsCapacitorFlow] = useState<boolean>(false);

  // Use refs to prevent duplicate processing across re-renders
  const isProcessingRef = useRef(false);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate calls
      if (isProcessingRef.current || hasProcessedRef.current) {
        console.log('⚠️ Auth callback already processing or completed - skipping duplicate call');
        return;
      }

      isProcessingRef.current = true;
      console.log('\n=== Auth Callback Handler Started ===');
      console.log('Current URL:', window.location.href);
      console.log('URL Search Params:', Object.fromEntries(searchParams.entries()));
      console.log('Search params entries:', Array.from(searchParams.entries()));

      try {
        if (isNativeCapacitor()) {
          console.log('Capacitor environment detected - attempting to close browser');
          initCapacitorBridgeIfNeeded();
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
            console.log('Browser closed successfully');
          } catch (error) {
            console.log('Browser might already be closed (this is OK)');
          }
        }

        // Get parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for errors from Auth0
        if (error) {
          setStatus('error');
          setErrorMessage(errorDescription || error || 'Authentication failed');
          setTimeout(() => router.push('/auth'), 3000);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setStatus('error');
          setErrorMessage('Missing authorization parameters');
          setTimeout(() => router.push('/auth'), 3000);
          return;
        }

        // Decode state parameter
        // State format: randomState|isCapacitor
        let decodedState = state;
        let capacitorFlow = false;

        if (state.includes('|')) {
          const [randomState, flag] = state.split('|');
          decodedState = randomState;
          capacitorFlow = flag === 'true';
          console.log('Decoded state - Capacitor flow:', capacitorFlow);
        } else {
          console.log('State does not contain Capacitor flag');
        }

        setIsCapacitorFlow(capacitorFlow);

        const isCapacitorCallback = isNativeCapacitor();
        const isCapacitorContext = isCapacitorCallback || capacitorFlow;

        if (!isCapacitorContext && !verifyState(decodedState)) {
          setStatus('error');
          setErrorMessage('Invalid state parameter. Possible CSRF attack.');
          setTimeout(() => router.push('/auth'), 3000);
          return;
        }

        // Exchange code for tokens via backend
        const backendUrl = getPublicBackendUrl();
        if (!backendUrl) {
          console.error('❌ Backend URL is not configured');
          throw new Error('Backend URL is not configured');
        }

        // Use the same redirect_uri that was sent to Auth0 (must match exactly for token exchange).
        // Use fintrapp:// when:
        //   1. We are currently running inside the native Capacitor runtime (isCapacitorCallback), OR
        //   2. The state flag tells us the flow was initiated from the native app (capacitorFlow).
        //      This covers the edge case where the auth-callback page is reached without the
        //      Capacitor bridge being available (e.g. in-app browser on web with state|true).
        let redirectUri = 'http://localhost:5173/auth-callback';
        if (isCapacitorCallback || capacitorFlow) {
          redirectUri = 'fintrapp://auth-callback';
        } else if (typeof window !== 'undefined') {
          const storedRedirectUri = sessionStorage.getItem('auth0_redirect_uri');
          if (storedRedirectUri) {
            redirectUri = storedRedirectUri;
          } else {
            redirectUri = `${window.location.origin}/auth-callback`;
          }
        }

        console.log('🔐 Exchanging code for tokens...', {
          codePrefix: code.substring(0, 20) + '...',
          redirectUri,
        });

        let response: Response;
        let data: Record<string, unknown>;

        try {
          response = await fetch(`${backendUrl}/api/v1/auth/oauth/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              state,
              redirect_uri: redirectUri,
            }),
          });
        } catch (networkError: unknown) {
          const message =
            networkError instanceof Error ? networkError.message : 'Network error';
          console.error('❌ Token exchange network error:', message);
          // "Failed to fetch" / "Load failed" usually means CORS or backend unreachable
          const friendlyMessage =
            message === 'Failed to fetch' || message === 'Load failed'
              ? 'Could not reach the server. If you\'re in the app, ensure the backend allows your app origin (CORS) and is reachable.'
              : message;
          throw new Error(friendlyMessage);
        }

        try {
          data = (await response.json()) as Record<string, unknown>;
        } catch {
          const text = await response.text();
          console.error('❌ Token exchange invalid JSON:', response.status, text);
          throw new Error(
            response.status === 0
              ? 'Network or CORS error (no response from server).'
              : `Server error (${response.status}). Check backend CORS allows this origin.`
          );
        }

        console.log('🔐 Token exchange response:', {
          status: response.status,
          ok: response.ok,
        });
        console.log('🔐 Token exchange data:', {
          hasData: !!data,
          dataKeys: Object.keys(data),
          hasDataValue: !!(data as { data?: { value?: unknown } }).data?.value,
        });

        if (!response.ok) {
          const details = (data as { details?: string }).details;
          const message = (data as { message?: string }).message;
          console.error('❌ Token exchange failed:', {
            status: response.status,
            details,
            message,
          });
          throw new Error(details || message || 'Token exchange failed');
        }
        // Extract tokens from response
        // Backend returns: { success: true, message: "...", data: { access_token, id_token, ... } }
        type TokenPayload = {
          access_token?: string;
          id_token?: string;
          refresh_token?: string;
          expires_in?: number;
          token_type?: string;
          scope?: string;
        };
        const responseData = data as {
          data?: { value?: TokenPayload } | TokenPayload;
        };
        const rawData = responseData.data;
        const extracted =
          typeof rawData === 'object' &&
          rawData !== null &&
          'value' in rawData
            ? (rawData as { value?: TokenPayload }).value
            : rawData;
        const tokens: TokenPayload = (extracted ?? data) as TokenPayload;
        console.log('🔐 Extracted tokens:', {
          hasAccessToken: !!tokens.access_token,
          hasIdToken: !!tokens.id_token,
          hasRefreshToken: !!tokens.refresh_token,
          accessTokenLength: tokens.access_token?.length,
          idTokenLength: tokens.id_token?.length,
          accessTokenParts: tokens.access_token?.split('.').length,
          idTokenParts: tokens.id_token?.split('.').length,
          accessTokenPrefix: tokens.access_token?.substring(0, 50) + '...',
          idTokenPrefix: tokens.id_token?.substring(0, 50) + '...',
        });

        // Validate tokens are present
        if (!tokens.access_token || !tokens.id_token) {
          throw new Error('Invalid token response from backend - missing access_token or id_token');
        }

        // Try to decode user profile from ID token
        let userProfile = null;
        let decodeError = null;

        try {
          userProfile = AuthStorage.decodeJWT(tokens.id_token);
        } catch (error: any) {
          console.warn('⚠️ Failed to decode ID token:', error.message);
        }

        // If ID token decode failed, try to get user info from Auth0's userinfo endpoint
        if (!userProfile) {
          try {
            const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
            if (!auth0Domain) {
              throw new Error('Auth0 domain is not configured');
            }

            const userInfoUrl = `https://${auth0Domain}/userinfo`;
            console.log('UserInfo URL:', userInfoUrl);

            const userInfoResponse = await fetch(userInfoUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json',
              },
            });

            if (!userInfoResponse.ok) {
              const errorText = await userInfoResponse.text();

              let errorMessage = `Failed to get user info from Auth0 (${userInfoResponse.status})`;
              try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error_description || errorJson.error || errorMessage;
              } catch (e) {
                errorMessage += `: ${errorText}`;
              }

              throw new Error(errorMessage);
            }

            userProfile = await userInfoResponse.json();
          } catch (userInfoError: any) {
            // Provide more detailed error message
            let errorMsg = 'Failed to get user profile';
            if (decodeError) {
              errorMsg += ` (ID token decode failed: ${decodeError})`;
            }
            if (userInfoError.message) {
              errorMsg += ` (UserInfo fetch failed: ${userInfoError.message})`;
            }

            throw new Error(errorMsg);
          }
        }

        if (!userProfile) {
          throw new Error('Failed to get user profile - both ID token decode and UserInfo fetch failed');
        }

        // Store authentication data
        const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 0;
        const authTokens: AuthTokens = {
          access_token: tokens.access_token ?? '',
          id_token: tokens.id_token ?? '',
          refresh_token: tokens.refresh_token,
          expires_in: expiresIn,
          token_type: tokens.token_type ?? 'Bearer',
          scope: tokens.scope ?? '',
        };

        const authData: AuthStorageData = {
          tokens: authTokens,
          user: userProfile,
          expires_at: Date.now() + expiresIn * 1000,
          issued_at: Date.now(),
        };

        console.log('💾 Storing auth data in localStorage...', {
          userEmail: userProfile?.email,
          userSub: userProfile?.sub,
          expiresAt: new Date(authData.expires_at).toISOString(),
        });
        AuthStorage.setAuthData(authData);

        // Verify tokens are stored
        const storedAuthData = AuthStorage.getAuthData();
        console.log('💾 Verifying stored auth data:', {
          storedSuccessfully: !!storedAuthData,
          hasTokens: !!storedAuthData?.tokens,
          hasUser: !!storedAuthData?.user,
          isAuthenticatedInStorage: AuthStorage.isAuthenticated(),
        });
        
        // Refresh auth context state before redirecting to prevent brief login page flash
        // This ensures AuthWrapper sees the user as authenticated immediately
        console.log('🔄 Refreshing AuthContext state...');
        await checkAuth();
        console.log('✅ AuthContext refreshed');

        // Success!
        hasProcessedRef.current = true;
        setStatus('success');

        // For Capacitor, always redirect to dashboard since sessionStorage doesn't work
        // For web, use the stored redirect path (but never redirect to auth pages)
        let redirectPath = capacitorFlow ? '/dashboard' : getOriginalRedirectPath();

        // Ensure we never redirect to auth pages after successful authentication
        const authPages = ['/login', '/auth', '/auth-callback', '/consent'];
        if (authPages.includes(redirectPath)) {
          redirectPath = '/dashboard';
        }

        console.log('🔄 Determining redirect strategy...', {
          capacitorFlow,
          isCapacitorCallback,
          isIOSDevice: isIOSDevice(),
          redirectPath,
        });

        // For Capacitor flow, close browser and redirect directly
        if (capacitorFlow || isCapacitorCallback) {
          console.log('📱 Capacitor flow detected - closing browser and redirecting to dashboard');
          
          // Close the browser (will fail silently if already closed)
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
            console.log('✅ Browser closed successfully');
          } catch (error) {
            console.log('ℹ️ Browser already closed (this is OK)');
          }

          // Small delay to ensure browser view dismisses
          await new Promise(resolve => setTimeout(resolve, 200));

          // Redirect directly to dashboard (no need for intermediate deep link)
          // Auth state is already refreshed, so we can navigate immediately
          console.log('🚀 Navigating to dashboard:', redirectPath);
          router.push(redirectPath);
          
          // Reset the global auth lock after navigation
          // This allows future logins to work
          setTimeout(() => {
            resetGlobalAuthLock();
          }, 500);
        } else {
          // For web browser (not Capacitor), always redirect to dashboard
          console.log('🌐 Web browser flow - redirecting to:', redirectPath);
          // Use router.push instead of window.location.href to avoid full page reload
          // This prevents the brief flash of login page
          // No delay needed since auth state is already refreshed
          router.push(redirectPath);
        }

      } catch (error: any) {
        hasProcessedRef.current = true;
        setStatus('error');
        setErrorMessage(error.message || 'An error occurred during authentication');
        setTimeout(() => router.push('/auth'), 3000);
      } finally {
        isProcessingRef.current = false;
      }
    };

    handleCallback();
  }, [searchParams, router, isAuthenticated, checkAuth]);

  const handleCloseBrowser = async () => {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch (error) {
      // Silent fail if browser is already closed
    }
  };

  const handleOpenApp = () => {
    const redirectPath = getOriginalRedirectPath();
    const scheme = 'App://';
    const appUrl = `${scheme}${redirectPath}`;

    const link = document.createElement('a');
    link.href = appUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Fintr</h1>
          <p className="text-muted-foreground mt-2">Your Personal Finance Assistant</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {status === 'processing' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-primary mb-2">
                  Completing Sign-In
                </h2>
                <p className="text-muted-foreground">
                  Please wait while we complete your authentication...
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary mb-2">
                  Success!
                </h2>
                {(showCloseBrowserButton || isCapacitorFlow) ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      You've been signed in successfully! Tap the button below to return to the app.
                    </p>
                    <Button
                      onClick={handleCloseBrowser}
                      className="bg-primary hover:bg-primary/80 text-white w-full"
                    >
                      Return to App
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    You've been signed in successfully. Redirecting to your dashboard...
                  </p>
                )}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary mb-2">
                  Authentication Failed
                </h2>
                <p className="text-muted-foreground">
                  {errorMessage || 'An error occurred during authentication.'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Redirecting back to login...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
