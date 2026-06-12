import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Account, AccountBalanceTotals } from "@/types/accountTypes";
import {
  ChevronDown,
  ChevronUp,
  Info,
  ChevronRight,
} from "lucide-react";
import {
  cn,
  formatCurrency as formatCurrencyWithCurrency,
} from "@/lib/utils";

const CASH_TOTAL_CATEGORIES = new Set([
  "cash",
  "savings",
  "debit",
  "e_wallet",
  "investment",
]);

const PAYABLE_TOTAL_CATEGORIES = new Set(["credit_card"]);

const accountAmountColorClass = (value: number): string => {
  if (value < 0) {
    return "text-red-900 dark:text-red-700";
  }
  if (value > 0) {
    return "text-teal-600 dark:text-teal-500";
  }
  return "text-gray-500 dark:text-muted-foreground";
};
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { getCurrentRate } from "@/services/exchangeRates/queries";
import { useAccounts } from "@/hooks/async/useAccounts";
import Link from "next/link";

interface AccountListProps {
  accounts: Account[];
  balanceTotals?: AccountBalanceTotals | null;
  /** Optional override for space currency (e.g. when not inside space context). */
  totalBalanceCurrency?: string;
}

interface TotalDisplayProps {
  label: string;
  amount: number;
  currency: string;
  isLoading: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

const TotalDisplay: React.FC<TotalDisplayProps> = ({
  label,
  amount,
  currency,
  isLoading,
  align = "right",
  className,
}) => (
  <div
    className={cn(
      "rounded-lg border border-gray-200 bg-white px-4 py-3 text-xl",
      "dark:border-border dark:bg-card dark:shadow-sm",
      align === "left" && "text-left",
      align === "center" && "text-center",
      align === "right" && "text-right",
      className,
    )}
  >
    <div className="text-sm text-muted-foreground font-normal">{label}</div>
    {isLoading ? (
      <span className="font-medium text-muted-foreground">…</span>
    ) : (
      <span
        className={`font-medium ${accountAmountColorClass(amount)}`}
      >
        {formatCurrencyWithCurrency(amount, currency)}
      </span>
    )}
  </div>
);

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  balanceTotals,
  totalBalanceCurrency: totalBalanceCurrencyProp,
}) => {
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency =
    totalBalanceCurrencyProp ?? currentSpace?.currency ?? "PHP";

  const { accountCategoryOptions } = useAccounts();
  const [ratesToSpace, setRatesToSpace] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showConvertedForCurrency, setShowConvertedForCurrency] = useState<
    string | null
  >(null);

  const parseBalance = (balance: string): number => {
    return parseFloat(balance) || 0;
  };

  const accountCurrencies = React.useMemo(() => {
    const set = new Set<string>();
    for (const account of accounts) {
      set.add(account.balanceCurrency ?? "PHP");
    }
    return Array.from(set);
  }, [accounts]);

  React.useEffect(() => {
    const needRates = accountCurrencies.filter((c) => c !== spaceCurrency);
    if (needRates.length === 0) {
      setRatesToSpace({ [spaceCurrency]: 1 });
      setRatesLoading(false);
      return;
    }
    setRatesLoading(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    Promise.all(
      needRates.map((fromCurrency) =>
        getCurrentRate(api, fromCurrency, spaceCurrency, todayStr)
          .then((data) => ({ fromCurrency, rate: Number(data.rate) }))
          .catch(() => ({ fromCurrency, rate: 1 })),
      ),
    )
      .then((results) => {
        const map: Record<string, number> = { [spaceCurrency]: 1 };
        for (const { fromCurrency, rate } of results) {
          map[fromCurrency] = rate;
        }
        setRatesToSpace(map);
      })
      .catch(() => setRatesToSpace({ [spaceCurrency]: 1 }))
      .finally(() => setRatesLoading(false));
  }, [api, spaceCurrency, accountCurrencies.join(",")]);

  const balanceInSpaceCurrency = React.useCallback(
    (account: Account) => {
      const currency = account.balanceCurrency ?? "PHP";
      const rate = ratesToSpace[currency] ?? 1;
      return parseBalance(account.balance) * rate;
    },
    [ratesToSpace],
  );

  const totalInSpaceCurrency = React.useMemo(() => {
    return accounts.reduce(
      (sum, account) => sum + balanceInSpaceCurrency(account),
      0,
    );
  }, [accounts, balanceInSpaceCurrency]);

  const cashOnlyInSpaceCurrency = React.useMemo(() => {
    if (balanceTotals) return balanceTotals.cashTotal;

    return accounts
      .filter((account) => CASH_TOTAL_CATEGORIES.has(account.accountCategory))
      .reduce((sum, account) => sum + balanceInSpaceCurrency(account), 0);
  }, [accounts, balanceInSpaceCurrency, balanceTotals]);

  const payableOnlyInSpaceCurrency = React.useMemo(() => {
    if (balanceTotals) return balanceTotals.payableTotal;

    return accounts
      .filter((account) => PAYABLE_TOTAL_CATEGORIES.has(account.accountCategory))
      .reduce((sum, account) => sum + balanceInSpaceCurrency(account), 0);
  }, [accounts, balanceInSpaceCurrency, balanceTotals]);

  const displayTotalInSpaceCurrency = balanceTotals?.total ?? totalInSpaceCurrency;
  const totalsCurrency =
    balanceTotals?.currency ?? spaceCurrency;
  const currencySuffix = ` (in ${totalsCurrency})`;

  const balancesByCurrency = React.useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const account of accounts) {
      const code = account.balanceCurrency ?? "PHP";
      const current = byCurrency.get(code) ?? 0;
      byCurrency.set(code, current + parseBalance(account.balance));
    }
    return Array.from(byCurrency.entries())
      .map(([currency, total]) => ({ currency, total }))
      .slice(0, 3);
  }, [accounts]);

  const getCategoryLabel = (categoryValue: string): string => {
    const category = accountCategoryOptions.find(
      (option) => option.value === categoryValue,
    );
    return category ? category.label : categoryValue;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 mb-2">
          <TotalDisplay
            label={`Total${currencySuffix}`}
            amount={displayTotalInSpaceCurrency}
            currency={totalsCurrency}
            isLoading={ratesLoading && !balanceTotals}
            align="center"
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-4">
            <TotalDisplay
              label={`Cash only${currencySuffix}`}
              amount={cashOnlyInSpaceCurrency}
              currency={totalsCurrency}
              isLoading={ratesLoading && !balanceTotals}
              align="left"
            />
            <TotalDisplay
              label={`Credit Card${currencySuffix}`}
              amount={payableOnlyInSpaceCurrency}
              currency={totalsCurrency}
              isLoading={ratesLoading && !balanceTotals}
              align="right"
            />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-medium">Your Accounts</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground -mr-2"
            onClick={() => setShowMoreInfo((v) => !v)}
          >
            {showMoreInfo ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <Info className="h-4 w-4 mr-1" />
                Show more information
              </>
            )}
          </Button>
        </div>
        {showMoreInfo && balancesByCurrency.length > 0 && (
          <div className="rounded-md border border-gray-200 bg-muted/30 p-3 space-y-1.5">
            {balancesByCurrency.map(({ currency, total }) => {
              const isSpaceCurrency = currency === spaceCurrency;
              const rate = ratesToSpace[currency] ?? 1;
              const convertedInSpace = total * rate;
              const showConverted = showConvertedForCurrency === currency;
              return (
                <div key={currency} className="space-y-0.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{currency}</span>
                    {isSpaceCurrency ? (
                      <span className={`font-medium ${accountAmountColorClass(total)}`}>
                        {formatCurrencyWithCurrency(total, currency)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setShowConvertedForCurrency((c) =>
                            c === currency ? null : currency,
                          )
                        }
                        className={cn(
                          "font-medium text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded",
                          accountAmountColorClass(total),
                        )}
                        title={`Show equivalent in ${spaceCurrency}`}
                      >
                        {formatCurrencyWithCurrency(total, currency)}
                      </button>
                    )}
                  </div>
                  {!isSpaceCurrency && showConverted && !ratesLoading && (
                    <div className="text-xs text-muted-foreground pl-1 flex justify-end">
                      ≈{" "}
                      {formatCurrencyWithCurrency(
                        convertedInSpace,
                        spaceCurrency,
                      )}{" "}
                      <span className="italic">(today&apos;s rate)</span>
                    </div>
                  )}
                </div>
              );
            })}
            {accountCurrencies.length > 1 && !ratesLoading && (
              <div className="flex justify-between items-center text-sm pt-1.5 border-t border-gray-200 mt-1.5">
                <span className="text-muted-foreground font-medium">
                  Total (in {spaceCurrency})
                </span>
                <span
                  className={`font-medium ${accountAmountColorClass(displayTotalInSpaceCurrency)}`}
                >
                  {formatCurrencyWithCurrency(
                    displayTotalInSpaceCurrency,
                    totalsCurrency,
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {accounts.map((account) => {
          const balanceAmount = parseBalance(account.balance);
          return (
            <Link
              key={account.id}
              href={`/dashboard/space_settings/accounts/detail?accountId=${encodeURIComponent(account.id)}`}
              className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 dark:border-0 dark:bg-card dark:shadow-sm dark:hover:bg-accent/50"
            >
              <div className="flex min-w-0 flex-1 items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{account.name}</p>
                  <p className="truncate text-sm text-gray-500 dark:text-muted-foreground">
                    {getCategoryLabel(account.accountCategory)}
                  </p>
                </div>
              </div>
              <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                <span
                  className={`text-lg font-medium ${accountAmountColorClass(balanceAmount)}`}
                >
                  {formatCurrencyWithCurrency(
                    balanceAmount,
                    account.balanceCurrency ?? "PHP",
                  )}
                </span>
                <ChevronRight
                  className="h-5 w-5 text-muted-foreground group-hover:text-foreground"
                  aria-hidden
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AccountList;
