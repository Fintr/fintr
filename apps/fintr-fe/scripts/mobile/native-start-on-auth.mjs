#!/usr/bin/env node
/**
 * Capacitor `capacitor:copy:after` hook.
 *
 * Capacitor serves `public/index.html` for `/` and every extensionless path (including
 * the `/auth` start path), so the bundled native app would boot into the marketing
 * homepage. Native users never need the homepage: replace the copied `index.html` with
 * the pre-rendered `auth.html`. The web export in `out/` is untouched.
 *
 * iOS refuses to launch unless `public/<appStartPath>` exists on disk (e.g. auth/).
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const NATIVE_PUBLIC_DIRS = {
  ios: "ios/App/App/public",
  android: "android/app/src/main/assets/public",
};

const platform = process.env.CAPACITOR_PLATFORM_NAME;
const publicDir = NATIVE_PUBLIC_DIRS[platform];

if (!publicDir) {
  process.exit(0);
}

const rootDir = process.env.CAPACITOR_ROOT_DIR ?? process.cwd();
const authHtml = path.join(rootDir, publicDir, "auth.html");
const indexHtml = path.join(rootDir, publicDir, "index.html");

if (!existsSync(authHtml)) {
  console.error(`[native-start-on-auth] Missing ${authHtml}; cannot start ${platform} on /auth.`);
  process.exit(1);
}

copyFileSync(authHtml, indexHtml);
const authDir = path.join(rootDir, publicDir, "auth");
mkdirSync(authDir, { recursive: true });
copyFileSync(authHtml, path.join(authDir, "index.html"));
console.log(`[native-start-on-auth] ${platform}: index.html now serves /auth`);
