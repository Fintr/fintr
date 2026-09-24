import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubscribeProButton } from "./subscribe-pro-button";

const gate = vi.hoisted(() => ({
  value: "web" as "unknown" | "native" | "web",
}));

const presentProPaywall = vi.hoisted(() => vi.fn());
const syncRevenueCatCustomer = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useNativeCheckoutGate", () => ({
  useNativeCheckoutGate: () => gate.value,
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  PRO_ACCESS_QUERY_KEY: ["finance", "proAccess"],
  useProAccess: () => ({
    data: { appUserId: "user-1" },
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

vi.mock("@/lib/revenuecat/purchase-pro", () => ({
  presentProPaywall,
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

describe("SubscribeProButton", () => {
  beforeEach(() => {
    gate.value = "web";
    presentProPaywall.mockReset();
    syncRevenueCatCustomer.mockReset();
  });

  it("opens the Xendit checkout in the browser", () => {
    render(<SubscribeProButton>Subscribe</SubscribeProButton>);

    expect(screen.getByRole("link", { name: "Subscribe" })).toHaveAttribute(
      "href",
      "/dashboard/subscriptions/create",
    );
  });

  it("opens the RevenueCat paywall in the iOS or Android app", async () => {
    gate.value = "native";
    presentProPaywall.mockResolvedValue(undefined);
    syncRevenueCatCustomer.mockResolvedValue({ pro: true });
    const user = userEvent.setup();

    render(<SubscribeProButton>Subscribe</SubscribeProButton>);
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(presentProPaywall).toHaveBeenCalledWith("user-1");
    expect(screen.queryByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
  });
});
