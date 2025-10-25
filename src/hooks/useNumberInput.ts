import { useState, useEffect } from 'react';
import { numberFormatting } from '@/lib/utils';

interface UseNumberInputProps {
  initialValue?: string | number;
  onValueChange?: (cleanValue: number) => void;
}

interface UseNumberInputReturn {
  displayValue: string;
  setDisplayValue: (value: string) => void;
  handleInputChange: (value: string) => void;
  reset: () => void;
}

/**
 * Custom hook for handling number input with comma formatting and decimal support
 * 
 * @param initialValue - Initial value for the input
 * @param onValueChange - Callback when the clean numeric value changes
 * @returns Object with display value, handlers, and reset function
 */
export const useNumberInput = ({ 
  initialValue = "", 
  onValueChange 
}: UseNumberInputProps = {}): UseNumberInputReturn => {
  const [displayValue, setDisplayValue] = useState(() => {
    if (initialValue) {
      return numberFormatting.formatForInput(initialValue.toString());
    }
    return "";
  });

  // Don't automatically update display value when initialValue changes
  // This prevents interference with user typing
  // The display value will be updated through handleInputChange only

  const handleInputChange = (value: string) => {
    const formattedValue = numberFormatting.handleInputChange(value);
    setDisplayValue(formattedValue);
    
    // Call onValueChange with the clean numeric value
    if (onValueChange) {
      const cleanValue = numberFormatting.cleanForBackend(formattedValue);
      onValueChange(cleanValue);
    }
  };

  const reset = () => {
    setDisplayValue("");
  };

  return {
    displayValue,
    setDisplayValue,
    handleInputChange,
    reset
  };
};
