"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, Loader2, Check } from "lucide-react";
import { FormError } from "@/components/ui/form-error";
import { RollingNumber } from "@/components/ui/rolling-number";
import { formatAmountWithCode, formatWithDelimiters, numberFormatting } from "@/lib/utils";
import {
  getCurrentRate,
  getRecentRates,
  type RecentRateItem,
} from "@/services/exchangeRates/queries";
import { useAuthApi } from "@/hooks/useAuthApi";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import {
  CURRENCIES,
  getCountryCodeForCurrency,
  getFlagEmoji,
} from "@/data/currencies";

const RATE_DISPLAY_DECIMALS = 3;
const FLAG_NAME_GAP = "\u2002\u2002";

function formatRateForLabel(dateStr: string | undefined): string {
  if (!dateStr) return "Today's rate (API)";
  const d = new Date(dateStr);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) return "Today's rate (API)";
  return `Rate for ${d.toLocaleDateString()} (API)`;
}

export interface ConversionSnapshot {
  originalCurrency: string;
  exchangeRate: number;
  exchangeRateSource: "auto" | "manual" | "recent";
}

interface AmountWithRatePickerProps {
  id: string;
  label: string;
  amountDisplayValue: string;
  onAmountChange: (value: string) => void;
  fromCurrency: string;
  onFromCurrencyChange: (code: string) => void;
  toCurrency: string;
  amountCurrencyOptions: string[];
  accountOptions: AccountOptionWithCurrency[];
  errors?: string[];
  placeholder?: string;
  inputClassName?: string;
  hideRatePicker?: boolean;
  /** When true, from currency is read-only (e.g. determined by from-account in transfers). */
  lockFromCurrency?: boolean;
  onConversionChange: (conversion: ConversionSnapshot | null) => void;
  /** Transaction date for "current" rate (yyyy-MM-dd). */
  date?: string;
  /** When provided (e.g. edit mode), use this rate instead of fetching a default; prevents overwriting parent's conversion. */
  initialConversion?: ConversionSnapshot | null;
}

