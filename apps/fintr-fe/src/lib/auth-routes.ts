/** Default destination after login, OAuth, or completing auth. */
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard/home";

/** Milliseconds before login falls back to a hard navigation on static preview. */
export const AUTH_REDIRECT_FALLBACK_MS = 2000;

const AUTH_PAGES = [
  "/login",
  "/signup",
  "/auth",
  "/auth-callback",
  "/consent",
];

export const isAuthPage = (path: string): boolean => AUTH_PAGES.includes(path);

export const isAuthenticatedAppPath = (path: string): boolean => {
  const normalized = path.replace(/\/$/, "") || "/";

  return (
    normalized.startsWith("/dashboard")
    || normalized.startsWith("/onboarding")
    || normalized.startsWith("/admin")
    || normalized.startsWith("/crm")
    || normalized.startsWith("/consent")
  );
};

const normalizePath = (path: string): string =>
  path.replace(/\/$/, "") || "/";

/**
 * Hard navigation after auth — only from auth pages. Avoids reloading
 * `/dashboard/home` during offline sync (which causes ERR_FAILED under SW).
 */
export const navigateAfterAuthentication = (
  path: string = DEFAULT_AUTHENTICATED_PATH,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const current = normalizePath(window.location.pathname);
  const target = normalizePath(path);

  if (current === target || isAuthenticatedAppPath(current)) {
    return;
  }

  if (!isAuthPage(current)) {
    return;
  }

  window.location.assign(path);
};

/**
 * Get the original redirect path before OAuth flow.
 * Never returns auth pages — always redirects to home after successful auth.
 */
export const getOriginalRedirectPath = (): string => {
  if (typeof window === "undefined") {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  const path = sessionStorage.getItem("auth0_redirect_origin");
  sessionStorage.removeItem("auth0_redirect_origin");

  if (path && !isAuthPage(path)) {
    return path;
  }

  return DEFAULT_AUTHENTICATED_PATH;
};
