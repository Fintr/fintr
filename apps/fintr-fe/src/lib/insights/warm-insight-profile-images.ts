import { PROFILE_IMAGE_PATHS } from "@/lib/insights/profile-catalog";
import { warmShellCachedImageUrls } from "@/lib/insights/resolve-shell-cached-asset";

/**
 * Ensures insight profile illustrations are in the fintr shell cache.
 * Call while online (e.g. on Dashboard mount) so offline insight cards
 * can load /profiles/*.png without hitting the network.
 */
export const warmInsightProfileImages = async (): Promise<void> => {
  await warmShellCachedImageUrls(Object.values(PROFILE_IMAGE_PATHS));
};
