/**
 * Nested dashboard routes whose mobile sticky header shows Back immediately
 * (no scroll required). Used by the header and by the default push transition.
 */
export const shouldShowImmediateBackButton = (pathname: string): boolean => {
  const immediateBackPrefixes = [
    "/dashboard/space_settings/accounts/detail",
    "/dashboard/space_settings/categories",
    "/dashboard/space_settings/tags",
    "/dashboard/space_settings/accounts",
    "/dashboard/space_settings/entities/detail",
    "/dashboard/space_settings/entities",
    "/dashboard/transactions/detail",
    "/dashboard/recurring",
    "/dashboard/space_settings/import",
    "/dashboard/space_settings/subscriptions",
    "/dashboard/loans",
  ];

  return immediateBackPrefixes.some((prefix) => pathname.startsWith(prefix));
};
