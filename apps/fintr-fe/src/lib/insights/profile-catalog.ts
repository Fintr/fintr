import type { InsightProfileKey } from "@/services/insights/types";

/** LinkedIn-flat illustrations for insights customer profile cards. */
export const PROFILE_IMAGE_PATHS: Record<InsightProfileKey, string> = {
  strong_saver: "/profiles/strong_saver.png",
  high_earner: "/profiles/high_earner.png",
  steady_investor: "/profiles/steady_investor.png",
  avid_spender: "/profiles/avid_spender.png",
  balanced_budgeter: "/profiles/balanced_budgeter.png",
  debt_crusher: "/profiles/debt_crusher.png",
};

export const profileImageForKey = (imageKey: string): string => {
  return (
    PROFILE_IMAGE_PATHS[imageKey as InsightProfileKey]
    ?? PROFILE_IMAGE_PATHS.strong_saver
  );
};
