import * as Sentry from "@sentry/nextjs";

export async function register() {
  const SENTRY_DSN = process.env.SENTRY_DSN;

  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      enabled: process.env.NODE_ENV !== "development",
      beforeSend(event) {
        if (event.exception) {
          // Sanitize sensitive data from server-side errors
          if (event.request?.headers) {
            const headers = { ...event.request.headers };
            delete headers.authorization;
            delete headers.cookie;
            event.request.headers = headers;
          }
          if (event.request?.data) {
            try {
              const data = JSON.parse(event.request.data);
              if (data.password) {
                data.password = "[REDACTED]";
              }
              if (data.token) {
                data.token = "[REDACTED]";
              }
              event.request.data = JSON.stringify(data);
            } catch {
              // If not JSON, leave as-is
            }
          }
        }
        return event;
      },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
