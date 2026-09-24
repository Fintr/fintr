import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { resetLocalDbForTests } from "@/lib/local-db";
import { cacheGamificationProfile } from "@/services/achievements/local-cache";
import type { GamificationProfile } from "@/types/badgeTypes";

import { useGamificationProfile } from "./useGamificationProfile";

const getProfile = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: { get: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/achievements/api", () => ({
  achievementsApi: {
    getProfile: (...args: unknown[]) => getProfile(...args),
  },
}));

const sampleProfile = (): GamificationProfile => ({
  xp: 250,
  level: 3,
  xpIntoLevel: 50,
  xpPerLevel: 100,
  title: {
    level: 3,
    key: "steady_logger",
    title: "Steady Logger",
    description: "Consistency unlocked.",
    imageKey: "steady_logger",
    unlocked: true,
  },
  titles: [],
  featured: [],
  achievements: [],
});

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

describe("useGamificationProfile", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    getProfile.mockReset();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
    await resetLocalDbForTests();
  });

  it("reads the cached profile while offline and does not hit the API", async () => {
    await cacheGamificationProfile(sampleProfile());

    const { result } = renderHook(() => useGamificationProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.level).toBe(3);
      expect(result.current.data?.title.key).toBe("steady_logger");
    });

    expect(getProfile).not.toHaveBeenCalled();
  });
});
