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

// Track color indices for each chart reference key
const chartColorIndices: { [chartKey: string]: number } = {};

export function getColor(chartKey: string): string {
  const colors = [
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
  
  // Initialize index for this chart key if it doesn't exist
  if (!(chartKey in chartColorIndices)) {
    chartColorIndices[chartKey] = 0;
  }

  // Get the current color for this chart
  const color = colors[chartColorIndices[chartKey]];
  console.log('chartKey', chartKey, color);
  // Move to the next color for this chart
  chartColorIndices[chartKey]++;
  
  // Reset to 0 when all colors have been used for this chart
  if (chartColorIndices[chartKey] >= colors.length) {
    chartColorIndices[chartKey] = 0;
  }
  
  return color;
}

// Darker, more royal color palette for charts
const CHART_COLORS = [
  "#1E40AF", // Royal Blue
  "#9F1239", // Deep Red
  "#047857", // Emerald Green
  "#7E22CE", // Royal Purple
  "#0E7490", // Cyan
  "#6D28D9", // Violet
  "#BE185D", // Pink
  "#166534", // Green
  "#4338CA", // Indigo
  "#701A75", // Fuchsia
  "#0F766E", // Teal
  "#4F46E5", // Blue
  "#C026D3", // Magenta
  "#0369A1", // Sky Blue
  "#059669"  // Green Teal
];

// Track used colors to avoid duplicates
let usedChartColors: Set<string> = new Set();

// Get a unique chart color
export function getUniqueChartColor(identifier?: string): string {
  // Reset used colors if all are used
  if (usedChartColors.size >= CHART_COLORS.length) {
    usedChartColors.clear();
  }
  
  // If identifier is provided, use it to consistently pick the same color
  if (identifier) {
    const hash = identifier.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    // Try to find a color that hasn't been used yet
    for (let i = 0; i < CHART_COLORS.length; i++) {
      const colorIndex = (hash + i) % CHART_COLORS.length;
      const color = CHART_COLORS[colorIndex];
      
      if (!usedChartColors.has(color)) {
        usedChartColors.add(color);
        return color;
      }
    }
  }
  
  // If no identifier or all colors for this identifier are used,
  // find the first unused color
  for (const color of CHART_COLORS) {
    if (!usedChartColors.has(color)) {
      usedChartColors.add(color);
      return color;
    }
  }
  
  // If all colors are used, return the first one
  // (this should never happen due to the reset at the beginning)
  return CHART_COLORS[0];
}

// Reset chart colors (useful when generating a new chart)
export function resetChartColors(): void {
  usedChartColors.clear();
}
