import type { ZodError } from "zod";

export type FieldErrorMap = Record<string, string[]>;

export type DomainValidationFailure = {
  success: false;
  message: string;
  details: FieldErrorMap;
};

export class DomainValidationError extends Error {
  readonly success = false as const;
  readonly details: FieldErrorMap;

  constructor(details: FieldErrorMap) {
    super("Validation failed");
    this.name = "DomainValidationError";
    this.details = details;
  }

  toJSON(): DomainValidationFailure {
    return {
      success: false,
      message: this.message,
      details: this.details,
    };
  }
}

export const zodErrorToFieldMap = (error: ZodError): FieldErrorMap => {
  const details: FieldErrorMap = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    const key = path.length > 0 ? path : "_base";
    details[key] = details[key] ?? [];
    details[key].push(issue.message);
  }

  return details;
};

export const assertValid = <T>(
  result:
    | { success: true; data: T }
    | { success: false; error: ZodError },
): T => {
  if (result.success) {
    return result.data;
  }

  throw new DomainValidationError(zodErrorToFieldMap(result.error));
};
