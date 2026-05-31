/**
 * Site-wide maintenance gate for authenticated non-admin users.
 * Enable with NEXT_PUBLIC_MAINTENANCE_MODE=true at build time.
 */

export function isMaintenanceModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
}

export function getMaintenanceMessage(): string {
  const custom = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE?.trim();

  if (custom) {
    return custom;
  }

  return "We're performing scheduled maintenance to improve Fintr. Please check back soon.";
}

export function getMaintenanceTitle(): string {
  const custom = process.env.NEXT_PUBLIC_MAINTENANCE_TITLE?.trim();

  if (custom) {
    return custom;
  }

  return "We'll be right back";
}
