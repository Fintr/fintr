"use client";

import React, { useCallback, useId, useMemo, useState } from "react";
import { Check, Search, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getCurrencySymbol } from "@/lib/utils";
import {
  CURRENCIES,
  POPULAR_CURRENCY_CODES,
} from "@/data/currencies";
import { CurrencyFlag } from "@/components/ui/currency-flag";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const CURRENCY_SELECTOR_HISTORY_KEY = "__fintrCurrencySelector";
const BELOW_MD_SHEET_QUERY = "(max-width: 767px)";

const bottomSheetClassName = cn(
  "flex h-[80dvh] min-h-[80dvh] max-h-[80dvh] flex-col overflow-hidden rounded-none rounded-t-3xl",
  "border-x-0 border-b-0 border-t bg-background p-0 shadow-2xl",
  "w-full min-w-full max-w-none",
  "z-[130]",
);

export interface CurrencySelectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single element forwarded with `asChild` to the trigger. */
  trigger: React.ReactElement;
  value: string;
  onSelect: (code: string) => void;
  title?: string;
  /** When set, only these ISO codes are listed. */
  currencyCodes?: string[];
}

function getPopularCurrencies(
  currencies: { code: string; name: string }[],
): { code: string; name: string }[] {
  const byCode = new Map(currencies.map((currency) => [currency.code, currency]));

  return POPULAR_CURRENCY_CODES.map((code) => byCode.get(code)).filter(
    (currency): currency is { code: string; name: string } => currency != null,
  );
}

function sortCurrenciesPopularFirst(
  currencies: { code: string; name: string }[],
): { code: string; name: string }[] {
  const popularSet = new Set<string>(POPULAR_CURRENCY_CODES);
  const byCode = new Map(currencies.map((currency) => [currency.code, currency]));

  const popular = POPULAR_CURRENCY_CODES.map((code) => byCode.get(code)).filter(
    (currency): currency is { code: string; name: string } => currency != null,
  );

  const rest = currencies
    .filter((currency) => !popularSet.has(currency.code))
    .sort((a, b) => a.code.localeCompare(b.code));

  return [...popular, ...rest];
}

interface CurrencySelectorContentProps {
  open: boolean;
  value: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title: string;
  currencyCodes?: string[];
  showDragHandle?: boolean;
}

function CurrencySelectorContent({
  open,
  value,
  onSelect,
  onClose,
  title,
  currencyCodes,
  showDragHandle = false,
}: CurrencySelectorContentProps) {
  const titleId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPopularOnly, setShowPopularOnly] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setShowPopularOnly(false);
    }
  }, [open]);

  const availableCurrencies = useMemo(() => {
    if (!currencyCodes?.length) {
      return CURRENCIES;
    }

    const allowed = new Set(currencyCodes.map((code) => code.toUpperCase()));
    return CURRENCIES.filter((currency) => allowed.has(currency.code));
  }, [currencyCodes]);

  const filteredCurrencies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      return availableCurrencies.filter(
        (currency) =>
          currency.code.toLowerCase().includes(query) ||
          currency.name.toLowerCase().includes(query),
      );
    }

    if (showPopularOnly) {
      return getPopularCurrencies(availableCurrencies);
    }

    return sortCurrenciesPopularFirst(availableCurrencies);
  }, [availableCurrencies, searchQuery, showPopularOnly]);

  const handleSelect = useCallback(
    (code: string) => {
      onSelect(code);
      onClose();
    },
    [onClose, onSelect],
  );

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
          <h2
            id={titleId}
            className="text-lg font-semibold text-primary"
          >
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
            onClick={onClose}
            aria-label="Close currency selector"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search currency"
            autoComplete="off"
            className={cn(
              "h-11 rounded-full border-0 bg-muted/60 pl-10 pr-4",
              "focus-visible:ring-1 focus-visible:ring-ring",
            )}
          />
        </div>

        {!searchQuery.trim() ? (
          <div className="mb-3 flex">
            <button
              type="button"
              onClick={() => setShowPopularOnly((current) => !current)}
              aria-pressed={showPopularOnly}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
                "text-xs font-medium transition-colors",
                showPopularOnly
                  ? "bg-primary/15 text-primary dark:bg-primary-dark-mode/15 dark:text-primary-dark-mode"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              <Star className="h-3.5 w-3.5" aria-hidden />
              Popular first
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          "px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          !showDragHandle && "max-h-80",
        )}
      >
        {filteredCurrencies.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No currencies match
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredCurrencies.map((currency) => {
              const isSelected = value === currency.code;
              const symbol = getCurrencySymbol(currency.code);

              return (
                <li key={currency.code}>
                  <button
                    type="button"
                    onClick={() => handleSelect(currency.code)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left",
                      "transition-colors hover:bg-muted/60",
                      isSelected && "bg-muted/40",
                    )}
                  >
                    <CurrencyFlag currencyCode={currency.code} size={40} />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">
                          {currency.code}
                        </span>
                        {isSelected ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {currency.name}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-md bg-muted px-2.5 py-1",
                        "text-sm font-medium text-muted-foreground",
                      )}
                    >
                      {symbol}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Currency picker shell: bottom sheet on small screens, popover on larger viewports.
 * Matches the mobile "Select Currency" design with search, popular-first sort, and
 * flag / code / name / symbol rows.
 */
export function CurrencySelectorSheet({
  open,
  onOpenChange,
  trigger,
  value,
  onSelect,
  title = "Select Currency",
  currencyCodes,
}: CurrencySelectorSheetProps) {
  useCloseOnPopStateWhenOpen(open, onOpenChange, CURRENCY_SELECTOR_HISTORY_KEY);

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
    <CurrencySelectorContent
      open={open}
      value={value}
      onSelect={onSelect}
      onClose={handleClose}
      title={title}
      currencyCodes={currencyCodes}
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
        align="start"
        className="flex max-h-[min(32rem,calc(100vh-4rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
}
