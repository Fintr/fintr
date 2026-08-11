"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getCurrentRate } from "@/services/exchangeRates/queries";
import { formatFxQuoteCompact } from "@/utils/fxQuoteDisplay";
import { formatWithDelimiters } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import type { Account } from "@/types/accountTypes";
import { HomeSection } from "@/components/dashboard/tabs/home/home-section";

const RATE_DISPLAY_DECIMALS = 2;
const RATE_STALE_TIME_MS = 5 * 60_000;

type HomeExchangeRatesSectionProps = {
  spaceCurrency: string;
  accounts: Account[];
};

const formatRateValue = (value: number): string =>
  formatWithDelimiters(value, {
    minFractionDigits: RATE_DISPLAY_DECIMALS,
    maxFractionDigits: RATE_DISPLAY_DECIMALS,
  });

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export const HomeExchangeRatesSection = ({
  spaceCurrency,
  accounts,
}: HomeExchangeRatesSectionProps) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const rateDate = todayIsoDate();

  const currencyPairs = useMemo(() => {
    const foreignCurrencies = new Set<string>();

    accounts.forEach((account) => {
      const currency = account.balanceCurrency?.trim();
      if (currency && currency !== spaceCurrency) {
        foreignCurrencies.add(currency);
      }
    });

    if (foreignCurrencies.size === 0 && spaceCurrency === "PHP") {
      foreignCurrencies.add("USD");
    }

    return [...foreignCurrencies].map((fromCurrency) => ({
      fromCurrency,
      toCurrency: spaceCurrency,
    }));
  }, [accounts, spaceCurrency]);

  const rateQueries = useQueries({
    queries: currencyPairs.map((pair) => ({
      queryKey: [
        "home",
        "exchange-rate",
        spaceCode,
        pair.fromCurrency,
        pair.toCurrency,
        rateDate,
      ],
      queryFn: () =>
        getCurrentRate(
          api,
          pair.fromCurrency,
          pair.toCurrency,
          rateDate,
        ),
      enabled: !!spaceCode && isAuthenticated,
      staleTime: RATE_STALE_TIME_MS,
    })),
  });

  const isLoading = rateQueries.some((query) => query.isLoading);
  const rates = rateQueries
    .map((query, index) => {
      const rate = Number(query.data?.rate ?? 0);
      if (!Number.isFinite(rate) || rate <= 0) {
        return null;
      }

      const pair = currencyPairs[index];
      return {
        key: `${pair.fromCurrency}-${pair.toCurrency}`,
        label: formatFxQuoteCompact(
          rate,
          pair.fromCurrency,
          pair.toCurrency,
          formatRateValue,
        ),
      };
    })
    .filter((row): row is { key: string; label: string } => row != null);

  if (currencyPairs.length === 0) {
    return null;
  }

  return (
    <HomeSection title="Exchange rates">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="medium" />
        </div>
      ) : null}

      {!isLoading && rates.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No exchange rates available.
        </p>
      ) : null}

      {!isLoading && rates.length > 0 ? (
        <div className="space-y-2">
          {rates.map((rate) => (
            <div
              key={rate.key}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-500">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-primary">{rate.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </HomeSection>
  );
};
