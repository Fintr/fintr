const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/auth",
  "/auth-callback",
  "/consent",
  "/pricing",
  "/contact-us",
  "/privacy-policy",
  "/terms-of-service",
  "/waitlist",
  "/whats-next",
  "/delete-account",
  "/account-setup",
  "/signup-success",
]);

/**
 * Routes that do not require authentication (marketing site, auth flows, legal).
 * Treats unknown/null pathname as public during hydration to avoid redirect flashes.
 */
export const isPublicPath = (pathname: string | null | undefined): boolean => {
  if (pathname == null || pathname === "") {
    return true;
  }

  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (normalized === "/" || PUBLIC_EXACT_PATHS.has(normalized)) {
    return true;
  }

  return false;
};
