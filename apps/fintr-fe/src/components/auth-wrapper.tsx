"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import LoadingScreen from '@/components/ui/loading-screen';
import { AuthStorage } from '@/lib/auth-storage';
import { CapacitorLoadingTimeout } from '@/components/capacitor-loading-timeout';
import { shouldShowAuthLoadingScreen } from '@/lib/app-loading-gates';
import { isPublicPath } from '@/lib/public-routes';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoading, isAuthenticated, checkAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const isPublicRoute = isPublicPath(pathname);
  const authData = AuthStorage.getAuthData();
  const hasStoredSession = Boolean(authData);
  const isAuthenticatedInStorage = Boolean(
    authData && AuthStorage.isAuthenticated(),
  );

  useEffect(() => {
    // Only redirect if both context and storage indicate not authenticated
    if (!isLoading && !isAuthenticated && !isAuthenticatedInStorage && !isPublicRoute) {
      router.push('/login');
    }
  }, [
    isLoading,
    isAuthenticated,
    isAuthenticatedInStorage,
    isPublicRoute,
    router,
    pathname,
  ]);

  if (
    shouldShowAuthLoadingScreen({
      isPublicRoute,
      isAuthContextLoading: isLoading,
      isAuthenticated,
      hasStoredSession,
    })
  ) {
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
