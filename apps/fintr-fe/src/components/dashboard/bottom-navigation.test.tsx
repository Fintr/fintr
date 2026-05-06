import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mockUsePlatformDetection = vi.fn();

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/",
}));

vi.mock("@/components/dashboard/add-transaction-dialog", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/add-receipt-dialog", () => ({
  default: () => null,
}));
vi.mock("@/components/ai-chat/enhanced-ai-chat-modal", () => ({
  default: () => null,
}));

describe("BottomNavigation — iOS native safe area", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).resetDocumentClassList?.()
  });

  afterEach(() => {
    (global as any).resetDocumentClassList?.()
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
    // Reset class list - no 3-button nav class means gesture navigation
    (global as any).resetDocumentClassList?.()

    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isIOSNative: false,
      isNative: true,
      safeAreaInsetTop: 30,
      safeAreaInsetBottom: 0, // Component passes 0, gesture nav uses minimum 16px
    });

    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    // Without 3-button nav class, uses gesture nav minimum of 16px
    expect(nav?.style.bottom === "16px" || nav?.style.bottom === "16").toBe(true);
    expect(container.querySelector(".fixed.bottom-0.h-12")).toBeTruthy();
  });

  it("uses 3-button nav height (48px) when fintr-has-3btn-nav class is present", async () => {
    // Add 3-button nav class
    document.documentElement.classList.add("fintr-has-3btn-nav")

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
    // With 3-button nav class, uses 48px regardless of passed inset
    expect(nav?.style.bottom === "48px" || nav?.style.bottom === "48").toBe(true);
    expect(container.querySelector(".fixed.bottom-0.h-12")).toBeTruthy();

    // Clean up
    document.documentElement.classList.remove("fintr-has-3btn-nav")
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
