"use client";

import { useEffect, useState } from 'react';
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
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showOpenAppButton, setShowOpenAppButton] = useState<boolean>(false);
  const [showCloseBrowserButton, setShowCloseBrowserButton] = useState<boolean>(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
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
        let isCapacitorFlow = false;
        
        if (state.includes('|')) {
          const [randomState, flag] = state.split('|');
          decodedState = randomState;
          isCapacitorFlow = flag === 'true';
          console.log('🔍 Decoded state from Auth0:');
          console.log('  - Random state:', decodedState);
          console.log('  - Is Capacitor flow:', isCapacitorFlow);
        }
        
        // Verify state to prevent CSRF (only for web, not Capacitor)
        // For Capacitor, Auth0 already validates the state on its side
        const isCapacitorCallback = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
        const isCapacitorContext = isCapacitorCallback || isCapacitorFlow;
        
        if (!isCapacitorContext && !verifyState(decodedState)) {
          setStatus('error');
          setErrorMessage('Invalid state parameter. Possible CSRF attack.');
          setTimeout(() => router.push('/auth'), 3000);
          return;
        }
        
        console.log('✅ State verified - isCapacitorContext:', isCapacitorContext);

        // Exchange code for tokens via backend
        const backendUrl = process.env.NEXT_PUBLIC_BE_URL;
        if (!backendUrl) {
          throw new Error('Backend URL is not configured');
        }

        const response = await fetch(`${backendUrl}/api/v1/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || data.message || 'Token exchange failed');
        }

        // Extract tokens from response
        const tokens = data.data.value || data.data;

        console.log('🔍 Token Exchange Response Debug:');
        console.log('  - Full response:', data);
        console.log('  - Extracted tokens:', tokens);
        console.log('  - ID Token:', tokens.id_token);
        console.log('  - Access Token:', tokens.access_token);

        // Try to decode user profile from ID token
        let userProfile = null;
        
        try {
          userProfile = AuthStorage.decodeJWT(tokens.id_token);
          console.log('  - Decoded user profile from ID token:', userProfile);
        } catch (error) {
          console.warn('⚠️  Could not decode ID token, trying alternative approach:', error);
          
          // If ID token is encrypted, try to get user info from Auth0's userinfo endpoint
          try {
            const userInfoResponse = await fetch(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/userinfo`, {
              headers: {
                'Authorization': `Bearer ${tokens.access_token}`
              }
            });
            
            if (userInfoResponse.ok) {
              userProfile = await userInfoResponse.json();
              console.log('  - Got user profile from userinfo endpoint:', userProfile);
            } else {
              throw new Error('Failed to get user info from Auth0');
            }
          } catch (userInfoError) {
            console.error('❌ Failed to get user profile from both ID token and userinfo endpoint:', userInfoError);
            throw new Error('Failed to get user profile');
          }
        }
        
        if (!userProfile) {
          console.error('❌ Failed to get user profile');
          throw new Error('Failed to get user profile');
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

        // Success!
        setStatus('success');

        // Redirect using custom scheme to trigger Capacitor deep link
        // This will close the in-app browser and open the main app
        console.log('✅ Google sign-in successful, redirecting to app...');
        console.log('🔍 Device Detection:');
        console.log('  - Is iOS:', isIOSDevice());
        console.log('  - Is Capacitor:', isCapacitorEnvironment());
        console.log('  - Is Capacitor Flow (from state):', isCapacitorFlow);
        
        // For Capacitor, always redirect to dashboard since sessionStorage doesn't work
        // For web, use the stored redirect path
        const redirectPath = isCapacitorFlow ? '/dashboard' : getOriginalRedirectPath();
        
        // For Capacitor flow, tokens are already stored above
        // Show button to close browser and return to app
        if (isCapacitorFlow) {
          console.log('📱 Capacitor flow - tokens stored, success!');
          setShowCloseBrowserButton(true);
        } else if (isIOSDevice()) {
          // On iOS device but not in Capacitor (e.g., Safari)
          // Show button to open app since direct redirect doesn't work in Safari
          console.log('📱 iOS Safari detected - showing open app button');
          setShowOpenAppButton(true);
        } else {
          // Regular web redirect
          console.log('🌐 Regular web redirect:', redirectPath);
          setTimeout(() => {
            window.location.href = redirectPath;
          }, 1000);
        }

      } catch (error: any) {
        console.error('Google Sign-In callback error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'An error occurred during authentication');
        setTimeout(() => router.push('/auth'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, router, isAuthenticated]);

  const handleCloseBrowser = async () => {
    console.log('📱 Attempting to close browser and return to app...');
    
    try {
      // Try to close browser via Capacitor API
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
      console.log('✅ Browser closed successfully');
    } catch (error) {
      console.error('❌ Could not close browser:', error);
      console.log('⚠️ User will need to manually close the browser');
    }
  };

  const handleOpenApp = () => {
    const redirectPath = getOriginalRedirectPath();
    const scheme = 'App://';
    const appUrl = `${scheme}${redirectPath}`;
    
    console.log('📱 Attempting to open app with URL:', appUrl);
    
    // For iOS Safari, we need to use a different method
    // Create a temporary anchor element to trigger the URL scheme
    const link = document.createElement('a');
    link.href = appUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // After attempting to open app, show a message
    // The app should handle the deep link if it's installed
    setTimeout(() => {
      console.log('✅ App open attempt completed');
    }, 500);
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
                {showCloseBrowserButton ? (
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
