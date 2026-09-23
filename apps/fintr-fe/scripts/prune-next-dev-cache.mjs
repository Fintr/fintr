/**
 * Delete leftover Turbopack filesystem cache before `next dev`.
 * Next 16 defaults that cache on; it grew to 14GB in this repo and
 * contributed to the Mac swapping to death.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const turbopackCacheDir = path.join(
  feRoot,
  ".next",
  "dev",
  "cache",
  "turbopack",
);

if (!existsSync(turbopackCacheDir)) {
  process.exit(0);
}

console.log(
  "[prune-next-dev-cache] Removing leftover Turbopack cache at",
  turbopackCacheDir,
);
rmSync(turbopackCacheDir, { recursive: true, force: true });