export function AmountWithRatePicker({
  id,
  label,
  amountDisplayValue,
  onAmountChange,
  fromCurrency,
  onFromCurrencyChange,
  toCurrency,
  amountCurrencyOptions,
  accountOptions,
  errors = [],
  placeholder = "0.00",
  inputClassName = "",
  hideRatePicker = false,
  lockFromCurrency = false,
  onConversionChange,
  date,
  initialConversion,
}: AmountWithRatePickerProps) {
  const { api } = useAuthApi();
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false);
  const [currencySearchQuery, setCurrencySearchQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [manualRate, setManualRate] = useState("");
  const [loadingRate, setLoadingRate] = useState<"currency" | "current" | null>(null);
  const [currentRateDisplay, setCurrentRateDisplay] = useState<number | null>(null);
  const [displayedRateDate, setDisplayedRateDate] = useState<string | undefined>(undefined);
  const [recentRates, setRecentRates] = useState<RecentRateItem[]>([]);
  const ratePopoverContentRef = useRef<HTMLDivElement>(null);
  const [conversion, setConversion] = useState<{
    exchangeRate: number;
    exchangeRateSource: "auto" | "manual" | "recent";
  } | null>(() =>
    initialConversion
      ? { exchangeRate: initialConversion.exchangeRate, exchangeRateSource: initialConversion.exchangeRateSource }
      : null
  );

  const RATE_TOLERANCE = 1e-6;
  const ratesMatch = (a: number, b: number) => Math.abs(a - b) < RATE_TOLERANCE;
  const isTodayRateApplied =
    conversion?.exchangeRateSource === "auto" &&
    currentRateDisplay != null &&
    ratesMatch(conversion.exchangeRate, currentRateDisplay);
  const isManualRateApplied = conversion?.exchangeRateSource === "manual";
  const isRecentRateApplied = (rate: number) =>
    conversion?.exchangeRateSource === "recent" && ratesMatch(conversion.exchangeRate, rate);

  const amountNumeric = numberFormatting.cleanForBackend(amountDisplayValue);
  const needsConversion = fromCurrency !== toCurrency;
  const convertedAmount =
    needsConversion && conversion && amountNumeric > 0
      ? amountNumeric * conversion.exchangeRate
      : 0;

  const filteredCurrencies = React.useMemo(() => {
    const q = currencySearchQuery.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [currencySearchQuery]);

  const handleCurrencyPopoverOpenChange = useCallback(
    (open: boolean) => {
      setCurrencyPopoverOpen(open);
      if (!open) setCurrencySearchQuery("");
    },
    []
  );

  const handleSelectAmountCurrency = useCallback(
    (code: string) => {
      onFromCurrencyChange(code);
      setCurrencyPopoverOpen(false);
      if (code === toCurrency) {
        setConversion(null);
        onConversionChange(null);
      } else {
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
        setRecentRates([]);
      }
    },
    [onFromCurrencyChange, toCurrency, onConversionChange]
  );

  const handleOpenPopover = useCallback(
    (open: boolean) => {
      if (!open) {
        setPopoverOpen(false);
        return;
      }
      setPopoverOpen(true);
      if (!needsConversion) return;
      setLoadingRate("current");
      const todayStr = new Date().toISOString().slice(0, 10);
      Promise.all([
        getCurrentRate(api, fromCurrency, toCurrency, todayStr),
        getRecentRates(api, fromCurrency, toCurrency),
      ])
        .then(([current, recent]) => {
          setCurrentRateDisplay(Number(current.rate));
          setDisplayedRateDate(todayStr);
          setRecentRates(recent.rates ?? []);
        })
        .catch(() => {
          setCurrentRateDisplay(null);
          setDisplayedRateDate(undefined);
          setRecentRates([]);
        })
        .finally(() => setLoadingRate(null));
    },
    [api, fromCurrency, toCurrency, needsConversion]
  );

  const applyConversion = useCallback(
    (rate: number, source: "auto" | "manual" | "recent") => {
      const snapshot: ConversionSnapshot = {
        originalCurrency: fromCurrency,
        exchangeRate: rate,
        exchangeRateSource: source,
      };
      setConversion({ exchangeRate: rate, exchangeRateSource: source });
      onConversionChange(snapshot);
    },
    [fromCurrency, onConversionChange]
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleUseTodaysRate = useCallback(() => {
    setLoadingRate("current");
    getCurrentRate(api, fromCurrency, toCurrency, todayStr)
      .then((r) => {
        const rate = Number(r.rate);
        setCurrentRateDisplay(rate);
        setDisplayedRateDate(todayStr);
        applyConversion(rate, "auto");
        setPopoverOpen(false);
      })
      .catch(() => {
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
      })
      .finally(() => setLoadingRate(null));
  }, [api, fromCurrency, toCurrency, applyConversion]);

  const handleUseRecentRate = useCallback(
    (rate: number) => {
      applyConversion(Number(rate), "recent");
    },
    [applyConversion]
  );

  const handleUseManualRate = useCallback(() => {
    const parsed = numberFormatting.cleanForBackend(manualRate);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    applyConversion(parsed, "manual");
  }, [manualRate, applyConversion]);

  // When parent provides initial conversion (e.g. edit mode), use it and do not overwrite
  useEffect(() => {
    if (!needsConversion) {
      setConversion(null);
      onConversionChange(null);
      return;
    }
    if (initialConversion) {
      setConversion({
        exchangeRate: initialConversion.exchangeRate,
        exchangeRateSource: initialConversion.exchangeRateSource,
      });
      return;
    }
    // Create mode: default to most recent rate used, else today's rate
    setLoadingRate("currency");
    const todayStr = new Date().toISOString().slice(0, 10);
    Promise.all([
      getRecentRates(api, fromCurrency, toCurrency),
      getCurrentRate(api, fromCurrency, toCurrency, todayStr),
    ])
      .then(([recent, current]) => {
        const rates = recent.rates ?? [];
        if (rates.length > 0) {
          const mostRecent = rates[0];
          const rate = Number(mostRecent.rate);
          setCurrentRateDisplay(rate);
          setDisplayedRateDate(
            mostRecent.usedAt ?? (mostRecent as { timestamp?: string }).timestamp ?? todayStr
          );
          setRecentRates(rates);
          applyConversion(rate, "recent");
        } else {
          const rate = Number(current.rate);
          setCurrentRateDisplay(rate);
          setDisplayedRateDate(todayStr);
          applyConversion(rate, "auto");
        }
      })
      .catch(() => {
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
        setRecentRates([]);
      })
      .finally(() => setLoadingRate(null));
  }, [fromCurrency, toCurrency, needsConversion, api, applyConversion, initialConversion]);

  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {/* Row 1: [Currency] [Amount] [Rates]. Row 2 (when conversion): aligned with amount "→ PHP ###" and "(rate: ...)". */}
      <div className="grid gap-x-2 gap-y-2 w-full min-w-0" style={{ gridTemplateColumns: "auto 1fr auto" }}>
        {/* Currency on the left: locked label or search + list */}
        <div className="flex flex-nowrap items-center shrink-0">
          {lockFromCurrency ? (
            <span
              className="inline-flex h-9 items-center rounded-md border border-input bg-muted/50 px-2 text-xs font-medium text-muted-foreground"
              aria-label="Amount currency (from account)"
            >
              {fromCurrency}
            </span>
          ) : (
            <Popover
              open={currencyPopoverOpen}
              onOpenChange={handleCurrencyPopoverOpenChange}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs font-medium h-9 px-2"
                  aria-label="Amount currency"
                >
                  {fromCurrency}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Input
                  type="text"
                  placeholder="Search by name or code..."
                  value={currencySearchQuery}
                  onChange={(e) => setCurrencySearchQuery(e.target.value)}
                  className="rounded-b-none border-x-0 border-t-0 border-b border-border bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="off"
                />
                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredCurrencies.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No currencies match
                    </p>
                  ) : (
                    filteredCurrencies.map(({ code, name }) => {
                      const flag = getFlagEmoji(getCountryCodeForCurrency(code));
                      const label = flag
                        ? `${flag}${FLAG_NAME_GAP}${name} (${code})`
                        : `${name} (${code})`;
                      return (
                        <Button
                          key={code}
                          type="button"
                          variant={fromCurrency === code ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-left font-normal"
                          onClick={() => handleSelectAmountCurrency(code)}
                        >
                          {label}
                        </Button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="min-w-0 flex items-center">
          <CalculatorInput
            id={id}
            name={id}
            value={amountDisplayValue}
            onChange={onAmountChange}
            placeholder={placeholder}
            className={`w-full min-w-0 ${inputClassName}`}
          />
        </div>
        <div className="flex flex-nowrap items-center shrink-0">
          {!hideRatePicker && needsConversion && (
            <Popover open={popoverOpen} onOpenChange={handleOpenPopover}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 gap-1 px-2 sm:gap-1.5 sm:px-3 font-medium border-dashed hover:border-primary/50 hover:bg-primary/5"
                  aria-label="Exchange rate options"
                >
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  <span className="text-xs sm:text-sm whitespace-nowrap">Rates</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72"
                align="end"
                onPointerDownOutside={(e) => {
                  if (
                    ratePopoverContentRef.current?.contains(
                      e.target as Node
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <div ref={ratePopoverContentRef} className="space-y-3">
                  <p className="text-sm font-medium">
                    {fromCurrency} → {toCurrency}
                  </p>
                  {currentRateDisplay != null && (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatRateForLabel(displayedRateDate)}:{" "}
                      </span>
                      <span className="font-medium">
                        {formatWithDelimiters(Number(currentRateDisplay), { minFractionDigits: RATE_DISPLAY_DECIMALS, maxFractionDigits: RATE_DISPLAY_DECIMALS })} {toCurrency}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleUseTodaysRate}
                      disabled={loadingRate === "current"}
                    >
                      {loadingRate === "current" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                      ) : isTodayRateApplied ? (
                        <Check className="h-4 w-4 text-primary mr-2 shrink-0" aria-hidden />
                      ) : null}
                      Use today's rate
                    </Button>
                  </div>
                  {recentRates.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Recent rates</p>
                      {recentRates.slice(0, 3).map((r, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between text-sm"
                          onClick={() => {
                            handleUseRecentRate(Number(r.rate));
                            setPopoverOpen(false);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {isRecentRateApplied(Number(r.rate)) ? (
                              <Check className="h-4 w-4 text-primary shrink-0" aria-hidden />
                            ) : null}
                            {formatWithDelimiters(Number(r.rate), { minFractionDigits: RATE_DISPLAY_DECIMALS, maxFractionDigits: RATE_DISPLAY_DECIMALS })} {toCurrency}
                          </span>
                          {(r.usedAt ?? (r as { timestamp?: string }).timestamp) ? (
                            <span className="text-muted-foreground text-xs">
                              {new Date(
                                (r.usedAt ?? (r as { timestamp?: string }).timestamp)!
                              ).toLocaleDateString()}
                            </span>
                          ) : null}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Manual rate"
                      value={manualRate}
                      onChange={(e) =>
                        setManualRate(
                          numberFormatting.handleInputChange(e.target.value)
                        )
                      }
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleUseManualRate}
                      disabled={(() => {
                        const rateNum = numberFormatting.cleanForBackend(
                          manualRate
                        );
                        return (
                          !manualRate ||
                          !Number.isFinite(rateNum) ||
                          rateNum <= 0
                        );
                      })()}
                    >
                      {isManualRateApplied ? (
                        <Check className="h-4 w-4 text-primary mr-1.5 shrink-0" aria-hidden />
                      ) : null}
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {needsConversion && (
          <>
            <div />
            <div className="flex flex-col gap-0.5 min-w-0 pl-3 border-l-2 border-primary/20 py-0.5">
              {conversion && amountNumeric > 0 ? (
                <>
                  <p className="text-sm font-semibold text-primary tracking-tight">
                    → {toCurrency}{" "}
                    <RollingNumber
                      value={formatWithDelimiters(convertedAmount, {
                        minFractionDigits: 3,
                        maxFractionDigits: 3,
                      })}
                      className="text-primary"
                    />
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    (rate: {toCurrency}{" "}
                    <RollingNumber
                      value={formatWithDelimiters(conversion.exchangeRate, {
                        minFractionDigits: RATE_DISPLAY_DECIMALS,
                        maxFractionDigits: RATE_DISPLAY_DECIMALS,
                      })}
                      className="text-muted-foreground"
                    />
                    {conversion.exchangeRateSource !== "auto" && " · manual/recent"})
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  → {toCurrency} — enter amount and choose a rate
                </p>
              )}
            </div>
            <div />
          </>
        )}
      </div>
      {errors.length > 0 &&
        errors.map((error) => <FormError key={error}>{error}</FormError>)}
    </div>
  );
}
