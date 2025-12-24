"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthStorage } from '@/lib/auth-storage';

export default function DeepLinkHandler() {
  const router = useRouter();
  const { checkAuth, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const handleDeepLink = async () => {
      // Wait for Capacitor to be ready before checking
      if (typeof window === 'undefined') {
        return;
      }
      
      // Give Capacitor time to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!(window as any).Capacitor) {
        return;
      }

      try {
        const { App } = await import('@capacitor/app');
        
        // Listen for app URL opens (deep links)
        const listener = await App.addListener('appUrlOpen', async (event: { url: string }) => {
          console.log('\n=== Deep Link Received ===');
          console.log('URL:', event.url);
          
          // Immediately close Browser if it's still open (from OAuth redirect)
          // This ensures the Browser closes when iOS intercepts the custom URL scheme
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close().catch(() => {
              // Browser might already be closed, that's OK
            });
            console.log('Browser closed via deep link handler');
          } catch (error) {
            // Ignore errors if Browser plugin isn't available
          }
          
          // Parse the URL scheme (e.g., fintrapp://dashboard, capacitor://localhost/auth-callback?code=...)
          let path = '/dashboard';
          let queryParams = '';
          
          try {
            // For custom schemes like fintrapp://dashboard or fintrapp://auth-callback?code=...
            if (event.url.includes('://')) {
              const parts = event.url.split('://');
              if (parts.length > 1) {
                const pathAndQuery = parts[1] || '';
                
                // Split path and query params
                if (pathAndQuery.includes('?')) {
                  const [parsedPath, query] = pathAndQuery.split('?');
                  path = parsedPath || '/dashboard';
                  queryParams = query || '';
                } else {
                  path = pathAndQuery || '/dashboard';
                }
                
                // Ensure leading slash
                if (!path.startsWith('/')) {
                  path = '/' + path;
                }
              }
            } else if (event.url.startsWith('/')) {
              path = event.url;
            }
            
            console.log('Parsed path:', path);
            console.log('Query params:', queryParams);
          } catch (error) {
            console.error('Error parsing URL:', error);
            // Invalid URL format, default to dashboard
          }
          
          // Check if this is an OAuth callback with query params
          if (path === '/auth-callback' && queryParams) {
            console.log('Routing to auth-callback with params');
            console.log('Query params:', queryParams);
            
            // Close the Browser plugin if it's still open (from OAuth redirect)
            // This ensures the browser closes when the app opens via deep link
            import('@capacitor/browser').then(({ Browser }) => {
              Browser.close().catch(() => {
                // Ignore errors if browser is already closed
              });
            });
            
            // Route to auth-callback page to process the tokens
            router.push(`/auth-callback?${queryParams}`);
            return;
          }
          
          // Check if this is an auth callback success (from auth-callback page redirect after token storage)
          if (path === '/auth-callback-success' || path === 'auth-callback-success') {
            console.log('Auth callback success - refreshing auth state...');
            
            // Wait for checkAuth to complete and verify auth state is updated
            let retryCount = 0;
            const maxRetries = 10; // Maximum 5 seconds of retries (10 * 500ms)
            
            const navigateToDashboard = () => {
              // Check auth state directly from storage as a fallback
              const authData = AuthStorage.getAuthData();
              const isAuthReady = authData && AuthStorage.isAuthenticated();
              
              if (isAuthReady) {
                console.log('Auth confirmed ready, navigating to dashboard');
                router.push('/dashboard');
                // Force a small delay to ensure navigation completes
                setTimeout(() => {
                  // If still on same route, the state should be ready now
                  console.log('Dashboard navigation initiated');
                }, 100);
              } else if (retryCount < maxRetries) {
                retryCount++;
                console.warn(`Auth not ready yet, retrying (${retryCount}/${maxRetries}) in 500ms...`);
                setTimeout(navigateToDashboard, 500);
              } else {
                console.error('Auth not ready after maximum retries, navigating anyway');
                // Navigate anyway - AuthWrapper will handle the redirect if needed
                router.push('/dashboard');
              }
            };
            
            checkAuth().then(() => {
              console.log('Auth state refreshed, verifying authentication...');
              
              // Wait for React state to propagate, then check if authenticated
              setTimeout(() => {
                navigateToDashboard();
              }, 500);
            }).catch((error) => {
              console.error('Error refreshing auth state:', error);
              // Still try to navigate - auth might be in storage even if checkAuth failed
              navigateToDashboard();
            });
            return;
          }
          
          console.log('Routing to:', path);
          
          // Refresh auth state when deep link is received
          checkAuth().then(() => {
            router.push(path);
          });
        });

        return () => {
          listener.remove();
        };
      } catch (error) {
        // Silent fail if not in Capacitor environment
      }
    };

    handleDeepLink();
  }, [router, checkAuth]);

  return null;
}
