"use client";

import React, { useCallback, useId, useMemo } from "react";
import { ArrowRight, Check, Clock, Loader2, TrendingUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyFlag } from "@/components/ui/currency-flag";
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, formatWithDelimiters, getCurrencySymbol } from "@/lib/utils";
import type { RecentRateItem } from "@/services/exchangeRates/queries";
import { humanFxQuote, operativeMultiplierFromFinalAmount } from "@/utils/fxQuoteDisplay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const EXCHANGE_RATE_SELECTOR_HISTORY_KEY = "__fintrExchangeRateSelector";
const BELOW_MD_SHEET_QUERY = "(max-width: 767px)";
const RATE_DISPLAY_DECIMALS = 3;
const RATE_TOLERANCE = 1e-6;

const recentRatesListClassName = cn(
  "insight-rail-peek h-full overflow-y-auto overscroll-contain",
);

const bottomSheetClassName = cn(
  "flex h-[80dvh] min-h-[80dvh] max-h-[80dvh] flex-col overflow-hidden rounded-none rounded-t-3xl",
  "border-x-0 border-b-0 border-t bg-background p-0 shadow-2xl",
  "w-full min-w-full max-w-none",
  "z-[130]",
);

export type ExchangeRateSource = "auto" | "manual" | "recent";
export type ManualExchangeEntryMode = "rate" | "final_amount";

export interface ExchangeRateSelectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  fromCurrency: string;
  toCurrency: string;
  currentRateDisplay: number | null;
  displayedRateDate?: string;
  recentRates: RecentRateItem[];
  appliedRate: number | null;
  appliedSource: ExchangeRateSource | null;
  appliedManualEntryMode?: ManualExchangeEntryMode | null;
  loadingRate: "currency" | "current" | null;
  sourceAmount: number;
  manualEntryMode: ManualExchangeEntryMode;
  onManualEntryModeChange: (mode: ManualExchangeEntryMode) => void;
  manualRate: string;
  manualFinalAmount: string;
  manualRatePlaceholder?: string;
  manualRateApplyDisabled: boolean;
  manualFinalAmountApplyDisabled: boolean;
  onManualRateChange: (value: string) => void;
  onManualFinalAmountChange: (value: string) => void;
  onSelectTodaysRate: () => void;
  onSelectRecentRate: (rate: number) => void;
  onApplyManualRate: () => void;
  onApplyManualFinalAmount: () => void;
  title?: string;
}

function ratesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < RATE_TOLERANCE;
}

function formatRateDateLabel(dateStr: string | undefined): string {
  if (!dateStr) return "Today";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Recent";

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) return "Today";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatRateQuote(
  rate: number,
  fromCurrency: string,
  toCurrency: string,
): string {
  const quote = humanFxQuote(rate, fromCurrency, toCurrency);
  return `${formatWithDelimiters(quote.displayValue, {
    minFractionDigits: RATE_DISPLAY_DECIMALS,
    maxFractionDigits: RATE_DISPLAY_DECIMALS,
  })} ${quote.unitCurrency} per 1 ${quote.baseCurrency}`;
}

function sortRecentRatesNewestFirst(rates: RecentRateItem[]): RecentRateItem[] {
  return [...rates].sort((a, b) => {
    const aTime = new Date(
      a.usedAt ?? (a as RecentRateItem & { timestamp?: string }).timestamp ?? 0,
    ).getTime();
    const bTime = new Date(
      b.usedAt ?? (b as RecentRateItem & { timestamp?: string }).timestamp ?? 0,
    ).getTime();

    return bTime - aTime;
  });
}

interface ExchangeRateSelectorContentProps {
  fromCurrency: string;
  toCurrency: string;
  currentRateDisplay: number | null;
  displayedRateDate?: string;
  recentRates: RecentRateItem[];
  appliedRate: number | null;
  appliedSource: ExchangeRateSource | null;
  appliedManualEntryMode?: ManualExchangeEntryMode | null;
  loadingRate: "currency" | "current" | null;
  sourceAmount: number;
  manualEntryMode: ManualExchangeEntryMode;
  onManualEntryModeChange: (mode: ManualExchangeEntryMode) => void;
  manualRate: string;
  manualFinalAmount: string;
  manualRatePlaceholder?: string;
  manualRateApplyDisabled: boolean;
  manualFinalAmountApplyDisabled: boolean;
  onManualRateChange: (value: string) => void;
  onManualFinalAmountChange: (value: string) => void;
  onSelectTodaysRate: () => void;
  onSelectRecentRate: (rate: number) => void;
  onApplyManualRate: () => void;
  onApplyManualFinalAmount: () => void;
  onClose: () => void;
  title: string;
  showDragHandle?: boolean;
}

