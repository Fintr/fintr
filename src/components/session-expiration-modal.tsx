"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SESSION_EXPIRED_EVENT_NAME } from '@/lib/session-expiration-handler';
import { AuthStorage } from '@/lib/auth-storage';

export default function SessionExpirationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuth();
  const hasHandledExpiration = useRef(false);

  useEffect(() => {
    const handleSessionExpired = () => {
      // Prevent handling multiple times
      if (hasHandledExpiration.current) {
        return;
      }

      // Don't show modal if already on login/auth page
      const publicRoutes = ['/login', '/auth', '/auth-callback'];
      if (publicRoutes.includes(pathname)) {
        return;
      }

      hasHandledExpiration.current = true;
      
      // Clear auth data immediately
      AuthStorage.clearAuthData();
      // Show modal
      setIsOpen(true);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);
    };
  }, [pathname]);

  const handleOkay = () => {
    setIsOpen(false);
    // Call logout to ensure all state is cleared and redirect to login
    logout();
    // Reset the flag when user clicks okay (in case they log back in)
    hasHandledExpiration.current = false;
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Prevent closing by clicking outside - user must click "Okay"
        if (!open) return;
        setIsOpen(open);
      }}
    >
      <DialogContent 
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Session Expired</DialogTitle>
          <DialogDescription>
            Session expired. Logged out.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleOkay}>
            Okay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

