"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronRight,
  FileText,
  HandCoins,
  Pencil,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import { useEntityDetail, ENTITY_DETAIL_KEY } from "@/hooks/async/useEntityDetail";
import type { IndexTransaction } from "@/types/transactionTypes";
import { cn, formatCurrency } from "@/lib/utils";
import { EntityEditDialog } from "@/components/dashboard/entities/entity-edit-dialog";
import { merchantMonthlySpend } from "@/utils/merchantMonthlySpend";
import {
  loanContactOutstanding,
  type CurrencyAmount,
} from "@/utils/loanContactOutstanding";
import { transactionViewHref } from "@/utils/detailHrefs";
import {
  activityPresentsAsIncome,
  activityPresentsAsTransfer,
} from "@/utils/activityDisplay";
import {
  formatIndexTransactionListAmount,
  indexTransactionDisplayMoney,
} from "@/utils/indexTransactionDisplay";
import { formatTransactionRowDate } from "@/utils/dateUtils";
import { transactionRowTitle } from "@/utils/transactionDescription";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import type { EntityDetailLoan, EntityDetailLoanPayment } from "@/services/entities/mutation";

type EntityDetailContentProps = {
  entityId: string;
};

const RECENT_LIMIT = 8;

const formatRowDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return format(parsed, "MMM d, yyyy");
};

const SectionHeading = ({
  title,
  count,
}: {
  title: string;
  count?: number;
}) => (
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-primary">{title}</h2>
    {typeof count === "number" ? (
      <span className="text-sm text-muted-foreground">{count}</span>
    ) : null}
  </div>
);

const EmptySection = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const formatCurrencyAmounts = (rows: CurrencyAmount[]): string =>
  rows.map((row) => formatCurrency(row.amount, row.currency)).join(" · ");

export function EntityDetailContent({ entityId }: EntityDetailContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const { data, isLoading, isError, refetch } = useEntityDetail(entityId);
  const [entityEditOpen, setEntityEditOpen] = useState(false);

  const entity = data?.entity;
  const transactions = data?.transactions ?? [];
  const loans = data?.loans ?? [];
  const loanPayments = data?.loanPayments ?? [];
  const identifiers = data?.identifiers ?? [];
  const isMerchant = entity?.entityType === "transaction";

  const merchantSpend = useMemo(
    () => merchantMonthlySpend(transactions),
    [transactions],
  );
  const outstanding = useMemo(
    () => loanContactOutstanding(loans),
    [loans],
  );

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [ENTITY_DETAIL_KEY, entityId] });
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (isError || !entity) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-2 py-8">
        <p className="text-muted-foreground">Could not load this entity.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/space_settings/entities">Back to entities</Link>
          </Button>
        </div>
      </div>
    );
  }

  const entityLabel = isMerchant ? "Merchant" : "Loan contact";
  const recentTransactions = transactions.slice(0, RECENT_LIMIT);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <MerchantAvatar
            name={entity.fullName}
            photoUrl={entity.photoUrl}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-primary">
              {entity.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">{entityLabel}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setEntityEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden />
            Edit
          </Button>
        </div>

        {isMerchant ? (
          <MerchantRelationship
            spend={merchantSpend}
            transactions={recentTransactions}
            totalCount={transactions.length}
            spaceCurrency={spaceCurrency}
            onOpenTransaction={(transaction) =>
              router.push(transactionViewHref(transaction))
            }
          />
        ) : (
          <LoanContactRelationship
            outstanding={outstanding}
            loans={loans}
            loanPayments={loanPayments}
            transactions={recentTransactions}
            spaceCurrency={spaceCurrency}
            onOpenLoan={(loanId) =>
              router.push(
                `/dashboard/loans/detail?loanId=${encodeURIComponent(loanId)}`,
              )
            }
            onOpenTransaction={(transaction) =>
              router.push(transactionViewHref(transaction))
            }
          />
        )}
      </div>

      <EntityEditDialog
        entity={entity}
        entityLabel={entityLabel}
        open={entityEditOpen}
        onOpenChange={setEntityEditOpen}
        onSuccess={handleEditSuccess}
        identifiers={identifiers}
      />
    </>
  );
}

