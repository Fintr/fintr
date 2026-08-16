import { afterEach, describe, expect, it } from "vitest";

import { AuthStorage } from "@/lib/auth-storage";

import { createInitialAuthState } from "./create-initial-auth-state";

describe("createInitialAuthState", () => {
  afterEach(() => {
    AuthStorage.clearAuthData();
  });

  it("starts ready when a stored session already exists", () => {
    AuthStorage.setAuthData({
      tokens: {
        access_token: "access",
        id_token: "id",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid",
      },
      user: {
        sub: "auth0|1",
        email: "miko@example.com",
        name: "Miko",
      },
      expires_at: Date.now() + 60_000,
      issued_at: Date.now(),
    });

    const state = createInitialAuthState();

    expect(state.isLoading).toBe(false);
    expect(state.user?.email).toBe("miko@example.com");
    expect(state.tokens?.access_token).toBe("access");
  });

  it("hydrates stored credentials even when the access token is expired", () => {
    AuthStorage.setAuthData({
      tokens: {
        access_token: "access",
        id_token: "id",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid",
      },
      user: {
        sub: "auth0|1",
        email: "miko@example.com",
        name: "Miko",
      },
      expires_at: Date.now() - 60_000,
      issued_at: Date.now() - 3_700_000,
    });

    const state = createInitialAuthState();

    expect(state.isLoading).toBe(false);
    expect(state.user?.email).toBe("miko@example.com");
  });

  it("starts loading on a true cold start with no session", () => {
    const state = createInitialAuthState();

    expect(state.isLoading).toBe(true);
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
  });
});
