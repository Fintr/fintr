import { isAxiosError } from "axios";

function firstStringFromParsed(parsed: Record<string, unknown>): string | null {
  const errField = parsed.error;
  if (typeof errField === "string" && errField.trim()) {
    return errField.trim();
  }
  if (
    errField &&
    typeof errField === "object" &&
    "message" in errField &&
    typeof (errField as { message: unknown }).message === "string"
  ) {
    const m = String((errField as { message: string }).message).trim();
    return m || null;
  }
  if (typeof parsed.message === "string" && parsed.message.trim()) {
    return parsed.message.trim();
  }
  const errors = parsed.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (typeof first === "string" && first.trim()) {
      return first.trim();
    }
  }
  return null;
}

const DEFAULT_EXPORT_FAILURE =
  "Could not export CSV. If you are in the app, try again or update Fintr from the store.";

/**
 * Turns axios / Error / unknown failures from blob export requests into a short user string.
 * When the API returns 4xx/5xx with `responseType: 'blob'`, the body is often a JSON Blob.
 */
export async function getUserFacingExportErrorMessage(
  error: unknown
): Promise<string> {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const msg = firstStringFromParsed(parsed);
        if (msg) {
          return msg;
        }
      } catch {
        /* fall through */
      }
    }

    if (data && typeof data === "object" && !(data instanceof Blob)) {
      const msg = firstStringFromParsed(data as Record<string, unknown>);
      if (msg) {
        return msg;
      }
    }

    if (status === 401) {
      return "Session expired. Sign in again.";
    }
    if (status === 403) {
      return "You don't have permission to export this data.";
    }
    if (status === 404) {
      return "Export could not be found.";
    }
    if (status !== undefined && status >= 500) {
      return "Server error. Try again in a moment.";
    }

    if (error.message?.trim()) {
      return error.message.trim();
    }
    return DEFAULT_EXPORT_FAILURE;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return DEFAULT_EXPORT_FAILURE;
}
