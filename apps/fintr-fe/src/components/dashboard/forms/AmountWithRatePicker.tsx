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
import {
  cn,
  formatAmountWithCode,
  formatWithDelimiters,
  numberFormatting,
} from "@/lib/utils";
import {
  getCurrentRate,
  getRecentRates,
  type RecentRateItem,
} from "@/services/exchangeRates/queries";
import { useAuthApi } from "@/hooks/useAuthApi";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import {
  formControlHeightClassName,
  formControlInteractiveSurfaceClassName,
} from "@/components/ui/form-control-surface";
import {
  CURRENCIES,
  getCountryCodeForCurrency,
  getFlagEmoji,
} from "@/data/currencies";

const RATE_DISPLAY_DECIMALS = 3;
const FLAG_NAME_GAP = "\u2002\u2002";

/** Backend returns +from → to+ multiplier (FetchRate, serializers, recent rates). Use as-is. */
function multiplierFromApi(raw: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

/**
 * Human-friendly quote from multiplier `m` (to per from: fromAmount * m = toAmount).
 * Example: m ≈ 0.0165 USD/PHP → “60.606 PHP per 1 USD”.
 */
function humanFxQuote(
  multiplier: number,
  fromCurrency: string,
  ledgerTargetCurrency: string
): { displayValue: number; unitCurrency: string; baseCurrency: string } {
  const m = multiplier;
  if (!Number.isFinite(m) || m <= 0) {
    return {
      displayValue: m,
      unitCurrency: ledgerTargetCurrency,
      baseCurrency: fromCurrency,
    };
  }
  if (m >= 1) {
    return {
      displayValue: m,
      unitCurrency: ledgerTargetCurrency,
      baseCurrency: fromCurrency,
    };
  }
  return {
    displayValue: 1 / m,
    unitCurrency: fromCurrency,
    baseCurrency: ledgerTargetCurrency,
  };
}

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
  /** Ledger / account currency for the conversion leg (CURR1→CURR2). Omit or null until an account is chosen — never substitute space currency here. */
  toCurrency: string | null;
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
  const ledgerTargetCurrency =
    toCurrency != null && String(toCurrency).trim() !== ""
      ? String(toCurrency).trim()
      : null;

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
  /** Ignores stale Promise results when from/to changes (e.g. space PHP → account USD). */
  const autoRateFetchSeqRef = useRef(0);
  const popoverRateFetchSeqRef = useRef(0);
  const [conversion, setConversion] = useState<{
    exchangeRate: number;
    exchangeRateSource: "auto" | "manual" | "recent";
  } | null>(() =>
    initialConversion
      ? {
          exchangeRate: multiplierFromApi(initialConversion.exchangeRate),
          exchangeRateSource: initialConversion.exchangeRateSource,
        }
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
    conversion?.exchangeRateSource === "recent" &&
    ratesMatch(
      conversion.exchangeRate,
      multiplierFromApi(rate),
    );

  const amountNumeric = numberFormatting.cleanForBackend(amountDisplayValue);
  /** True when we have an explicit ledger pair (never infer space as the "to" leg). */
  const pairReady =
    ledgerTargetCurrency != null && fromCurrency !== ledgerTargetCurrency;
  /** Show converted line when there is a real pair, or edit mode seeded conversion. */
  const fxPreviewActive = pairReady || initialConversion != null;
  const convertedAmount =
    conversion &&
    amountNumeric > 0 &&
    (pairReady || initialConversion != null)
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
      if (code === ledgerTargetCurrency) {
        setConversion(null);
        onConversionChange(null);
      } else {
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
        setRecentRates([]);
      }
    },
    [onFromCurrencyChange, ledgerTargetCurrency, onConversionChange]
  );

  const handleOpenPopover = useCallback(
    (open: boolean) => {
      if (!open) {
        setPopoverOpen(false);
        return;
      }
      setPopoverOpen(true);
      if (!pairReady) return;
      const seq = ++popoverRateFetchSeqRef.current;
      setLoadingRate("current");
      const todayStr = new Date().toISOString().slice(0, 10);
      Promise.all([
        getCurrentRate(api, fromCurrency, ledgerTargetCurrency, todayStr),
        getRecentRates(api, fromCurrency, ledgerTargetCurrency),
      ])
        .then(([current, recent]) => {
          if (seq !== popoverRateFetchSeqRef.current) return;
          setCurrentRateDisplay(multiplierFromApi(Number(current.rate)));
          setDisplayedRateDate(todayStr);
          setRecentRates(recent.rates ?? []);
        })
        .catch(() => {
          if (seq !== popoverRateFetchSeqRef.current) return;
          setCurrentRateDisplay(null);
          setDisplayedRateDate(undefined);
          setRecentRates([]);
        })
        .finally(() => {
          if (seq !== popoverRateFetchSeqRef.current) return;
          setLoadingRate(null);
        });
    },
    [api, fromCurrency, ledgerTargetCurrency, pairReady]
  );

  const applyConversion = useCallback(
    (rawRate: number, source: "auto" | "manual" | "recent"): number => {
      const rate = multiplierFromApi(rawRate);
      const snapshot: ConversionSnapshot = {
        originalCurrency: fromCurrency,
        exchangeRate: rate,
        exchangeRateSource: source,
      };
      setConversion({ exchangeRate: rate, exchangeRateSource: source });
      onConversionChange(snapshot);
      return rate;
    },
    [fromCurrency, onConversionChange]
  );

  const handleUseTodaysRate = useCallback(() => {
    if (ledgerTargetCurrency == null) return;
    setLoadingRate("current");
    const rateDate = new Date().toISOString().slice(0, 10);
    getCurrentRate(api, fromCurrency, ledgerTargetCurrency, rateDate)
      .then((r) => {
        const raw = Number(r.rate);
        const n = applyConversion(raw, "auto");
        setCurrentRateDisplay(n);
        setDisplayedRateDate(rateDate);
        setPopoverOpen(false);
      })
      .catch(() => {
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
      })
      .finally(() => setLoadingRate(null));
  }, [api, fromCurrency, ledgerTargetCurrency, applyConversion]);

  const handleUseRecentRate = useCallback(
    (rate: number) => {
      applyConversion(Number(rate), "recent");
    },
    [applyConversion],
  );

  const handleUseManualRate = useCallback(() => {
    const parsed = numberFormatting.cleanForBackend(manualRate);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    applyConversion(parsed, "manual");
  }, [manualRate, applyConversion]);

  // When parent provides initial conversion (e.g. edit mode), use it and do not overwrite.
  // Otherwise only auto-fetch when we have a real from→ledger pair (never substitute space).
  useEffect(() => {
    if (initialConversion) {
      const normalized = multiplierFromApi(initialConversion.exchangeRate);
      setConversion((prev) => {
        if (
          prev &&
          prev.exchangeRateSource === initialConversion.exchangeRateSource &&
          Math.abs(prev.exchangeRate - normalized) < RATE_TOLERANCE
        ) {
          return prev;
        }
        return {
          exchangeRate: normalized,
          exchangeRateSource: initialConversion.exchangeRateSource,
        };
      });
      // Do not always call onConversionChange: it updates the parent, which passes a new
      // initialConversion reference and would retrigger this effect → infinite loop.
      if (
        Math.abs(normalized - initialConversion.exchangeRate) >= RATE_TOLERANCE
      ) {
        onConversionChange({
          originalCurrency: initialConversion.originalCurrency,
          exchangeRate: normalized,
          exchangeRateSource: initialConversion.exchangeRateSource,
        });
      }
      return;
    }

    if (!pairReady) {
      setConversion(null);
      onConversionChange(null);
      setCurrentRateDisplay(null);
      setDisplayedRateDate(undefined);
      setRecentRates([]);
      return;
    }

    // Create mode: default to most recent rate used, else today's rate
    const seq = ++autoRateFetchSeqRef.current;
    setConversion(null);
    onConversionChange(null);
    setLoadingRate("currency");
    const todayStr = new Date().toISOString().slice(0, 10);
    Promise.all([
      getRecentRates(api, fromCurrency, ledgerTargetCurrency),
      getCurrentRate(api, fromCurrency, ledgerTargetCurrency, todayStr),
    ])
      .then(([recent, current]) => {
        if (seq !== autoRateFetchSeqRef.current) return;
        const rates = recent.rates ?? [];
        if (rates.length > 0) {
          const mostRecent = rates[0];
          const raw = Number(mostRecent.rate);
          const n = applyConversion(raw, "recent");
          setCurrentRateDisplay(n);
          setDisplayedRateDate(
            mostRecent.usedAt ?? (mostRecent as { timestamp?: string }).timestamp ?? todayStr
          );
          setRecentRates(rates);
        } else {
          const raw = Number(current.rate);
          const n = applyConversion(raw, "auto");
          setCurrentRateDisplay(n);
          setDisplayedRateDate(todayStr);
        }
      })
      .catch(() => {
        if (seq !== autoRateFetchSeqRef.current) return;
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
        setRecentRates([]);
      })
      .finally(() => {
        if (seq !== autoRateFetchSeqRef.current) return;
        setLoadingRate(null);
      });
  }, [
    fromCurrency,
    ledgerTargetCurrency,
    pairReady,
    api,
    applyConversion,
    initialConversion,
    onConversionChange,
  ]);

  return (
    <div className="grid grid-rows-[1.25rem_auto] gap-2">
      <Label htmlFor={id} className="self-end text-sm leading-none">
        {label}
      </Label>
      <div className="space-y-2 w-full min-w-0">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {/* Currency on the left: locked label or search + list */}
          <div className="flex shrink-0 flex-nowrap items-center">
          {lockFromCurrency ? (
            <span
              className={cn(
                "inline-flex items-center px-2 text-xs font-medium text-muted-foreground",
                formControlHeightClassName,
              )}
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
                  className={cn(
                    "shrink-0 px-2 text-xs font-medium",
                    formControlInteractiveSurfaceClassName,
                  )}
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
        <div className="min-w-0 flex flex-1 items-center basis-[10rem]">
          <CalculatorInput
            id={id}
            name={id}
            value={amountDisplayValue}
            onChange={onAmountChange}
            placeholder={placeholder}
            className={`w-full min-w-0 ${inputClassName}`}
          />
        </div>
        <div className="flex shrink-0 flex-nowrap items-center">
          {!hideRatePicker && pairReady && (
            <Popover open={popoverOpen} onOpenChange={handleOpenPopover}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "shrink-0 gap-1 px-2 font-medium border-dashed sm:gap-1.5 sm:px-3",
                    formControlInteractiveSurfaceClassName,
                    "hover:border-primary/50 hover:bg-primary/5",
                  )}
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
                    {fromCurrency} → {ledgerTargetCurrency}
                  </p>
                  {currentRateDisplay != null && (() => {
                    const q = humanFxQuote(
                      currentRateDisplay,
                      fromCurrency,
                      ledgerTargetCurrency,
                    );
                    return (
                      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <p className="text-muted-foreground">
                          {formatRateForLabel(displayedRateDate)}:
                        </p>
                        <p className="font-medium">
                          {formatWithDelimiters(q.displayValue, {
                            minFractionDigits: RATE_DISPLAY_DECIMALS,
                            maxFractionDigits: RATE_DISPLAY_DECIMALS,
                          })}{" "}
                          {q.unitCurrency} per 1 {q.baseCurrency}
                        </p>
                      </div>
                    );
                  })()}
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
                            {(() => {
                              const raw = Number(r.rate);
                              const m = multiplierFromApi(raw);
                              const q = humanFxQuote(
                                m,
                                fromCurrency,
                                ledgerTargetCurrency,
                              );
                              return (
                                <>
                                  {formatWithDelimiters(q.displayValue, {
                                    minFractionDigits: RATE_DISPLAY_DECIMALS,
                                    maxFractionDigits: RATE_DISPLAY_DECIMALS,
                                  })}{" "}
                                  {q.unitCurrency} per 1 {q.baseCurrency}
                                </>
                              );
                            })()}
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
                        <Check className="h-4 w-4 text-primary-foreground mr-1.5 shrink-0" aria-hidden />
                      ) : null}
                      {isManualRateApplied ? "Applied" : "Apply"}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        </div>
        {fxPreviewActive && (
          <div className="min-w-0 border-l-2 border-primary/20 py-0.5 pl-3">
            {conversion && amountNumeric > 0 ? (
              <>
                <p className="text-sm font-semibold text-primary tracking-tight">
                  → {ledgerTargetCurrency ?? "Account"}{" "}
                  <RollingNumber
                    value={formatWithDelimiters(convertedAmount, {
                      minFractionDigits: 3,
                      maxFractionDigits: 3,
                    })}
                    className="text-primary"
                  />
                </p>
                {ledgerTargetCurrency != null ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    (
                    {(() => {
                      const q = humanFxQuote(
                        conversion.exchangeRate,
                        fromCurrency,
                        ledgerTargetCurrency,
                      );
                      return (
                        <>
                          <RollingNumber
                            value={formatWithDelimiters(q.displayValue, {
                              minFractionDigits: RATE_DISPLAY_DECIMALS,
                              maxFractionDigits: RATE_DISPLAY_DECIMALS,
                            })}
                            className="text-muted-foreground"
                          />{" "}
                          {q.unitCurrency} per 1 {q.baseCurrency}
                        </>
                      );
                    })()}
                    {conversion.exchangeRateSource !== "auto" && " · manual/recent"})
                  </p>
                ) : null}
              </>
            ) : ledgerTargetCurrency != null ? (
              <p className="text-xs text-muted-foreground">
                → {ledgerTargetCurrency} — enter amount and choose a rate
              </p>
            ) : initialConversion == null ? (
              <p className="text-xs text-muted-foreground">
                Select an account to preview the amount in the account currency.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter amount to see the converted value.
              </p>
            )}
          </div>
        )}
      </div>
      {errors.length > 0 &&
        errors.map((error) => <FormError key={error}>{error}</FormError>)}
    </div>
  );
}