function ExchangeRateSelectorContent({
  fromCurrency,
  toCurrency,
  currentRateDisplay,
  displayedRateDate,
  recentRates,
  appliedRate,
  appliedSource,
  appliedManualEntryMode = null,
  loadingRate,
  sourceAmount,
  manualEntryMode,
  onManualEntryModeChange,
  manualRate,
  manualFinalAmount,
  manualRatePlaceholder,
  manualRateApplyDisabled,
  manualFinalAmountApplyDisabled,
  onManualRateChange,
  onManualFinalAmountChange,
  onSelectTodaysRate,
  onSelectRecentRate,
  onApplyManualRate,
  onApplyManualFinalAmount,
  onClose,
  title,
  showDragHandle = false,
}: ExchangeRateSelectorContentProps) {
  const titleId = useId();

  const sortedRecentRates = useMemo(
    () => sortRecentRatesNewestFirst(recentRates),
    [recentRates],
  );

  const rateOptionCount =
    sortedRecentRates.length + (currentRateDisplay != null ? 1 : 0);

  const appliedSourceLabel = useMemo(() => {
    if (appliedSource === "manual") {
      return appliedManualEntryMode === "final_amount"
        ? "Final amount"
        : "Manual rate";
    }
    if (appliedSource === "recent") return "Recent rate";
    if (appliedSource === "auto") return "Today's rate";
    return null;
  }, [appliedManualEntryMode, appliedSource]);

  const targetCurrencySymbol = getCurrencySymbol(toCurrency);

  const parsedFinalAmount = useMemo(() => {
    const normalized = manualFinalAmount.replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, [manualFinalAmount]);

  const calculatedRateFromFinalAmount = useMemo(() => {
    if (parsedFinalAmount == null) return null;
    return operativeMultiplierFromFinalAmount(sourceAmount, parsedFinalAmount);
  }, [parsedFinalAmount, sourceAmount]);

  const manualApplyDisabled =
    manualEntryMode === "rate"
      ? manualRateApplyDisabled
      : manualFinalAmountApplyDisabled;

  const isTodayRateSelected =
    appliedSource === "auto" &&
    appliedRate != null &&
    currentRateDisplay != null &&
    ratesMatch(appliedRate, currentRateDisplay);

  const isRecentRateSelected = (rate: number) =>
    appliedSource === "recent" &&
    appliedRate != null &&
    ratesMatch(appliedRate, rate);

  const handleSelectRecent = useCallback(
    (rate: number) => {
      onSelectRecentRate(rate);
      onClose();
    },
    [onClose, onSelectRecentRate],
  );

  const handleSelectToday = useCallback(() => {
    onSelectTodaysRate();
    onClose();
  }, [onClose, onSelectTodaysRate]);

  const handleApplyManual = useCallback(() => {
    if (manualEntryMode === "final_amount") {
      onApplyManualFinalAmount();
    } else {
      onApplyManualRate();
    }
    onClose();
  }, [
    manualEntryMode,
    onApplyManualFinalAmount,
    onApplyManualRate,
    onClose,
  ]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        showDragHandle ? "h-full flex-1" : "flex-1",
      )}
    >
      <div
        className={cn(
          "shrink-0 px-4",
          showDragHandle ? "pt-2" : "pt-4",
        )}
      >
        {showDragHandle ? (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" />
        ) : null}

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-primary">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
            onClick={onClose}
            aria-label="Close exchange rate selector"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <CurrencyFlag currencyCode={fromCurrency} size={28} />
          <span className="text-sm font-semibold text-foreground">
            {fromCurrency}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <CurrencyFlag currencyCode={toCurrency} size={28} />
          <span className="text-sm font-semibold text-foreground">
            {toCurrency}
          </span>
        </div>

        {appliedRate != null && appliedSourceLabel ? (
          <div className="mb-4 rounded-2xl bg-muted/35 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              In use · {appliedSourceLabel}
            </p>
            <p className="mt-1.5 text-base font-semibold tabular-nums leading-snug text-foreground">
              {formatRateQuote(appliedRate, fromCurrency, toCurrency)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2">
        {loadingRate === "current" && rateOptionCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading rates…</p>
          </div>
        ) : rateOptionCount > 0 ? (
          <div className={recentRatesListClassName}>
            <ul className="divide-y divide-border/50 pb-1">
                {currentRateDisplay != null ? (
                  <li>
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      disabled={loadingRate === "current"}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors",
                        isTodayRateSelected
                          ? "bg-primary/[0.06]"
                          : "hover:bg-muted/35",
                        loadingRate === "current" && "opacity-70",
                      )}
                    >
                      {loadingRate === "current" ? (
                        <Loader2
                          className="h-[18px] w-[18px] shrink-0 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                      ) : (
                        <TrendingUp
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            isTodayRateSelected
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              isTodayRateSelected
                                ? "text-primary"
                                : "text-foreground",
                            )}
                          >
                            Today&apos;s rate
                          </span>
                          {isTodayRateSelected ? (
                            <Check
                              className="h-4 w-4 shrink-0 text-primary"
                              aria-hidden
                            />
                          ) : null}
                        </span>
                        <span className="block truncate text-sm tabular-nums text-muted-foreground">
                          {formatRateQuote(
                            currentRateDisplay,
                            fromCurrency,
                            toCurrency,
                          )}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          isTodayRateSelected
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatRateDateLabel(displayedRateDate)}
                      </span>
                    </button>
                  </li>
                ) : null}

                {sortedRecentRates.map((row, index) => {
                  const rawRate = Number(row.rate);
                  const selected = isRecentRateSelected(rawRate);
                  const usedAt =
                    row.usedAt ??
                    (row as RecentRateItem & { timestamp?: string }).timestamp;

                  return (
                    <li key={`${rawRate}-${usedAt ?? index}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectRecent(rawRate)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors",
                          selected
                            ? "bg-primary/[0.06]"
                            : "hover:bg-muted/35",
                        )}
                      >
                        <Clock
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            selected
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                          aria-hidden
                        />

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                selected
                                  ? "text-primary"
                                  : "text-foreground",
                              )}
                            >
                              {index === 0 ? "Most recent" : "Recent rate"}
                            </span>
                            {selected ? (
                              <Check
                                className="h-4 w-4 shrink-0 text-primary"
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <span className="block truncate text-sm tabular-nums text-muted-foreground">
                            {formatRateQuote(rawRate, fromCurrency, toCurrency)}
                          </span>
                        </span>

                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {formatRateDateLabel(usedAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "relative z-10 shrink-0 border-t border-border/50 bg-background px-4 pt-4",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        <h3 className="mb-3 text-sm font-semibold text-primary">Custom rate</h3>

        <div
          role="tablist"
          aria-label="How to enter a custom rate"
          className="mb-4 flex gap-5 border-b border-border/50"
        >
          <button
            type="button"
            role="tab"
            id="manual-rate-tab"
            aria-selected={manualEntryMode === "rate"}
            aria-controls="manual-rate-panel"
            onClick={() => onManualEntryModeChange("rate")}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
              manualEntryMode === "rate"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Enter rate
          </button>
          <button
            type="button"
            role="tab"
            id="manual-final-amount-tab"
            aria-selected={manualEntryMode === "final_amount"}
            aria-controls="manual-rate-panel"
            onClick={() => onManualEntryModeChange("final_amount")}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
              manualEntryMode === "final_amount"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Final amount
          </button>
        </div>

        <div
          id="manual-rate-panel"
          role="tabpanel"
          aria-labelledby={
            manualEntryMode === "rate"
              ? "manual-rate-tab"
              : "manual-final-amount-tab"
          }
        >
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            {manualEntryMode === "rate" ? (
              <>
                Type the exchange rate as{" "}
                <span className="font-medium text-foreground">
                  {toCurrency} per 1 {fromCurrency}
                </span>
                .
              </>
            ) : (
              <>
                Enter the total in{" "}
                <span className="font-medium text-foreground">{toCurrency}</span>{" "}
                for this transaction. We&apos;ll derive the rate from your{" "}
                <span className="font-medium text-foreground">{fromCurrency}</span>{" "}
                amount.
              </>
            )}
          </p>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              {manualEntryMode === "final_amount" ? (
                <span
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"
                  aria-hidden
                >
                  {targetCurrencySymbol}
                </span>
              ) : null}
              <Input
                type="text"
                inputMode="decimal"
                placeholder={
                  manualEntryMode === "rate"
                    ? manualRatePlaceholder ?? "Enter rate"
                    : `Total in ${toCurrency}`
                }
                value={
                  manualEntryMode === "rate" ? manualRate : manualFinalAmount
                }
                onChange={(event) =>
                  manualEntryMode === "rate"
                    ? onManualRateChange(event.target.value)
                    : onManualFinalAmountChange(event.target.value)
                }
                aria-label={
                  manualEntryMode === "rate"
                    ? "Manual exchange rate"
                    : `Final amount in ${toCurrency}`
                }
                className={cn(
                  "h-12 rounded-2xl border border-border/50 bg-muted/30",
                  "focus-visible:ring-1 focus-visible:ring-ring",
                  manualEntryMode === "final_amount" && "pl-9",
                )}
              />
            </div>
            <Button
              type="button"
              className="h-12 shrink-0 rounded-2xl px-5"
              onClick={handleApplyManual}
              disabled={manualApplyDisabled}
            >
              {appliedSource === "manual" ? (
                <Check className="mr-1.5 h-4 w-4" aria-hidden />
              ) : null}
              Apply
            </Button>
          </div>

          {manualEntryMode === "final_amount" ? (
            <div className="mt-3">
              {sourceAmount <= 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Enter a transaction amount first to calculate a rate from the
                  final total.
                </p>
              ) : calculatedRateFromFinalAmount != null ? (
                <div className="rounded-2xl bg-muted/35 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Calculated rate
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
                    {formatRateQuote(
                      calculatedRateFromFinalAmount,
                      fromCurrency,
                      toCurrency,
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Exchange rate picker shell: bottom sheet on small screens, popover on desktop.
 * Mirrors the currency selector layout with flags, selectable rows, and an in-use summary.
 */
export function ExchangeRateSelectorSheet({
  open,
  onOpenChange,
  trigger,
  fromCurrency,
  toCurrency,
  currentRateDisplay,
  displayedRateDate,
  recentRates,
  appliedRate,
  appliedSource,
  appliedManualEntryMode = null,
  loadingRate,
  sourceAmount,
  manualEntryMode,
  onManualEntryModeChange,
  manualRate,
  manualFinalAmount,
  manualRatePlaceholder,
  manualRateApplyDisabled,
  manualFinalAmountApplyDisabled,
  onManualRateChange,
  onManualFinalAmountChange,
  onSelectTodaysRate,
  onSelectRecentRate,
  onApplyManualRate,
  onApplyManualFinalAmount,
  title = "Exchange rate",
}: ExchangeRateSelectorSheetProps) {
  useCloseOnPopStateWhenOpen(
    open,
    onOpenChange,
    EXCHANGE_RATE_SELECTOR_HISTORY_KEY,
  );

  const useBottomSheet = useMediaQuery(BELOW_MD_SHEET_QUERY);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const content = (
    <ExchangeRateSelectorContent
      fromCurrency={fromCurrency}
      toCurrency={toCurrency}
      currentRateDisplay={currentRateDisplay}
      displayedRateDate={displayedRateDate}
      recentRates={recentRates}
      appliedRate={appliedRate}
      appliedSource={appliedSource}
      appliedManualEntryMode={appliedManualEntryMode}
      loadingRate={loadingRate}
      sourceAmount={sourceAmount}
      manualEntryMode={manualEntryMode}
      onManualEntryModeChange={onManualEntryModeChange}
      manualRate={manualRate}
      manualFinalAmount={manualFinalAmount}
      manualRatePlaceholder={manualRatePlaceholder}
      manualRateApplyDisabled={manualRateApplyDisabled}
      manualFinalAmountApplyDisabled={manualFinalAmountApplyDisabled}
      onManualRateChange={onManualRateChange}
      onManualFinalAmountChange={onManualFinalAmountChange}
      onSelectTodaysRate={onSelectTodaysRate}
      onSelectRecentRate={onSelectRecentRate}
      onApplyManualRate={onApplyManualRate}
      onApplyManualFinalAmount={onApplyManualFinalAmount}
      onClose={handleClose}
      title={title}
      showDragHandle={useBottomSheet}
    />
  );

  if (useBottomSheet) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          overlayClassName="z-[125]"
          onOverlayClick={handleClose}
          className={bottomSheetClassName}
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[min(36rem,calc(100vh-4rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex min-h-0 flex-1 flex-col">{content}</div>
      </PopoverContent>
    </Popover>
  );
}
