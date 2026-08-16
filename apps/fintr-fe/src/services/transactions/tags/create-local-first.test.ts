import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalDb, resetLocalDbForTests } from "@/lib/local-db";

import {
  loadTransactionTags,
  removeTransactionTagFromList,
  replaceTransactionTagIdInList,
  upsertTransactionTagInList,
} from "./local-cache";

vi.mock("./mutation", () => ({
  createTransactionTag: vi.fn(),
  updateTransactionTag: vi.fn(),
  deleteTransactionTag: vi.fn(),
}));

import { createTransactionTag } from "./mutation";
import { createTagLocalFirst } from "./create-local-first";
import { deleteTagLocalFirst } from "./delete-local-first";
import { updateTagLocalFirst } from "./update-local-first";

describe("tags local-first mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("creates a tag locally first, then reconciles with the server id", async () => {
    vi.mocked(createTransactionTag).mockResolvedValue({
      data: {
        id: "server-tag-1",
        name: "Europe",
        color: "#0A3D62",
        is_default: false,
      },
    });

    const api = {} as never;
    const result = await createTagLocalFirst(api, {
      spaceCode: "SPACE_1",
      data: { name: "Europe" },
    });

    expect(result.pendingSync).toBe(false);
    expect(result.data.id).toBe("server-tag-1");

    const tags = await loadTransactionTags("SPACE_1");
    expect(tags).toEqual([
      expect.objectContaining({
        id: "server-tag-1",
        name: "Europe",
      }),
    ]);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(0);
  });

  it("keeps a pending tag when create sync fails with a network error", async () => {
    vi.mocked(createTransactionTag).mockRejectedValue(
      new Error("Failed to fetch"),
    );

    const api = {} as never;
    const result = await createTagLocalFirst(api, {
      spaceCode: "SPACE_1",
      data: { name: "Japan" },
    });

    expect(result.pendingSync).toBe(true);
    expect(result.data.id).toMatch(/^local:/);

    const tags = await loadTransactionTags("SPACE_1");
    expect(tags).toHaveLength(1);
    expect(tags[0]?.name).toBe("Japan");

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.status).toBe("pending");
  });

  it("updates a cached tag locally and syncs", async () => {
    const { cacheTransactionTagsResponse } = await import("./local-cache");
    await cacheTransactionTagsResponse("SPACE_1", [
      {
        id: "tag-1",
        name: "Europe",
        color: "#0A3D62",
        isDefault: false,
      },
    ]);

    const { updateTransactionTag } = await import("./mutation");
    vi.mocked(updateTransactionTag).mockResolvedValue({
      data: {
        id: "tag-1",
        name: "Europe 2026",
        color: "#0A3D62",
      },
    });

    const api = {} as never;
    const result = await updateTagLocalFirst(api, {
      spaceCode: "SPACE_1",
      tagId: "tag-1",
      updateData: { name: "Europe 2026" },
    });

    expect(result.pendingSync).toBe(false);
    expect(result.localTag.name).toBe("Europe 2026");

    const tags = await loadTransactionTags("SPACE_1");
    expect(tags[0]?.name).toBe("Europe 2026");
  });

  it("deletes a cached tag locally and syncs", async () => {
    const { cacheTransactionTagsResponse } = await import("./local-cache");
    await cacheTransactionTagsResponse("SPACE_1", [
      {
        id: "tag-1",
        name: "Europe",
        color: "#0A3D62",
        isDefault: false,
      },
    ]);

    const { deleteTransactionTag } = await import("./mutation");
    vi.mocked(deleteTransactionTag).mockResolvedValue({ success: true });

    const api = {} as never;
    const result = await deleteTagLocalFirst(api, {
      spaceCode: "SPACE_1",
      tagId: "tag-1",
    });

    expect(result.pendingSync).toBe(false);
    expect(await loadTransactionTags("SPACE_1")).toEqual([]);
  });
});

describe("tag list helpers", () => {
  it("upserts, replaces, and removes tags in a list", () => {
    const base = [
      {
        id: "tag-1",
        name: "Europe",
        color: "#0A3D62",
        isDefault: false,
      },
    ];

    const upserted = upsertTransactionTagInList(base, {
      id: "tag-2",
      name: "Japan",
      color: "#0A3D62",
      isDefault: false,
    });
    expect(upserted).toHaveLength(2);

    const replaced = replaceTransactionTagIdInList(
      upserted,
      "tag-2",
      "server-tag-2",
    );
    expect(replaced.find((tag) => tag.id === "server-tag-2")?.name).toBe(
      "Japan",
    );

    const removed = removeTransactionTagFromList(replaced, "tag-1");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.id).toBe("server-tag-2");
  });
});
