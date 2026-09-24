import type { BootstrapRequiredErrorDetails } from "@/types/syncTypes";

type ApiErrorBody = {
  success?: boolean;
  error?: {
    message?: string;
    details?: BootstrapRequiredErrorDetails & Record<string, unknown>;
  };
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
