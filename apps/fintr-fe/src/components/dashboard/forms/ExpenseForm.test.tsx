import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
import {
  CombinedTransactionTypeEnum,
  type UpdateTransactionType,
} from "@/types/transactionTypes";
import {
  accountOptionsAtom,
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

const { mockExpenseCategoryOptions } = vi.hoisted(() => ({
  mockExpenseCategoryOptions: vi.fn(() => [] as Array<{
    id: string;
    label: string;
    value: string;
    name: string;
    parentId: string | null;
  }>),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: mockExpenseCategoryOptions(),
    incomeCategoryOptions: [],
    expenseCategories: [],
    incomeCategories: [],
    createCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
  }),
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
    id = "amount",
    label,
    fromCurrency,
    amountDisplayValue,
    onAmountChange,
    onConversionChange,
    hideRatePicker,
    initialConversion,
    amountCurrencyOptions,
  }: {
    id?: string;
    label?: string;
    fromCurrency: string;
    amountDisplayValue: string;
    onAmountChange?: (value: string) => void;
    onConversionChange?: (conversion: {
      originalCurrency: string;
      targetCurrency: string;
      exchangeRate: number;
      exchangeRateSource: "auto" | "manual" | "recent";
    } | null) => void;
    hideRatePicker?: boolean;
    initialConversion?: {
      originalCurrency: string;
      targetCurrency: string;
      exchangeRate: number;
    } | null;
    amountCurrencyOptions: string[];
  }) => {
    const prefix = id === "amount" ? "edit-amount" : id;
    const numeric =
      Number.parseFloat(String(amountDisplayValue).replace(/,/g, "")) || 0;
    const converted = numeric * (initialConversion?.exchangeRate ?? 0);

    return (
      <div>
        <span data-testid={id === "amount" ? "amount-picker-label" : `${id}-label`}>
          {label}
        </span>
        <span data-testid={`${prefix}-currency`}>{fromCurrency}</span>
        <span data-testid={`${prefix}-value`}>{amountDisplayValue}</span>
        <span data-testid={`${prefix}-converted`}>
          {converted > 0 ? converted : ""}
        </span>
        <span data-testid={id === "amount" ? "edit-amount-currencies" : `${id}-currencies`}>
          {amountCurrencyOptions.join(",")}
        </span>
        {hideRatePicker ? null : (
          <>
            <span data-testid={id === "amount" ? "edit-exchange-rate" : `${id}-exchange-rate`}>
              {initialConversion?.exchangeRate ?? "open"}
            </span>
            <button
              type="button"
              data-testid={`${prefix}-apply-recent-rate`}
              onClick={() =>
                onConversionChange?.({
                  originalCurrency: fromCurrency,
                  targetCurrency: initialConversion?.targetCurrency ?? "PHP",
                  exchangeRate: 100,
                  exchangeRateSource: "recent",
                })
              }
            >
              Apply 100 recent
            </button>
          </>
        )}
        <input
          id={id}
          aria-label={label}
          value={amountDisplayValue}
          onChange={(event) => onAmountChange?.(event.target.value)}
        />
      </div>
    );
  },
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

