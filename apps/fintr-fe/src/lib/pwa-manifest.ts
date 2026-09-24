import type { Metadata } from "next";
import type { MetadataRoute } from "next";

export const FINTR_PWA_NAME = "Fintr";
export const FINTR_PWA_THEME_COLOR = "#151921";
export const FINTR_PWA_BACKGROUND_COLOR = "#FAFAF8";
export const FINTR_PWA_START_URL = "/dashboard/home";

export const FINTR_APPLE_WEB_APP: NonNullable<Metadata["appleWebApp"]> = {
  capable: true,
  statusBarStyle: "black-translucent",
  title: FINTR_PWA_NAME,
};

export function buildWebAppManifest(): MetadataRoute.Manifest {
  return {
    name: FINTR_PWA_NAME,
    short_name: FINTR_PWA_NAME,
    description:
      "Manage your finances with ease using Fintr's comprehensive dashboard and analytics.",
    start_url: FINTR_PWA_START_URL,
    scope: "/",
    display: "standalone",
    background_color: FINTR_PWA_BACKGROUND_COLOR,
    theme_color: FINTR_PWA_THEME_COLOR,
    categories: ["finance"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
