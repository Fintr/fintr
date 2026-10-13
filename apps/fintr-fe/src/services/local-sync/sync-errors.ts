import type { BootstrapRequiredErrorDetails } from "@/types/syncTypes";

type ApiErrorBody = {
  success?: boolean;
  error?: {
    message?: string;
    details?: BootstrapRequiredErrorDetails & Record<string, unknown>;
  };
};

const SESSION_AUTH_MESSAGES = ["Bad credentials", "Requires authentication"];

const errorBodyMessage = (body: unknown): string => {
  if (!body || typeof body !== "object") {
    return "";
  }

  const record = body as { message?: unknown; error?: unknown };
  if (typeof record.message === "string") {
    return record.message;
  }
  if (typeof record.error === "string") {
    return record.error;
  }
  if (record.error && typeof record.error === "object") {
    const nested = (record.error as { message?: unknown }).message;
    return typeof nested === "string" ? nested : "";
  }
  return "";
};

/**
 * The API rejected the session (expired or invalid JWT), not the payload. Mutations
 * rethrow either the Axios error or its response body, so check both shapes. Plain
 * "Unauthorized" is excluded: attachment proxies reuse 401 while the session is valid.
 */
export const isSessionAuthError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || error instanceof Error) {
    return false;
  }

  const response = (error as { response?: { data?: unknown } }).response;
  const message = errorBodyMessage(response ? response.data : error);

  return SESSION_AUTH_MESSAGES.some((prefix) => message.startsWith(prefix));
};

export const isBootstrapRequiredError = (error: unknown): error is {
  response: { status: 410; data: ApiErrorBody };
} => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const response = (error as { response?: { status?: number; data?: ApiErrorBody } })
    .response;

  if (response?.status !== 410) {
    return false;
  }

  return response.data?.error?.details?.bootstrapRequired === true;
};

export const bootstrapRequiredDetails = (
  error: unknown,
): BootstrapRequiredErrorDetails | undefined => {
  if (!isBootstrapRequiredError(error)) {
    return undefined;
  }

  const details = error.response.data.error?.details;
  if (!details?.bootstrapRequired) {
    return undefined;
  }

  return {
    bootstrapRequired: true,
    oldestAvailableSeq: Number(details.oldestAvailableSeq ?? 0),
  };
};
