const LIGHT_THEME_EXACT_PATHS = new Set([
  "/",
  "/pricing",
  "/contact-us",
  "/privacy-policy",
  "/terms-of-service",
  "/waitlist",
  "/whats-next",
  "/delete-account",
]);

/**
 * Marketing / legal pages keep the original light landing design.
 * Auth, onboarding, and the signed-in app use dark theme.
 * When the route is not yet known, default to light.
 */
export const isLightThemePath = (
  pathname: string | null | undefined,
): boolean => {
  if (pathname == null || pathname === "") {
    return true;
  }

  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return LIGHT_THEME_EXACT_PATHS.has(normalized);
};

export const resolveThemeForPath = (
  pathname: string | null | undefined,
): "light" | "dark" =>
  isLightThemePath(pathname) ? "light" : "dark";
