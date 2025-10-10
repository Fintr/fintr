import React from 'react';
import { Input } from './input';
import { useNumberInput } from '@/hooks/useNumberInput';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string | number;
  onChange?: (cleanValue: number) => void;
  onDisplayChange?: (displayValue: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * NumberInput component that handles comma formatting and decimal points
 * 
 * @param value - The numeric value (will be formatted for display)
 * @param onChange - Callback with clean numeric value
 * @param onDisplayChange - Callback with formatted display value
 * @param placeholder - Input placeholder
 * @param className - Additional CSS classes
 * @param ...props - Other input props
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, onDisplayChange, placeholder = "0.00", className, ...props }, ref) => {
    const { displayValue, handleInputChange } = useNumberInput({
      initialValue: value,
      onValueChange: onChange
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      handleInputChange(inputValue);
      
      // Call onDisplayChange with display value
      if (onDisplayChange) {
        onDisplayChange(inputValue);
      }
    };

    return (
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";
