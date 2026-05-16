import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CustomModal } from "./custom-modal";

const mobileViewportHeightState = vi.hoisted(() => ({ value: null as number | null }));

const mockUsePlatformDetection = vi.fn(() => ({
  isAndroidNative: false,
  isAndroidBrowser: false,
  isIOSNative: false,
  isIOSBrowser: false,
  isNative: false,
  isMobileBrowser: false,
  safeAreaInsetBottom: 0,
  safeAreaInsetTop: 0,
  hasAndroid3ButtonNav: false,
}));

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

vi.mock("@/hooks/useKeyboardDetector", () => ({
  useKeyboardDetector: () => ({ isOpen: false, visualViewportHeight: null }),
}));

vi.mock("@/hooks/useMobileModalViewportHeight", () => ({
  useMobileModalViewportHeight: () => mobileViewportHeightState.value,
}));

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => false,
}));

describe("CustomModal mobile positioning", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.stubGlobal("scrollTo", vi.fn());
    mobileViewportHeightState.value = null;
    mockUsePlatformDetection.mockReset();
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isAndroidBrowser: false,
      isIOSNative: false,
      isIOSBrowser: false,
      isNative: false,
      isMobileBrowser: false,
      safeAreaInsetBottom: 0,
      safeAreaInsetTop: 0,
      hasAndroid3ButtonNav: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("pins mobile modal container to top-left", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    const content = document.querySelector("[data-modal-content]") as HTMLElement | null;
    expect(content).toBeTruthy();
    const wrapper = content?.parentElement as HTMLElement | null;
    expect(wrapper?.className).toContain("items-start");
    expect(wrapper?.className).toContain("justify-start");
  });

  it("anchors mobile overlay to the visual viewport on Android native (no inset-0)", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isAndroidBrowser: false,
      isIOSNative: false,
      isIOSBrowser: false,
      isNative: true,
      isMobileBrowser: false,
      safeAreaInsetBottom: 0,
      safeAreaInsetTop: 0,
      hasAndroid3ButtonNav: false,
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    const backdrop = screen.getByTestId("custom-modal-backdrop");
    const outer = backdrop.parentElement as HTMLElement | null;
    expect(outer).toBeTruthy();
    expect(outer?.className).not.toContain("inset-0");
    expect(outer?.style.top).toBe("0px");
    expect(outer?.style.left).toBe("0px");
  });

  it("extends anchored overlay to layout bottom on Android native (gesture nav)", async () => {
    const vvHeight = 752;
    const innerH = 800;

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: innerH,
    });

    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: {
        offsetTop: 0,
        offsetLeft: 0,
        width: 390,
        height: vvHeight,
        addEventListener,
        removeEventListener,
      },
    });

    mobileViewportHeightState.value = vvHeight;

    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isAndroidBrowser: false,
      isIOSNative: false,
      isIOSBrowser: false,
      isNative: true,
      isMobileBrowser: false,
      safeAreaInsetBottom: 24,
      safeAreaInsetTop: 0,
      hasAndroid3ButtonNav: false,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    const backdrop = screen.getByTestId("custom-modal-backdrop");
    const outer = backdrop.parentElement as HTMLElement | null;
    expect(outer?.style.height).toBe(`${innerH}px`);

    const modal = document.querySelector("[data-modal-content]") as HTMLElement | null;
    expect(modal?.style.height).toBe(`${innerH}px`);
  });

  it("keeps desktop modal container centered", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    const content = document.querySelector("[data-modal-content]") as HTMLElement | null;
    expect(content).toBeTruthy();
    const wrapper = content?.parentElement as HTMLElement | null;
    expect(wrapper?.className).toContain("items-center");
    expect(wrapper?.className).toContain("justify-center");
  });

  it("does not use history state handling on mobile browser", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isAndroidBrowser: false,
      isIOSNative: false,
      isIOSBrowser: false,
      isNative: false,
      isMobileBrowser: true,
      safeAreaInsetBottom: 0,
      safeAreaInsetTop: 0,
      hasAndroid3ButtonNav: false,
    });

    const pushStateSpy = vi.spyOn(window.history, "pushState");

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pushStateSpy).not.toHaveBeenCalled();
  });
});
