import { readFileSync } from "node:fs";
import path from "path";
import { describe, expect, it } from "vitest";

const feRoot = path.resolve(__dirname, "../..");

describe("Next.js dev memory bounds", () => {
  it("disables the unbounded Turbopack filesystem cache and caps Turbopack RAM", () => {
    const nextConfig = readFileSync(
      path.join(feRoot, "next.config.ts"),
      "utf8",
    );

    expect(nextConfig).toContain("turbopackFileSystemCacheForDev: false");
    expect(nextConfig).toMatch(/turbopackMemoryLimit:\s*2\s*\*\s*1024\s*\*\s*1024\s*\*\s*1024/);
  });

  it("prunes a leftover Turbopack cache and caps the Node heap before next dev", () => {
    const packageJson = readFileSync(
      path.join(feRoot, "package.json"),
      "utf8",
    );

    expect(packageJson).toContain("scripts/prune-next-dev-cache.mjs");
    expect(packageJson).toContain("--max-old-space-size=3072");
  });
});
