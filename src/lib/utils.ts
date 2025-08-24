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

export const CHART_COLORS = [
  "#FF6F61", // Coral pink
  "#CC5500", // Burnt orange
  "#0A3D62", // Deep navy
  "#E6B800", // Soft gold
  "#B5E3C8", // Pale mint
  "#E0E0E0", // Light gray
  "#87CEEB", // Sky blue
  "#D4B483", // Warm sand
  "#C4C3D0", // Lavender gray
];
// Track color indices for each chart reference key
const chartColorIndices: { [chartKey: string]: number } = {};

export function getColor(chartKey?: string): string {
  if (!chartKey) {
    return CHART_COLORS[Math.floor(Math.random() * CHART_COLORS.length)];
  }
  
  // Initialize index for this chart key if it doesn't exist
  if (!(chartKey in chartColorIndices)) {
    chartColorIndices[chartKey] = 0;
  }

  // Get the current color for this chart
  const color = CHART_COLORS[chartColorIndices[chartKey]];
  console.log('chartKey', chartKey, color);
  // Move to the next color for this chart
  chartColorIndices[chartKey]++;
  
  // Reset to 0 when all colors have been used for this chart
  if (chartColorIndices[chartKey] >= CHART_COLORS.length) {
    chartColorIndices[chartKey] = 0;
  }
  
  return color;
}

export function getColorByIndex(index: number): string {
  return CHART_COLORS[index];
}

export function getProgressColor(progress: number, type: "bg" | "font" | "all" = "all"): string {
  if (progress <= 80) {
    return type === "bg" ? "bg-teal-600" : type === "font" ? "text-teal-600" : "bg-teal-600 text-teal-600"; // teal
  } else if (progress <= 100) {
    return type === "bg" ? "bg-[#CC5500]" : type === "font" ? "text-[#CC5500]" : "bg-[#CC5500] text-[#CC5500]"; // burnt orange
  } else {
    return type === "bg" ? "bg-red-900" : type === "font" ? "text-red-900" : "bg-red-900 text-red-900"; // burgundy
  }
}
