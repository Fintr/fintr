"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar as CalendarLucide,
  CheckCircle2,
  Clock,
  FileText,
  Percent,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { cn, formatCurrency } from "@/lib/utils";
import { useLoan, LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import { LoanDetailPanel } from "@/components/dashboard/loan-detail-panel";
import { LoanSummaryStats } from "@/components/dashboard/loan-summary-stats";
import { LoanPaydownProgress } from "@/components/dashboard/loan-paydown-progress";
import EditLoanModal from "@/components/dashboard/forms/EditLoanModal";
import DeleteLoanModal from "@/components/dashboard/forms/DeleteLoanModal";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { deleteLoanLocalFirst } from "@/services/loans/delete-local-first";
import { useQueryClient } from "@tanstack/react-query";
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { formatLoanTerm } from "@/utils/formatLoanTerm";
import {
  formatLoanDueLabel,
  getNextLoanPaymentDeadline,
} from "@/utils/loan-upcoming-deadlines";
import type { LoanPaymentPrefill } from "@/types/loanPaymentTypes";

type LoanDetailContentProps = {
  loanId: string;
};

type MetadataItemProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

function MetadataItem({ icon, label, value }: MetadataItemProps) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <dt className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </dt>
      </div>
      <dd className="truncate text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

export default function LoanDetailContent({ loanId }: LoanDetailContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { data: loan, isLoading, isError, error, refetch } = useLoan(loanId);
  const [openPaymentRequestId, setOpenPaymentRequestId] = React.useState(0);
  const [paymentPrefill, setPaymentPrefill] =
    React.useState<LoanPaymentPrefill | null>(null);
  const handledRecordPaymentParam = React.useRef(false);
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions write:transactions",
  });

  const handleDeleteLoan = async (id: string) => {
    if (!api) {
      throw new Error("API not available");
    }

    if (!loan || !spaceCode) {
      throw new Error("Loan not found");
    }

    const result = await deleteLoanLocalFirst(
      api,
      { spaceId: spaceCode, loan },
      { queryClient, waitForSync: false },
    );

    router.push("/dashboard/loans");

    void Promise.resolve(result.syncPromise)
      .then(async (synced) => {
        if (synced.pendingSync) {
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["loans"] });
        await queryClient.invalidateQueries({ queryKey: [LOAN_DETAIL_KEY, id] });
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        await queryClient.invalidateQueries({
          queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
          exact: false,
        });
      })
      .catch(() => undefined);

    return { success: true, pendingSync: result.pendingSync };
  };

  const requestOpenPayment = React.useCallback((prefill?: LoanPaymentPrefill) => {
    setPaymentPrefill(prefill ?? null);
    setOpenPaymentRequestId((current) => current + 1);
  }, []);

  React.useEffect(() => {
    if (handledRecordPaymentParam.current || !loan) {
      return;
    }

    if (searchParams.get("recordPayment") !== "1") {
      return;
    }

    handledRecordPaymentParam.current = true;

    const prefillAmount = searchParams.get("prefillAmount");
    requestOpenPayment({
      amount: prefillAmount ?? undefined,
      accountName: loan.accountName,
      date: new Date(),
    });

    router.replace(`/dashboard/loans/detail?loanId=${loanId}`, { scroll: false });
  }, [loan, loanId, requestOpenPayment, router, searchParams]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (isError || !loan) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load loan"}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/loans">Back to loans</Link>
          </Button>
        </div>
      </div>
    );
  }

  const loanDate = new Date(loan.date);
  const maturityDate = new Date(loan.maturityDate);
  const isBorrowed = loan.loanType === "borrowed";
  const accentClass = isBorrowed
    ? "text-red-900 dark:text-red-400"
    : "text-teal-600 dark:text-teal-400";
  const statusColorClass =
    loan.status === "paid_off"
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : loan.status === "defaulted"
        ? "bg-destructive/15 text-destructive"
        : "bg-primary/15 text-primary dark:text-primary-dark-mode";
  const loanTypeBadgeClass = isBorrowed
    ? "bg-red-500/10 text-red-800 dark:text-red-400"
    : "bg-teal-500/10 text-teal-700 dark:text-teal-400";

  const loanTitle = loan.description?.trim() || loan.entityName;
  const principalAmount =
    typeof loan.principalAmount === "string"
      ? parseFloat(loan.principalAmount)
      : loan.principalAmount;
  const nextPaymentDeadline =
    loan.status === "active" ? getNextLoanPaymentDeadline(loan) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 md:pb-8">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-4 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-primary md:text-xl">
                {loanTitle}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                    statusColorClass,
                  )}
                >
                  {loan.status.replace("_", " ")}
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                    loanTypeBadgeClass,
                  )}
                >
                  {isBorrowed ? "Borrowed" : "Lent"}
                </span>
                {loan.adjustsAccountBalance === false ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Ledger only
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <EditLoanModal loan={loan} triggerVariant="toolbar" />
              <DeleteLoanModal
                loan={loan}
                onDelete={handleDeleteLoan}
                triggerVariant="toolbar"
                triggerAccentClassName={accentClass}
              />
            </div>
          </div>
        </div>

        <div className="space-y-5 px-4 py-5 md:px-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Outstanding balance
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-bold tabular-nums tracking-tight md:text-4xl",
                loan.status === "paid_off"
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {formatCurrency(
                loan.outstandingBalance,
                loan.outstandingBalanceCurrency,
              )}
            </p>
            {loan.status !== "paid_off" ? (
              <p className={cn("mt-1 text-sm font-medium", accentClass)}>
                {isBorrowed ? "You owe" : "Owed to you"}
              </p>
            ) : null}
          </div>

          <LoanPaydownProgress
            principalAmount={principalAmount}
            outstandingBalance={loan.outstandingBalance}
            isBorrowed={isBorrowed}
            status={loan.status}
          />

          {loan.status === "paid_off" ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-3">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                  Loan completed
                </p>
                {loan.paidOffDate ? (
                  <p className="mt-0.5 text-xs text-green-700 dark:text-green-500">
                    Paid off on{" "}
                    {new Date(loan.paidOffDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {nextPaymentDeadline ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Next payment
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(
                    nextPaymentDeadline.paymentAmount,
                    loan.outstandingBalanceCurrency,
                  )}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ·{" "}
                    {nextPaymentDeadline.dueDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs font-medium",
                    nextPaymentDeadline.isOverdue
                      ? "text-red-700 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  {formatLoanDueLabel(
                    nextPaymentDeadline.dueDate,
                    nextPaymentDeadline.isOverdue,
                  )}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  requestOpenPayment({
                    amount: String(nextPaymentDeadline.paymentAmount),
                    accountName: loan.accountName,
                    date: new Date(),
                  })
                }
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                Record payment
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <LoanSummaryStats
        loan={loan}
        isBorrowed={isBorrowed}
        textColorClass={accentClass}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Loan details
        </h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetadataItem
            icon={<Clock className="h-3 w-3" />}
            label="Term"
            value={formatLoanTerm(loan.loanTermMonths)}
          />
          <MetadataItem
            icon={<Percent className="h-3 w-3" />}
            label="Rate"
            value={`${loan.interestRate}%`}
          />
          <MetadataItem
            icon={<CalendarLucide className="h-3 w-3" />}
            label="Start"
            value={loanDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <MetadataItem
            icon={<CalendarLucide className="h-3 w-3" />}
            label="Maturity"
            value={maturityDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <MetadataItem
            icon={<User className="h-3 w-3" />}
            label={isBorrowed ? "Lender" : "Borrower"}
            value={loan.entityName}
          />
          {loan.files && loan.files.length > 0 ? (
            <MetadataItem
              icon={<FileText className="h-3 w-3" />}
              label="Files"
              value={`${loan.files.length} attached`}
            />
          ) : null}
        </dl>
      </section>

      <LoanDetailPanel
        loan={loan}
        isBorrowed={isBorrowed}
        textColorClass={accentClass}
        openPaymentRequestId={openPaymentRequestId}
        paymentPrefill={paymentPrefill}
      />
    </div>
  );
}
