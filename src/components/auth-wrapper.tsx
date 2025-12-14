"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import LoadingScreen from '@/components/ui/loading-screen';
import { AuthStorage } from '@/lib/auth-storage';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/auth', '/auth-callback', '/consent', '/', '/pricing', '/contact-us', '/privacy-policy', '/terms-of-service', '/waitlist', '/whats-next'];
  const isPublicRoute = publicRoutes.includes(pathname);
  
  useEffect(() => {
    console.log('🛡️ AuthWrapper - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'isPublicRoute:', isPublicRoute, 'pathname:', pathname);
    
    // Check storage directly as a fallback to prevent brief redirect flash
    // This is especially important right after auth callback when context might not be updated yet
    const authData = AuthStorage.getAuthData();
    const isAuthenticatedInStorage = authData && AuthStorage.isAuthenticated();
    
    // Only redirect if both context and storage indicate not authenticated
    // This prevents the brief flash of login page during auth callback redirect
    if (!isLoading && !isAuthenticated && !isAuthenticatedInStorage && !isPublicRoute) {
      console.log('🔄 AuthWrapper - redirecting to login');
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname]);
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  // Check storage directly as fallback to prevent redirect flash
  const authData = AuthStorage.getAuthData();
  const isAuthenticatedInStorage = authData && AuthStorage.isAuthenticated();
  
  // If not authenticated (in both context and storage) and not on a public route, show loading while redirecting
  if (!isAuthenticated && !isAuthenticatedInStorage && !isPublicRoute) {
    return <LoadingScreen />;
  }
  
  return <>{children}</>;
}

export default AuthWrapper;
