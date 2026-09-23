import { BADGE_IMAGE_PATHS } from "@/lib/badges/catalog";
import { TAG_STYLE_PRESETS } from "@/lib/tags/preset-style-images";
import { warmShellCachedImageUrls } from "@/lib/insights/resolve-shell-cached-asset";

/**
 * Ensures gamification badge illustrations and tag sample styles are in the
 * fintr shell cache. Call while online (e.g. on Dashboard mount).
 */
export const warmBadgeImages = async (): Promise<void> => {
  await warmShellCachedImageUrls([
    ...Object.values(BADGE_IMAGE_PATHS),
    ...TAG_STYLE_PRESETS.map((preset) => preset.src),
  ]);
};
