/**
 * Production static build using `.env` (and optional `.env.local`), not
 * `.env.production`. Hides production env files during `next build` so they
 * cannot override local API URLs and Auth0 settings.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(feRoot, ".env");

if (!fs.existsSync(envFile)) {
  console.error(
    "[build-local-preview] Missing apps/fintr-fe/.env — copy from .env.example",
  );
  process.exit(1);
}

const productionEnvFiles = [
  ".env.production",
  ".env.production.local",
];

const hiddenEnvFiles = [];

function hideProductionEnvFiles() {
  for (const name of productionEnvFiles) {
    const absolutePath = path.join(feRoot, name);

    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const backupPath = `${absolutePath}.preview-hidden`;

    if (fs.existsSync(backupPath)) {
      console.error(
        `[build-local-preview] Stale backup exists: ${backupPath}. Remove it and retry.`,
      );
      process.exit(1);
    }

    fs.renameSync(absolutePath, backupPath);
    hiddenEnvFiles.push({ absolutePath, backupPath });
  }
}

function restoreProductionEnvFiles() {
  for (const { absolutePath, backupPath } of hiddenEnvFiles) {
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, absolutePath);
    }
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: feRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

hideProductionEnvFiles();

try {
  console.log("[build-local-preview] Building with .env (production env files hidden)");

  run("node", ["scripts/copy-circle-flags.mjs"]);

  const dotenvArgs = ["--no-install", "dotenv-cli", "-e", ".env"];

  if (fs.existsSync(path.join(feRoot, ".env.local"))) {
    dotenvArgs.push("-e", ".env.local");
  }

  // .env often sets NODE_ENV=development for `next dev`; production export requires production.
  dotenvArgs.push("--", "sh", "-c", "NODE_ENV=production exec next build");

  console.log(
    "[build-local-preview] NODE_ENV=production for next build (ignores NODE_ENV in .env)",
  );

  run("npx", dotenvArgs);
  run("node", ["scripts/generate-service-worker.mjs"]);
  console.log("[build-local-preview] Wrote out/sw.js (precache shell worker)");
} finally {
  restoreProductionEnvFiles();
}

console.log("[build-local-preview] Done — run `pnpm preview` to serve out/");
