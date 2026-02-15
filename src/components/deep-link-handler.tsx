"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthStorage } from '@/lib/auth-storage';

// Global flag to prevent processing during auth flows
let globalAuthLock = false;

// Global set of auth-callback URLs we've already navigated for (survives duplicate appUrlOpen events)
const processedAuthCallbackUrls = new Set<string>();

// Export function to reset the global auth lock after auth flow completes
export const resetGlobalAuthLock = () => {
  console.log('🔓 Resetting global auth lock');
  globalAuthLock = false;
};

export default function DeepLinkHandler() {
  const router = useRouter();
  const { checkAuth, isAuthenticated, isLoading } = useAuth();
  
  // Use refs to persist across renders and prevent race conditions
  const processedUrlsRef = useRef(new Set<string>());
  const isProcessingRef = useRef(false);

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
          
          // CRITICAL: Check global auth lock first (prevents all processing during auth)
          if (globalAuthLock) {
            console.log('🔒 Global auth lock active - ignoring deep link');
            return;
          }
          
          // Prevent duplicate processing of the same URL (synchronous check)
          if (processedUrlsRef.current.has(event.url)) {
            console.log('⏭️ Skipping duplicate deep link:', event.url);
            return;
          }
          
          // Mark as processed IMMEDIATELY to prevent race conditions
          processedUrlsRef.current.add(event.url);
          
          // Prevent concurrent processing
          if (isProcessingRef.current) {
            console.log('⏭️ Already processing a deep link, skipping:', event.url);
            return;
          }
          
          // Set processing flag
          isProcessingRef.current = true;
          
          console.log('✅ Processing deep link:', event.url);
          
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
            // Only one navigation per auth callback URL (iOS can fire appUrlOpen multiple times)
            if (processedAuthCallbackUrls.has(event.url)) {
              console.log('⏭️ Auth callback already handled for this URL, skipping navigation');
              isProcessingRef.current = false;
              return;
            }
            processedAuthCallbackUrls.add(event.url);
            globalAuthLock = true;
            console.log('🔒 Global auth lock activated');
            console.log('🔐 OAuth callback detected - initiating token exchange');
            console.log('Query params:', queryParams);

            // Close the browser so user sees the app (may already be closed)
            console.log('🚪 Closing Safari browser...');
            try {
              const { Browser } = await import('@capacitor/browser');
              await Browser.close();
              console.log('✅ Safari browser closed');
            } catch (error) {
              console.log('ℹ️ Browser close failed (might already be closed):', error);
            }

            await new Promise((resolve) => setTimeout(resolve, 100));

            console.log('📍 Navigating to /auth-callback...');
            router.push(`/auth-callback?${queryParams}`);
            console.log('✅ Auth callback navigation initiated');
            return;
          }
          
          // Check if this is an auth callback success (from auth-callback page redirect after token storage)
          if (path === '/auth-callback-success' || path === 'auth-callback-success') {
            console.log('Auth callback success - refreshing auth state...');
            
            // Refresh auth state from storage
            await checkAuth().catch((error) => {
              console.error('Error refreshing auth state:', error);
            });
            
            // Check auth state from storage
            const authData = AuthStorage.getAuthData();
            const isAuthReady = authData && AuthStorage.isAuthenticated();
            
            if (isAuthReady) {
              console.log('✅ Auth confirmed ready, navigating to dashboard');
              router.push('/dashboard');
            } else {
              console.error('❌ Auth not ready after token exchange');
              router.push('/login');
            }
            
            isProcessingRef.current = false; // Reset processing flag
            return;
          }
          
          console.log('Routing to:', path);
          
          // Refresh auth state when deep link is received
          try {
            await checkAuth();
            router.push(path);
          } catch (error) {
            console.error('Error in deep link handler:', error);
            router.push(path); // Navigate anyway
          } finally {
            isProcessingRef.current = false; // Reset processing flag
          }
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
