import { BADGE_IMAGE_PATHS } from "@/lib/badges/catalog";
import { warmShellCachedImageUrls } from "@/lib/insights/resolve-shell-cached-asset";

/**
 * Ensures gamification badge illustrations are in the fintr shell cache.
 * Call while online (e.g. on Dashboard mount) so Settings titles/badges
 * can load /badges/*.png without hitting the network.
 */
export const warmBadgeImages = async (): Promise<void> => {
  await warmShellCachedImageUrls(Object.values(BADGE_IMAGE_PATHS));
};
