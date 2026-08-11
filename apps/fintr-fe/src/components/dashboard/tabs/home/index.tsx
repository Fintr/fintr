"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAtom, useAtomValue } from "jotai";
import {
  ArrowLeftRight,
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  PiggyBank,
  Plus,
  User,
  Wallet,
} from "lucide-react";
import {
  dateFilterEndDateAtom,
  dateFilterMonthYearAtom,
  dateFilterStartDateAtom,
  monthYearToDateRange,
} from "@/atoms/dateFilterAtoms";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { formatCurrency, shouldShowV2Features } from "@/lib/utils";
import {
  calculateBottomPadding,
} from "@/lib/platform-detection";
import {
  getYearOptions,
  monthNames,
} from "@/utils/dateUtils";
import { accountCategoryLabels } from "@/types/accountTypes";
import { getAccountCategoryIcon } from "@/utils/accountCategoryIcon";
import { AnimatedCurrency } from "@/components/ui/animated-currency";
import LoadingSpinner from "@/components/ui/loading-spinner";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import AddReceiptDialog from "@/components/dashboard/add-receipt-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HomeSection } from "@/components/dashboard/tabs/home/home-section";
import { HomeRecentTransactions } from "@/components/dashboard/tabs/home/home-recent-transactions";
import { HomeLoansSection } from "@/components/dashboard/tabs/home/home-loans-section";
import { HomeExchangeRatesSection } from "@/components/dashboard/tabs/home/home-exchange-rates-section";
import { TagsTravelHintPill } from "@/components/dashboard/tags-travel-hint-pill";
import { useTransactionTags } from "@/hooks/async/useTransactionTags";

const parseBalance = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCategoryLabel = (categoryValue: string): string => {
  const normalized = categoryValue.toLowerCase() as keyof typeof accountCategoryLabels;
  return accountCategoryLabels[normalized] ?? categoryValue;
};

