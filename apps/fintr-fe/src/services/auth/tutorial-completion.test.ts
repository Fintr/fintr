import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStorage } from "@/lib/auth-storage";
import { resetLocalDbForTests } from "@/lib/local-db/db";
import {
  cacheCurrentUserResponse,
  loadCachedCurrentUserResponse,
} from "@/services/auth/local-cache";
import {
  isTutorialPlatformCompleted,
  markTutorialCompletedLocally,
  readLocalTutorialCompletion,
  resolvePlatformTutorialCompletion,
  resolveTutorialCompletedAt,
  writeLocalTutorialCompletion,
} from "@/services/auth/tutorial-completion";

describe("tutorial-completion", () => {
  beforeEach(() => {
    vi.spyOn(AuthStorage, "getUser").mockReturnValue({
      sub: "auth0|user-1",
      email: "user@example.com",
      name: "User",
    });
    window.localStorage.clear();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  it("treats datetime strings and true as completed", () => {
    expect(isTutorialPlatformCompleted("2026-08-14T00:00:00.000Z")).toBe(true);
    expect(isTutorialPlatformCompleted(true)).toBe(true);
    expect(isTutorialPlatformCompleted(null)).toBe(false);
    expect(isTutorialPlatformCompleted(undefined)).toBe(false);
    expect(isTutorialPlatformCompleted("")).toBe(false);
  });

  it("resolves the first completed source", () => {
    expect(
      resolveTutorialCompletedAt(null, undefined, "2026-08-14T00:00:00.000Z"),
    ).toBe("2026-08-14T00:00:00.000Z");
    expect(resolveTutorialCompletedAt(null, true)).toMatch(/^\d{4}-/);
    expect(resolveTutorialCompletedAt(null, null)).toBeNull();
  });

  it("persists completion to localStorage and IndexedDB", async () => {
    await cacheCurrentUserResponse({
      data: {
        spaceCode: "fintr",
        onboardingStep: "completed",
      },
    });

    const completedAt = await markTutorialCompletedLocally("mobile");

    expect(readLocalTutorialCompletion("mobile")).toBe(completedAt);

    const cached = await loadCachedCurrentUserResponse();
    expect(cached?.data?.mobileTutorial).toBe(completedAt);
  });

  it("prefers any completed source when resolving platform completion", async () => {
    writeLocalTutorialCompletion("mobile", "2026-08-14T12:00:00.000Z");

    await cacheCurrentUserResponse({
      data: {
        mobileTutorial: null,
      },
    });

    expect(resolvePlatformTutorialCompletion("mobile", await loadCachedCurrentUserResponse()))
      .toBe("2026-08-14T12:00:00.000Z");
  });
});
