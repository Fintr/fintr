"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Button } from "@/components/ui/button";
import { CurrencySelectorSheet } from "@/components/ui/currency-selector-sheet";
import {
  ExchangeRateSelectorSheet,
  type ManualExchangeEntryMode,
} from "@/components/ui/exchange-rate-selector-sheet";
import { TrendingUp, Loader2 } from "lucide-react";
import { FormError } from "@/components/ui/form-error";
import { RollingNumber } from "@/components/ui/rolling-number";
import {
  cn,
  formatWithDelimiters,
  numberFormatting,
} from "@/lib/utils";
import {
  getCurrentRate,
  getRecentRates,
  type RecentRateItem,
} from "@/services/exchangeRates/queries";
import { resolveAutoExchangeRates } from "@/services/exchangeRates/resolve-auto-rates";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import {
  formControlHeightClassName,
  formControlInteractiveSurfaceClassName,
} from "@/components/ui/form-control-surface";
import {
  formatFxQuoteLabel,
  humanFxQuote,
  operativeMultiplierFromFinalAmount,
  operativeMultiplierFromManualQuote,
} from "@/utils/fxQuoteDisplay";
import {
  fxPairChanged,
  type FxRatePair,
} from "@/utils/autoFxRateSelection";

const RATE_DISPLAY_DECIMALS = 3;
/** Backend returns +from → to+ multiplier (FetchRate, serializers, recent rates). Use as-is. */
function multiplierFromApi(raw: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

export interface ConversionSnapshot {
  originalCurrency: string;
  /** Account ledger currency the exchange rate converts into. */
  targetCurrency: string;
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
  /** When true, auto-fetched rates update the preview only and do not notify the parent (edit display-only). */
  previewOnly?: boolean;
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
  previewOnly = false,
}: AmountWithRatePickerProps) {
  const ledgerTargetCurrency =
    toCurrency != null && String(toCurrency).trim() !== ""
      ? String(toCurrency).trim()
      : null;

  const { api } = useAuthApi();
  const reduceMotion = useReducedMotion();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [rateSheetOpen, setRateSheetOpen] = useState(false);
  const [manualRate, setManualRate] = useState("");
  const [manualFinalAmount, setManualFinalAmount] = useState("");
  const [manualEntryMode, setManualEntryMode] =
    useState<ManualExchangeEntryMode>("rate");
  const [appliedManualEntryMode, setAppliedManualEntryMode] =
    useState<ManualExchangeEntryMode | null>(null);
  const [loadingRate, setLoadingRate] = useState<"currency" | "current" | null>(null);
  const [currentRateDisplay, setCurrentRateDisplay] = useState<number | null>(null);
  const [displayedRateDate, setDisplayedRateDate] = useState<string | undefined>(undefined);
  const [recentRates, setRecentRates] = useState<RecentRateItem[]>([]);
  /** Ignores stale Promise results when from/to changes (e.g. space PHP → account USD). */
  const autoRateFetchSeqRef = useRef(0);
  const popoverRateFetchSeqRef = useRef(0);
  const lastAutoFetchedPairRef = useRef<FxRatePair | null>(null);
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

  const amountNumeric = numberFormatting.cleanForBackend(amountDisplayValue);
  const rateLookupDate = date ?? new Date().toISOString().slice(0, 10);
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

  const handleSelectAmountCurrency = useCallback(
    (code: string) => {
      onFromCurrencyChange(code);
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

  const handleOpenRateSheet = useCallback(
    (open: boolean) => {
      if (!open) {
        setRateSheetOpen(false);
        return;
      }
      setRateSheetOpen(true);
      if (!pairReady || ledgerTargetCurrency == null) return;
      const seq = ++popoverRateFetchSeqRef.current;
      setLoadingRate("current");
      Promise.all([
        getCurrentRate(api, fromCurrency, ledgerTargetCurrency, rateLookupDate),
        getRecentRates(api, fromCurrency, ledgerTargetCurrency, {
          spaceId: spaceCode || undefined,
        }),
      ])
        .then(([current, recent]) => {
          if (seq !== popoverRateFetchSeqRef.current) return;
          setCurrentRateDisplay(multiplierFromApi(Number(current.rate)));
          setDisplayedRateDate(rateLookupDate);
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
    [
      api,
      fromCurrency,
      ledgerTargetCurrency,
      pairReady,
      rateLookupDate,
      spaceCode,
    ],
  );

  const applyConversion = useCallback(
    (
      rawRate: number,
      source: "auto" | "manual" | "recent",
      options?: { syncToParent?: boolean; manualEntryMode?: ManualExchangeEntryMode | null },
    ): number => {
      const rate = multiplierFromApi(rawRate);
      const snapshot: ConversionSnapshot = {
        originalCurrency: fromCurrency,
        targetCurrency: ledgerTargetCurrency ?? fromCurrency,
        exchangeRate: rate,
        exchangeRateSource: source,
      };
      setConversion({ exchangeRate: rate, exchangeRateSource: source });
      if (source === "manual") {
        setAppliedManualEntryMode(options?.manualEntryMode ?? "rate");
      } else {
        setAppliedManualEntryMode(null);
      }
      const syncToParent = options?.syncToParent ?? !previewOnly;
      if (syncToParent) {
        onConversionChange(snapshot);
      }
      return rate;
    },
    [fromCurrency, ledgerTargetCurrency, onConversionChange, previewOnly]
  );

  const handleUseTodaysRate = useCallback(() => {
    if (ledgerTargetCurrency == null) return;
    setLoadingRate("current");
    getCurrentRate(api, fromCurrency, ledgerTargetCurrency, rateLookupDate)
      .then((r) => {
        const raw = Number(r.rate);
        const n = applyConversion(raw, "auto", { syncToParent: true });
        setCurrentRateDisplay(n);
        setDisplayedRateDate(rateLookupDate);
      })
      .catch(() => {
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
      })
      .finally(() => setLoadingRate(null));
  }, [api, fromCurrency, ledgerTargetCurrency, applyConversion, rateLookupDate]);

  const handleUseRecentRate = useCallback(
    (rate: number) => {
      applyConversion(Number(rate), "recent", { syncToParent: true });
    },
    [applyConversion],
  );

  const handleUseManualRate = useCallback(() => {
    const parsed = numberFormatting.cleanForBackend(manualRate);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const hintRate =
      conversion?.exchangeRate ??
      currentRateDisplay ??
      initialConversion?.exchangeRate ??
      null;
    const operativeRate = operativeMultiplierFromManualQuote(parsed, hintRate);

    applyConversion(operativeRate, "manual", {
      syncToParent: true,
      manualEntryMode: "rate",
    });
  }, [
    manualRate,
    applyConversion,
    conversion?.exchangeRate,
    currentRateDisplay,
    initialConversion?.exchangeRate,
  ]);

  const handleUseManualFinalAmount = useCallback(() => {
    const finalAmount = numberFormatting.cleanForBackend(manualFinalAmount);
    const operativeRate = operativeMultiplierFromFinalAmount(
      amountNumeric,
      finalAmount,
    );
    if (operativeRate == null) return;

    applyConversion(operativeRate, "manual", {
      syncToParent: true,
      manualEntryMode: "final_amount",
    });
  }, [amountNumeric, applyConversion, manualFinalAmount]);

  const manualRateHint =
    conversion?.exchangeRate ??
    currentRateDisplay ??
    initialConversion?.exchangeRate ??
    null;

  const manualRateQuote =
    ledgerTargetCurrency != null && manualRateHint != null
      ? humanFxQuote(manualRateHint, fromCurrency, ledgerTargetCurrency)
      : null;

  const initialConversionApplies =
    initialConversion != null &&
    initialConversion.originalCurrency === fromCurrency;

  // When parent provides initial conversion (e.g. edit mode), use it and do not overwrite.
  // Otherwise only auto-fetch when we have a real from→ledger pair (never substitute space).
  useEffect(() => {
    if (initialConversionApplies && initialConversion) {
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
          targetCurrency:
            initialConversion.targetCurrency ??
            ledgerTargetCurrency ??
            initialConversion.originalCurrency,
          exchangeRate: normalized,
          exchangeRateSource: initialConversion.exchangeRateSource,
        });
      }
      return;
    }

    if (!pairReady || !ledgerTargetCurrency) {
      lastAutoFetchedPairRef.current = null;
      setConversion(null);
      if (!previewOnly) {
        onConversionChange(null);
      }
      setCurrentRateDisplay(null);
      setDisplayedRateDate(undefined);
      setRecentRates([]);
      setLoadingRate(null);
      return;
    }

    // Create mode: service resolves local DB first, then backend.
    const seq = ++autoRateFetchSeqRef.current;
    const nextPair: FxRatePair = {
      fromCurrency,
      toCurrency: ledgerTargetCurrency,
    };
    const pairChanged = fxPairChanged(lastAutoFetchedPairRef.current, nextPair);
    let cancelled = false;

    void (async () => {
      // Defer the loading skeleton so local-DB hits don't flash a placeholder.
      const loadingTimer = window.setTimeout(() => {
        if (!cancelled && seq === autoRateFetchSeqRef.current && pairChanged) {
          setLoadingRate("currency");
        }
      }, 80);

      try {
        const resolved = await resolveAutoExchangeRates({
          api,
          fromCurrency,
          toCurrency: ledgerTargetCurrency,
          date: rateLookupDate,
          spaceId: spaceCode || undefined,
          pairChanged,
          previousPair: lastAutoFetchedPairRef.current,
        });

        if (cancelled || seq !== autoRateFetchSeqRef.current) return;
        window.clearTimeout(loadingTimer);

        const n = applyConversion(
          resolved.appliedRate,
          resolved.appliedSource,
        );
        setDisplayedRateDate(resolved.displayedRateDate);
        setCurrentRateDisplay(n);
        setRecentRates(resolved.recent.rates ?? []);
        lastAutoFetchedPairRef.current = nextPair;
        setLoadingRate(null);
      } catch {
        if (cancelled || seq !== autoRateFetchSeqRef.current) return;
        window.clearTimeout(loadingTimer);
        if (pairChanged) {
          setConversion(null);
          if (!previewOnly) {
            onConversionChange(null);
          }
        }
        setCurrentRateDisplay(null);
        setDisplayedRateDate(undefined);
        setRecentRates([]);
        setLoadingRate(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fromCurrency,
    ledgerTargetCurrency,
    pairReady,
    api,
    applyConversion,
    initialConversion,
    initialConversionApplies,
    onConversionChange,
    previewOnly,
    rateLookupDate,
    spaceCode,
  ]);

  return (
    <div className="grid grid-rows-[1.25rem_auto] gap-2">
      <Label htmlFor={id} className="self-end text-sm leading-none">
        {label}
      </Label>
      <div className="w-full min-w-0">
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
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
              <CurrencySelectorSheet
                open={currencySheetOpen}
                onOpenChange={setCurrencySheetOpen}
                value={fromCurrency}
                onSelect={handleSelectAmountCurrency}
                trigger={
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
                }
              />
            )}
          </div>
          <div className="min-w-0 flex flex-1 items-center">
            <CalculatorInput
              id={id}
              name={id}
              value={amountDisplayValue}
              onChange={onAmountChange}
              placeholder={placeholder}
              className={`w-full min-w-0 ${inputClassName}`}
            />
          </div>
          {!hideRatePicker && pairReady && ledgerTargetCurrency != null && (
            <div className="flex shrink-0 flex-nowrap items-center">
              <ExchangeRateSelectorSheet
                open={rateSheetOpen}
                onOpenChange={handleOpenRateSheet}
                fromCurrency={fromCurrency}
                toCurrency={ledgerTargetCurrency}
                currentRateDisplay={currentRateDisplay}
                displayedRateDate={displayedRateDate}
                recentRates={recentRates}
                appliedRate={conversion?.exchangeRate ?? null}
                appliedSource={conversion?.exchangeRateSource ?? null}
                appliedManualEntryMode={appliedManualEntryMode}
                loadingRate={loadingRate}
                sourceAmount={amountNumeric}
                manualEntryMode={manualEntryMode}
                onManualEntryModeChange={setManualEntryMode}
                manualRate={manualRate}
                manualFinalAmount={manualFinalAmount}
                manualRatePlaceholder={
                  manualRateQuote != null
                    ? formatFxQuoteLabel(manualRateQuote)
                    : "Enter rate"
                }
                manualRateApplyDisabled={(() => {
                  const rateNum = numberFormatting.cleanForBackend(manualRate);
                  return (
                    !manualRate ||
                    !Number.isFinite(rateNum) ||
                    rateNum <= 0
                  );
                })()}
                manualFinalAmountApplyDisabled={(() => {
                  const finalAmount = numberFormatting.cleanForBackend(
                    manualFinalAmount,
                  );
                  return (
                    amountNumeric <= 0 ||
                    !manualFinalAmount ||
                    !Number.isFinite(finalAmount) ||
                    finalAmount <= 0
                  );
                })()}
                onManualRateChange={(value) =>
                  setManualRate(numberFormatting.handleInputChange(value))
                }
                onManualFinalAmountChange={(value) =>
                  setManualFinalAmount(numberFormatting.handleInputChange(value))
                }
                onSelectTodaysRate={handleUseTodaysRate}
                onSelectRecentRate={handleUseRecentRate}
                onApplyManualRate={handleUseManualRate}
                onApplyManualFinalAmount={handleUseManualFinalAmount}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "shrink-0 gap-1 px-2 font-medium border-dashed sm:gap-1.5 sm:px-3",
                      formControlInteractiveSurfaceClassName,
                      "hover:border-primary/50 hover:bg-primary/5",
                    )}
                    aria-label="Exchange rate options"
                    disabled={loadingRate === "currency"}
                  >
                    {loadingRate === "currency" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm whitespace-nowrap">
                      Rates
                    </span>
                  </Button>
                }
              />
            </div>
          )}
        </div>
        <AnimatePresence initial={false}>
          {fxPreviewActive && (
            <motion.div
              key="fx-preview"
              initial={
                reduceMotion
                  ? false
                  : { height: 0, opacity: 0, marginTop: 0 }
              }
              animate={{
                height: "auto",
                opacity: 1,
                marginTop: 8,
              }}
              exit={
                reduceMotion
                  ? undefined
                  : { height: 0, opacity: 0, marginTop: 0 }
              }
              transition={{
                height: {
                  duration: 0.28,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: {
                  duration: 0.22,
                  ease: "easeOut",
                },
                marginTop: {
                  duration: 0.28,
                  ease: [0.22, 1, 0.36, 1],
                },
              }}
              className="overflow-hidden"
            >
              <div className="min-w-0 min-h-[2.75rem] border-l-2 border-primary/20 py-0.5 pl-3">
                {loadingRate === "currency" && !conversion ? (
                  <div
                    className="flex h-[2.75rem] flex-col justify-center gap-1.5"
                    aria-busy="true"
                    aria-live="polite"
                  >
                    <div className="h-4 w-44 max-w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 max-w-full animate-pulse rounded bg-muted" />
                  </div>
                ) : conversion && amountNumeric > 0 ? (
                  <div className="flex min-h-[2.75rem] flex-col justify-center">
                    <p className="text-sm font-semibold text-primary tracking-tight leading-5">
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
                      <p className="text-xs text-muted-foreground tabular-nums leading-4">
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
                        {conversion.exchangeRateSource === "manual" &&
                          appliedManualEntryMode === "final_amount" &&
                          " · from final amount"}
                        {conversion.exchangeRateSource === "manual" &&
                          appliedManualEntryMode !== "final_amount" &&
                          " · manual rate"}
                        {conversion.exchangeRateSource === "recent" &&
                          " · recent rate"}
                        )
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-[2.75rem] items-center">
                    <p className="text-xs text-muted-foreground">
                      {ledgerTargetCurrency != null
                        ? `→ ${ledgerTargetCurrency} — enter amount and choose a rate`
                        : initialConversion == null
                          ? "Select an account to preview the amount in the account currency."
                          : "Enter amount to see the converted value."}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {errors.length > 0 &&
        errors.map((error) => <FormError key={error}>{error}</FormError>)}
    </div>
  );
}
