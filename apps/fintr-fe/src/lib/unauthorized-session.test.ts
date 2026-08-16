import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const triggerSessionExpiration = vi.fn();

vi.mock("./session-expiration-handler", () => ({
  triggerSessionExpiration: () => triggerSessionExpiration(),
}));

describe("respondToUnauthorizedApiError", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    triggerSessionExpiration.mockReset();
    vi.stubGlobal("location", {
      ...originalLocation,
      pathname: "/dashboard/home",
      href: "http://localhost:5173/dashboard/home",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not treat a generic 401 as session expiry during import", async () => {
    const { respondToUnauthorizedApiError } = await import(
      "./unauthorized-session"
    );

    respondToUnauthorizedApiError("/attachments/download");

    expect(window.location.href).toBe("http://localhost:5173/dashboard/home");
    expect(triggerSessionExpiration).not.toHaveBeenCalled();
  });
});
