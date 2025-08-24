import React from 'react';

interface FormErrorProps {
  message?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * FormError component for displaying validation errors
 * @param message - The error message to display
 * @param children - Alternative to message, can provide formatted content
 * @param className - Additional classes to apply to the container
 */
const FormError: React.FC<FormErrorProps> = ({ message, children, className = '' }) => {
  const errorMessage = children || message;
  
  if (!errorMessage) return null;
  
  return (
    <div className={`flex items-center mt-1.5 mb-1 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4 bg-red-800 mr-1 flex-shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-xs font-medium bg-red-800">{errorMessage}</p>
    </div>
  );
};

export { FormError, type FormErrorProps }; 
 