const MerchantRelationship = ({
  spend,
  transactions,
  totalCount,
  spaceCurrency,
  onOpenTransaction,
}: {
  spend: ReturnType<typeof merchantMonthlySpend>;
  transactions: IndexTransaction[];
  totalCount: number;
  spaceCurrency: string;
  onOpenTransaction: (transaction: IndexTransaction) => void;
}) => (
  <div className="space-y-6">
    <section className="rounded-xl border border-border bg-card px-4 py-4">
      <p className="text-sm text-muted-foreground">Spent this month</p>
      <p className="text-3xl font-semibold text-red-900 dark:text-red-700">
        {formatCurrency(spend.thisMonth, spend.currency || spaceCurrency)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Last month{" "}
        {formatCurrency(spend.lastMonth, spend.currency || spaceCurrency)}
      </p>
      {spend.topCategoryName ? (
        <p className="mt-2 text-sm text-foreground">
          Mostly {spend.topCategoryName}
        </p>
      ) : null}
    </section>

    <section className="space-y-3">
      <SectionHeading title="Recent activity" count={totalCount} />
      {transactions.length === 0 ? (
        <EmptySection message="No transactions linked to this merchant yet." />
      ) : (
        <CompactTransactionList
          transactions={transactions}
          spaceCurrency={spaceCurrency}
          onOpenTransaction={onOpenTransaction}
        />
      )}
    </section>
  </div>
);

const LoanContactRelationship = ({
  outstanding,
  loans,
  loanPayments,
  transactions,
  spaceCurrency,
  onOpenLoan,
  onOpenTransaction,
}: {
  outstanding: ReturnType<typeof loanContactOutstanding>;
  loans: EntityDetailLoan[];
  loanPayments: EntityDetailLoanPayment[];
  transactions: IndexTransaction[];
  spaceCurrency: string;
  onOpenLoan: (loanId: string) => void;
  onOpenTransaction: (transaction: IndexTransaction) => void;
}) => {
  const hasYouOwe = outstanding.youOwe.length > 0;
  const hasTheyOwe = outstanding.theyOwe.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card px-4 py-4 space-y-2">
        {!hasYouOwe && !hasTheyOwe ? (
          <>
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-3xl font-semibold text-foreground">
              {formatCurrency(0, spaceCurrency)}
            </p>
          </>
        ) : null}
        {hasYouOwe ? (
          <div>
            <p className="text-sm text-muted-foreground">You owe</p>
            <p className="text-3xl font-semibold text-red-900 dark:text-red-700">
              {formatCurrencyAmounts(outstanding.youOwe)}
            </p>
          </div>
        ) : null}
        {hasTheyOwe ? (
          <div>
            <p className="text-sm text-muted-foreground">They owe you</p>
            <p className="text-3xl font-semibold text-teal-600 dark:text-teal-500">
              {formatCurrencyAmounts(outstanding.theyOwe)}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionHeading title="Loans" count={loans.length} />
        {loans.length === 0 ? (
          <EmptySection message="No loans linked to this contact yet." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {loans.map((loan) => (
              <li key={loan.id}>
                <button
                  type="button"
                  onClick={() => onOpenLoan(loan.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {loan.description || "Loan"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatRowDate(loan.date)}
                      {` · ${loan.loanType === "borrowed" ? "Borrowed" : "Lent"}`}
                      {` · ${loan.status.replace("_", " ")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(loan.outstandingBalance, loan.currency)}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title="Payments" count={loanPayments.length} />
        {loanPayments.length === 0 ? (
          <EmptySection message="No loan payments linked to this contact yet." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {loanPayments.map((payment) => (
              <li key={payment.id}>
                <button
                  type="button"
                  onClick={() => onOpenLoan(payment.loanId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <HandCoins className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {payment.loanDescription || "Loan payment"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatRowDate(payment.date)}
                      {payment.accountName ? ` · ${payment.accountName}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(payment.totalPayment, payment.currency)}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {transactions.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading title="Transactions" count={transactions.length} />
          <CompactTransactionList
            transactions={transactions}
            spaceCurrency={spaceCurrency}
            onOpenTransaction={onOpenTransaction}
          />
        </section>
      ) : null}
    </div>
  );
};

const CompactTransactionList = ({
  transactions,
  spaceCurrency,
  onOpenTransaction,
}: {
  transactions: IndexTransaction[];
  spaceCurrency: string;
  onOpenTransaction: (transaction: IndexTransaction) => void;
}) => (
  <div className="space-y-2">
    {transactions.map((transaction) => {
      const presentsAsIncome = activityPresentsAsIncome(transaction);
      const presentsAsTransfer = activityPresentsAsTransfer(transaction);
      const { amount, currency } = indexTransactionDisplayMoney(
        transaction,
        spaceCurrency,
        false,
      );
      const title = transactionRowTitle({
        description: transaction.description,
        fallback: transaction.categoryName || "Transaction",
      });

      return (
        <button
          key={transaction.id}
          type="button"
          onClick={() => onOpenTransaction(transaction)}
          className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:border-primary/30"
        >
          <div
            className={cn(
              "h-10 w-1 shrink-0 self-center rounded",
              presentsAsIncome
                ? "bg-teal-600"
                : presentsAsTransfer
                  ? "bg-blue-900"
                  : "bg-red-900",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-primary">{title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                formatTransactionRowDate(transaction.date),
                transaction.categoryName,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-sm font-semibold",
              presentsAsTransfer
                ? "text-primary"
                : presentsAsIncome
                  ? "text-teal-600 dark:text-teal-500"
                  : "text-red-900 dark:text-red-700",
            )}
          >
            {formatIndexTransactionListAmount(amount, currency, false)}
          </span>
        </button>
      );
    })}
  </div>
);
