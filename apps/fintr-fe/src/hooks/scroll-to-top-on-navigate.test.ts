import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import {
  applyScrollSnapshot,
  readScrollSnapshot,
  resetScrollNavigationState,
  scrollContainersToTop,
  useScrollToTopOnNavigate,
} from "@/hooks/scroll-to-top-on-navigate";

const mockUsePathname = vi.fn(() => "/dashboard/transactions/detail");
const mockUseSearchParams = vi.fn(() => new URLSearchParams("transactionId=1"));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe("scrollContainersToTop", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it("scrolls the window and any provided containers to the top", () => {
    const container = document.createElement("div");
    container.scrollTop = 240;

    scrollContainersToTop(window, container);

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(container.scrollTop).toBe(0);
  });
});

describe("readScrollSnapshot / applyScrollSnapshot", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
      configurable: true,
    });
  });

  it("round-trips window and container scroll positions", () => {
    const container = document.createElement("div");
    container.scrollTop = 180;
    Object.defineProperty(window, "scrollY", {
      value: 320,
      writable: true,
      configurable: true,
    });

    const snapshot = readScrollSnapshot(container);

    container.scrollTop = 0;
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
      configurable: true,
    });

    applyScrollSnapshot(snapshot, container);

    expect(window.scrollTo).toHaveBeenCalledWith(0, 320);
    expect(container.scrollTop).toBe(180);
  });
});

describe("useScrollToTopOnNavigate", () => {
  beforeEach(() => {
    resetScrollNavigationState();
    window.scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
      configurable: true,
    });
    mockUsePathname.mockReturnValue("/dashboard/transactions/detail");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("transactionId=1"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not scroll on the initial render", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();

    renderHook(() => useScrollToTopOnNavigate(scrollContainerRef));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to top when the pathname changes", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const container = document.createElement("div");
    container.scrollTop = 180;
    scrollContainerRef.current = container;

    const { rerender } = renderHook(() =>
      useScrollToTopOnNavigate(scrollContainerRef),
    );

    mockUsePathname.mockReturnValue(
      "/dashboard/space_settings/entities/detail",
    );
    rerender();

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(container.scrollTop).toBe(0);
  });

  it("scrolls to top when only search params change", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const container = document.createElement("div");
    container.scrollTop = 96;
    scrollContainerRef.current = container;

    const { rerender } = renderHook(() =>
      useScrollToTopOnNavigate(scrollContainerRef),
    );

    mockUseSearchParams.mockReturnValue(new URLSearchParams("entityId=2"));
    rerender();

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(container.scrollTop).toBe(0);
  });

  it("restores the previous scroll position on back navigation", () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const container = document.createElement("div");
    scrollContainerRef.current = container;

    const { rerender } = renderHook(() =>
      useScrollToTopOnNavigate(scrollContainerRef),
    );

    Object.defineProperty(window, "scrollY", {
      value: 320,
      writable: true,
      configurable: true,
    });
    container.scrollTop = 120;
    window.dispatchEvent(new Event("scroll"));

    mockUsePathname.mockReturnValue(
      "/dashboard/space_settings/entities/detail",
    );
    mockUseSearchParams.mockReturnValue(new URLSearchParams("entityId=1"));
    rerender();

    window.dispatchEvent(new PopStateEvent("popstate"));
    mockUsePathname.mockReturnValue("/dashboard/transactions/detail");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("transactionId=1"));
    rerender();

    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 320);
    expect(container.scrollTop).toBe(120);
  });

  it("does not reset scroll when moving between bottom-nav tabs", () => {
    mockUsePathname.mockReturnValue("/dashboard/home");
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const scrollContainerRef = createRef<HTMLDivElement>();
    const container = document.createElement("div");
    container.scrollTop = 180;
    scrollContainerRef.current = container;

    const { rerender } = renderHook(() =>
      useScrollToTopOnNavigate(scrollContainerRef),
    );

    mockUsePathname.mockReturnValue("/dashboard/insights");
    rerender();

    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(180);
  });
});
