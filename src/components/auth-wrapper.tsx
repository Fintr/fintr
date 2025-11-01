"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import LoadingScreen from '@/components/ui/loading-screen';

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
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      console.log('🔄 AuthWrapper - redirecting to login');
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname]);
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  // If not authenticated and not on a public route, show loading while redirecting
  if (!isAuthenticated && !isPublicRoute) {
    return <LoadingScreen />;
  }
  
  return <>{children}</>;
}

export default AuthWrapper;
