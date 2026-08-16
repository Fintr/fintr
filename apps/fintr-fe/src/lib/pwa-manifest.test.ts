import { describe, expect, it } from "vitest";

import { buildWebAppManifest } from "./pwa-manifest";

describe("buildWebAppManifest", () => {
  it("meets Chrome installability fields for a standalone PWA", () => {
    const manifest = buildWebAppManifest();

    expect(manifest.name).toBe("Fintr");
    expect(manifest.short_name).toBe("Fintr");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard/home");
    expect(manifest.scope).toBe("/");
    expect(manifest.theme_color).toBe("#151921");
    expect(manifest.background_color).toBe("#FAFAF8");
  });

  it("includes 192 and 512 PNG icons", () => {
    const manifest = buildWebAppManifest();
    const icons = manifest.icons ?? [];
    const sizes = icons.map((icon) => icon.sizes);

    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.every((icon) => icon.type === "image/png")).toBe(true);
    expect(icons.every((icon) => icon.src.startsWith("/icons/"))).toBe(true);
  });
});
