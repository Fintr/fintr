import { useState, useEffect } from 'react';

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

  const setValue = (value: any) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn('Error setting localStorage key:', key, error);
    }
  };

  return [storedValue, setValue];
}
