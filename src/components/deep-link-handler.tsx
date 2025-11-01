"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DeepLinkHandler() {
  const router = useRouter();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const handleDeepLink = async () => {
      // Check if we're in Capacitor
      if (typeof window === 'undefined' || !(window as any).Capacitor) {
        return;
      }

      try {
        const { App } = await import('@capacitor/app');
        
        // Listen for app URL opens (deep links)
        const listener = await App.addListener('appUrlOpen', (event: { url: string }) => {
          // Parse the URL scheme (e.g., App://dashboard or App://auth-callback?code=...&state=...)
          let path = '/dashboard';
          let queryParams = '';
          
          try {
            // For custom schemes like App://dashboard or App://auth-callback?code=...
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
          } catch (error) {
            // Invalid URL format, default to dashboard
          }
          
          // Check if this is an OAuth callback
          if (path === '/auth-callback' && queryParams) {
            router.push(`/auth-callback?${queryParams}`);
            return;
          }
          
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
