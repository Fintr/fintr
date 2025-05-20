/**
 * Extracts field validation errors from API error responses
 * @param error - The error object from API response
 * @returns An object mapping field names to their error messages
 */
export const extractFieldErrors = (error: any): Record<string, string[]> => {
  // If the error has a response property (Axios error)
  if (error.error.details) {
    const { details } = error.error;
    // Check for the expected error structure
    if (details) {
      return details;
    }
  }
  
  // If the error object itself has a details property (direct API response)
  if (error.details) {
    return error.details;
  }
  
  // Return empty object if no field errors found
  return {};
};

/**
 * Formats a validation error message for display
 * @param errors - Array of error messages for a field
 * @returns Formatted error message
 */
export const formatFieldError = (errors: string[] | undefined): string => {
  if (!errors || errors.length === 0) return '';
  
  // Join multiple errors with line breaks if there are more than one
  return errors.join(', ');
};

/**
 * Checks if an API error response contains field validation errors
 * @param error - The error object
 * @returns True if the error has field validation errors
 */
export const hasFieldValidationErrors = (error: any): boolean => {
  const fieldErrors = extractFieldErrors(error);
  return Object.keys(fieldErrors).length > 0;
}; 
