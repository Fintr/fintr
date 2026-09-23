"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Bell,
  Camera,
  ChevronRight,
  User,
} from "lucide-react";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { cn, shouldShowV2Features } from "@/lib/utils";
import {
  calculateBottomPadding,
} from "@/lib/platform-detection";
import { monthNames } from "@/utils/dateUtils";
import { accountCategoryLabels } from "@/types/accountTypes";
import { getAccountCategoryIcon } from "@/utils/accountCategoryIcon";
import { AnimatedCurrency } from "@/components/ui/animated-currency";
import LoadingSpinner from "@/components/ui/loading-spinner";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import AddReceiptDialog from "@/components/dashboard/add-receipt-dialog";
import { HomeSection } from "@/components/dashboard/tabs/home/home-section";
import { HomeRecentTransactions } from "@/components/dashboard/tabs/home/home-recent-transactions";
import { HomeLoansSection } from "@/components/dashboard/tabs/home/home-loans-section";
import { HomeExchangeRatesSection } from "@/components/dashboard/tabs/home/home-exchange-rates-section";
import { TagsTravelHintPill } from "@/components/dashboard/tags-travel-hint-pill";
import { useTransactionTags } from "@/hooks/async/useTransactionTags";
import { usePrefetchAccountDetailRoutes } from "@/hooks/usePrefetchAccountDetailRoutes";
import { HOME_CONTENT_SHEET_Z_CLASS } from "@/lib/dashboard-chrome-stacking";
import { syncDocumentScreenClass } from "@/lib/document-screen-class";

const parseBalance = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCategoryLabel = (categoryValue: string): string => {
  const normalized = categoryValue.toLowerCase() as keyof typeof accountCategoryLabels;
  return accountCategoryLabels[normalized] ?? categoryValue;
};

const HomeTab = ({ isActive = true }: { isActive?: boolean }) => {
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

  const { accounts, balanceTotals, isLoading: isLoadingAccounts } =
    useAccounts();
  usePrefetchAccountDetailRoutes(accounts);
  const { defaultTag } = useTransactionTags();

  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [addTransactionType, setAddTransactionType] = useState<
    "expense" | "transfer"
  >("transfer");
  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false);
  const [prefilledTransactionData, setPrefilledTransactionData] =
    useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    return syncDocumentScreenClass("fintr-home-screen", isActive);
  }, [isActive]);

  const dashboardMonthLabel = useMemo(() => {
    const now = new Date();
    const month = monthNames[now.getMonth()]?.label ?? "This month";
    return `${month} ${now.getFullYear()}`;
  }, []);

  const currentBalance = balanceTotals?.total ?? 0;
  const balanceCurrency = balanceTotals?.currency ?? spaceCurrency;
  const previewAccounts = accounts.slice(0, 3);
  const isLoadingBalance = isLoadingAccounts && !balanceTotals;

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

            {showV2Features ? (
              <Link
                href="/dashboard/insights"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                aria-label="Open dashboard"
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
            <div className="mt-3 flex justify-center">
              <Link
                href="/dashboard/insights"
                className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30"
              >
                View {dashboardMonthLabel} on Dashboard
                <ChevronRight className="h-3.5 w-3.5 opacity-80" />
              </Link>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "relative -mt-12 flex-1 rounded-t-[28px] bg-background px-4 pt-6 pb-8",
            HOME_CONTENT_SHEET_Z_CLASS,
          )}
          style={
            isMobile ? { paddingBottom: mobileBottomPadding } : undefined
          }
        >
          <div className="mb-6">
            <TagsTravelHintPill defaultTag={defaultTag} />
          </div>

          <div className="flex justify-center gap-10">
            <button
              type="button"
              onClick={() => {
                setAddTransactionType("transfer");
                setIsAddTransactionOpen(true);
              }}
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
                        className={cn(
                          "text-sm font-semibold",
                          balanceAmount < 0
                            ? "text-red-800 dark:text-red-400"
                            : "text-primary",
                        )}
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

      {isAddTransactionOpen ? (
        <AddTransactionDialog
          isOpen={isAddTransactionOpen}
          onClose={() => {
            setIsAddTransactionOpen(false);
            setPrefilledTransactionData(null);
          }}
          initialTransactionType={addTransactionType}
          prefilledData={prefilledTransactionData ?? undefined}
        />
      ) : null}
      {isAddReceiptOpen ? (
        <AddReceiptDialog
          isOpen={isAddReceiptOpen}
          onClose={() => setIsAddReceiptOpen(false)}
          onReceiptSuccess={handleReceiptSuccess}
        />
      ) : null}
    </>
  );
};

export default HomeTab;
