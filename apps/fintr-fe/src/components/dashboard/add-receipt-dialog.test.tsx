import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddReceiptDialog from "./add-receipt-dialog";

vi.mock("@/hooks/useAuthApi", () => ({
  default: () => ({
    api: {},
    isAuthenticated: true,
  }),
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: true,
      source: "trial",
      trialDaysRemaining: 7,
    },
    isPending: false,
  }),
}));

vi.mock("@/hooks/async/useDashboardData", () => ({
  useDashboardData: () => ({
    data: {
      accountOptions: [{ id: "cash", name: "Cash" }],
      expenseCategoryOptions: [{ id: "food", name: "Food" }],
    },
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/services/receipts/mutation", () => ({
  uploadReceipt: vi.fn(),
}));

describe("AddReceiptDialog", () => {
  it("uses Cancel as the close target for the receipt tour", async () => {
    const onClose = vi.fn();

    render(
      <AddReceiptDialog
        isOpen
        onClose={onClose}
      />,
    );

    const cancel = await screen.findByRole("button", { name: "Cancel" });

    expect(cancel).toHaveAttribute(
      "data-tutorial-target",
      "close-add-receipt-modal",
    );

    fireEvent.click(cancel);

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("centers take photo and upload file in the mobile empty state", () => {
    render(
      <AddReceiptDialog
        isOpen
        onClose={vi.fn()}
      />,
    );

    const actions = screen
      .getByRole("button", { name: "Take Photo" })
      .closest("[data-tutorial-target='add-receipt-modal']");
    const actionRegion = actions?.parentElement;

    expect(actionRegion).toHaveClass("flex-1", "justify-center", "md:justify-start");
  });
});
