import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NativeStoreCheckout } from "./native-store-checkout";

const presentProPaywall = vi.hoisted(() => vi.fn());
const syncRevenueCatCustomer = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
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

describe("NativeStoreCheckout", () => {
  beforeEach(() => {
    presentProPaywall.mockReset();
    syncRevenueCatCustomer.mockReset();
    replace.mockReset();
    presentProPaywall.mockResolvedValue(undefined);
    syncRevenueCatCustomer.mockResolvedValue({ pro: true });
  });

  it("opens RevenueCat instead of the Xendit checkout", async () => {
    render(<NativeStoreCheckout openPaywall />);

    expect(screen.getByText("Opening the App Store…")).toBeInTheDocument();
    await waitFor(() => {
      expect(presentProPaywall).toHaveBeenCalledWith("user-1");
    });
    expect(screen.queryByText("Choose a plan to get started")).not.toBeInTheDocument();
  });

  it("waits to open the paywall until the app check finishes", () => {
    render(<NativeStoreCheckout openPaywall={false} />);

    expect(presentProPaywall).not.toHaveBeenCalled();
    expect(screen.getByText("Loading checkout…")).toBeInTheDocument();
  });
});
