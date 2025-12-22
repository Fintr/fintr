/**
 * Capacitor environment detection and utilities
 */

/**
 * Wait for Capacitor to be ready (if in Capacitor environment)
 * Also ensures Capacitor is fully initialized with all methods
 */
export const waitForCapacitor = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  // If Capacitor is already available and has the expected methods, return true
  const capacitor = (window as any).Capacitor;
  if (capacitor && typeof capacitor.getPlatform === 'function') {
    return true;
  }

  // Wait for Capacitor to load (with timeout)
  return new Promise((resolve) => {
    const maxWait = 5000; // 5 seconds max
    const startTime = Date.now();
    
    const checkCapacitor = () => {
      const cap = (window as any).Capacitor;
      
      // Check if Capacitor exists and has at least one method (indicating it's initialized)
      if (cap && typeof cap.getPlatform === 'function') {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        console.warn('Capacitor did not load within timeout period');
        resolve(false);
        return;
      }
      
      setTimeout(checkCapacitor, 100);
    };
    
    checkCapacitor();
  });
};

/**
 * Check if we're running in a Capacitor environment (mobile app)
 * This is a synchronous check - use waitForCapacitor() if you need to ensure it's loaded
 */
export const isCapacitorEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
};

/**
 * Get the base URL for redirects based on the environment
 * - For Capacitor: returns 'fintrapp://'
 * - For browser: returns window.location.origin
 */
export const getBaseUrl = (): string => {
  if (isCapacitorEnvironment()) {
    return 'fintrapp://';
  }
  
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback for SSR
  return process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000';
};

/**
 * Build a redirect URL for subscription callbacks
 * @param path - The path to append (e.g., '/dashboard/subscriptions?success=true')
 */
export const buildSubscriptionRedirectUrl = (path: string): string => {
  const baseUrl = getBaseUrl();
  
  // For Capacitor (fintrapp://), append path directly without leading slash
  if (baseUrl.endsWith('://')) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}${cleanPath}`;
  }
  
  // For browser URLs, ensure path starts with / and append to base URL
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * Open a URL using the appropriate method based on environment
 * - For Capacitor: Uses in-app browser (Capacitor Browser plugin)
 * - For browser: Uses window.location.href or window.open
 * @param url - The URL to open
 * @param options - Options for opening the URL
 */
export const openUrl = async (
  url: string,
  options?: {
    inNewTab?: boolean;
    title?: string;
  }
): Promise<void> => {
  // Wait for Capacitor to be ready before checking
  const isCapacitor = await waitForCapacitor();
  
  if (isCapacitor) {
    try {
      const { Browser } = await import('@capacitor/browser');
      
      await Browser.open({
        url: url,
        windowName: '_self',
        presentationStyle: 'popover',
        toolbarColor: '#ffffff'
      });
    } catch (error) {
      console.error('Failed to open Capacitor browser:', error);
      // Fallback to regular browser if Capacitor Browser fails
      if (options?.inNewTab) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    }
  } else {
    // For regular browser
    if (options?.inNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  }
};

