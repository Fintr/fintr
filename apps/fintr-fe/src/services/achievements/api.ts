import { AxiosInstance } from "axios";
import type { GamificationAchievement, GamificationProfile } from "@/types/badgeTypes";

export const achievementsApi = {
  getProfile: (api: AxiosInstance) =>
    api.get<{ success: boolean; message: string; data: GamificationProfile }>(
      "/achievements/profile",
    ),

  getAchievements: (api: AxiosInstance) =>
    api.get<{
      success: boolean;
      message: string;
      data: { achievements: GamificationAchievement[] };
    }>("/achievements/achievements"),
};
