/**
 * When enabled, peer catch-up uses GET /spaces/sync/changes instead of
 * re-fetching paginated transaction lists while online.
 */
export const isSpaceSyncPullEnabled = (): boolean => {
  const raw = process.env.NEXT_PUBLIC_FINTR_SPACE_SYNC_PULL;
  return raw === "1" || raw === "true";
};
