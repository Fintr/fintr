/**
 * Serve the static export with cleanUrls and print the real browser URL.
 * Run after `pnpm build:local` or `pnpm preview:local`.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(feRoot, "out");

// Do not use process.env.PORT — .env / pnpm may set it for the Rails API or next dev.
const parsedPort = Number.parseInt(String(process.env.PREVIEW_PORT ?? "5173"), 10);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5173;
const host = process.env.PREVIEW_HOST || "localhost";
const shouldOpenBrowser = process.env.PREVIEW_OPEN !== "0";

if (!fs.existsSync(outDir)) {
  console.error(
    "[preview] out/ not found — run `pnpm build:local` or `pnpm preview:local` first.",
  );
  process.exit(1);
}

// cleanUrls lets /dashboard/home resolve to dashboard/home.html
const serveConfigPath = path.join(outDir, "serve.json");
if (!fs.existsSync(serveConfigPath)) {
  fs.writeFileSync(
    serveConfigPath,
    JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2),
    "utf8",
  );
}

const swPath = path.join(outDir, "sw.js");
if (!fs.existsSync(swPath)) {
  console.warn(
    "[preview] out/sw.js missing — offline navigation will not work. Re-run `pnpm build:local`.",
  );
}

const loginUrl = `http://${host}:${port}/login`;
const dashboardUrl = `http://${host}:${port}/dashboard/home`;
const rootUrl = `http://${host}:${port}/`;

console.log("");
console.log("  Fintr static preview");
console.log("  Uses NEXT_PUBLIC_* from .env (not .env.production).");
console.log("  ─────────────────────────────────────────");
console.log(`  Login:     ${loginUrl}`);
console.log(`  Dashboard: ${dashboardUrl}`);
console.log(`  Root:      ${rootUrl}`);
console.log("");
console.log("  Use localhost (not 127.0.0.1) so Auth0 callback matches this origin.");
console.log("");
console.log("  If Chrome still shows ERR_FAILED on auth-callback:");
console.log("  chrome://serviceworker-internals → Unregister workers for :5173");
console.log("  then reload http://localhost:5173/login");
console.log("");
console.log("  Backend API must be running for login/dashboard data.");
console.log("");

async function waitForServer(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { method: "HEAD" });

      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  return false;
}

function openBrowser(url) {
  const platform = process.platform;

  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", shell: false });
    return;
  }

  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", shell: false });
    return;
  }

  spawn("xdg-open", [url], { stdio: "ignore", shell: false });
}

const child = spawn("npx", ["serve@14.2.4", "out", "-p", String(port)], {
  cwd: feRoot,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error("[preview] Failed to start serve:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 0);
});

if (shouldOpenBrowser) {
  waitForServer(loginUrl).then((ready) => {
    if (!ready) {
      console.warn(
        "[preview] Server did not respond in time — open the URL manually:",
      );
      console.warn(`  ${loginUrl}`);
      return;
    }

    console.log(`[preview] Opening ${loginUrl}`);
    openBrowser(loginUrl);
  });
}
