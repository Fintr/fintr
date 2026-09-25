import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement } from "react";

const proAccess = vi.hoisted(() => ({
  source: "none" as "trial" | "none" | "revenuecat",
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: proAccess.source !== "none",
      source: proAccess.source,
      trialDaysRemaining: proAccess.source === "trial" ? 5 : 0,
    },
    isPending: false,
  }),
}));

const mockUsePlatformDetection = vi.fn();
const addTransactionDialog = vi.hoisted(() => vi.fn(() => null));
const addReceiptDialog = vi.hoisted(() => vi.fn(() => null));
const aiChatModal = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

const mockPathname = vi.hoisted(() => ({
  value: "/dashboard/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
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
    mockPathname.value = "/dashboard/";
    proAccess.source = "none";
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

describe("BottomNavigation — light mode bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proAccess.source = "none";
    mockUsePlatformDetection.mockReturnValue(webPlatform);
  });

  it("uses the navy bar from the light-mode reference", async () => {
    const BottomNavigation = (await import("./bottom-navigation")).default;
    const { container } = render(<BottomNavigation />);

    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("bg-[#0d3557]");
    expect(nav?.className).toContain("dark:bg-card/95");

    const home = screen.getByRole("link", { name: "Home" });
    const transactions = screen.getByRole("link", { name: "Transactions" });
    expect(home.className).toContain("text-white/70");
    expect(transactions.className).toContain("text-white");
    expect(transactions.className).not.toContain("text-white/70");
    expect(transactions.className).toContain("dark:text-primary-dark-mode");
  });
});

describe("BottomNavigation — leaving admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.value = "/admin/users";
    proAccess.source = "none";
    mockUsePlatformDetection.mockReturnValue(webPlatform);
    window.history.replaceState({}, "", "/admin/users");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("does not swallow home, transactions, dashboard, or menu taps", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const BottomNavigation = (await import("./bottom-navigation")).default;
    render(<BottomNavigation />);

    for (const name of ["Home", "Transactions", "Dashboard", "Menu"]) {
      const link = screen.getByRole("link", { name });
      fireEvent.pointerDown(link);
      fireEvent.pointerUp(link);
      fireEvent.click(link);
    }

    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });
});

describe("BottomNavigation — fast tab switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.value = "/dashboard/";
    proAccess.source = "none";
    mockUsePlatformDetection.mockReturnValue(webPlatform);
    window.history.replaceState({}, "", "/dashboard/");
  });

  it("still commits a tab change inside the dashboard shell", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const BottomNavigation = (await import("./bottom-navigation")).default;
    render(<BottomNavigation />);

    fireEvent.click(screen.getByRole("link", { name: "Home" }));

    expect(pushState).toHaveBeenCalledWith({}, "", "/dashboard/home");
    pushState.mockRestore();
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

describe("BottomNavigation — trial Pro badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proAccess.source = "trial";
    mockUsePlatformDetection.mockReturnValue(webPlatform);
  });

  it("badges AI chat and receipt scanning during a trial", async () => {
    const BottomNavigation = (await import("./bottom-navigation")).default;
    render(<BottomNavigation />);

    expect(
      within(screen.getByRole("link", { name: /Dashboard/ })).queryByText("Pro"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: "Home" })).queryByText("Pro"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Options" }));

    expect(
      within(screen.getByRole("button", { name: /Chat with AI/ })).getByText(
        "Pro",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /Add Receipt/ })).getByText(
        "Pro",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("button", { name: /Add Transaction/ }),
      ).queryByText("Pro"),
    ).not.toBeInTheDocument();
  });
});
