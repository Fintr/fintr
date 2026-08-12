import { describe, expect, it } from "vitest";

import { buildServiceWorkerBootstrapScript } from "./service-worker-bootstrap-script";

describe("buildServiceWorkerBootstrapScript", () => {
  it("skips service worker registration on auth routes", () => {
    const script = buildServiceWorkerBootstrapScript("/sw.js");

    expect(script).toContain("skipServiceWorkerRoutes");
    expect(script).toContain("/auth-callback");
    expect(script).toContain("/login");
  });

  it("registers the shell worker on app routes", () => {
    const script = buildServiceWorkerBootstrapScript("/sw.js");

    expect(script).toContain('register("/sw.js"');
  });
});