const installment5SeriesContext = {
  paidSoFarCents: 80_000,
  committedMonthsCount: 8,
  calculatedDates: [
    "2026-01-01",
    "2026-02-01",
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
  ],
  defaultPerPaymentCents: 10_000,
  occurrenceCentsByDate: Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => {
      const year = 2026 + Math.floor(index / 12);
      const month = (index % 12) + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-01`;
      return [date, 10_000] as const;
    }),
  ),
};

const installment5InitialData = (date: string) => ({
  id: `tx-install-${date}`,
  date,
  seriesParentDate: "2026-01-01",
  description: "INSTALL5",
  amount: 100,
  amountCurrency: "GBP",
  categoryName: "Medicine",
  accountName: "SAMPLE BDO LONG ASS NAME",
  transactionType: "expense",
  type: CombinedTransactionTypeEnum.EXPENSE,
  scheduleType: ScheduleTypeEnum.INSTALLMENT,
  repeatInterval: "",
  installmentPeriod: 24,
  installmentTotal: 2400,
  file: null,
  hasCurrencyConversion: true,
  original_display_amount: 100,
  original_display_currency: "GBP",
  currencyConversion: {
    originalAmount: 100,
    originalCurrency: "GBP",
    convertedAmount: 10_000,
    convertedCurrency: "PHP",
    exchangeRate: 100,
    source: "manual",
  },
}) as UpdateTransactionType & {
  original_display_amount: number;
  original_display_currency: string;
};

const renderInstallmentExpenseForm = ({
  date,
  installmentUpdateScope,
  initialData,
  onSubmitSuccess = vi.fn(),
}: {
  date: string;
  installmentUpdateScope: (typeof UpdateScopeEnum)[keyof typeof UpdateScopeEnum];
  initialData?: Partial<ReturnType<typeof installment5InitialData>> & {
    currencyConversion?: UpdateTransactionType["currencyConversion"];
  };
  onSubmitSuccess?: ReturnType<typeof vi.fn>;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const base = installment5InitialData(date);

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider initialValues={[[accountOptionsAtom, phpOnlyAccounts]]}>
        <ExpenseForm
          id={`tx-install-${date}`}
          initialData={{
            ...base,
            ...initialData,
            currencyConversion: {
              ...base.currencyConversion,
              ...initialData?.currencyConversion,
            },
          }}
          date={new Date(`${date}T00:00:00`)}
          setDate={vi.fn()}
          spaceCurrency="PHP"
          isEditMode
          showInstallmentScopeSelector
          installmentUpdateScope={installmentUpdateScope}
          installmentSeriesContext={installment5SeriesContext}
          onSubmitSuccess={onSubmitSuccess}
          onCancel={vi.fn()}
        />
      </JotaiProvider>
    </QueryClientProvider>,
  );
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
    mockExpenseCategoryOptions.mockReturnValue([medicineCategory]);
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

describe("ExpenseForm installment edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpenseCategoryOptions.mockReturnValue([medicineCategory]);
  });

  it("shows total and monthly amounts for installment plans", async () => {
    renderExpenseForm({
      id: "tx-install",
      date: "2026-01-01",
      description: "INSTALL4",
      amount: 1000,
      amountCurrency: "GBP",
      categoryName: "Medicine",
      accountName: "SAMPLE BDO LONG ASS NAME",
      transactionType: "expense",
      type: CombinedTransactionTypeEnum.EXPENSE,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      repeatInterval: "",
      installmentPeriod: 24,
      installmentTotal: 24000,
      file: null,
    });

    expect(await screen.findByTestId("amount-picker-label")).toHaveTextContent(
      "Total amount",
    );
    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("24,000");
    expect(screen.getByLabelText("Monthly amount")).toHaveValue("1,000");
    expect(screen.getByText(/GBP per payment/)).toBeInTheDocument();
  });

  it("shows committed payments when editing an in-progress installment plan", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <JotaiProvider initialValues={[[accountOptionsAtom, phpOnlyAccounts]]}>
          <ExpenseForm
            id="tx-install"
            initialData={{
              id: "tx-install",
              date: "2026-01-01",
              description: "INSTALL4",
              amount: 1000,
              amountCurrency: "GBP",
              categoryName: "Medicine",
              accountName: "SAMPLE BDO LONG ASS NAME",
              transactionType: "expense",
              type: CombinedTransactionTypeEnum.EXPENSE,
              scheduleType: ScheduleTypeEnum.INSTALLMENT,
              repeatInterval: "",
              installmentPeriod: 24,
              installmentTotal: 24000,
              file: null,
            }}
            date={new Date("2026-01-01T00:00:00")}
            setDate={vi.fn()}
            spaceCurrency="PHP"
            isEditMode
            installmentSeriesContext={{
              paidSoFarCents: 800_000,
              committedMonthsCount: 8,
              calculatedDates: [],
              defaultPerPaymentCents: 100_000,
              occurrenceCentsByDate: {},
            }}
            onSubmitSuccess={vi.fn()}
            onCancel={vi.fn()}
          />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Already committed: 8 payments/)).toBeInTheDocument();
    expect(screen.getByText(/£8,000/)).toBeInTheDocument();
  });

  it("labels this-and-future edits as the last remaining payments", async () => {
    renderInstallmentExpenseForm({
      date: "2027-11-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_AND_FUTURE,
    });

    expect(
      await screen.findByText(/Monthly amount for the last 2 payments/),
    ).toBeInTheDocument();
    expect(screen.getByText(/only affects the last 2 payments/)).toBeInTheDocument();
    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("2,400");
    expect(screen.getByLabelText(/Monthly amount for the last 2 payments/)).toHaveValue(
      "100",
    );
  });

  it("labels a July this-and-future edit as the last 18 payments", async () => {
    renderInstallmentExpenseForm({
      date: "2026-07-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_AND_FUTURE,
    });

    expect(
      await screen.findByText(/Monthly amount for the last 18 payments/),
    ).toBeInTheDocument();
    expect(screen.getByText(/the last 18 payments of 24/)).toBeInTheDocument();
    expect(screen.getByTestId("installment-monthly-fx")).toHaveTextContent(
      "PHP",
    );
  });

  it("labels a 2nd-payment this-and-future edit as the last 23 payments", async () => {
    renderInstallmentExpenseForm({
      date: "2026-02-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_AND_FUTURE,
    });

    expect(
      await screen.findByText(/Monthly amount for the last 23 payments/),
    ).toBeInTheDocument();
    expect(screen.getByText(/the last 23 payments of 24/)).toBeInTheDocument();
  });

  it("shows plan total and this payment only for a single installment edit", async () => {
    renderInstallmentExpenseForm({
      date: "2026-07-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
    });

    expect(await screen.findByTestId("amount-picker-label")).toHaveTextContent(
      "Total amount",
    );
    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("2,400");
    expect(screen.getByLabelText("This payment only")).toHaveValue("100");
    expect(screen.getByTestId("edit-amount-converted")).toHaveTextContent(
      "240000",
    );
    expect(screen.getByTestId("installment-this-payment-converted")).toHaveTextContent(
      "10000",
    );
  });

  it("converts a PHP installmentTotal into GBP using the assigned rate (INSTALL7)", async () => {
    renderInstallmentExpenseForm({
      date: "2026-08-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
      initialData: {
        installmentTotal: 240_000,
        currencyConversion: {
          originalAmount: 100,
          originalCurrency: "GBP",
          convertedAmount: 10_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "recent",
        },
      },
    });

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent(
      "2,400",
    );
    expect(screen.getByTestId("edit-amount-value")).not.toHaveTextContent(
      "240,000",
    );
    expect(screen.getByTestId("edit-exchange-rate")).toHaveTextContent("100");
    expect(screen.getByLabelText("This payment only")).toHaveValue("100");
  });

  it("raises the plan total when this payment only increases", async () => {
    const user = userEvent.setup();

    renderInstallmentExpenseForm({
      date: "2026-07-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
    });

    const thisPayment = await screen.findByLabelText("This payment only");
    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("2,400");
    expect(screen.getByTestId("edit-amount-converted")).toHaveTextContent(
      "240000",
    );
    expect(screen.getByTestId("installment-this-payment-converted")).toHaveTextContent(
      "10000",
    );

    await user.clear(thisPayment);
    await user.type(thisPayment, "500");

    expect(thisPayment).toHaveValue("500");
    expect(screen.getByTestId("installment-this-payment-converted")).toHaveTextContent(
      "50000",
    );
    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("2,800");
    expect(screen.getByTestId("edit-amount-converted")).toHaveTextContent(
      "280000",
    );
  });

  it("puts a solo total bump of 2500→2600 onto that payment as 200 GBP / 20k PHP", async () => {
    const user = userEvent.setup();

    renderInstallmentExpenseForm({
      date: "2027-10-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
      initialData: {
        amount: 100,
        original_display_amount: 100,
        installmentTotal: 2500,
        currencyConversion: {
          originalAmount: 100,
          originalCurrency: "GBP",
          convertedAmount: 10_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "recent",
        },
      },
    });

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent("2,500");
    expect(screen.getByLabelText("This payment only")).toHaveValue("100");
    expect(screen.getByTestId("installment-this-payment-converted")).toHaveTextContent(
      "10000",
    );

    const totalInput = screen.getByLabelText("Total amount");
    await user.clear(totalInput);
    await user.type(totalInput, "2600");

    expect(screen.getByTestId("edit-amount-value")).toHaveTextContent("2,600");
    expect(screen.getByLabelText("This payment only")).toHaveValue("200");
    // Must keep the series rate (100), not an auto market rate (~83 → ~16.7k).
    expect(screen.getByTestId("installment-this-payment-converted")).toHaveTextContent(
      "20000",
    );
    expect(screen.getByTestId("edit-amount-converted")).toHaveTextContent("260000");
  });

  it("keeps the stored plan total when reopening a this-payment-only extra amount", async () => {
    renderInstallmentExpenseForm({
      date: "2027-11-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
      initialData: {
        amount: 200,
        original_display_amount: 200,
        installmentTotal: 2500,
        currencyConversion: {
          originalAmount: 200,
          originalCurrency: "GBP",
          convertedAmount: 20_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "manual",
        },
      },
    });

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent(
      "2,500",
    );
    expect(screen.getByLabelText("This payment only")).toHaveValue("200");
    expect(screen.getByTestId("edit-amount-converted")).toHaveTextContent(
      "250000",
    );
    expect(
      screen.getByTestId("installment-this-payment-converted"),
    ).toHaveTextContent("20000");
  });

  it("shows the series plan total for an unchanged payment after a this-only bump", async () => {
    renderInstallmentExpenseForm({
      date: "2027-12-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
      initialData: {
        amount: 100,
        original_display_amount: 100,
        installmentTotal: 250_000,
        currencyConversion: {
          originalAmount: 100,
          originalCurrency: "GBP",
          convertedAmount: 10_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "manual",
        },
      },
    });

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent(
      "2,500",
    );
    expect(screen.getByLabelText("This payment only")).toHaveValue("100");
  });

  it("converts a PHP plan total into GBP for this-payment-only reopen", async () => {
    renderInstallmentExpenseForm({
      date: "2027-11-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
      initialData: {
        amount: 200,
        original_display_amount: 200,
        installmentTotal: 250_000,
        currencyConversion: {
          originalAmount: 200,
          originalCurrency: "GBP",
          convertedAmount: 20_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "manual",
        },
      },
    });

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent(
      "2,500",
    );
    expect(screen.getByLabelText("This payment only")).toHaveValue("200");
  });

  it("applies the total amount rate to this payment only", async () => {
    const user = userEvent.setup();

    renderInstallmentExpenseForm({
      date: "2027-10-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_ONLY,
      initialData: {
        amount: 200,
        original_display_amount: 200,
        installmentTotal: 2_700,
        currencyConversion: {
          originalAmount: 200,
          originalCurrency: "GBP",
          convertedAmount: 69_100,
          convertedCurrency: "PHP",
          exchangeRate: 345.5,
          source: "manual",
        },
      },
    });

    expect(
      await screen.findByTestId("installment-this-payment-converted"),
    ).toHaveTextContent("69100");

    await user.click(screen.getByTestId("edit-amount-apply-recent-rate"));

    expect(screen.getByTestId("edit-amount-converted")).toHaveTextContent(
      "270000",
    );
    expect(
      screen.getByTestId("installment-this-payment-converted"),
    ).toHaveTextContent("20000");
    expect(screen.getByTestId("edit-exchange-rate")).toHaveTextContent("100");
  });

  it("applies the total amount rate to the monthly remaining payment", async () => {
    const user = userEvent.setup();

    renderInstallmentExpenseForm({
      date: "2027-10-01",
      installmentUpdateScope: UpdateScopeEnum.THIS_AND_FUTURE,
      initialData: {
        amount: 200,
        original_display_amount: 200,
        installmentTotal: 2_700,
        currencyConversion: {
          originalAmount: 200,
          originalCurrency: "GBP",
          convertedAmount: 69_100,
          convertedCurrency: "PHP",
          exchangeRate: 345.5,
          source: "manual",
        },
      },
    });

    expect(await screen.findByTestId("installment-monthly-fx")).toHaveTextContent(
      "69,100.000",
    );

    await user.click(screen.getByTestId("edit-amount-apply-recent-rate"));

    expect(screen.getByTestId("installment-monthly-fx")).toHaveTextContent(
      "20,000.000",
    );
  });

  it("restores 2500 GBP plan total when stored installment total is stale at 2401", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const occurrenceCentsByDate = Object.fromEntries(
      Array.from({ length: 24 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 7 + index, 22));
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-22`;
        return [key, key === "2028-06-22" ? 20_000 : 10_000] as const;
      }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <ExpenseForm
          id="tx-install8-jun"
          initialData={{
            id: "tx-install8-jun",
            date: "2028-06-22",
            seriesParentDate: "2026-08-22",
            description: "INSTALL8",
            amount: 200,
            amountCurrency: "PHP",
            categoryName: "Home",
            accountName: "SAMPLE BDO LONG ASS NAME",
            transactionType: "expense",
            type: CombinedTransactionTypeEnum.EXPENSE,
            scheduleType: ScheduleTypeEnum.INSTALLMENT,
            repeatInterval: "",
            installmentPeriod: 24,
            installmentTotal: 240_100,
            file: null,
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
          }}
          date={new Date("2028-06-22T00:00:00")}
          setDate={vi.fn()}
          spaceCurrency="PHP"
          isEditMode
          showInstallmentScopeSelector
          installmentUpdateScope={UpdateScopeEnum.THIS_ONLY}
          installmentSeriesContext={{
            paidSoFarCents: 10_000,
            committedMonthsCount: 1,
            calculatedDates: ["2026-08-22"],
            defaultPerPaymentCents: 10_000,
            occurrenceCentsByDate,
          }}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent(
      "2,500",
    );
    expect(screen.getByLabelText("This payment only")).toHaveValue("200");
  });

  it("restores the plan total when switching from this payment only to this and future", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const formProps = {
      id: "tx-install-switch",
      initialData: {
        id: "tx-install-switch",
        date: "2027-11-01",
        seriesParentDate: "2026-01-01",
        description: "INSTALL5",
        amount: 100,
        amountCurrency: "GBP",
        categoryName: "Medicine",
        accountName: "SAMPLE BDO LONG ASS NAME",
        transactionType: "expense",
        type: CombinedTransactionTypeEnum.EXPENSE,
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
        repeatInterval: "",
        installmentPeriod: 24,
        installmentTotal: 2400,
        file: null,
      },
      date: new Date("2027-11-01T00:00:00"),
      setDate: vi.fn(),
      spaceCurrency: "PHP",
      isEditMode: true,
      showInstallmentScopeSelector: true,
      installmentSeriesContext: {
        paidSoFarCents: 80_000,
        committedMonthsCount: 8,
        calculatedDates: [
          "2026-01-01",
          "2026-02-01",
          "2026-03-01",
          "2026-04-01",
          "2026-05-01",
          "2026-06-01",
          "2026-07-01",
          "2026-08-01",
        ],
        defaultPerPaymentCents: 10_000,
        occurrenceCentsByDate: installment5SeriesContext.occurrenceCentsByDate,
      },
      onSubmitSuccess: vi.fn(),
      onCancel: vi.fn(),
    } as const;

    const view = render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider initialValues={[[accountOptionsAtom, phpOnlyAccounts]]}>
          <ExpenseForm
            {...formProps}
            installmentUpdateScope={UpdateScopeEnum.THIS_ONLY}
          />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent("2,400");
    expect(screen.getByLabelText("This payment only")).toHaveValue("100");

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider initialValues={[[accountOptionsAtom, phpOnlyAccounts]]}>
          <ExpenseForm
            {...formProps}
            installmentUpdateScope={UpdateScopeEnum.THIS_AND_FUTURE}
          />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent("2,400");
    expect(screen.getByLabelText(/Monthly amount for the last 2 payments/)).toHaveValue(
      "100",
    );
  });

  it("shows 200 for the last 2 payments when releasing a this-only bump into a 2600 total", async () => {
    const user = userEvent.setup();
    const occurrenceCentsByDate = {
      ...installment5SeriesContext.occurrenceCentsByDate,
      "2027-11-01": 20_000,
    };

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <JotaiProvider initialValues={[[accountOptionsAtom, phpOnlyAccounts]]}>
          <ExpenseForm
            id="tx-install-nov-200"
            initialData={{
              ...installment5InitialData("2027-11-01"),
              amount: 200,
              installmentTotal: 2500,
              original_display_amount: 200,
              currencyConversion: {
                originalAmount: 200,
                originalCurrency: "GBP",
                convertedAmount: 20_000,
                convertedCurrency: "PHP",
                exchangeRate: 100,
                source: "manual",
              },
            }}
            date={new Date("2027-11-01T00:00:00")}
            setDate={vi.fn()}
            spaceCurrency="PHP"
            isEditMode
            showInstallmentScopeSelector
            installmentUpdateScope={UpdateScopeEnum.THIS_AND_FUTURE}
            installmentSeriesContext={{
              ...installment5SeriesContext,
              occurrenceCentsByDate,
              defaultPerPaymentCents: 10_000,
            }}
            onSubmitSuccess={vi.fn()}
            onCancel={vi.fn()}
          />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent("2,500");
    // Locked earlier months at 100 → remaining 300 across last 2 = 150 before the bump to 2600.
    expect(screen.getByLabelText(/Monthly amount for the last 2 payments/)).toHaveValue(
      "150",
    );

    const amountInput = screen.getByLabelText("Total amount");
    await user.clear(amountInput);
    await user.type(amountInput, "2600");

    expect(await screen.findByTestId("edit-amount-value")).toHaveTextContent("2,600");
    expect(screen.getByLabelText(/Monthly amount for the last 2 payments/)).toHaveValue(
      "200",
    );
  });

  it("enables Update Expense after choosing an installment change scope", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const formProps = {
      id: "tx-install-scope",
      initialData: installment5InitialData("2027-12-01"),
      date: new Date("2027-12-01T00:00:00"),
      setDate: vi.fn(),
      spaceCurrency: "PHP",
      isEditMode: true as const,
      showInstallmentScopeSelector: true,
      installmentSeriesContext: installment5SeriesContext,
      onSubmitSuccess: vi.fn(),
      onCancel: vi.fn(),
    };

    const Harness = () => {
      const [scope, setScope] = useState(UpdateScopeEnum.THIS_ONLY);

      return (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider initialValues={[[accountOptionsAtom, phpOnlyAccounts]]}>
            <ExpenseForm
              {...formProps}
              installmentUpdateScope={scope}
              onInstallmentUpdateScopeChange={setScope}
            />
          </JotaiProvider>
        </QueryClientProvider>
      );
    };

    render(<Harness />);

    const updateButton = await screen.findByRole("button", { name: "Update Expense" });
    expect(updateButton).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /All payments in the plan/ }));

    expect(screen.getByRole("button", { name: "Update Expense" })).toBeEnabled();

    await user.click(screen.getByRole("radio", { name: /This and future payments/ }));

    expect(screen.getByRole("button", { name: "Update Expense" })).toBeEnabled();

    await user.click(screen.getByRole("radio", { name: /This installment payment only/ }));

    expect(screen.getByRole("button", { name: "Update Expense" })).toBeDisabled();
  });

  it("submits the picker rate of 100 instead of a leftover derived 195.313", async () => {
    const user = userEvent.setup();
    const onSubmitSuccess = vi.fn();

    renderInstallmentExpenseForm({
      date: "2026-08-01",
      installmentUpdateScope: UpdateScopeEnum.ALL_IN_SERIES,
      onSubmitSuccess,
      initialData: {
        amount: 64,
        original_display_amount: 64,
        installmentTotal: 3000,
        currencyConversion: {
          originalAmount: 64,
          originalCurrency: "GBP",
          convertedAmount: 12_500,
          convertedCurrency: "PHP",
          exchangeRate: 195.313,
          source: "manual",
        },
      },
    });

    await user.click(await screen.findByTestId("edit-amount-apply-recent-rate"));
    await user.click(screen.getByRole("button", { name: "Update Expense" }));

    expect(onSubmitSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        exchange_rate: 100,
        original_currency: "GBP",
      }),
    );
    expect(onSubmitSuccess).not.toHaveBeenCalledWith(
      expect.objectContaining({
        exchange_rate: 195.313,
      }),
    );
  });
});

describe("ExpenseForm category options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpenseCategoryOptions.mockReturnValue([
      {
        id: "cat-church",
        label: "Church",
        value: "cat-church",
        name: "Church",
        parentId: null,
      },
    ]);
  });

  it("uses the transaction categories list, not dashboard shell atoms", () => {
    renderExpenseForm({
      ...gbpConvertedExpense,
      categoryName: "Church",
    });

    expect(screen.getByTestId("Expense Category-options")).toHaveTextContent(
      "Church",
    );
    expect(
      screen.getByTestId("Expense Category-options"),
    ).not.toHaveTextContent("Medicine");
  });
});
