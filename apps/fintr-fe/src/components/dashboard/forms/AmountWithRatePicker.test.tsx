import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AmountWithRatePicker } from "./AmountWithRatePicker";
import {
  getCurrentRate,
  getRecentRates,
} from "@/services/exchangeRates/queries";

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/services/exchangeRates/queries", () => ({
  getCurrentRate: vi.fn(),
  getRecentRates: vi.fn(),
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

describe("AmountWithRatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentRate.mockResolvedValue({
      rate: 1.27,
      from_currency: "GBP",
      to_currency: "USD",
      source: "api",
    });
    mockedGetRecentRates.mockResolvedValue({
      rates: [{ rate: 80.886, usedAt: "2026-06-27T00:00:00.000Z" }],
      source: "recent",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("fetches the live rate when the target leg changes to the USD account", async () => {
    const onConversionChange = vi.fn();

    const { rerender } = render(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="PHP"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedGetCurrentRate).toHaveBeenCalledWith(
        {},
        "GBP",
        "PHP",
        "2026-06-27",
      );
    });

    onConversionChange.mockClear();
    mockedGetCurrentRate.mockResolvedValue({
      rate: 1.27,
      from_currency: "GBP",
      to_currency: "USD",
      source: "api",
    });

    rerender(
      <AmountWithRatePicker
        {...defaultProps}
        toCurrency="USD"
        onConversionChange={onConversionChange}
      />,
    );

    await waitFor(() => {
      expect(mockedGetCurrentRate).toHaveBeenCalledWith(
        {},
        "GBP",
        "USD",
        "2026-06-27",
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

  it("uses a recent rate when it matches the live quote on a stable pair", async () => {
    const onConversionChange = vi.fn();

    mockedGetRecentRates.mockResolvedValue({
      rates: [{ rate: 1.28, usedAt: "2026-06-27T00:00:00.000Z" }],
      source: "recent",
    });
    mockedGetCurrentRate.mockResolvedValue({
      rate: 1.27,
      from_currency: "GBP",
      to_currency: "USD",
      source: "api",
    });

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
      expect(onConversionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeRate: 1.28,
          exchangeRateSource: "recent",
        }),
      );
    });
  });
});
