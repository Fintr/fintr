"use client";

import React, { useEffect, useState } from 'react';
import { isCapacitorEnvironment } from '@/lib/capacitor';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, LogOut } from 'lucide-react';
import { AuthStorage } from '@/lib/auth-storage';

interface CapacitorLoadingTimeoutProps {
  isLoading: boolean;
  timeoutMs?: number;
  onRetry: () => void;
}

/**
 * Component that monitors loading state and shows recovery options
 * if loading takes too long (especially in Capacitor apps)
 */
export function CapacitorLoadingTimeout({
  isLoading,
  timeoutMs = 15000, // 15 seconds default
  onRetry,
}: CapacitorLoadingTimeoutProps) {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      if (isTimedOut || elapsedSeconds > 0) {
        console.log('✅ CapacitorLoadingTimeout: Loading complete, resetting', {
          wasTimedOut: isTimedOut,
          elapsedSeconds,
        });
      }
      setIsTimedOut(false);
      setElapsedSeconds(0);
      return;
    }

    console.log('⏳ CapacitorLoadingTimeout: Starting timeout monitor', {
      timeoutMs,
      timestamp: new Date().toISOString(),
    });

    // Count elapsed seconds
    const countInterval = setInterval(() => {
      setElapsedSeconds(prev => {
        const newValue = prev + 1;
        if (newValue % 5 === 0) {
          console.log(`⏳ CapacitorLoadingTimeout: Still loading... ${newValue}s elapsed`);
        }
        return newValue;
      });
    }, 1000);

    // Set timeout for showing recovery options
    const timeoutId = setTimeout(() => {
      console.warn('⏰ CapacitorLoadingTimeout: TIMEOUT REACHED!', {
        timeoutMs,
        timestamp: new Date().toISOString(),
      });
      setIsTimedOut(true);
    }, timeoutMs);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(countInterval);
    };
  }, [isLoading, timeoutMs]);

  const handleForceReload = () => {
    console.log('🔄 CapacitorLoadingTimeout: User clicked Force Reload');
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleClearAndRestart = () => {
    console.log('🧹 CapacitorLoadingTimeout: User clicked Clear Session & Login Again');
    console.log('🧹 Clearing all auth data...');
    if (typeof window !== 'undefined') {
      // Clear all auth data
      AuthStorage.clearAuthData();
      localStorage.clear();
      sessionStorage.clear();
      console.log('🧹 All data cleared, redirecting to /login');
      // Redirect to login
      window.location.href = '/login';
    }
  };

  const handleRetry = () => {
    console.log('🔄 CapacitorLoadingTimeout: User clicked Try Again');
    onRetry();
  };

  if (!isLoading || !isTimedOut) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="mx-4 max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/20">
            <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              Taking longer than expected...
            </h2>
            <p className="text-sm text-muted-foreground">
              The app has been loading for {elapsedSeconds} seconds.
              This might be due to a slow network connection or an authentication issue.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 pt-4">
            <Button
              onClick={handleRetry}
              variant="default"
              size="lg"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            {isCapacitorEnvironment() && (
              <Button
                onClick={handleForceReload}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Force Reload App
              </Button>
            )}

            <Button
              onClick={handleClearAndRestart}
              variant="destructive"
              size="lg"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Clear Session & Login Again
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            If the problem persists, try "Clear Session & Login Again"
          </p>
        </div>
      </div>
    </div>
  );
}
