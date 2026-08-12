/**
 * Inline bootstrap for layout.tsx. Skips auth redirect routes so OAuth callbacks
 * are not intercepted (Chrome ERR_FAILED on /auth-callback). Registers the shell
 * worker on app routes after login.
 */
export function buildServiceWorkerBootstrapScript(serviceWorkerUrl: string): string {
  const escapedUrl = serviceWorkerUrl.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

  return `
(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  var path = location.pathname.replace(/\\/$/, "") || "/";
  var skipServiceWorkerRoutes = [
    "/login",
    "/auth-callback",
    "/auth",
    "/consent",
    "/signup",
    "/signup-success",
  ];

  if (skipServiceWorkerRoutes.indexOf(path) !== -1) {
    return;
  }

  navigator.serviceWorker.register("${escapedUrl}", { scope: "/" }).catch(function (error) {
    console.warn("[fintr-sw] Service worker registration failed", error);
  });
})();
`;
}
