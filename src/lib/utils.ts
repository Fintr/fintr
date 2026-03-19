import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to truncate text with responsive behavior
export const truncateText = (text: string, maxLength: number = 10, responsive: boolean = true): string => {
  if (!text) return '';
  
  // If responsive is true, we'll use CSS classes instead of JS truncation
  if (responsive) {
    return text;
  }
  
  // Only truncate if not responsive (for cases where we need JS truncation)
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

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

/** Returns the currency symbol for a given ISO 4217 code (e.g. "USD" → "$", "PHP" → "₱"). */
export function getCurrencySymbol(currencyCode: string): string {
  if (!currencyCode || currencyCode.length !== 3) return currencyCode || "";
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).formatToParts(0);
    const currencyPart = parts.find((p) => p.type === "currency");
    return currencyPart?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

/** Format amount with 3 decimals and 3-letter currency code (e.g. "1,234.567 PHP"). */
export function formatAmountWithCode(amount: number, currencyCode: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return `${formatted} ${currencyCode}`;
}

/** Format a rate or numeric value with thousand separators and fixed decimals (e.g. "15.767" or "12,345.678"). */
export function formatWithDelimiters(
  value: number,
  options: { minFractionDigits?: number; maxFractionDigits?: number } = {}
): string {
  const { minFractionDigits = 2, maxFractionDigits = 6 } = options;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
}

export const CHART_COLORS = [
  "#008080", // Teal
  "#FF6F61", // Coral pink
  "#CC5500", // Burnt orange
  "#0A3D62", // Deep navy
  "#E6B800", // Soft gold
  "#B5E3C8", // Pale mint
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
  return CHART_COLORS[index % CHART_COLORS.length];
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

export function getNumberColor(value: number): string {
  if (value < 0) {
    return "text-red-900"; // negative values
  } else if (value > 0) {
    return "text-teal-600"; // positive values
  }
  return "text-gray-500"; // zero
}

// Number formatting utilities
export const numberFormatting = {
  // Format number with comma delimiters for display
  formatNumber: (value: string | number): string => {
    if (!value && value !== 0) return '';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '';
    return numValue.toLocaleString('en-US');
  },

  // Parse formatted number back to clean numeric value
  parseNumber: (formattedValue: string): number => {
    if (!formattedValue) return 0;
    // Remove all non-numeric characters except decimal point and minus sign
    const cleanValue = formattedValue.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  },

  // Format number for input display (with commas) - handles decimal points and negatives properly
  formatForInput: (value: string | number): string => {
    if (!value && value !== 0) return '';
    
    // Convert to string for processing
    const stringValue = value.toString();
    
    // If the string is empty, return empty
    if (stringValue === '') return '';
    
    // If the string is just a minus sign, return it
    if (stringValue === '-') return '-';
    
    // If the string is just a decimal point, return it
    if (stringValue === '.') return '.';
    
    // Check if negative
    const isNegative = stringValue.startsWith('-');
    const workingValue = isNegative ? stringValue.slice(1) : stringValue;
    const prefix = isNegative ? '-' : '';
    
    // If the string ends with a decimal point, format the integer part and add the decimal
    if (workingValue.endsWith('.')) {
      const integerPart = workingValue.slice(0, -1);
      if (integerPart === '') return prefix + '.';
      const numValue = parseFloat(integerPart);
      if (!isNaN(numValue)) {
        return prefix + numValue.toLocaleString('en-US') + '.';
      }
      return stringValue;
    }
    
    // If the string contains a decimal point, format the integer part and preserve the decimal part
    if (workingValue.includes('.')) {
      const [integerPart, decimalPart] = workingValue.split('.');
      if (integerPart === '') return prefix + '.' + decimalPart;
      const numValue = parseFloat(integerPart);
      if (!isNaN(numValue)) {
        return prefix + numValue.toLocaleString('en-US') + '.' + decimalPart;
      }
      return stringValue;
    }
    
    // For integers, format with commas
    const numValue = parseFloat(workingValue);
    if (!isNaN(numValue)) {
      return prefix + numValue.toLocaleString('en-US');
    }
    
    return stringValue;
  },

  // Clean number for backend (remove commas) - preserves decimal points
  cleanForBackend: (formattedValue: string): number => {
    if (!formattedValue) return 0;
    // Remove commas but preserve decimal points
    const cleanValue = formattedValue.replace(/,/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  },

  // Handle input change - allows decimal points and negative signs during typing
  handleInputChange: (value: string): string => {
    // Allow only numbers, decimal points, commas, and minus sign
    let cleaned = value.replace(/[^0-9.,-]/g, '');
    
    // If the value is empty, return empty
    if (cleaned === '') return '';
    
    // If the value is just a minus sign, return it
    if (cleaned === '-') return '-';
    
    // If the value is just a decimal point, return it
    if (cleaned === '.') return '.';
    
    // Remove all commas before processing
    const withoutCommas = cleaned.replace(/,/g, '');
    
    // Check if negative (minus sign at the start)
    const isNegative = withoutCommas.startsWith('-');
    const workingValue = isNegative ? withoutCommas.slice(1) : withoutCommas;
    const prefix = isNegative ? '-' : '';
    
    // If working value is empty after removing minus, return just minus
    if (workingValue === '') return '-';
    
    // If the value ends with a decimal point, format the integer part and add the decimal
    if (workingValue.endsWith('.')) {
      const integerPart = workingValue.slice(0, -1);
      if (integerPart === '') return prefix + '.';
      const numValue = parseFloat(integerPart);
      if (!isNaN(numValue)) {
        return prefix + numValue.toLocaleString('en-US') + '.';
      }
      return withoutCommas;
    }
    
    // If the value contains a decimal point, preserve it exactly
    if (workingValue.includes('.')) {
      const [integerPart, decimalPart] = workingValue.split('.');
      
      // If integer part is empty, just return the decimal part with a dot
      if (integerPart === '') return prefix + '.' + decimalPart;
      
      // Format integer part with commas and preserve decimal part exactly as typed
      const integerNum = parseFloat(integerPart);
      if (!isNaN(integerNum) && integerNum >= 0) {
        // Format the integer part with commas
        const formattedInteger = integerNum.toLocaleString('en-US');
        // CRITICAL: Always preserve the decimal part exactly as typed, no matter what
        return prefix + formattedInteger + '.' + decimalPart;
      }
      // If parsing fails, return the original cleaned value
      return withoutCommas;
    }
    
    // For integers, format with commas
    const numValue = parseFloat(workingValue);
    if (!isNaN(numValue) && numValue >= 0) {
      return prefix + numValue.toLocaleString('en-US');
    }
    
    return withoutCommas;
  }
};
