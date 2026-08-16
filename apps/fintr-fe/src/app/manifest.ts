import type { MetadataRoute } from "next";

import { buildWebAppManifest } from "@/lib/pwa-manifest";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return buildWebAppManifest();
}
