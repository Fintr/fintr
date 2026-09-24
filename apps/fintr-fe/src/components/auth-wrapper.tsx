"use client";

import React, { useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import LoadingScreen from '@/components/ui/loading-screen';
import { AuthStorage } from '@/lib/auth-storage';
import { CapacitorLoadingTimeout } from '@/components/capacitor-loading-timeout';
import { shouldShowAuthLoadingScreen } from '@/lib/app-loading-gates';
import { hasAppShellReady } from '@/lib/app-shell-state';
import { isPublicPath } from '@/lib/public-routes';
import { useHydrationSafeValue } from '@/hooks/useHydrationSafeValue';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoading, isAuthenticated, checkAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const isPublicRoute = isPublicPath(pathname);
  const appShellReady = useHydrationSafeValue(hasAppShellReady, false);
  const readStoredSession = useCallback(
    () => Boolean(AuthStorage.getAuthData()),
    [],
  );
  const readAuthenticatedInStorage = useCallback(() => {
    const authData = AuthStorage.getAuthData();
    return Boolean(authData && AuthStorage.isAuthenticated());
  }, []);
  const hasStoredSession = useHydrationSafeValue(readStoredSession, false);
  const isAuthenticatedInStorage = useHydrationSafeValue(
    readAuthenticatedInStorage,
    false,
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
      appShellReady,
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
