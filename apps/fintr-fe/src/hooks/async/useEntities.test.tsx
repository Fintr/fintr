import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { createEntityLocalFirst } from "@/services/entities/create-local-first";
import {
  cacheEntitiesResponse,
  loadCachedEntitiesResponse,
} from "@/services/entities/local-cache";

const { fetchEntities, createEntity } = vi.hoisted(() => ({
  fetchEntities: vi.fn(),
  createEntity: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: { get: vi.fn(), post: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/entities/mutation", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/entities/mutation")
  >("@/services/entities/mutation");

  return {
    ...actual,
    fetchEntities: (...args: unknown[]) => fetchEntities(...args),
    createEntity: (...args: unknown[]) => createEntity(...args),
  };
});

import { useEntities } from "./useEntities";

const store = {
  id: "entity-store",
  fullName: "Store",
  entityType: "transaction" as const,
  photoUrl: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
};

describe("useEntities", () => {
  beforeEach(async () => {
    fetchEntities.mockReset();
    createEntity.mockReset();
    createEntity.mockImplementation(() => new Promise(() => {}));
    localStorage.setItem("spaceCode", "space-a");
    await resetLocalDbForTests();
    await cacheEntitiesResponse("space-a", [store]);
  });

  afterEach(async () => {
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("shows a newly created merchant from IndexedDB without waiting for the backend", async () => {
    fetchEntities.mockResolvedValue({ data: [store] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useEntities("transaction"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.entities.map((entity) => entity.fullName)).toEqual([
        "Store",
      ]);
    });

    await act(async () => {
      await createEntityLocalFirst(
        { get: vi.fn(), post: vi.fn() } as never,
        {
          spaceCode: "space-a",
          data: { fullName: "Merchant1", entityType: "transaction" },
        },
        { queryClient, waitForSync: false },
      );
    });

    await waitFor(() => {
      expect(result.current.entities.map((entity) => entity.fullName)).toEqual([
        "Merchant1",
        "Store",
      ]);
    });

    const cached = await loadCachedEntitiesResponse("space-a");
    expect(cached?.map((entity) => entity.fullName)).toEqual([
      "Store",
      "Merchant1",
    ]);

    fetchEntities.mockResolvedValue({ data: [store] });
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetchEntities.mock.calls.length).toBeGreaterThan(1);

    expect(result.current.entities.map((entity) => entity.fullName)).toEqual([
      "Merchant1",
      "Store",
    ]);
    expect(
      (await loadCachedEntitiesResponse("space-a"))?.some(
        (entity) => entity.fullName === "Merchant1",
      ),
    ).toBe(true);
  });
});
