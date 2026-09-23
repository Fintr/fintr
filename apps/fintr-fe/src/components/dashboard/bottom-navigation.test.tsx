import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement } from "react";

const mockUsePlatformDetection = vi.fn();
const addTransactionDialog = vi.hoisted(() => vi.fn(() => null));
const addReceiptDialog = vi.hoisted(() => vi.fn(() => null));
const aiChatModal = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/",
  useRouter: () => ({ prefetch: vi.fn() }),
}));

vi.mock("@/hooks/usePrefetchDashboardNavRoutes", () => ({
  usePrefetchDashboardNavRoutes: () => undefined,
}));

vi.mock("@/components/dashboard/add-transaction-dialog", () => ({
  default: (props: unknown) => addTransactionDialog(props),
}));
vi.mock("@/components/dashboard/add-receipt-dialog", () => ({
  default: (props: unknown) => addReceiptDialog(props),
}));
vi.mock("@/components/ai-chat/enhanced-ai-chat-modal", () => ({
  default: (props: unknown) => aiChatModal(props),
}));

const webPlatform = {
  isAndroidNative: false,
  isIOSNative: false,
  isNative: false,
  safeAreaInsetTop: 0,
  safeAreaInsetBottom: 0,
};

describe("BottomNavigation — iOS native safe area", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlatformDetection.mockReturnValue(webPlatform);
    (global as any).resetDocumentClassList?.();
  });

  afterEach(() => {
    (global as any).resetDocumentClassList?.();
  });

  it("uses compact pb-2 on iOS native (not pb-safe-bottom; WKWebView excludes home-indicator region)", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isIOSNative: true,
      isNative: true,
      safeAreaInsetTop: 59,
      safeAreaInsetBottom: 34,
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    render(<BottomNavigation />);

    const nav = document.querySelector("nav");
    expect(nav?.className).toContain("pb-2");
    expect(nav?.className).not.toContain("pb-safe-bottom");
    expect(nav?.className).not.toContain("pb-4");
  });

  it("sets bottom offset to 0 for iOS native (nav sits on WebView bottom; no CSS bottom lift)", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isIOSNative: true,
      isNative: true,
      safeAreaInsetTop: 59,
      safeAreaInsetBottom: 34,
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    expect(nav?.style.bottom === "0px" || nav?.style.bottom === "0").toBe(true);
  });

  it("keeps Android nav compact with off-white system-nav spacer and no pb-4", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isIOSNative: false,
      isNative: true,
      safeAreaInsetTop: 30,
      safeAreaInsetBottom: 48,
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    expect(nav?.className).not.toContain("pb-4");
    expect(nav?.className).not.toContain("android-bottom-nav-native");
    expect(container.querySelector(".fixed.bottom-0.h-12")).toBeTruthy();
  });

  it("uses gesture nav height (16px) for Android when no 3-button nav class", async () => {
    (global as any).resetDocumentClassList?.();

    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isIOSNative: false,
      isNative: true,
      safeAreaInsetTop: 30,
      safeAreaInsetBottom: 0,
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    expect(nav?.style.bottom === "16px" || nav?.style.bottom === "16").toBe(true);
    expect(container.querySelector(".fixed.bottom-0.h-12")).toBeTruthy();
  });

  it("uses 3-button nav height (48px) when fintr-has-3btn-nav class is present", async () => {
    document.documentElement.classList.add("fintr-has-3btn-nav");

    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isIOSNative: false,
      isNative: true,
      safeAreaInsetTop: 30,
      safeAreaInsetBottom: 0,
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    expect(nav?.style.bottom === "48px" || nav?.style.bottom === "48").toBe(true);
    expect(container.querySelector(".fixed.bottom-0.h-12")).toBeTruthy();

    document.documentElement.classList.remove("fintr-has-3btn-nav");
  });

  it("does not add extra bottom padding for mobile browser", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isIOSNative: false,
      isNative: false,
      safeAreaInsetTop: 0,
      safeAreaInsetBottom: 0,
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    expect(nav?.className).not.toContain("pb-4");
    expect(nav?.className).not.toContain("pb-2");
    expect(nav?.style.bottom === "0px" || nav?.style.bottom === "0").toBe(true);
    expect(container.querySelector(".fixed.bottom-0.h-12")).toBeNull();
  });
});

describe("BottomNavigation — fast tab switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlatformDetection.mockReturnValue(webPlatform);
  });

  it("does not mount add/chat overlays until they are opened", async () => {
    const BottomNavigation = (await import("./bottom-navigation")).default;
    render(<BottomNavigation />);

    expect(addTransactionDialog).not.toHaveBeenCalled();
    expect(addReceiptDialog).not.toHaveBeenCalled();
    expect(aiChatModal).not.toHaveBeenCalled();
  });

  it("marks the tapped tab pending on pointer down so the shell can switch immediately", async () => {
    const { pendingDashboardBottomTabAtom } = await import(
      "@/atoms/dashboardBottomTabAtoms"
    );
    const BottomNavigation = (await import("./bottom-navigation")).default;
    const store = createStore();

    render(
      createElement(
        JotaiProvider,
        { store },
        createElement(BottomNavigation),
      ),
    );

    fireEvent.pointerDown(screen.getByRole("link", { name: "Dashboard" }));

    expect(store.get(pendingDashboardBottomTabAtom)).toBe("insights");
  });
});
