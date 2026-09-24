import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db/db";
import {
  cacheCurrentUserResponse,
  loadCachedCurrentUserResponse,
} from "@/services/auth/local-cache";

describe("current user local cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("does not return another account's onboarding snapshot", async () => {
    await cacheCurrentUserResponse(
      {
        data: {
          spaceCode: "previous-space",
          onboardingStep: "completed",
        },
      },
      "auth0|previous",
    );

    await expect(loadCachedCurrentUserResponse("auth0|new")).resolves.toBeUndefined();

    const sameAccount = await loadCachedCurrentUserResponse("auth0|previous");
    expect(sameAccount?.data?.onboardingStep).toBe("completed");
  });

  it("ignores an untagged snapshot when an account id is required", async () => {
    await cacheCurrentUserResponse({
      data: {
        onboardingStep: "completed",
      },
    });

    await expect(loadCachedCurrentUserResponse("auth0|new")).resolves.toBeUndefined();
  });
});
