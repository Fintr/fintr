"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyState, getOriginalRedirectPath } from '@/services/auth/google-signin';
import { AuthStorage, AuthStorageData, AuthTokens } from '@/lib/auth-storage';

// Helper function to detect if we're on iOS mobile
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  
  return isIOS;
};

// Helper function to check if Capacitor environment
const isCapacitorEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
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
        // If we're in a Capacitor environment and came from a custom URL scheme,
        // close the browser immediately (it should have already closed automatically,
        // but this ensures it's closed)
        if (isCapacitorEnvironment()) {
          console.log('Capacitor environment detected - attempting to close browser');
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
        
        console.log('Extracted params:');
        console.log('  - Code:', code ? 'Present' : 'Missing');
        console.log('  - State:', state || 'Missing');
        console.log('  - Error:', error || 'None');

        // Check for errors from Auth0
        if (error) {
          console.error('\n❌ Auth0 Error:', error);
          console.error('Error Description:', errorDescription);
          console.error('===================================\n');
          setStatus('error');
          setErrorMessage(errorDescription || error || 'Authentication failed');
          setTimeout(() => router.push('/auth'), 3000);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          console.error('\n❌ Missing authorization parameters');
          console.error('Code:', code ? 'Present' : 'Missing');
          console.error('State:', state ? 'Present' : 'Missing');
          console.error('===================================\n');
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
        
        // Verify state to prevent CSRF (only for web, not Capacitor)
        // For Capacitor, Auth0 already validates the state on its side
        const isCapacitorCallback = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
        const isCapacitorContext = isCapacitorCallback || capacitorFlow;
        
        console.log('Capacitor context:', isCapacitorContext);
        
        if (!isCapacitorContext && !verifyState(decodedState)) {
          setStatus('error');
          setErrorMessage('Invalid state parameter. Possible CSRF attack.');
          setTimeout(() => router.push('/auth'), 3000);
          return;
        }

        // Exchange code for tokens via backend
        const backendUrl = process.env.NEXT_PUBLIC_BE_URL;
        if (!backendUrl) {
          console.error('❌ Backend URL is not configured');
          throw new Error('Backend URL is not configured');
        }

        // Get the redirect URI that was used in the authorization request
        // This must match exactly what Auth0 expects for token exchange
        let redirectUri = 'http://localhost:5173/auth-callback'; // Default fallback
        
        if (isCapacitorContext || capacitorFlow) {
          // For Capacitor, we used fintrapp://auth-callback
          redirectUri = 'fintrapp://auth-callback';
        } else if (typeof window !== 'undefined') {
          // Try to get from sessionStorage (stored during auth initiation)
          const storedRedirectUri = sessionStorage.getItem('auth0_redirect_uri');
          if (storedRedirectUri) {
            redirectUri = storedRedirectUri;
          } else {
            // Fallback to constructing from current origin
            redirectUri = `${window.location.origin}/auth-callback`;
          }
        }
        
        console.log('\n=== Exchanging Code for Tokens ===');
        console.log('Backend URL:', backendUrl);
        console.log('Redirect URI (must match Auth0):', redirectUri);
        console.log('Calling:', `${backendUrl}/api/v1/auth/google/callback`);
        
        const response = await fetch(`${backendUrl}/api/v1/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            code, 
            state,
            redirect_uri: redirectUri // Send redirect URI to backend
          }),
        });
        
        console.log('Response status:', response.status);

        const data = await response.json();

        if (!response.ok) {
          console.error('❌ Token exchange failed');
          console.error('Response:', JSON.stringify(data, null, 2));
          console.error('================================\n');
          throw new Error(data.details || data.message || 'Token exchange failed');
        }

        console.log('✅ Token exchange successful');
        console.log('Response structure:', JSON.stringify(data, null, 2));

        // Extract tokens from response
        // Backend returns: { success: true, message: "...", data: { access_token, id_token, ... } }
        const tokens = data.data?.value || data.data || data;
        
        console.log('\n=== Token Extraction ===');
        console.log('Tokens structure:', {
          hasAccessToken: !!tokens.access_token,
          hasIdToken: !!tokens.id_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type,
          scope: tokens.scope,
        });
        
        // Validate tokens are present
        if (!tokens.access_token || !tokens.id_token) {
          console.error('❌ Missing required tokens in response');
          console.error('Available keys:', Object.keys(tokens));
          throw new Error('Invalid token response from backend - missing access_token or id_token');
        }

        // Try to decode user profile from ID token
        let userProfile = null;
        let decodeError = null;
        
        try {
          console.log('Attempting to decode ID token...');
          userProfile = AuthStorage.decodeJWT(tokens.id_token);
          
          if (userProfile) {
            console.log('✅ Successfully decoded user profile from ID token');
            console.log('User:', userProfile.email || userProfile.sub);
          } else {
            console.log('⚠️ ID token decode returned null - token might be encrypted');
            decodeError = 'ID token decode returned null';
          }
        } catch (error: any) {
          console.warn('⚠️ Failed to decode ID token:', error.message);
          decodeError = error.message;
        }
        
        // If ID token decode failed, try to get user info from Auth0's userinfo endpoint
        if (!userProfile) {
          console.log('\n=== Fetching User Info from Auth0 ===');
          console.log('Auth0 Domain:', process.env.NEXT_PUBLIC_AUTH0_DOMAIN);
          console.log('Access Token (first 20 chars):', tokens.access_token?.substring(0, 20) + '...');
          
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
            
            console.log('UserInfo Response Status:', userInfoResponse.status);
            console.log('UserInfo Response Status Text:', userInfoResponse.statusText);
            
            if (!userInfoResponse.ok) {
              const errorText = await userInfoResponse.text();
              console.error('❌ UserInfo API Error Response:', errorText);
              
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
            console.log('✅ Successfully fetched user profile from Auth0');
            console.log('User:', userProfile.email || userProfile.sub);
            
          } catch (userInfoError: any) {
            console.error('❌ UserInfo fetch failed:', userInfoError);
            console.error('Error message:', userInfoError.message);
            console.error('Error stack:', userInfoError.stack);
            
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
        const authTokens: AuthTokens = {
          access_token: tokens.access_token,
          id_token: tokens.id_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope,
        };

        const authData: AuthStorageData = {
          tokens: authTokens,
          user: userProfile,
          expires_at: Date.now() + (tokens.expires_in * 1000),
          issued_at: Date.now(),
        };

        AuthStorage.setAuthData(authData);
        
        // Verify tokens are stored
        const storedAuthData = AuthStorage.getAuthData();
        console.log('✅ Auth data stored successfully');
        console.log('Stored user:', storedAuthData?.user?.email || storedAuthData?.user?.sub);
        console.log('Has access token:', !!storedAuthData?.tokens?.access_token);
        console.log('Has ID token:', !!storedAuthData?.tokens?.id_token);
        console.log('User profile:', userProfile.email || userProfile.sub);

        // Refresh auth context state before redirecting to prevent brief login page flash
        // This ensures AuthWrapper sees the user as authenticated immediately
        console.log('🔄 Refreshing auth context state...');
        await checkAuth();
        console.log('✅ Auth context state refreshed');

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
        
        console.log('\n=== Redirecting ===');
        console.log('Capacitor Flow:', capacitorFlow);
        console.log('Is Capacitor Callback:', isCapacitorCallback);
        console.log('Redirect Path:', redirectPath);
        
        // For Capacitor flow, redirect to app using custom URL scheme
        // This will close the browser and open the app
        if (capacitorFlow || isCapacitorCallback) {
          console.log('Using Capacitor redirect flow');
          // Small delay to ensure token storage is complete
          setTimeout(async () => {
            try {
              console.log('Closing browser...');
              // Close the browser
              const { Browser } = await import('@capacitor/browser');
              await Browser.close();
              console.log('Browser closed');
            } catch (error) {
              console.log('Browser might already be closed (this is OK)');
            }
            
            console.log('Redirecting to: fintrapp://auth-callback-success');
            // Redirect to app using custom URL scheme
            // This will be caught by the deep link handler
            window.location.href = 'fintrapp://auth-callback-success';
          }, 500);
        } else if (isIOSDevice()) {
          setShowOpenAppButton(true);
        } else {
          // Use router.push instead of window.location.href to avoid full page reload
          // This prevents the brief flash of login page
          // No delay needed since auth state is already refreshed
          router.push(redirectPath);
        }

      } catch (error: any) {
        hasProcessedRef.current = true;
        console.error('\n❌ Auth Callback Error:', error.message || error);
        console.error('Error stack:', error.stack);
        console.error('==============================\n');
        setStatus('error');
        setErrorMessage(error.message || 'An error occurred during authentication');
        setTimeout(() => router.push('/auth'), 3000);
      } finally {
        isProcessingRef.current = false;
      }
      
      console.log('=== Auth Callback Handler Complete ===\n');
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
                  Please wait while we complete your Google authentication...
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
                      You've been signed in with Google! Tap the button below to return to the app.
                    </p>
                    <Button
                      onClick={handleCloseBrowser}
                      className="bg-primary hover:bg-primary/80 text-white w-full"
                    >
                      Return to App
                    </Button>
                  </>
                ) : showOpenAppButton ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      You've been signed in with Google. Tap the button below to open the app.
                    </p>
                    <Button
                      onClick={handleOpenApp}
                      className="bg-primary hover:bg-primary/80 text-white w-full"
                    >
                      Open Fintr App
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    You've been signed in with Google. Redirecting to your dashboard...
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
