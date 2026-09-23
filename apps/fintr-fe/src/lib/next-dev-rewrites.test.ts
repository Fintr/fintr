import { describe, expect, it } from "vitest";

import { nextDevRewrites } from "./next-dev-rewrites";

describe("nextDevRewrites", () => {
  it("proxies API and Active Storage through the Rails backend", () => {
    expect(nextDevRewrites("http://localhost:3001/")).toEqual([
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:3001/api/v1/:path*",
      },
      {
        source: "/rails/active_storage/:path*",
        destination: "http://localhost:3001/rails/active_storage/:path*",
      },
    ]);
  });
});
