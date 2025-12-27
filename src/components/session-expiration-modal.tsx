"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    const handleSessionExpired = () => {
      // Clear auth data immediately
      AuthStorage.clearAuthData();
      // Show modal
      setIsOpen(true);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);
    };
  }, []);

  const handleOkay = () => {
    setIsOpen(false);
    // Call logout to ensure all state is cleared and redirect to login
    logout();
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

