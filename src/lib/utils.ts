import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function to prevent excessive function calls
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function to limit function execution rate
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Check if device is mobile for performance optimizations
  isMobileDevice: (): boolean => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Memory cleanup utility
  cleanupMemory: () => {
    if (typeof window !== 'undefined') {
      // Force garbage collection if available (Chrome DevTools)
      if ((window as any).gc) {
        (window as any).gc();
      }
    }
  },

  // Optimize images for mobile
  createOptimizedImageUrl: (url: string, width?: number, quality?: number) => {
    if (!url) return url;
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (quality) params.append('q', quality.toString());
    return `${url}${params.toString() ? '?' + params.toString() : ''}`;
  },

  // Check if browser supports certain features
  supports: {
    webp: (): boolean => {
      if (typeof window === 'undefined') return false;
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    },
    
    intersectionObserver: (): boolean => {
      return typeof window !== 'undefined' && 'IntersectionObserver' in window;
    },
    
    passiveEventListeners: (): boolean => {
      if (typeof window === 'undefined') return false;
      let passiveSupported = false;
      try {
        const options = {
          get passive() {
            passiveSupported = true;
            return false;
          }
        } as AddEventListenerOptions;
        window.addEventListener('test' as keyof WindowEventMap, () => {}, options);
        window.removeEventListener('test' as keyof WindowEventMap, () => {}, options);
      } catch (err) {
        passiveSupported = false;
      }
      return passiveSupported;
    }
  }
};

// Function to check if V2 features should be shown
export const shouldShowV2Features = (): boolean => {
  return process.env.NEXT_PUBLIC_SHOW_V2 === 'true';
};

// Existing utility functions
export function formatCurrency(amount: number, currency: string = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

export function getRandomColor(): string {
  const colors = [
    "#008080", "#FF6B6B", "#4ECDC4", "#45B7D1", 
    "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
