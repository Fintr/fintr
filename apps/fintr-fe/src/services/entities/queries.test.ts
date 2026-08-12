import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  cacheEntitiesResponse,
  normalizeEntityRecords,
} from "./local-cache";
import { fetchEntitiesLocalFirst } from "./queries";

describe("fetchEntitiesLocalFirst", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  it("returns cached merchants while offline", async () => {
    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "1",
          full_name: "Jollibee",
          entity_type: "transaction",
        },
      ]),
    );

    const api = {
      get: vi.fn(),
    };

    vi.stubGlobal("navigator", { onLine: false });

    const entities = await fetchEntitiesLocalFirst(api as never, "SPACE_1", {
      entityType: "transaction",
    });

    expect(entities).toEqual([
      expect.objectContaining({ fullName: "Jollibee" }),
    ]);
    expect(api.get).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