const HomeTab = () => {
  const { user } = useAuth();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const showV2Features = shouldShowV2Features();
  const {
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();
  const mobileBottomPadding = calculateBottomPadding(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  );
  const isMobile = useMediaQuery("(max-width: 768px)");

  const startDate = useAtomValue(dateFilterStartDateAtom);
  const endDate = useAtomValue(dateFilterEndDateAtom);
  const monthYear = useAtomValue(dateFilterMonthYearAtom);
  const [, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [, setEndDate] = useAtom(dateFilterEndDateAtom);

  const { data: dashboardData, isLoading: isLoadingDashboard } =
    useDashboardData(startDate, endDate);
  const { accounts, balanceTotals, isLoading: isLoadingAccounts } =
    useAccounts();
  const { defaultTag } = useTransactionTags();

  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(monthYear.selectedMonth);
  const [pickerYear, setPickerYear] = useState(monthYear.selectedYear);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [addTransactionType, setAddTransactionType] = useState<
    "expense" | "transfer"
  >("expense");
  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false);
  const [prefilledTransactionData, setPrefilledTransactionData] =
    useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("fintr-home-screen");

    return () => {
      document.documentElement.classList.remove("fintr-home-screen");
    };
  }, []);

  const monthLabel = useMemo(() => {
    const month = monthNames.find(
      (entry) => entry.value === monthYear.selectedMonth,
    );
    return `${month?.label ?? "Month"} ${monthYear.selectedYear}`;
  }, [monthYear.selectedMonth, monthYear.selectedYear]);

  const currentBalance = balanceTotals?.total ?? 0;
  const balanceCurrency = balanceTotals?.currency ?? spaceCurrency;

  const totalIncome = Number.parseFloat(
    dashboardData?.financialSummary?.totalIncome ?? "0",
  );
  const totalExpenses = Number.parseFloat(
    dashboardData?.financialSummary?.totalExpenses ?? "0",
  );
  const netSavings = Number.parseFloat(
    dashboardData?.financialSummary?.netSavings ?? "0",
  );

  const balanceChangeLabel = useMemo(() => {
    if (!Number.isFinite(netSavings) || netSavings === 0) {
      return null;
    }

    const prefix = netSavings > 0 ? "+" : "";
    return `${prefix}${formatCurrency(netSavings, spaceCurrency)} this month`;
  }, [netSavings, spaceCurrency]);

  const previewAccounts = accounts.slice(0, 3);
  const isLoadingBalance = isLoadingAccounts && !balanceTotals;
  const isLoadingSummary = isLoadingDashboard && !dashboardData;

  const handleApplyMonthPicker = () => {
    const { startDate: nextStart, endDate: nextEnd } = monthYearToDateRange(
      pickerMonth,
      pickerYear,
      pickerMonth,
      pickerYear,
    );
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setIsMonthPickerOpen(false);
  };

  const handleOpenMonthPicker = (open: boolean) => {
    if (open) {
      setPickerMonth(monthYear.selectedMonth);
      setPickerYear(monthYear.selectedYear);
    }
    setIsMonthPickerOpen(open);
  };

  const handleOpenAddTransaction = (type: "expense" | "transfer") => {
    setAddTransactionType(type);
    setIsAddTransactionOpen(true);
  };

  const handleReceiptSuccess = (
    suggestedTransactionPayload: Record<string, unknown>,
    receiptImage: File,
    draftId?: string,
  ) => {
    setPrefilledTransactionData({
      amount: suggestedTransactionPayload?.amount,
      description: suggestedTransactionPayload?.description,
      categoryName:
        suggestedTransactionPayload?.categoryName ||
        suggestedTransactionPayload?.category_name,
      accountName:
        suggestedTransactionPayload?.accountName ||
        suggestedTransactionPayload?.account_name,
      date: suggestedTransactionPayload?.date,
      scheduleType:
        suggestedTransactionPayload?.scheduleType ||
        suggestedTransactionPayload?.schedule_type,
      entityName:
        suggestedTransactionPayload?.entityName ||
        suggestedTransactionPayload?.entity_name,
      receiptMerchantDetected:
        suggestedTransactionPayload?.receiptMerchantDetected ||
        suggestedTransactionPayload?.receipt_merchant_detected,
      receiptImage,
      draftId,
    });
    setAddTransactionType("expense");
    setIsAddTransactionOpen(true);
  };

  return (
    <>
      <div className="flex min-h-full flex-col md:rounded-t-xl md:overflow-hidden">
        <section
          className="shrink-0 bg-primary px-4 pb-20 text-white"
          style={{
            paddingTop:
              "max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
          }}
        >
          <div className="flex items-center justify-between gap-3 pb-3 pt-3">
            <Link
              href="/dashboard/app_settings"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
              aria-label="Open profile and menu"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name ? `${user.name}'s profile` : "Profile"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </Link>

            <Popover open={isMonthPickerOpen} onOpenChange={handleOpenMonthPicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/25"
                  aria-label="Change month"
                >
                  {monthLabel}
                  <ChevronDown className="h-4 w-4 opacity-80" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-72 space-y-4 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">Month</p>
                  <Select value={pickerMonth} onValueChange={setPickerMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">Year</p>
                  <Select value={pickerYear} onValueChange={setPickerYear}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {getYearOptions().map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleApplyMonthPicker}
                >
                  Apply
                </Button>
              </PopoverContent>
            </Popover>

            {showV2Features ? (
              <Link
                href="/dashboard/insights"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                aria-label="View notifications and insights"
              >
                <Bell className="h-5 w-5" />
              </Link>
            ) : (
              <div className="h-10 w-10" aria-hidden />
            )}
          </div>

          <div className="pb-2 pt-4 text-center">
            <p className="text-sm font-medium text-white/80">Current Balance</p>
            {isLoadingBalance ? (
              <div className="flex justify-center py-6">
                <LoadingSpinner size="medium" />
              </div>
            ) : (
              <div className="mt-2 flex justify-center">
                <AnimatedCurrency
                  amount={currentBalance}
                  currency={balanceCurrency}
                  className="text-4xl font-bold tracking-tight text-white"
                  maximumFractionDigits={0}
                />
              </div>
            )}
            {balanceChangeLabel ? (
              <div className="mt-3 flex justify-center">
                <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
                  {balanceChangeLabel}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="relative z-20 -mt-12 flex-1 rounded-t-[28px] bg-background px-4 pt-6 pb-8"
          style={
            isMobile ? { paddingBottom: mobileBottomPadding } : undefined
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-500">
                <PiggyBank className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {isLoadingSummary || totalIncome === 0
                  ? "—"
                  : formatCurrency(totalIncome, spaceCurrency)}
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-700 dark:text-red-500">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {isLoadingSummary || totalExpenses === 0
                  ? "—"
                  : formatCurrency(totalExpenses, spaceCurrency)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <TagsTravelHintPill defaultTag={defaultTag} />
          </div>

          <div className="mt-6 grid grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleOpenAddTransaction("expense")}
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-primary">Transaction</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddTransaction("transfer")}
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-500">
                <ArrowLeftRight className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-primary">Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddReceiptOpen(true)}
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-500">
                <Camera className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-primary">Scan Receipt</span>
            </button>

            <Link
              href="/dashboard/app_settings"
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MoreHorizontal className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-primary">More</span>
            </Link>
          </div>

          <HomeSection
            title="Accounts"
            href="/dashboard/space_settings/accounts"
          >
            {previewAccounts.length > 0 ? (
              <div className="space-y-2">
                {previewAccounts.map((account) => {
                  const balanceAmount = parseBalance(account.balance);
                  const AccountIcon = getAccountCategoryIcon(
                    account.accountCategory,
                  );

                  return (
                    <Link
                      key={account.id}
                      href={`/dashboard/space_settings/accounts/detail?accountId=${encodeURIComponent(account.id)}`}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                          <AccountIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary">
                            {account.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryLabel(account.accountCategory)}
                          </p>
                        </div>
                      </div>
                      <AnimatedCurrency
                        amount={balanceAmount}
                        currency={account.balanceCurrency ?? spaceCurrency}
                        className="text-sm font-semibold text-primary"
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                No accounts yet.
              </p>
            )}
          </HomeSection>

          <HomeRecentTransactions spaceCurrency={spaceCurrency} />
          <HomeLoansSection />
          <HomeExchangeRatesSection
            spaceCurrency={spaceCurrency}
            accounts={accounts}
          />
        </section>
      </div>

      <AddTransactionDialog
        isOpen={isAddTransactionOpen}
        onClose={() => {
          setIsAddTransactionOpen(false);
          setPrefilledTransactionData(null);
        }}
        initialTransactionType={addTransactionType}
        prefilledData={prefilledTransactionData ?? undefined}
      />
      <AddReceiptDialog
        isOpen={isAddReceiptOpen}
        onClose={() => setIsAddReceiptOpen(false)}
        onReceiptSuccess={handleReceiptSuccess}
      />
    </>
  );
};

export default HomeTab;
