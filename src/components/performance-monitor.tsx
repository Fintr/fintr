"use client";
import { useEffect } from 'react';
import { performanceUtils } from '@/lib/utils';

interface PerformanceMonitorProps {
  children: React.ReactNode;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ children }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let memoryCheckInterval: NodeJS.Timeout | null = null;
    let refreshTimeout: NodeJS.Timeout | null = null;
    let isPaused = false;

    // Pause monitoring when app is backgrounded to prevent watchdog termination
    const handleVisibilityChange = () => {
      isPaused = document.hidden;
      if (isPaused && refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Monitor memory usage and performance for mobile devices
    if (performanceUtils.isMobileDevice()) {
      console.log('📱 Mobile device detected - enabling performance monitoring');

      // Check memory usage every 30 seconds
      memoryCheckInterval = setInterval(() => {
        // Skip memory check when app is backgrounded
        if (isPaused) return;
        
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          
          // If memory usage is above 85%, trigger cleanup
          if (memoryUsage > 0.85) {
            console.warn('⚠️ High memory usage detected:', Math.round(memoryUsage * 100) + '%');
            performanceUtils.cleanupMemory();
            
            // If memory usage is above 95%, suggest page refresh
            if (memoryUsage > 0.95) {
              console.error('🚨 Critical memory usage detected - suggesting refresh');
              
              // Show user a non-intrusive notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Fintr Performance', {
                  body: 'App is using high memory. Consider refreshing for better performance.',
                  icon: '/favicon.ico'
                });
              }
              
              // Auto-refresh after 5 minutes if user doesn't act
              refreshTimeout = setTimeout(() => {
                if (confirm('The app is using high memory. Would you like to refresh for better performance?')) {
                  window.location.reload();
                }
              }, 300000); // 5 minutes
            }
          }
        }
      }, 30000); // Check every 30 seconds

      // Prevent excessive re-renders by throttling certain events
      const throttledResize = performanceUtils.throttle(() => {
        if (isPaused) return;
        // Trigger cleanup on resize to free up memory
        performanceUtils.cleanupMemory();
      }, 1000);

      const throttledScroll = performanceUtils.throttle(() => {
        // Passive scroll handling for better performance
      }, 100);

      // Add event listeners with passive option for better performance
      const passiveSupported = performanceUtils.supports.passiveEventListeners();
      const eventOptions: AddEventListenerOptions | boolean = passiveSupported ? { passive: true } : false;

      window.addEventListener('resize', throttledResize);
      window.addEventListener('scroll', throttledScroll, eventOptions);

      // Cleanup on unmount
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (memoryCheckInterval) clearInterval(memoryCheckInterval);
        if (refreshTimeout) clearTimeout(refreshTimeout);
        window.removeEventListener('resize', throttledResize);
        window.removeEventListener('scroll', throttledScroll, eventOptions);
      };
    }

    // Performance monitoring for all devices
    const handleError = (event: ErrorEvent) => {
      console.error('💥 JavaScript Error:', event.error);
      
      // Try to recover from errors that might cause freezing
      try {
        performanceUtils.cleanupMemory();
      } catch (e) {
        console.error('Failed to cleanup memory:', e);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('💥 Unhandled Promise Rejection:', event.reason);
      
      // Prevent default to avoid console spam
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    // Request notification permission for mobile users
    if (performanceUtils.isMobileDevice() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('📱 Notification permission granted for performance alerts');
        }
      });
    }
  }, []);

  return <>{children}</>;
}; 
