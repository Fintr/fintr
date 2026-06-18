import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Account, AccountBalanceTotals } from "@/types/accountTypes";
import {
  ChevronDown,
  ChevronUp,
  Info,
  ChevronRight,
  Wallet,
  CreditCard,
} from "lucide-react";
import {
  cn,
} from "@/lib/utils";
import AddAccountSheet from "@/components/dashboard/add-account-sheet";
import { AnimatedCurrency } from "@/components/ui/animated-currency";
import { getAccountCategoryIcon } from "@/utils/accountCategoryIcon";

const CASH_TOTAL_CATEGORIES = new Set([
  "cash",
  "savings",
  "debit",
  "e_wallet",
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
  label?: string;
  amount: number;
  currency: string;
  isLoading: boolean;
  align?: "left" | "center" | "right";
  variant?: "card" | "plain";
  className?: string;
  icon?: React.ReactNode;
}

const TotalDisplay: React.FC<TotalDisplayProps> = ({
  label,
  amount,
  currency,
  isLoading,
  align = "right",
  variant = "card",
  className,
  icon,
}) => {
  const hasIcon = Boolean(icon);

  return (
    <div
      className={cn(
        "px-4 py-3",
        variant === "card" && [
          "rounded-lg bg-white",
          "dark:bg-card dark:shadow-sm",
        ],
        variant === "plain" && "border-0 bg-transparent shadow-none",
        !hasIcon && align === "left" && "text-left",
        !hasIcon && align === "center" && "text-center",
        !hasIcon && align === "right" && "text-right",
        className,
      )}
    >
      <div className={cn(hasIcon && "flex items-center gap-3")}>
        {hasIcon ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className={cn(hasIcon && "min-w-0 flex-1 text-left")}>
          {label ? (
            <div className="text-sm font-normal text-muted-foreground">
              {label}
            </div>
          ) : null}
          {isLoading ? (
            <span
              className={cn(
                "block font-semibold text-muted-foreground",
                variant === "plain" && "text-2xl md:text-3xl",
                variant === "card" && "text-base md:text-lg",
                label && "mt-1",
              )}
            >
              …
            </span>
          ) : (
            <AnimatedCurrency
              amount={amount}
              currency={currency}
              enabled={!isLoading}
              maximumFractionDigits={variant === "card" ? 0 : undefined}
              className={cn(
                "block font-semibold tracking-tight",
                variant === "plain" && "text-2xl md:text-3xl",
                variant === "card" && "text-base md:text-lg",
                label && "mt-1",
                accountAmountColorClass(amount),
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
};

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
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-6">
          <TotalDisplay
            label="Total Balance"
            amount={displayTotalInSpaceCurrency}
            currency={totalsCurrency}
            isLoading={ratesLoading && !balanceTotals}
            align="center"
            variant="plain"
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-4">
            <TotalDisplay
              label="Cash only"
              amount={cashOnlyInSpaceCurrency}
              currency={totalsCurrency}
              isLoading={ratesLoading && !balanceTotals}
              icon={<Wallet className="h-5 w-5" />}
            />
            <TotalDisplay
              label="Credit Card"
              amount={payableOnlyInSpaceCurrency}
              currency={totalsCurrency}
              isLoading={ratesLoading && !balanceTotals}
              icon={<CreditCard className="h-5 w-5" />}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-medium">Your Accounts</h3>
            <AddAccountSheet />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground w-fit -ml-3"
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
                      <AnimatedCurrency
                        amount={total}
                        currency={currency}
                        className={cn(
                          "font-medium",
                          accountAmountColorClass(total),
                        )}
                      />
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
                        <AnimatedCurrency
                          amount={total}
                          currency={currency}
                        />
                      </button>
                    )}
                  </div>
                  {!isSpaceCurrency && showConverted && !ratesLoading && (
                    <div className="text-xs text-muted-foreground pl-1 flex justify-end">
                      ≈{" "}
                      <AnimatedCurrency
                        amount={convertedInSpace}
                        currency={spaceCurrency}
                      />{" "}
                      <span className="italic">(today&apos;s rate)</span>
                    </div>
                  )}
                </div>
              );
            })}
            {accountCurrencies.length > 1 && !ratesLoading && (
              <div className="flex justify-between items-center text-sm pt-1.5 border-t border-gray-200 mt-1.5">
                <span className="text-muted-foreground font-medium">
                  Total
                </span>
                <AnimatedCurrency
                  amount={displayTotalInSpaceCurrency}
                  currency={totalsCurrency}
                  className={cn(
                    "font-medium",
                    accountAmountColorClass(displayTotalInSpaceCurrency),
                  )}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {accounts.map((account) => {
          const balanceAmount = parseBalance(account.balance);
          const AccountIcon = getAccountCategoryIcon(account.accountCategory);

          return (
            <Link
              key={account.id}
              href={`/dashboard/space_settings/accounts/detail?accountId=${encodeURIComponent(account.id)}`}
              className="group flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 dark:border-0 dark:bg-card dark:shadow-sm dark:hover:bg-accent/50"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
                  aria-hidden
                >
                  <AccountIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium break-words leading-snug">
                    {account.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-muted-foreground">
                    {getCategoryLabel(account.accountCategory)}
                  </p>
                </div>
              </div>
              <div className="ml-2 flex flex-shrink-0 items-center gap-2 self-center">
                <AnimatedCurrency
                  amount={balanceAmount}
                  currency={account.balanceCurrency ?? "PHP"}
                  className={cn(
                    "text-lg font-medium",
                    accountAmountColorClass(balanceAmount),
                  )}
                />
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
