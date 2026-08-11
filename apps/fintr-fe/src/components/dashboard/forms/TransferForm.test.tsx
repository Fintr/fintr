import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import type { UpdateTransferType } from "@/services/transactions/transfers/mutation";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import TransferForm from "./TransferForm";

const mockResolveAutoExchangeRates = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-a", vi.fn()],
}));

vi.mock("@/services/exchangeRates/resolve-auto-rates", () => ({
  resolveAutoExchangeRates: (...args: unknown[]) =>
    mockResolveAutoExchangeRates(...args),
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

vi.mock("@/components/ui/calculator-input", () => ({
  CalculatorInput: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      id={id}
      aria-label={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("./GridPicker", () => ({
  default: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select account</option>
        <option value="Cash">Cash</option>
        <option value="BDO">BDO</option>
        <option value="Gotrade">Gotrade</option>
        <option value="Binance">Binance</option>
      </select>
    </label>
  ),
}));

vi.mock("./FileUploadField", () => ({
  default: () => null,
}));

vi.mock("./TransactionScheduleFields", () => ({
  default: () => null,
}));

vi.mock("./StickyFormActions", () => ({
  StickyFormActions: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  pinnedFormScrollAreaClassName: "",
}));

vi.mock("./AmountWithRatePicker", () => ({
  AmountWithRatePicker: ({
    onConversionChange,
  }: {
    onConversionChange: (conversion: {
      originalCurrency: string;
      targetCurrency: string;
      exchangeRate: number;
      exchangeRateSource: "auto";
    } | null) => void;
  }) => {
    return (
      <button
        type="button"
        onClick={() =>
          onConversionChange({
            originalCurrency: "PHP",
            targetCurrency: "USD",
            exchangeRate: 0.0172,
            exchangeRateSource: "auto",
          })
        }
      >
        Apply FX rate
      </button>
    );
  },
}));

const accountOptions = [
  {
    label: "Cash",
    value: "Cash",
    currency: "PHP",
    balance: "1000",
    accountCategory: "cash",
  },
  {
    label: "Gotrade",
    value: "Gotrade",
    currency: "USD",
    balance: "100",
    accountCategory: "investment",
  },
  {
    label: "Binance",
    value: "Binance",
    currency: "USD",
    balance: "200",
    accountCategory: "investment",
  },
  {
    label: "BDO",
    value: "BDO",
    currency: "PHP",
    balance: "500",
    accountCategory: "credit_card",
  },
];

const baseInitialData: UpdateTransferType = {
  id: "transfer-1",
  amount: 100,
  transactionCost: 0,
  fromAccountName: "Cash",
  toAccountName: "Gotrade",
  description: "Move funds",
  date: "2026-08-09",
  scheduleType: ScheduleTypeEnum.ONE_TIME,
};

const renderTransferForm = (
  initialData: UpdateTransferType,
  onSubmitSuccess = vi.fn().mockResolvedValue(undefined),
) => {
  const date = new Date("2026-08-09T00:00:00");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider initialValues={[[accountOptionsAtom, accountOptions]]}>
        <TransferForm
          id={initialData.id}
          initialData={initialData}
          date={date}
          setDate={vi.fn()}
          spaceCurrency="PHP"
          isEditMode
          onSubmitSuccess={onSubmitSuccess}
          onCancel={vi.fn()}
        />
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

const renderTransferFormTree = (
  initialData: UpdateTransferType,
  onSubmitSuccess = vi.fn().mockResolvedValue(undefined),
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider initialValues={[[accountOptionsAtom, accountOptions]]}>
        <TransferForm
          id={initialData.id}
          initialData={initialData}
          date={new Date("2026-08-09T00:00:00")}
          setDate={vi.fn()}
          spaceCurrency="PHP"
          isEditMode
          onSubmitSuccess={onSubmitSuccess}
          onCancel={vi.fn()}
        />
      </JotaiProvider>
    </QueryClientProvider>
  );
};

describe("TransferForm edit mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAutoExchangeRates.mockResolvedValue({
      appliedRate: 0.0172,
      appliedSource: "auto",
    });
  });

  it("keeps a changed to account when initialData object reference changes but seed is unchanged", async () => {
  const user = userEvent.setup();
  const { rerender } = renderTransferForm(baseInitialData);

  await user.selectOptions(screen.getByLabelText("To Account"), "Binance");
  expect(screen.getByLabelText("To Account")).toHaveValue("Binance");

  rerender(renderTransferFormTree({ ...baseInitialData }));

  expect(screen.getByLabelText("To Account")).toHaveValue("Binance");
  });

  it("submits the updated destination account in edit mode", async () => {
    const user = userEvent.setup();
    const onSubmitSuccess = vi.fn().mockResolvedValue(undefined);

    renderTransferForm(baseInitialData, onSubmitSuccess);

    await user.selectOptions(screen.getByLabelText("To Account"), "BDO");
    await user.click(screen.getByRole("button", { name: "Update Transfer" }));

    await waitFor(() => {
      expect(onSubmitSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "transfer-1",
        fromAccountName: "Cash",
        toAccountName: "BDO",
      }),
    );
  });

  it("does not send exchange rate when the destination account shares the from account currency", async () => {
    const user = userEvent.setup();
    const onSubmitSuccess = vi.fn().mockResolvedValue(undefined);

    renderTransferForm(baseInitialData, onSubmitSuccess);

    await user.selectOptions(screen.getByLabelText("To Account"), "BDO");
    await user.click(screen.getByRole("button", { name: "Update Transfer" }));

    await waitFor(() => {
      expect(onSubmitSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          toAccountName: "BDO",
        }),
      );
      expect(onSubmitSuccess).toHaveBeenCalledWith(
        expect.not.objectContaining({
          exchange_rate: expect.anything(),
        }),
      );
    });
  });
});
