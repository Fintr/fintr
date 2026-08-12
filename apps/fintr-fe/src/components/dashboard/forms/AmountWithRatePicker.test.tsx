import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AmountWithRatePicker } from "./AmountWithRatePicker";
import { resolveAutoExchangeRates } from "@/services/exchangeRates/resolve-auto-rates";
import { getCurrentRate, getRecentRates } from "@/services/exchangeRates/queries";

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/services/exchangeRates/queries", () => ({
  getCurrentRate: vi.fn(),
  getRecentRates: vi.fn(),
}));

vi.mock("@/services/exchangeRates/resolve-auto-rates", () => ({
  resolveAutoExchangeRates: vi.fn(),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-a", vi.fn()],
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("@/components/ui/calculator-input", () => ({
  CalculatorInput: ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (value: string) => void;
    id: string;
  }) => (
    <input
      id={id}
      data-testid="amount-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/rolling-number", () => ({
  RollingNumber: ({ value }: { value: string }) => <span>{value}</span>,
}));

const mockedResolveAutoExchangeRates = vi.mocked(resolveAutoExchangeRates);
const mockedGetCurrentRate = vi.mocked(getCurrentRate);
const mockedGetRecentRates = vi.mocked(getRecentRates);

const defaultProps = {
  id: "amount",
  label: "Amount",
  amountDisplayValue: "100",
  onAmountChange: vi.fn(),
  fromCurrency: "GBP",
  onFromCurrencyChange: vi.fn(),
  amountCurrencyOptions: ["GBP", "PHP", "USD"],
  accountOptions: [],
  onConversionChange: vi.fn(),
  date: "2026-06-27",
};

const rateForPair = (fromCurrency: string, toCurrency: string): number => {
  if (fromCurrency === "GBP" && toCurrency === "PHP") return 80.886;
  if (fromCurrency === "GBP" && toCurrency === "USD") return 1.27;
  if (fromCurrency === "VND" && toCurrency === "PHP") return 0.00233;
  if (fromCurrency === "USD" && toCurrency === "PHP") return 58;
  return 1;
};

const resolved = (overrides: {
  fromCurrency: string;
  toCurrency: string;
  appliedRate?: number;
  appliedSource?: "auto" | "recent";
  date?: string;
}) => {
  const appliedRate =
    overrides.appliedRate ??
    rateForPair(overrides.fromCurrency, overrides.toCurrency);

  return {
    fromLocal: false,
    current: {
      rate: appliedRate,
      from_currency: overrides.fromCurrency,
      to_currency: overrides.toCurrency,
      source: "api",
    },
    recent: {
      rates: [{ rate: appliedRate, usedAt: "2026-06-27T00:00:00.000Z" }],
      source: "recent",
    },
    appliedRate,
    appliedSource: overrides.appliedSource ?? ("auto" as const),
    displayedRateDate: overrides.date ?? "2026-06-27",
  };
};

const previewHasText = (pattern: RegExp) => {
  const preview = document.querySelector(".border-l-2");
  expect(preview).toBeTruthy();
  expect(within(preview as HTMLElement).getByText(pattern)).toBeTruthy();
};

describe("AmountWithRatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolveAutoExchangeRates.mockImplementation(async (params) =>
      resolved({
        fromCurrency: params.fromCurrency,
        toCurrency: params.toCurrency,
        appliedSource: "auto",
        date: params.date,
      }),
    );
    // Manual "Use today's rate" still goes through getCurrentRate.
    mockedGetCurrentRate.mockResolvedValue({
      rate: 1.27,
      from_currency: "GBP",
      to_currency: "USD",
      source: "api",
    });
    mockedGetRecentRates.mockResolvedValue({
      source: "recent",
      rates: [{ rate: 82.5, usedAt: "2026-07-01T10:00:00.000Z" }],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("resolves rates through the exchangeRates service when the target leg changes", async () => {
    const onConversionChange = vi.fn();

    const { rerender } = render(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="PHP"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedResolveAutoExchangeRates).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCurrency: "GBP",
          toCurrency: "PHP",
          date: "2026-06-27",
          spaceId: "space-a",
        }),
      );
    });

    onConversionChange.mockClear();

    rerender(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="USD"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedResolveAutoExchangeRates).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCurrency: "GBP",
          toCurrency: "USD",
          date: "2026-06-27",
        }),
      );
    });

    await waitFor(() => {
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          originalCurrency: "GBP",
          targetCurrency: "USD",
          exchangeRate: 1.27,
          exchangeRateSource: "auto",
        }),
      );
    });

    expect(screen.getByText(/→ USD/)).toBeInTheDocument();
    expect(screen.getByText("127.000")).toBeInTheDocument();
    expect(screen.queryByText(/8,088/)).not.toBeInTheDocument();
  });

  it("re-resolves through the service when the date changes on a stable pair", async () => {
    const onConversionChange = vi.fn();

    mockedResolveAutoExchangeRates.mockImplementation(async (params) =>
      resolved({
        fromCurrency: params.fromCurrency,
        toCurrency: params.toCurrency,
        appliedRate: params.date === "2026-06-28" ? 1.28 : 1.27,
        appliedSource: params.date === "2026-06-28" ? "recent" : "auto",
        date: params.date,
      }),
    );

    const { rerender } = render(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="USD"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1.27,
          exchangeRateSource: "auto",
        }),
      );
    });

    onConversionChange.mockClear();

    rerender(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="USD"
        date="2026-06-28"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedResolveAutoExchangeRates).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCurrency: "GBP",
          toCurrency: "USD",
          date: "2026-06-28",
        }),
      );
    });

    await waitFor(() => {
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1.28,
          exchangeRateSource: "recent",
        }),
      );
    });
  });

  it("updates the human quote when amount currency changes from VND to USD", async () => {
    const onConversionChange = vi.fn();

    const { rerender } = render(
      <AmountWithRatePicker
        {...defaultProps}
        fromCurrency="VND"
        toCurrency="PHP"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          originalCurrency: "VND",
          targetCurrency: "PHP",
          exchangeRate: 0.00233,
        }),
      );
    });

    await waitFor(() => {
      previewHasText(/VND per 1 PHP/);
    });

    onConversionChange.mockClear();

    rerender(
      <AmountWithRatePicker
        {...defaultProps}
        fromCurrency="USD"
        toCurrency="PHP"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedResolveAutoExchangeRates).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCurrency: "USD",
          toCurrency: "PHP",
          date: "2026-06-27",
        }),
      );
    });

    await waitFor(() => {
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          originalCurrency: "USD",
          targetCurrency: "PHP",
          exchangeRate: 58,
        }),
      );
    });

    await waitFor(() => {
      previewHasText(/PHP per 1 USD/);
    });
    expect(
      within(document.querySelector(".border-l-2") as HTMLElement).queryByText(
        /VND per 1 PHP/,
      ),
    ).not.toBeInTheDocument();
  });

  it("applies a manual exchange rate from the rate picker", async () => {
    const user = userEvent.setup();
    const onConversionChange = vi.fn();

    mockedGetCurrentRate.mockResolvedValue({
      rate: 76.4,
      from_currency: "GBP",
      to_currency: "PHP",
      source: "api",
    });

    render(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="PHP"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedResolveAutoExchangeRates).toHaveBeenCalled();
    });

    onConversionChange.mockClear();

    await user.click(
      screen.getByRole("button", { name: /exchange rate options/i }),
    );

    const manualInput = await screen.findByLabelText(/manual exchange rate/i);
    await user.clear(manualInput);
    await user.type(manualInput, "80");
    await user.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() => {
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          originalCurrency: "GBP",
          targetCurrency: "PHP",
          exchangeRateSource: "manual",
        }),
      );
    });
  });
});
