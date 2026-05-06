import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  className = '',
}) => {
  let spinnerSize = 'h-8 w-8';
  let borderWidth = 'border-4';

  if (size === 'small') {
    spinnerSize = 'h-5 w-5';
    borderWidth = 'border-2';
  } else if (size === 'large') {
    spinnerSize = 'h-12 w-12';
    borderWidth = 'border-6'; // Tailwind doesn't have border-6, will use border-4 for consistency
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full ${spinnerSize} ${borderWidth} border-solid border-primary border-t-transparent ${className}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export default LoadingSpinner; 
