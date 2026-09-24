import { afterEach, describe, expect, it } from "vitest";

import {
  adoptSignedInUser,
  readLastAuthUserSub,
  shouldApplyCachedWorkspaceContext,
  shouldSkipCurrentUserNetworkFetch,
} from "./current-user-context";

describe("shouldSkipCurrentUserNetworkFetch", () => {
  it("fetches the signed-in account while online", () => {
    expect(shouldSkipCurrentUserNetworkFetch(true)).toBe(false);
  });

  it("uses the local snapshot only while offline", () => {
    expect(shouldSkipCurrentUserNetworkFetch(false)).toBe(true);
  });
});

describe("shouldApplyCachedWorkspaceContext", () => {
  it("does not apply another session's cache while a network fetch will run", () => {
    expect(
      shouldApplyCachedWorkspaceContext({
        hasCachedCurrentUser: true,
        hasNetworkCurrentUser: false,
        skipNetworkFetch: false,
      }),
    ).toBe(false);
  });

  it("applies the matching cache when the network fetch is skipped", () => {
    expect(
      shouldApplyCachedWorkspaceContext({
        hasCachedCurrentUser: true,
        hasNetworkCurrentUser: false,
        skipNetworkFetch: true,
      }),
    ).toBe(true);
  });

  it("does not apply cache once the network payload is in", () => {
    expect(
      shouldApplyCachedWorkspaceContext({
        hasCachedCurrentUser: true,
        hasNetworkCurrentUser: true,
        skipNetworkFetch: true,
      }),
    ).toBe(false);
  });
});

describe("adoptSignedInUser", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("records the first signed-in account without clearing the workspace", () => {
    window.localStorage.setItem("spaceCode", "personal-space");

    expect(adoptSignedInUser("auth0|new")).toEqual({ changed: false });
    expect(window.localStorage.getItem("spaceCode")).toBe("personal-space");
    expect(readLastAuthUserSub()).toBe("auth0|new");
  });

  it("clears the previous account workspace when a different account signs in", () => {
    window.localStorage.setItem("fintr:lastAuthUserSub", "auth0|previous");
    window.localStorage.setItem("spaceCode", "previous-space");

    expect(adoptSignedInUser("auth0|new")).toEqual({ changed: true });
    expect(window.localStorage.getItem("spaceCode")).toBeNull();
    expect(readLastAuthUserSub()).toBe("auth0|new");
  });

  it("keeps the workspace when the same account signs in again", () => {
    window.localStorage.setItem("fintr:lastAuthUserSub", "auth0|same");
    window.localStorage.setItem("spaceCode", "personal-space");

    expect(adoptSignedInUser("auth0|same")).toEqual({ changed: false });
    expect(window.localStorage.getItem("spaceCode")).toBe("personal-space");
  });
});
