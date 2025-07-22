import { useState, useEffect } from 'react';
import { performanceUtils } from '@/lib/utils';

export function useLocalStorage(key: string, initialValue: any) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      const shouldParse = typeof initialValue !== 'string';
      const value = item ? (shouldParse ? JSON.parse(item) : item) : initialValue;
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
        window.localStorage.setItem(key, JSON.stringify(value));
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

  // Cleanup on unmount for mobile memory management
  useEffect(() => {
    return () => {
      if (performanceUtils.isMobileDevice()) {
        performanceUtils.cleanupMemory();
      }
    };
  }, []);

  return [storedValue, setValue];
}
