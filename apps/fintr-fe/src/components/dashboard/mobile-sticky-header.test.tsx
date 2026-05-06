import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mockUsePlatformDetection = vi.fn();

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/",
  useRouter: () => ({ back: vi.fn() }),
}));

describe("MobileStickyHeader — iOS native vs other platforms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses pt-safe-top on iOS native without inline padding (env() handles top inset)", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isIOSNative: true,
      isNative: true,
      safeAreaInsetTop: 59,
      safeAreaInsetBottom: 34,
    });

    const MobileStickyHeader = (await import("./mobile-sticky-header")).default;
    render(<MobileStickyHeader />);

    const header = document.querySelector("header");
    expect(header?.className).toContain("pt-safe-top");
    expect(header?.getAttribute("style")).toBeNull();
  });

  it("omits extra top safe-area classes on Android native", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isIOSNative: false,
      isNative: true,
      safeAreaInsetTop: 30,
      safeAreaInsetBottom: 48,
    });

    const MobileStickyHeader = (await import("./mobile-sticky-header")).default;
    render(<MobileStickyHeader />);

    const header = document.querySelector("header");
    expect(header?.className).not.toContain("pt-safe-top");
    expect(header?.className).not.toContain("android-sticky-header-inset-top");
    expect(header?.getAttribute("style")).toContain("padding-top");
    expect(header?.getAttribute("style")).toContain("24px");
  });

  it("still avoids extra top safe-area classes when native reports zero inset", async () => {
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: true,
      isIOSNative: false,
      isNative: true,
      safeAreaInsetTop: 0,
      safeAreaInsetBottom: 48,
    });

    const MobileStickyHeader = (await import("./mobile-sticky-header")).default;
    render(<MobileStickyHeader />);

    const header = document.querySelector("header");
    expect(header?.className).not.toContain("android-sticky-header-inset-top");
    expect(header?.getAttribute("style")).toContain("padding-top");
    expect(header?.getAttribute("style")).toContain("24px");
  });
});
