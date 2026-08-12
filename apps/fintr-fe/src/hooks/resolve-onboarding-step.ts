/**
 * Resolve the workspace setup step when /auth/private has no onboarding step.
 * Existing users always have a space; missing step + space means skip setup.
 * Only brand-new accounts (no space yet) should enter currency onboarding.
 */
export const resolveOnboardingStep = (
  step: unknown,
  hasSpace: boolean,
): string => {
  if (step && String(step).trim()) {
    return String(step).trim();
  }

  return hasSpace ? "completed" : "currency";
};
