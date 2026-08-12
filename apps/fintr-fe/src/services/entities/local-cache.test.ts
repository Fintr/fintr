import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  filterCachedEntities,
  loadCachedEntitiesResponse,
  normalizeEntityRecords,
  cacheEntitiesResponse,
} from "./local-cache";

describe("entities local cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  beforeEach(async () => {
    await resetLocalDbForTests();
  });

  it("caches and filters entities by type and search", async () => {
    const rows = normalizeEntityRecords([
      {
        id: "1",
        full_name: "Jollibee",
        entity_type: "transaction",
      },
      {
        id: "2",
        full_name: "BPI",
        entity_type: "loan",
      },
    ]);

    await cacheEntitiesResponse("SPACE_1", rows);

    const cached = await loadCachedEntitiesResponse("SPACE_1");
    expect(cached).toHaveLength(2);
    expect(filterCachedEntities(cached ?? [], "transaction", "joll")).toEqual([
      expect.objectContaining({ fullName: "Jollibee" }),
    ]);
  });
});
