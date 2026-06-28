"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import LoadingScreen from '@/components/ui/loading-screen';
import { AuthStorage } from '@/lib/auth-storage';
import { CapacitorLoadingTimeout } from '@/components/capacitor-loading-timeout';
import { isPublicPath } from '@/lib/public-routes';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoading, isAuthenticated, checkAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const publicAuthRoutes = ['/auth', '/login', '/signup'];
  const isPublicAuthRoute = publicAuthRoutes.includes(pathname);
  const isPublicRoute = isPublicPath(pathname);

  useEffect(() => {
    // Check storage directly as a fallback to prevent brief redirect flash
    // This is especially important right after auth callback when context might not be updated yet
    const authData = AuthStorage.getAuthData();
    const isAuthenticatedInStorage = authData && AuthStorage.isAuthenticated();

    // Only redirect if both context and storage indicate not authenticated
    // This prevents the brief flash of login page during auth callback redirect
    if (!isLoading && !isAuthenticated && !isAuthenticatedInStorage && !isPublicRoute) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname]);
  
  if (isLoading && !isPublicAuthRoute) {
    return (
      <>
        <LoadingScreen />
        <CapacitorLoadingTimeout
          isLoading={isLoading}
          timeoutMs={15000} // 15 seconds
          onRetry={checkAuth}
        />
      </>
    );
  }
  
  // Check storage directly as fallback to prevent redirect flash
  const authData = AuthStorage.getAuthData();
  const isAuthenticatedInStorage = authData && AuthStorage.isAuthenticated();
  
  // If not authenticated (in both context and storage) and not on a public route, show loading while redirecting
  if (!isAuthenticated && !isAuthenticatedInStorage && !isPublicRoute) {
    return (
      <>
        <LoadingScreen />
        <CapacitorLoadingTimeout
          isLoading={true}
          timeoutMs={15000}
          onRetry={checkAuth}
        />
      </>
    );
  }
  
  return <>{children}</>;
}

export default AuthWrapper;
