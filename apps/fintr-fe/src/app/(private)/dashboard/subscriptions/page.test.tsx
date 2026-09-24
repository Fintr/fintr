import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/async/useSubscriptions", () => ({
  useCurrentSubscription: () => ({
    subscriptions: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCancelSubscription: () => ({
    cancelSubscription: vi.fn(),
    isCancelling: false,
  }),
  useSimulateCyclePayment: () => ({
    simulateCyclePayment: vi.fn(),
    isSimulating: false,
  }),
  useForceAttemptCycle: () => ({
    forceAttemptCycle: vi.fn(),
    isForcing: false,
  }),
  useUpdateSubscription: () => ({
    updateSubscription: vi.fn(),
    isUpdating: false,
  }),
  useSubscriptionPlans: () => ({
    plans: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: {},
    getToken: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({
    currentSpace: null,
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/lib/capacitor", () => ({
  shouldShowSimulatePaymentButton: () => false,
  isNativeCapacitor: () => false,
  isNativeCapacitorAsync: () => Promise.resolve(false),
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  PRO_ACCESS_QUERY_KEY: ["finance", "proAccess"],
  useProAccess: () => ({ data: { appUserId: "user-1" } }),
}));

import SubscriptionsPage from "./page";

const shellForHeading = (name: string) => {
  const heading = screen.getByRole("heading", { name });
  const shell = heading.closest(".container");

  expect(shell).not.toBeNull();

  return shell as HTMLElement;
};

describe("subscriptions page", () => {
  it("keeps horizontal padding aligned with the mobile header", () => {
    render(<SubscriptionsPage />);

    const shell = shellForHeading("Subscriptions");

    expect(shell).toHaveClass("px-4");
    expect(shell.className).not.toMatch(/(^|\s)-mx-4(\s|$)/);
  });
});
