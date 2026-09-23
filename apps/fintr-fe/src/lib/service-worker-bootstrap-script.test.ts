import { describe, expect, it } from "vitest";

import { buildServiceWorkerBootstrapScript } from "./service-worker-bootstrap-script";

describe("buildServiceWorkerBootstrapScript", () => {
  it("skips service worker registration on auth routes", () => {
    const script = buildServiceWorkerBootstrapScript("/sw.js");

    expect(script).toContain("skipServiceWorkerRoutes");
    expect(script).toContain("/auth-callback");
    expect(script).toContain("/login");
  });

  it("unregisters an existing worker on auth routes so stale shells cannot control login", () => {
    const script = buildServiceWorkerBootstrapScript("/sw.js");

    expect(script).toContain("getRegistrations()");
    expect(script).toContain("registration.unregister()");
  });

  it("registers the shell worker on app routes", () => {
    const script = buildServiceWorkerBootstrapScript("/sw.js");

    expect(script).toContain('register("/sw.js"');
  });

  it("sets a named sourceURL so the browser does not fetch the page path as a .txt source map", () => {
    const script = buildServiceWorkerBootstrapScript("/sw.js");

    expect(script).toContain("//# sourceURL=fintr-service-worker-bootstrap.js");
  });
});
