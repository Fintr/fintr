/**
 * Capacitor environment detection and utilities
 */

/**
 * Check if we're running in a Capacitor environment (mobile app)
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

