import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

vi.mock("@/services/transactions/tags/mutation", () => ({
  fetchTransactionTags: vi.fn(async () => []),
}));

vi.mock("@/services/entities/mutation", () => ({
  fetchEntities: vi.fn(async () => ({ data: [] })),
}));

vi.mock("@/services/budgets/hydrate-from-server", () => ({
  hydrateBudgetsFromServer: vi.fn(async () => ({ hydratedMonths: 0 })),
}));

import { hydrateBudgetsFromServer } from "@/services/budgets/hydrate-from-server";
import { refreshReferenceDataCaches } from "./refresh-reference-data-caches";

describe("refreshReferenceDataCaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("copies Rails budget rows into IndexedDB after a successful pull", async () => {
    const api = {
      get: vi.fn(async () => ({ data: {} })),
    };
    const queryClient = new QueryClient();

    await refreshReferenceDataCaches({
      api: api as never,
      spaceCode: "space-a",
      queryClient,
    });

    expect(hydrateBudgetsFromServer).toHaveBeenCalledWith(
      api,
      { spaceCode: "space-a" },
      { queryClient },
    );
  });
});
