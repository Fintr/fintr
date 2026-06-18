"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarLucide,
  Clock,
  FileText,
  Percent,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { cn, formatCurrency } from "@/lib/utils";
import { useLoan, LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import { LoanDetailPanel } from "@/components/dashboard/loan-detail-panel";
import { LoanSummaryStats } from "@/components/dashboard/loan-summary-stats";
import EditLoanModal from "@/components/dashboard/forms/EditLoanModal";
import DeleteLoanModal from "@/components/dashboard/forms/DeleteLoanModal";
import { useAuthApi } from "@/hooks/useAuthApi";
import { deleteLoan } from "@/services/loans/mutation";
import { useQueryClient } from "@tanstack/react-query";
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { formatLoanTerm } from "@/utils/formatLoanTerm";

type LoanDetailContentProps = {
  loanId: string;
};

type DetailItemProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

function DetailStatBox({ icon, label, value }: DetailItemProps) {
  return (
    <div
      className={cn(
        "min-w-[9.5rem] shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3",
        "dark:border-border dark:bg-card",
        "sm:min-w-0 sm:flex-1",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <dt className="text-xs font-medium capitalize">{label}</dt>
      </div>
      <dd className="text-sm font-semibold text-foreground md:text-base">{value}</dd>
    </div>
  );
}

export default function LoanDetailContent({ loanId }: LoanDetailContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: loan, isLoading, isError, error, refetch } = useLoan(loanId);
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions write:transactions",
  });

  const handleDeleteLoan = async (id: string) => {
    if (!api) {
      throw new Error("API not available");
    }

    const response = await deleteLoan(api, id);
    queryClient.invalidateQueries({ queryKey: ["loans"] });
    queryClient.invalidateQueries({ queryKey: [LOAN_DETAIL_KEY, id] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({
      queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
      exact: false,
    });
    router.push("/dashboard/loans");
    return response;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (isError || !loan) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8">
        <p className="text-red-900">
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
  const textColorClass = isBorrowed
    ? "text-red-900 dark:text-red-700"
    : "text-teal-600 dark:text-teal-500";
  const statusColorClass =
    loan.status === "paid_off"
      ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
      : loan.status === "defaulted"
        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-700"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400";
  const loanTypeBadgeClass = isBorrowed
    ? "bg-red-800/10 text-red-900 dark:bg-red-800/20 dark:text-red-700"
    : "bg-teal-600/10 text-teal-600 dark:bg-teal-600/20 dark:text-teal-500";

  const loanTitle = loan.description?.trim() || loan.entityName;

  return (
    <div className="max-w-3xl mx-auto px-2 pb-24 md:pb-8 space-y-5">
      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-primary truncate md:text-2xl">
              {loanTitle}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  statusColorClass,
                )}
              >
                {loan.status.replace("_", " ")}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  loanTypeBadgeClass,
                )}
              >
                {isBorrowed ? "Borrowed" : "Lent"}
              </span>
              {loan.adjustsAccountBalance === false ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Ledger only
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 mb-6 text-center">
          <p className="text-xs text-muted-foreground md:text-sm">
            Outstanding balance
          </p>
          <p
            className={cn(
              "mt-2 text-3xl font-bold tracking-tight md:text-4xl",
              textColorClass,
            )}
          >
            {formatCurrency(
              loan.outstandingBalance,
              loan.outstandingBalanceCurrency,
            )}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <EditLoanModal loan={loan} triggerVariant="toolbar" />
          <DeleteLoanModal
            loan={loan}
            onDelete={handleDeleteLoan}
            triggerVariant="toolbar"
          />
        </div>
      </section>

      <LoanSummaryStats
        loan={loan}
        isBorrowed={isBorrowed}
        textColorClass={textColorClass}
      />

      <section className="space-y-3">
        <dl className="flex gap-2.5 overflow-x-auto pb-1 sm:overflow-visible">
          <DetailStatBox
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Term"
            value={formatLoanTerm(loan.loanTermMonths)}
          />
          <DetailStatBox
            icon={<Percent className="h-3.5 w-3.5" />}
            label="Interest rate"
            value={`${loan.interestRate}%`}
          />
          <DetailStatBox
            icon={<CalendarLucide className="h-3.5 w-3.5" />}
            label="Start date"
            value={loanDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <DetailStatBox
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Maturity date"
            value={maturityDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <DetailStatBox
            icon={<User className="h-3.5 w-3.5" />}
            label={isBorrowed ? "Lender" : "Borrower"}
            value={loan.entityName}
          />
          {loan.files && loan.files.length > 0 ? (
            <DetailStatBox
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Attachments"
              value={`${loan.files.length} file${loan.files.length > 1 ? "s" : ""}`}
            />
          ) : null}
        </dl>
      </section>

      <LoanDetailPanel
        loan={loan}
        isBorrowed={isBorrowed}
        textColorClass={textColorClass}
      />
    </div>
  );
}
