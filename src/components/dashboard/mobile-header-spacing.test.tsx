import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { calculateHeaderSpacerHeight } from "@/lib/platform-detection";

// Mock the platform detection hook
vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => ({
    isAndroidNative: true,
    isIOSNative: false,
    isNative: true,
    safeAreaInsetBottom: 48,
    safeAreaInsetTop: 30, // Simulate status bar height
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ back: vi.fn() }),
}));

describe("Mobile Header Spacer - Top Safe Area", () => {
  describe("calculateHeaderSpacerHeight function", () => {
    it("should calculate Android native spacer with minimum 44px + safe area", () => {
      const height = calculateHeaderSpacerHeight(true, false, 30); // 30px status bar

      // Should be calc(44px + 30px) = 74px total
      expect(height).toBe("calc(44px + 30px)");
    });

    it("should use env() for iOS native (full-bleed WebView safe area)", () => {
      const height = calculateHeaderSpacerHeight(false, true, 47);

      expect(height).toBe("calc(44px + env(safe-area-inset-top, 0px))");
    });

    it("should use env() fallback for mobile browsers", () => {
      const height = calculateHeaderSpacerHeight(false, false, 0);

      // Browser should use env() CSS function
      expect(height).toBe("calc(44px + env(safe-area-inset-top, 0px))");
    });

    it("should apply minimum status bar padding for Android native when inset is zero", () => {
      const height = calculateHeaderSpacerHeight(true, false, 0);

      expect(height).toBe("calc(44px + 24px)");
    });
  });

  describe("Mobile Sticky Header - Top Padding", () => {
    beforeEach(() => {
      // Reset document classes
      document.documentElement.className = "";
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should have pt-safe-top class for status bar padding", async () => {
      const MobileStickyHeader = (await import("./mobile-sticky-header"))
        .default;

      render(<MobileStickyHeader />);

      const header = document.querySelector("header");
      expect(header).toBeTruthy();

      // Should have the pt-safe-top class for status bar padding
      expect(header?.classList.contains("pt-safe-top")).toBe(true);
    });

    it("should apply inline padding for native apps", async () => {
      const MobileStickyHeader = (await import("./mobile-sticky-header"))
        .default;

      render(<MobileStickyHeader />);

      const header = document.querySelector("header");
      expect(header).toBeTruthy();

      // Should have inline style with padding for native apps
      // The mock returns safeAreaInsetTop: 30, so it should be "30px"
      const style = header?.getAttribute("style");
      expect(style).toContain("padding-top");
      expect(style).toContain("30px");
    });
  });

  describe("Dashboard Layout - Header Spacer", () => {
    it("should include spacer height that accounts for safe area", () => {
      // Test that the spacer height calculation includes both base height AND safe area
      const androidHeight = calculateHeaderSpacerHeight(true, false, 30);
      const browserHeight = calculateHeaderSpacerHeight(false, false, 0);

      // Android and Browser should include 44px base
      expect(androidHeight).toContain("44px");
      expect(browserHeight).toContain("44px");

      // Android native should include the safe area value
      expect(androidHeight).toContain("30px");

      // Browser should use env()
      expect(browserHeight).toContain("env(safe-area-inset-top");
    });

    it("should handle Android native with safe area and iOS native with env()", () => {
      const androidHeight = calculateHeaderSpacerHeight(true, false, 0);
      const iosHeight = calculateHeaderSpacerHeight(false, true, 0);

      // Android should include safe area calculation
      expect(androidHeight).not.toBe("44px");
      expect(androidHeight).toContain("calc(");

      expect(iosHeight).toContain("env(safe-area-inset-top");
    });
  });

  describe("Status Bar Padding Requirements", () => {
    it("should not use a tiny reported top inset below the Android minimum", () => {
      const height = calculateHeaderSpacerHeight(true, false, 5);

      expect(height).toBe("calc(44px + 24px)");
    });

    it("should use env() for iOS native with large reported safe area", () => {
      const height = calculateHeaderSpacerHeight(false, true, 59);

      expect(height).toBe("calc(44px + env(safe-area-inset-top, 0px))");
    });
  });
});
