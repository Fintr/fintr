import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "circle-flags", "flags");
const target = join(root, "public", "circle-flags");

if (!existsSync(source)) {
  console.warn("[copy-circle-flags] circle-flags not installed; skipping");
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log("[copy-circle-flags] copied flags to public/circle-flags");
