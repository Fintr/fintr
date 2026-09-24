import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AUTHENTICATED_PATH,
  getOriginalRedirectPath,
  isAuthPage,
  isAuthenticatedAppPath,
  navigateAfterAuthentication,
} from "./auth-routes";

describe("DEFAULT_AUTHENTICATED_PATH", () => {
  it("lands on the Home tab instead of Transactions", () => {
    expect(DEFAULT_AUTHENTICATED_PATH).toBe("/dashboard/home");
    expect(DEFAULT_AUTHENTICATED_PATH).not.toBe("/dashboard");
    expect(DEFAULT_AUTHENTICATED_PATH).not.toBe("/dashboard/");
  });
});

describe("isAuthPage", () => {
  it("treats login, signup, and OAuth routes as auth pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/auth")).toBe(true);
    expect(isAuthPage("/auth-callback")).toBe(true);
    expect(isAuthPage("/consent")).toBe(true);
  });

  it("does not treat dashboard routes as auth pages", () => {
    expect(isAuthPage("/dashboard")).toBe(false);
    expect(isAuthPage("/dashboard/home")).toBe(false);
    expect(isAuthPage("/dashboard/insights")).toBe(false);
  });
});

describe("navigateAfterAuthentication", () => {
  it("assigns the authenticated path from login", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      pathname: "/login",
      assign,
    });

    navigateAfterAuthentication("/dashboard/home");

    expect(assign).toHaveBeenCalledWith("/dashboard/home");
  });

  it("does not hard-reload when already on the dashboard", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      pathname: "/dashboard/home",
      assign,
    });

    navigateAfterAuthentication("/dashboard/home");

    expect(assign).not.toHaveBeenCalled();
  });
});

describe("isAuthenticatedAppPath", () => {
  it("treats dashboard and onboarding routes as authenticated app paths", () => {
    expect(isAuthenticatedAppPath("/dashboard/home")).toBe(true);
    expect(isAuthenticatedAppPath("/onboarding")).toBe(true);
    expect(isAuthenticatedAppPath("/login")).toBe(false);
  });
});

describe("getOriginalRedirectPath", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("defaults to Home when no origin is stored", () => {
    expect(getOriginalRedirectPath()).toBe("/dashboard/home");
    expect(sessionStorage.getItem("auth0_redirect_origin")).toBeNull();
  });

  it("defaults to Home when the stored origin is an auth page", () => {
    sessionStorage.setItem("auth0_redirect_origin", "/login");

    expect(getOriginalRedirectPath()).toBe("/dashboard/home");
    expect(sessionStorage.getItem("auth0_redirect_origin")).toBeNull();
  });

  it("defaults to Home for signup and OAuth callback origins", () => {
    sessionStorage.setItem("auth0_redirect_origin", "/signup");
    expect(getOriginalRedirectPath()).toBe("/dashboard/home");

    sessionStorage.setItem("auth0_redirect_origin", "/auth");
    expect(getOriginalRedirectPath()).toBe("/dashboard/home");

    sessionStorage.setItem("auth0_redirect_origin", "/auth-callback");
    expect(getOriginalRedirectPath()).toBe("/dashboard/home");
  });

  it("preserves a non-auth origin such as a dashboard tab", () => {
    sessionStorage.setItem("auth0_redirect_origin", "/dashboard/insights");

    expect(getOriginalRedirectPath()).toBe("/dashboard/insights");
    expect(sessionStorage.getItem("auth0_redirect_origin")).toBeNull();
  });
});
