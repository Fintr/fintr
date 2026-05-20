import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { shouldShowImmediateBackButton } from "./mobile-sticky-header";

const mockUsePlatformDetection = vi.fn();

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

const mockUsePathname = vi.fn(() => "/dashboard/");
const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategories: [
      { id: "1", name: "Travel & Vacations", categoryType: "expense", children: [] },
    ],
    incomeCategories: [],
  }),
}));

describe("shouldShowImmediateBackButton", () => {
  it("returns true for category list and detail routes", () => {
    expect(
      shouldShowImmediateBackButton("/dashboard/space_settings/categories"),
    ).toBe(true);
    expect(
      shouldShowImmediateBackButton(
        "/dashboard/space_settings/categories/detail?categoryId=1&kind=expense",
      ),
    ).toBe(true);
  });

  it("returns false for main dashboard tabs until scroll", () => {
    expect(shouldShowImmediateBackButton("/dashboard")).toBe(false);
    expect(shouldShowImmediateBackButton("/dashboard/space_settings")).toBe(
      false,
    );
  });
});

describe("MobileStickyHeader — back button on category pages", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isIOSNative: false,
      isNative: false,
      safeAreaInsetTop: 0,
      safeAreaInsetBottom: 0,
    });
  });

  it("shows back button before scroll on category detail", async () => {
    mockUsePathname.mockReturnValue(
      "/dashboard/space_settings/categories/detail",
    );
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("categoryId=1&kind=expense"),
    );

    const MobileStickyHeader = (await import("./mobile-sticky-header")).default;
    render(<MobileStickyHeader />);

    expect(screen.getByRole("button", { name: /go back/i })).toHaveClass(
      "opacity-100",
    );
  });

  it("shows category name on category detail", async () => {
    mockUsePathname.mockReturnValue(
      "/dashboard/space_settings/categories/detail",
    );
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("categoryId=1&kind=expense"),
    );

    const MobileStickyHeader = (await import("./mobile-sticky-header")).default;
    render(<MobileStickyHeader />);

    expect(
      screen.getByRole("heading", { name: "Category: Travel & Vacations" }),
    ).toBeInTheDocument();
  });
});

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
