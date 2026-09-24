import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageStoreSubscriptionButton } from "./manage-store-subscription-button";

const manageProSubscription = vi.hoisted(() => vi.fn());
const invalidateQueries = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/async/useProAccess", () => ({
  PRO_ACCESS_QUERY_KEY: ["finance", "proAccess"],
  useProAccess: () => ({
    data: { appUserId: "user-1" },
  }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@/lib/revenuecat/purchase-pro", () => ({
  manageProSubscription,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("ManageStoreSubscriptionButton", () => {
  beforeEach(() => {
    manageProSubscription.mockReset();
    invalidateQueries.mockReset();
  });

  it("opens store management and refreshes the subscription", async () => {
    manageProSubscription.mockResolvedValue(undefined);
    const onFinished = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ManageStoreSubscriptionButton
        managementUrl="https://apps.apple.com/account/subscriptions"
        onFinished={onFinished}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Manage subscription" }));

    expect(manageProSubscription).toHaveBeenCalledWith(
      "user-1",
      "https://apps.apple.com/account/subscriptions",
    );
    expect(onFinished).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["finance", "proAccess"],
    });
  });
});
