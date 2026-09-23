import "fake-indexeddb/auto";

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import {
  getLocalDb,
  OUTBOX_COMMAND_TAG_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import {
  cacheTransactionTagsResponse,
  loadTransactionTags,
} from "@/services/transactions/tags/local-cache";

const { fetchTransactionTags, createTransactionTag } = vi.hoisted(() => ({
  fetchTransactionTags: vi.fn(),
  createTransactionTag: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  default: () => ({
    api: { post: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/transactions/tags/mutation", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/transactions/tags/mutation")
  >("@/services/transactions/tags/mutation");

  return {
    ...actual,
    fetchTransactionTags: (...args: unknown[]) => fetchTransactionTags(...args),
    createTransactionTag: (...args: unknown[]) => createTransactionTag(...args),
    deleteTransactionTag: vi.fn(),
    toggleDefaultTransactionTag: vi.fn(),
    generateTransactionTagStyleImage: vi.fn(),
    assignTransactionTagStyleImage: vi.fn(),
  };
});

vi.mock("@/services/local-sync/drain-outbox", () => ({
  scheduleOutboxDrain: vi.fn(),
}));

import { useTransactionTags } from "./useTransactionTags";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const store = createStore();
  store.set(offlineSyncReadyAtom, true);

  return ({ children }: { children: ReactNode }) =>
    createElement(
      JotaiProvider,
      { store },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );
};

describe("useTransactionTags", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    fetchTransactionTags.mockReset();
    createTransactionTag.mockReset();
    createTransactionTag.mockImplementation(() => new Promise(() => {}));
    localStorage.setItem("spaceCode", "space-a");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    onlineManager.setOnline(false);
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("creates a tag locally while offline without waiting for the API", async () => {
    await cacheTransactionTagsResponse("space-a", [
      {
        id: "tag-europe",
        name: "Europe 2026",
        color: "#0A3D62",
        isDefault: false,
      },
    ]);

    const { result } = renderHook(() => useTransactionTags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.tags.map((tag) => tag.name)).toEqual([
        "Europe 2026",
      ]);
    });

    await act(async () => {
      await result.current.createTag({
        name: "Thailand 2026",
        color: "#00897B",
      });
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
      expect(result.current.tags.map((tag) => tag.name)).toEqual([
        "Europe 2026",
        "Thailand 2026",
      ]);
    });

    expect(fetchTransactionTags).not.toHaveBeenCalled();
    expect(result.current.isCreating).toBe(false);

    const cached = await loadTransactionTags("space-a");
    expect(cached.map((tag) => tag.name)).toEqual([
      "Europe 2026",
      "Thailand 2026",
    ]);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_TAG_CREATE);
  });
});
