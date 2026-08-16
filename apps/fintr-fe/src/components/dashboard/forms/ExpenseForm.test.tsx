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
  expenseCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import ExpenseForm from "./ExpenseForm";

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

vi.mock("@/hooks/async/useTransactionDrafts", () => ({
  useTransactionDrafts: () => ({
    data: [],
    refetch: vi.fn(),
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
  }: {
    label: string;
    value: string;
  }) => (
    <div>
      {label}: {value}
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

vi.mock("./DraftItems", () => ({
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
      originalCurrency: string;
      targetCurrency: string;
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
    label: "SAMPLE BDO LONG ASS NAME",
    value: "SAMPLE BDO LONG ASS NAME",
    currency: "PHP",
    balance: "1000",
    accountCategory: "credit_card",
  },
];

const medicineCategory = {
  id: "cat-medicine",
  label: "Medicine",
  value: "cat-medicine",
  name: "Medicine",
  parentId: null,
};

const gbpConvertedExpense = {
  id: "tx-gbp",
  date: "2026-08-12",
  description: "EXTEST2",
  amount: 200,
  amountCurrency: "GBP",
  categoryName: "Medicine",
  accountName: "SAMPLE BDO LONG ASS NAME",
  transactionType: "expense",
  type: CombinedTransactionTypeEnum.EXPENSE,
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

const renderExpenseForm = (initialData: UpdateTransactionType) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider
        initialValues={[
          [accountOptionsAtom, phpOnlyAccounts],
          [expenseCategoryOptionsAtom, [medicineCategory]],
        ]}
      >
        <ExpenseForm
          id={initialData.id}
          initialData={initialData}
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
};

describe("ExpenseForm converted edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the original GBP amount and exchange rate, not space PHP", async () => {
    renderExpenseForm(gbpConvertedExpense);

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
