import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { createElement } from "react";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";

import {
  shouldSkipCachedNetworkFetch,
  useBrowserOnline,
  useSkipCachedNetworkFetch,
} from "./useOfflineReadMode";

describe("shouldSkipCachedNetworkFetch", () => {
  it("allows network before offline sync is ready only while online", () => {
    expect(
      shouldSkipCachedNetworkFetch({
        offlineSyncReady: false,
        isOnline: true,
      }),
    ).toBe(false);
    expect(
      shouldSkipCachedNetworkFetch({
        offlineSyncReady: false,
        isOnline: false,
      }),
    ).toBe(true);
  });

  it("refetches from the network while online after offline-ready without space sync pull", () => {
    expect(
      shouldSkipCachedNetworkFetch({
        offlineSyncReady: true,
        isOnline: true,
        spaceSyncPullEnabled: false,
      }),
    ).toBe(false);
  });

  it("reads IndexedDB while online when space sync pull is active after offline-ready", () => {
    expect(
      shouldSkipCachedNetworkFetch({
        offlineSyncReady: true,
        isOnline: true,
        spaceSyncPullEnabled: true,
      }),
    ).toBe(true);

    expect(
      shouldSkipCachedNetworkFetch({
        offlineSyncReady: true,
        isOnline: true,
        spaceSyncPullEnabled: true,
        hasSyncCursor: false,
      }),
    ).toBe(false);
  });

  it("reads IndexedDB only when offline after offline-ready", () => {
    expect(
      shouldSkipCachedNetworkFetch({
        offlineSyncReady: true,
        isOnline: false,
      }),
    ).toBe(true);
  });
});

describe("useSkipCachedNetworkFetch", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
  });

  const wrap =
    (store: ReturnType<typeof createStore>) =>
    ({ children }: { children: ReactNode }) =>
      createElement(JotaiProvider, { store }, children);

  it("skips network only when offline-ready and the browser goes offline", () => {
    const store = createStore();
    store.set(offlineSyncReadyAtom, true);

    const { result } = renderHook(() => useSkipCachedNetworkFetch(), {
      wrapper: wrap(store),
    });

    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        writable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(false);
  });

  it("tracks browser online state", () => {
    const { result } = renderHook(() => useBrowserOnline());
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });
});
