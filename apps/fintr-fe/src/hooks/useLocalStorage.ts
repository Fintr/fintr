import { useState, useEffect } from 'react';
import { performanceUtils } from '@/lib/utils';

export function useLocalStorage(key: string, initialValue: any) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      // Determine if the stored item should be parsed as JSON
      // This is crucial: only parse if it was originally stored as a JSON object/array/boolean/number
      // For simple strings, we store and retrieve as-is to avoid "" quotes.
      const isJsonString = (str: string) => {
        try {
          JSON.parse(str);
        } catch (e) {
          return false;
        }
        return true;
      };

      const value = item ? (isJsonString(item) ? JSON.parse(item) : item) : initialValue;
      return value;
    } catch (error) {
      console.warn('Error reading localStorage key:', key, error);
      return initialValue;
    }
  });

  // Debounced setValue to prevent excessive localStorage writes
  const debouncedSetLocalStorage = performanceUtils.debounce((key: string, value: any) => {
    try {
      if (typeof window !== 'undefined') {
        // Only stringify if the value is not already a string. This avoids double-stringifying.
        const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
        window.localStorage.setItem(key, valueToStore);
      }
    } catch (error) {
      console.warn('Error setting localStorage key:', key, error);
    }
  }, 100);

  const setValue = (value: any) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      debouncedSetLocalStorage(key, valueToStore);
    } catch (error) {
      console.warn('Error setting localStorage key:', key, error);
    }
  };

  // Listen for external changes to localStorage (e.g., from space switching)
  useEffect(() => {
    const handleStorageChange = (e: CustomEvent) => {
      if (e.detail?.spaceCode !== undefined && key === 'spaceCode') {
        setStoredValue(e.detail.spaceCode);
      }
    };

    // Listen for our custom spaceCodeChanged event
    if (typeof window !== 'undefined') {
      window.addEventListener('spaceCodeChanged', handleStorageChange as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('spaceCodeChanged', handleStorageChange as EventListener);
      }
      if (performanceUtils.isMobileDevice()) {
        performanceUtils.cleanupMemory();
      }
    };
  }, [key]);

  return [storedValue, setValue];
}
