import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { TransactionDetailContent } from "./transaction-detail-content";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockRequestExit = vi.fn((then: () => void) => then());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

vi.mock("@/components/dashboard/detail-push-transition", () => ({
  useDetailPushExit: () => ({ requestExit: mockRequestExit }),
}));

const mockTransaction = {
  id: "tx-1",
  date: "2026-08-17",
  description: "Make subcat",
  amount: 1,
  amountCurrency: "GBP",
  bookedAmount: 1,
  bookedAmountCurrency: "GBP",
  categoryName: "A1",
  subcategoryName: null,
  categoryId: "cat-a1",
  subcategoryId: null,
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  entityName: "Jollibee",
  entityId: "ent-1",
  accountId: "acc-cash",
  fromAccountId: "acc-cash",
  toAccountId: null,
};

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-1"],
}));

vi.mock("@/hooks/useOfflineReadMode", () => ({
  usePreferLocalTransactionReads: () => true,
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("@/services/transactions/local-cache", () => ({
  loadLocalIndexTransactionById: vi.fn(async () => mockTransaction),
}));

const accountIdOnlyTransaction = {
  ...mockTransaction,
  fromAccountName: "",
  fromAccountId: "acc-cash",
  accountId: "acc-cash",
};

vi.mock("@/services/transactions/detail-local", () => ({
  resolveTransactionDetail: vi.fn(async () => {
    throw new Error("use local row");
  }),
}));

vi.mock("@/services/attachments/resolve", () => ({
  resolveAttachmentsForTransaction: vi.fn(async () => ({
    images: [],
    revoke: () => undefined,
  })),
}));

vi.mock("@/hooks/async/useEntities", () => ({
  useEntities: () => ({
    entities: [
      {
        id: "ent-1",
        fullName: "Jollibee",
        photoUrl: "https://cdn.example/jollibee.png",
        entityType: "transaction",
      },
    ],
  }),
}));

vi.mock("@/hooks/async/useAccounts", () => ({
  useAccounts: () => ({
    accounts: [
      {
        id: "acc-cash",
        name: "Cash",
        balance: "0",
        balanceCurrency: "PHP",
        accountCategory: "cash",
      },
    ],
  }),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategories: [
      {
        id: "cat-a1",
        name: "A1",
        categoryType: CategoryTypeEnum.EXPENSE,
        icon: "utensils",
        color: "#E53935",
        children: [],
      },
    ],
    incomeCategories: [],
    expenseCategoryOptions: [
      {
        id: "cat-a1",
        label: "A1",
        value: "cat-a1",
        name: "A1",
        parentId: null,
        icon: "utensils",
        color: "#E53935",
        children: [],
      },
    ],
    incomeCategoryOptions: [],
  }),
}));

vi.mock("@/components/dashboard/forms/EditTransactionDialog", () => ({
  default: ({
    onSuccess,
  }: {
    onSuccess: (options?: {
      deleted?: boolean;
      deleteScope?: DeleteScopeEnum;
    }) => void;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onSuccess({
            deleted: true,
            deleteScope: DeleteScopeEnum.THIS_ONLY,
          })
        }
      >
        Trigger delete success
      </button>
      <button
        type="button"
        onClick={() =>
          onSuccess({
            deleted: true,
            deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
          })
        }
      >
        Trigger series delete success
      </button>
    </>
  ),
}));

vi.mock("@/components/dashboard/transactions/tag-destination-dialog", () => ({
  TagDestinationDialog: () => null,
}));

vi.mock("@/components/ui/ImageLightbox", () => ({
  default: () => null,
}));

const renderView = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionDetailContent transactionId="tx-1" />
    </QueryClientProvider>,
  );
};

describe("TransactionDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockBack.mockReset();
    mockRequestExit.mockImplementation((then: () => void) => then());
  });

  it("shows merchant, account, and category icons beside the view rows", async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText("Jollibee")).toBeInTheDocument();
    });

    const merchantRow = screen.getByText("Jollibee").closest("a");
    expect(merchantRow).toBeTruthy();
    expect(
      (merchantRow as HTMLElement).querySelector("img"),
    ).toHaveAttribute("src", "https://cdn.example/jollibee.png");

    const accountRow = screen.getByText("Cash").closest("a");
    expect(accountRow).toBeTruthy();
    expect((accountRow as HTMLElement).querySelectorAll("svg").length).toBeGreaterThan(1);

    const categoryRow = screen.getByText("A1").closest("a");
    expect(categoryRow).toBeTruthy();
    expect((categoryRow as HTMLElement).querySelectorAll("svg").length).toBeGreaterThan(1);
  });

  it("resolves account label from accountId when the stored name is empty", async () => {
    const { loadLocalIndexTransactionById } = await import(
      "@/services/transactions/local-cache"
    );
    vi.mocked(loadLocalIndexTransactionById).mockResolvedValueOnce(
      accountIdOnlyTransaction,
    );

    renderView();

    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
  });

  it("returns to the previous page after deleting a transaction", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByText("Trigger delete success")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /trigger delete success/i }));

    expect(mockRequestExit).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("returns to the previous page after deleting a series from the transaction view", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(
        screen.getByText("Trigger series delete success"),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /trigger series delete success/i }),
    );

    expect(mockRequestExit).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
