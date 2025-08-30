"use client";

import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingScreen from '@/components/ui/loading-screen';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoading } = useAuth0();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return <>{children}</>;
}

export default AuthWrapper;
