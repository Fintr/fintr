import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProPlanCard } from "./pro-plan-card";

const proState = vi.hoisted(() => ({
  data: undefined as
    | {
        pro: boolean;
        source: "trial" | "none" | "revenuecat" | "subscription" | "admin" | "grant";
        proExpiresAt?: string | null;
        appUserId: string | null;
        trialDaysRemaining: number;
        features: [];
      }
    | undefined,
  isPending: false,
}));

const platformState = vi.hoisted(() => ({
  isNative: false,
  isIOSNative: false,
  isAndroidNative: false,
}));

const checkoutGate = vi.hoisted(() => ({
  value: "web" as "unknown" | "native" | "web",
}));

const presentProPaywall = vi.hoisted(() => vi.fn());
const presentProCustomerCenter = vi.hoisted(() => vi.fn());
const syncRevenueCatCustomer = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/async/useProAccess", () => ({
  PRO_ACCESS_QUERY_KEY: ["finance", "proAccess"],
  useProAccess: () => proState,
}));

vi.mock("@/hooks/async/useSubscriptions", () => ({
  useSubscriptionPlans: () => ({
    plans: [
      {
        id: "plan-pro",
        slug: "pro_monthly",
        name: "Pro Monthly",
        priceCents: 10000,
        priceCurrency: "PHP",
        interval: "month",
      },
      {
        id: "plan-yearly",
        slug: "pro_yearly",
        name: "Pro Yearly",
        priceCents: 100000,
        priceCurrency: "PHP",
        interval: "year",
      },
    ],
  }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: { post: vi.fn() } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/lib/platform-detection", () => ({
  detectPlatform: () => platformState,
}));

vi.mock("@/hooks/useNativeCheckoutGate", () => ({
  useNativeCheckoutGate: () => checkoutGate.value,
}));

vi.mock("@/lib/revenuecat/purchase-pro", () => ({
  presentProPaywall,
  presentProCustomerCenter,
  PurchaseCancelledError: class PurchaseCancelledError extends Error {},
}));

vi.mock("@/services/finance/pro-access", () => ({
  syncRevenueCatCustomer,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("ProPlanCard", () => {
  beforeEach(() => {
    proState.data = {
      pro: true,
      source: "trial",
      appUserId: "user-1",
      trialDaysRemaining: 5,
      features: [],
    };
    proState.isPending = false;
    platformState.isNative = false;
    platformState.isIOSNative = false;
    platformState.isAndroidNative = false;
    checkoutGate.value = "web";
    presentProPaywall.mockReset();
    presentProCustomerCenter.mockReset();
    syncRevenueCatCustomer.mockReset();
  });

  it("shows the trial countdown and the Pro feature list", () => {
    render(<ProPlanCard />);

    expect(screen.getByText(/₱100\.00 \/ month/)).toHaveTextContent(
      "₱100.00 / month or ₱1,000.00 / year (saves 17%)",
    );
    expect(screen.getByText("5 days left in your free trial.")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Insights")).toBeInTheDocument();
    expect(screen.getByText("Bulk AI receipt scanning")).toBeInTheDocument();
    expect(screen.getByText("Soon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Fintr Pro" })).toHaveAttribute(
      "href",
      "/dashboard/subscriptions/create",
    );
  });

  it("says the trial has ended when Pro is no longer active", () => {
    proState.data = {
      pro: false,
      source: "none",
      appUserId: "user-1",
      trialDaysRemaining: 0,
      features: [],
    };

    render(<ProPlanCard />);

    expect(screen.getByText("Your 7-day trial has ended.")).toBeInTheDocument();
  });

  it("shows the gifted year without a purchase button", () => {
    proState.data = {
      pro: true,
      source: "grant",
      appUserId: "user-1",
      trialDaysRemaining: 0,
      proExpiresAt: "2027-09-24T00:00:00.000Z",
      features: [],
    };

    render(<ProPlanCard />);

    expect(screen.getByText(/Fintr Pro is active through/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Get Fintr Pro" })).not.toBeInTheDocument();
  });

  it("hides the purchase action when Pro is already paid", () => {
    proState.data = {
      pro: true,
      source: "subscription",
      appUserId: "user-1",
      trialDaysRemaining: 0,
      features: [],
    };

    render(<ProPlanCard />);

    expect(screen.getByText("Fintr Pro is active on this account.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Get Fintr Pro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get Fintr Pro" })).not.toBeInTheDocument();
  });

  it("opens RevenueCat when the Capacitor app is detected", async () => {
    checkoutGate.value = "native";
    const user = userEvent.setup();
    presentProPaywall.mockResolvedValue(undefined);
    syncRevenueCatCustomer.mockResolvedValue({
      pro: true,
      source: "revenuecat",
    });

    render(<ProPlanCard />);
    await user.click(screen.getByRole("button", { name: "Get Fintr Pro" }));

    expect(presentProPaywall).toHaveBeenCalledWith("user-1");
    expect(screen.queryByRole("link", { name: "Get Fintr Pro" })).not.toBeInTheDocument();
  });

  it("buys Pro through RevenueCat on the mobile app", async () => {
    platformState.isNative = true;
    platformState.isIOSNative = true;
    const user = userEvent.setup();
    presentProPaywall.mockResolvedValue(undefined);
    syncRevenueCatCustomer.mockResolvedValue({
      pro: true,
      source: "revenuecat",
    });

    render(<ProPlanCard />);
    await user.click(screen.getByRole("button", { name: "Get Fintr Pro" }));

    expect(presentProPaywall).toHaveBeenCalledWith("user-1");
    expect(syncRevenueCatCustomer).toHaveBeenCalled();
  });

  it("opens Customer Center when the store subscription is active", async () => {
    platformState.isNative = true;
    proState.data = {
      pro: true,
      source: "revenuecat",
      appUserId: "user-1",
      trialDaysRemaining: 0,
      features: [],
    };
    const user = userEvent.setup();
    presentProCustomerCenter.mockResolvedValue(undefined);
    syncRevenueCatCustomer.mockResolvedValue({
      pro: true,
      source: "revenuecat",
    });

    render(<ProPlanCard />);
    await user.click(screen.getByRole("button", { name: "Manage subscription" }));

    expect(presentProCustomerCenter).toHaveBeenCalledWith("user-1");
  });
});
