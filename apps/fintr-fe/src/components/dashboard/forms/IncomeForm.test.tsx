import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  CombinedTransactionTypeEnum,
  type UpdateTransactionType,
} from "@/types/transactionTypes";
import {
  accountOptionsAtom,
} from "@/atoms/dashboardAtoms";
import IncomeForm from "./IncomeForm";

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-a", vi.fn()],
}));

vi.mock("@/hooks/async/useTransactionTags", () => ({
  useTransactionTags: () => ({
    tags: [],
    createTag: vi.fn(),
  }),
}));

vi.mock("@/hooks/useInitializeDefaultTransactionTags", () => ({
  useInitializeDefaultTransactionTags: () => undefined,
}));

const { mockIncomeCategoryOptions } = vi.hoisted(() => ({
  mockIncomeCategoryOptions: vi.fn(() => [] as Array<{
    id: string;
    label: string;
    value: string;
    name: string;
    parentId: string | null;
  }>),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: mockIncomeCategoryOptions(),
    expenseCategories: [],
    incomeCategories: [],
    createCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("@/services/exchangeRates/resolve-auto-rates", () => ({
  resolveAutoExchangeRates: vi.fn(),
}));

vi.mock("@/services/exchangeRates/queries", () => ({
  getCurrentRate: vi.fn(),
  getRecentRates: vi.fn().mockResolvedValue({ rates: [] }),
}));

vi.mock("@/components/ui/calendar-popover", () => ({
  CalendarPopover: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => null,
}));

vi.mock("./GridPicker", () => ({
  default: ({
    label,
    value,
    categories,
  }: {
    label: string;
    value: string;
    categories?: { name?: string; label?: string }[];
  }) => (
    <div>
      {label}: {value}
      {categories?.length ? (
        <span data-testid={`${label}-options`}>
          {categories.map((category) => category.name ?? category.label).join(",")}
        </span>
      ) : null}
    </div>
  ),
}));

vi.mock("./FileUploadField", () => ({
  default: () => null,
}));

vi.mock("./TransactionScheduleFields", () => ({
  default: () => null,
}));

vi.mock("./TagMultiPicker", () => ({
  TagMultiPicker: () => null,
}));

vi.mock("./TransactionEntityField", () => ({
  default: () => null,
}));

vi.mock("./TransactionDescriptionField", () => ({
  default: () => null,
}));

vi.mock("../tabs/transactions/buttons/DeleteButton", () => ({
  DeleteButton: () => null,
}));

vi.mock("./StickyFormActions", () => ({
  StickyFormActions: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  pinnedFormScrollAreaClassName: "",
}));

vi.mock("./AmountWithRatePicker", () => ({
  AmountWithRatePicker: ({
    fromCurrency,
    amountDisplayValue,
    hideRatePicker,
    initialConversion,
    amountCurrencyOptions,
  }: {
    fromCurrency: string;
    amountDisplayValue: string;
    hideRatePicker?: boolean;
    initialConversion?: {
      exchangeRate: number;
    } | null;
    amountCurrencyOptions: string[];
  }) => (
    <div>
      <span data-testid="edit-amount-currency">{fromCurrency}</span>
      <span data-testid="edit-amount-value">{amountDisplayValue}</span>
      <span data-testid="edit-amount-currencies">
        {amountCurrencyOptions.join(",")}
      </span>
      {hideRatePicker ? null : (
        <span data-testid="edit-exchange-rate">
          {initialConversion?.exchangeRate ?? "open"}
        </span>
      )}
    </div>
  ),
}));

const phpOnlyAccounts = [
  {
    label: "Cash",
    value: "Cash",
    currency: "PHP",
    balance: "1000",
    accountCategory: "cash",
  },
];

const gbpConvertedIncome = {
  id: "tx-gbp-income",
  date: "2026-08-12",
  description: "Freelance",
  amount: 200,
  amountCurrency: "GBP",
  categoryName: "Salary",
  accountName: "Cash",
  transactionType: "income",
  type: CombinedTransactionTypeEnum.INCOME,
  scheduleType: ScheduleTypeEnum.ONE_TIME,
  repeatInterval: "",
  installmentPeriod: 0,
  file: null,
  hasCurrencyConversion: true,
  original_display_amount: 200,
  original_display_currency: "GBP",
  currencyConversion: {
    originalAmount: 200,
    originalCurrency: "GBP",
    convertedAmount: 20_000,
    convertedCurrency: "PHP",
    exchangeRate: 100,
    source: "manual",
  },
} as UpdateTransactionType & {
  original_display_amount: number;
  original_display_currency: string;
};

describe("IncomeForm converted edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncomeCategoryOptions.mockReturnValue([
      {
        id: "cat-salary",
        label: "Salary",
        value: "cat-salary",
        name: "Salary",
        parentId: null,
      },
    ]);
  });

  it("shows the original GBP amount and exchange rate, not space PHP", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider
          initialValues={[
            [accountOptionsAtom, phpOnlyAccounts],
          ]}
        >
          <IncomeForm
            id={gbpConvertedIncome.id}
            initialData={gbpConvertedIncome}
            date={new Date("2026-08-12T00:00:00")}
            setDate={vi.fn()}
            spaceCurrency="PHP"
            isEditMode
            onSubmitSuccess={vi.fn()}
            onCancel={vi.fn()}
          />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("edit-amount-currency")).toHaveTextContent(
      "GBP",
    );
    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("200");
    expect(screen.getByTestId("edit-amount-value")).not.toHaveTextContent(
      "20,000",
    );
    expect(screen.getByTestId("edit-amount-currencies")).toHaveTextContent(
      "GBP",
    );
    expect(screen.getByTestId("edit-exchange-rate")).toHaveTextContent("100");
  });
});

describe("IncomeForm category options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncomeCategoryOptions.mockReturnValue([
      {
        id: "cat-bonus",
        label: "Bonus",
        value: "cat-bonus",
        name: "Bonus",
        parentId: null,
      },
    ]);
  });

  it("uses the transaction categories list, not dashboard shell atoms", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider
          initialValues={[
            [accountOptionsAtom, phpOnlyAccounts],
          ]}
        >
          <IncomeForm
            id={gbpConvertedIncome.id}
            initialData={{
              ...gbpConvertedIncome,
              categoryName: "Bonus",
            }}
            date={new Date("2026-08-12T00:00:00")}
            setDate={vi.fn()}
            spaceCurrency="PHP"
            isEditMode
            onSubmitSuccess={vi.fn()}
            onCancel={vi.fn()}
          />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("Income Category-options")).toHaveTextContent(
      "Bonus",
    );
    expect(
      screen.getByTestId("Income Category-options"),
    ).not.toHaveTextContent("Salary");
  });
});
