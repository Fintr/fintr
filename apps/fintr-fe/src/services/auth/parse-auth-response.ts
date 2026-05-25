import type { LoginResponse } from "./login";

type JsonRecord = Record<string, unknown>;

const readString = (record: JsonRecord, snake: string, camel: string): string | undefined => {
  const value = record[snake] ?? record[camel];
  return typeof value === "string" ? value : undefined;
};

const readNumber = (record: JsonRecord, snake: string, camel: string): number | undefined => {
  const value = record[snake] ?? record[camel];
  return typeof value === "number" ? value : undefined;
};

/**
 * Normalizes login/signup API payloads. Supports direct token objects and the
 * legacy Dry::Monads Success wrapper shape (`data.value`).
 */
export const parseAuthTokenPayload = (body: JsonRecord): LoginResponse => {
  const data = body.data;
  let payload: JsonRecord | undefined;

  if (data && typeof data === "object") {
    const record = data as JsonRecord;
    payload =
      record.value && typeof record.value === "object"
        ? (record.value as JsonRecord)
        : record;
  }

  if (!payload) {
    throw new Error("Invalid auth response: missing token payload");
  }

  const accessToken = readString(payload, "access_token", "accessToken");
  const idToken = readString(payload, "id_token", "idToken");
  const expiresIn = readNumber(payload, "expires_in", "expiresIn");

  if (!accessToken || !idToken || expiresIn == null) {
    throw new Error("Invalid auth response: missing access token, id token, or expiry");
  }

  return {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: readString(payload, "refresh_token", "refreshToken"),
    expires_in: expiresIn,
    token_type: readString(payload, "token_type", "tokenType") ?? "Bearer",
    scope: readString(payload, "scope", "scope") ?? "",
  };
};

const GENERIC_API_ERROR_MESSAGES = new Set([
  "registration failed",
  "signup failed",
  "login failed",
  "request failed",
  "unprocessable entity",
  "bad request",
  "unauthorized",
  "forbidden",
]);

const isGenericApiErrorMessage = (message: string): boolean =>
  GENERIC_API_ERROR_MESSAGES.has(message.trim().toLowerCase());

const formatErrorDetails = (details: unknown): string | undefined => {
  if (typeof details === "string" && details.trim()) {
    return details.trim();
  }

  if (details == null) {
    return undefined;
  }

  if (typeof details !== "object") {
    return String(details);
  }

  const entries = Object.entries(details as JsonRecord);
  if (entries.length === 0) {
    return undefined;
  }

  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.map(String).join(", ")}`;
      }

      if (typeof value === "string") {
        return `${key}: ${value}`;
      }

      return `${key}: ${JSON.stringify(value)}`;
    })
    .join("; ");
};

/**
 * Extracts a user-facing message from Fintr API error responses, e.g.
 * `{ success: false, error: { message: "Invalid credentials" } }`.
 */
export const parseApiErrorMessage = (
  body: JsonRecord,
  fallback = "Request failed",
): string => {
  const topLevelMessage = body.message;
  if (typeof topLevelMessage === "string" && topLevelMessage.trim()) {
    return topLevelMessage.trim();
  }

  const errorField = body.error;
  if (typeof errorField === "string" && errorField.trim()) {
    return errorField.trim();
  }

  if (errorField && typeof errorField === "object") {
    const errorObject = errorField as JsonRecord;
    const nestedMessage =
      typeof errorObject.message === "string" ? errorObject.message.trim() : undefined;
    const nestedDetails = formatErrorDetails(errorObject.details);

    if (nestedDetails && nestedMessage && isGenericApiErrorMessage(nestedMessage)) {
      return nestedDetails;
    }

    if (nestedDetails && !nestedMessage) {
      return nestedDetails;
    }

    if (nestedMessage) {
      return nestedMessage;
    }

    if (nestedDetails) {
      return nestedDetails;
    }
  }

  const topLevelDetails = formatErrorDetails(body.details);
  if (topLevelDetails) {
    return topLevelDetails;
  }

  return fallback;
};
