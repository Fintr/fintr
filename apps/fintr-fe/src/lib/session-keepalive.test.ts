import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth/login", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/auth/login")>()),
  refreshAccessToken: vi.fn(),
}));

import { refreshAccessToken } from "@/services/auth/login";
import { AuthStorage } from "@/lib/auth-storage";
import {
  ensureFreshSession,
  refreshStoredSession,
} from "./session-keepalive";

const HOUR_MS = 3_600_000;

const jwt = (payload: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.s`;

const storeSession = ({
  bearerExpiresAt,
  storedExpiresAt = Date.now() + 24 * HOUR_MS,
  refreshToken = "refresh-1",
}: {
  bearerExpiresAt: number;
  storedExpiresAt?: number;
  refreshToken?: string;
}) => {
  AuthStorage.setAuthData({
    tokens: {
      access_token: "opaque-access-token",
      id_token: jwt({ sub: "auth0|1", exp: Math.floor(bearerExpiresAt / 1000) }),
      refresh_token: refreshToken,
      expires_in: 86400,
      token_type: "Bearer",
      scope: "openid",
    },
    user: { sub: "auth0|1", email: "a@b.c", name: "A" },
    expires_at: storedExpiresAt,
    issued_at: Date.now(),
  });
};

const refreshedTokens = (overrides: Record<string, unknown> = {}) => ({
  access_token: "opaque-access-token-2",
  id_token: jwt({ sub: "auth0|1", exp: Math.floor((Date.now() + 10 * HOUR_MS) / 1000) }),
  expires_in: 86400,
  token_type: "Bearer",
  scope: "openid",
  ...overrides,
});

const rejectedWith = (status: number) =>
  Object.assign(new Error("Token refresh failed"), { status });

describe("AuthStorage session expiry", () => {
  afterEach(() => localStorage.clear());

  it("uses the bearer token's own expiry when it ends before the stored expiry", () => {
    const bearerExpiresAt = Date.now() + 60_000;
    storeSession({ bearerExpiresAt });

    expect(AuthStorage.getSessionExpiresAt()).toBe(
      Math.floor(bearerExpiresAt / 1000) * 1000,
    );
    expect(AuthStorage.needsRefresh()).toBe(true);
  });

  it("reports an expired bearer token even while the stored expiry is in the future", () => {
    storeSession({ bearerExpiresAt: Date.now() - 1_000 });

    expect(AuthStorage.isSessionExpired()).toBe(true);
  });
});

describe("ensureFreshSession", () => {
  const onRefreshed = vi.fn();
  const onExpired = vi.fn();

  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset();
    onRefreshed.mockReset();
    onExpired.mockReset();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does nothing while the session is comfortably valid", async () => {
    storeSession({ bearerExpiresAt: Date.now() + 10 * HOUR_MS });

    await ensureFreshSession({ onRefreshed, onExpired });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("refreshes ahead of expiry and stores the new tokens", async () => {
    storeSession({ bearerExpiresAt: Date.now() + 60_000 });
    const tokens = refreshedTokens({ refresh_token: "refresh-2" });
    vi.mocked(refreshAccessToken).mockResolvedValue(tokens);

    await ensureFreshSession({ onRefreshed, onExpired });

    expect(refreshAccessToken).toHaveBeenCalledWith("refresh-1");
    expect(onRefreshed).toHaveBeenCalledWith(tokens);
    expect(AuthStorage.getRefreshToken()).toBe("refresh-2");
    expect(AuthStorage.needsRefresh()).toBe(false);
  });

  it("keeps the existing refresh token when the server does not rotate it", async () => {
    storeSession({ bearerExpiresAt: Date.now() + 60_000 });
    vi.mocked(refreshAccessToken).mockResolvedValue(refreshedTokens());

    await ensureFreshSession({ onRefreshed, onExpired });

    expect(AuthStorage.getRefreshToken()).toBe("refresh-1");
  });

  it("logs out right away when the server rejects the refresh", async () => {
    storeSession({ bearerExpiresAt: Date.now() + 60_000 });
    vi.mocked(refreshAccessToken).mockRejectedValue(rejectedWith(401));

    await ensureFreshSession({ onRefreshed, onExpired });

    expect(onExpired).toHaveBeenCalledOnce();
  });

  it("keeps the session when the refresh fails for network or server reasons", async () => {
    storeSession({ bearerExpiresAt: Date.now() + 60_000 });
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await ensureFreshSession({ onRefreshed, onExpired });

    vi.mocked(refreshAccessToken).mockRejectedValueOnce(rejectedWith(503));
    await ensureFreshSession({ onRefreshed, onExpired });

    expect(onExpired).not.toHaveBeenCalled();
  });

  it("waits for connectivity instead of logging out while offline", async () => {
    storeSession({ bearerExpiresAt: Date.now() - 1_000 });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    await ensureFreshSession({ onRefreshed, onExpired });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("logs out once the token has expired and there is no refresh token", async () => {
    storeSession({ bearerExpiresAt: Date.now() - 1_000, refreshToken: "" });

    await ensureFreshSession({ onRefreshed, onExpired });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalledOnce();
  });
});

describe("refreshStoredSession", () => {
  beforeEach(() => vi.mocked(refreshAccessToken).mockReset());
  afterEach(() => localStorage.clear());

  it("shares one in-flight refresh so a rotated refresh token is never reused", async () => {
    storeSession({ bearerExpiresAt: Date.now() + 60_000 });
    vi.mocked(refreshAccessToken).mockResolvedValue(refreshedTokens());

    await Promise.all([refreshStoredSession(), refreshStoredSession()]);

    expect(refreshAccessToken).toHaveBeenCalledOnce();
  });
});
