/**
 * Extracts field validation errors from API error responses
 * @param error - The error object from API response
 * @returns An object mapping field names to their error messages
 */
export const extractFieldErrors = (error: any): Record<string, string[]> => {
  // If the error has a response property (Axios error)
  if (error?.error?.details) {
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

/**
 * Formats an API error object into a readable message.
 * Supports responses with shape: error.response.data.error.{message,details}
 */
const INTERNAL_DETAIL_KEYS = new Set(["expected", "error"]);

const FIELD_LABELS: Record<string, string> = {
  label: "Identifier",
};

const formatFieldDetailMessage = (key: string, message: string): string => {
  const fieldLabel = FIELD_LABELS[key] ?? key;

  if (
    message.startsWith("cannot") ||
    message.startsWith("must") ||
    message.startsWith("already")
  ) {
    return `${fieldLabel} ${message}`;
  }

  return message;
};

const formatDetailEntry = (key: string, value: unknown): string[] => {
  if (INTERNAL_DETAIL_KEYS.has(key)) {
    return [];
  }

  if (typeof value === "boolean") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatFieldDetailMessage(key, String(item)));
  }

  if (value && typeof value === "object") {
    return Object.values(value).map((item) =>
      formatFieldDetailMessage(key, String(item)),
    );
  }

  return [formatFieldDetailMessage(key, String(value))];
};

export const formatApiErrorMessage = (
  error: any,
  fallbackMessage: string
): string => {
  const detailsCandidates = [
    error?.response?.data?.error?.details,
    error?.response?.data?.details,
    error?.error?.details,
    error?.details,
  ];

  const messageCandidates = [
    error?.response?.data?.error?.message,
    error?.response?.data?.message,
    error?.error?.message,
    error?.message,
  ];

  const details = detailsCandidates.find(
    (candidate) => candidate && typeof candidate === "object"
  );

  if (details) {
    const detailMessages = Object.entries(details)
      .flatMap(([key, value]) => formatDetailEntry(key, value))
      .filter((message) => message.length > 0);

    if (detailMessages.length > 0) {
      return detailMessages.join("; ");
    }
  }

  const message = messageCandidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      candidate.length > 0 &&
      candidate !== "Unprocessable Entity" &&
      !candidate.startsWith("Request failed with status code")
  );

  return message || fallbackMessage;
};
