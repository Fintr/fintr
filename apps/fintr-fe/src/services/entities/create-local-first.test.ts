import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import { cacheEntitiesResponse, loadEntities } from "./local-cache";

vi.mock("./mutation", () => ({
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
}));

import { createEntity, updateEntity } from "./mutation";
import { createEntityLocalFirst } from "./create-local-first";
import { updateEntityLocalFirst } from "./update-local-first";

describe("entities local-first mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("creates an entity locally first, then reconciles with the server id", async () => {
    vi.mocked(createEntity).mockResolvedValue({
      data: {
        id: "server-entity-1",
        full_name: "Jollibee",
        entity_type: "transaction",
      },
    });

    const api = {} as never;
    const result = await createEntityLocalFirst(api, {
      spaceCode: "SPACE_1",
      data: {
        fullName: "Jollibee",
        entityType: "transaction",
      },
    });

    expect(result.pendingSync).toBe(false);
    expect(result.data.id).toBe("server-entity-1");
    expect(result.data.fullName).toBe("Jollibee");

    const entities = await loadEntities("SPACE_1");
    expect(entities).toEqual([
      expect.objectContaining({
        id: "server-entity-1",
        fullName: "Jollibee",
        entityType: "transaction",
      }),
    ]);
  });

  it("keeps a pending entity when create sync fails with a network error", async () => {
    vi.mocked(createEntity).mockRejectedValue(new Error("Failed to fetch"));

    const api = {} as never;
    const result = await createEntityLocalFirst(api, {
      spaceCode: "SPACE_1",
      data: {
        fullName: "BPI",
        entityType: "loan",
      },
    });

    expect(result.pendingSync).toBe(true);
    expect(result.data.id).toMatch(/^local:/);
    expect((await loadEntities("SPACE_1"))[0]?.fullName).toBe("BPI");
  });

  it("updates a cached entity name locally and syncs", async () => {
    await cacheEntitiesResponse("SPACE_1", [
      {
        id: "entity-1",
        fullName: "Jollibee",
        entityType: "transaction",
      },
    ]);

    vi.mocked(updateEntity).mockResolvedValue({
      data: {
        id: "entity-1",
        full_name: "Jollibee Foods",
        entity_type: "transaction",
      },
    });

    const api = {} as never;
    const result = await updateEntityLocalFirst(api, {
      spaceCode: "SPACE_1",
      entityId: "entity-1",
      fullName: "Jollibee Foods",
    });

    expect(result.pendingSync).toBe(false);
    expect(result.localEntity.fullName).toBe("Jollibee Foods");

    const entities = await loadEntities("SPACE_1");
    expect(entities[0]?.fullName).toBe("Jollibee Foods");
  });
});
