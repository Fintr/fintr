import { init as sentryInit } from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  sentryInit({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",
    tracesSampleRate: process.env.NEXT_PUBLIC_ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enabled: process.env.NEXT_PUBLIC_ENVIRONMENT !== "development",
    beforeSend(event) {
      if (event.exception) {
        // Sanitize sensitive data
        if (event.request?.headers) {
          const headers = { ...event.request.headers };
          delete headers.authorization;
          delete headers.cookie;
          event.request.headers = headers;
        }
      }
      return event;
    },
  });
}
