import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonLoaderProps {
  /** Size of the spinner */
  size?: 'small' | 'medium';
  /** Additional CSS classes */
  className?: string;
  /** Loading text to display */
  text?: string;
}

/**
 * Consistent loading spinner component for buttons
 * 
 * @example
 * ```tsx
 * <Button disabled={isLoading}>
 *   {isLoading ? (
 *     <ButtonLoader text="Saving..." />
 *   ) : (
 *     'Save'
 *   )}
 * </Button>
 * ```
 */
const ButtonLoader: React.FC<ButtonLoaderProps> = ({
  size = 'medium',
  className = '',
  text
}) => {
  const spinnerSize = size === 'small' ? 'h-3 w-3' : 'h-4 w-4';
  const marginClass = text ? 'mr-2' : '';

  return (
    <>
      <Loader2 className={`${spinnerSize} ${marginClass} animate-spin ${className}`} />
      {text && <span>{text}</span>}
    </>
  );
};

export default ButtonLoader;
