"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Landmark } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatCurrency } from "@/lib/utils";
import {
  formatLoanDueLabel,
  getUpcomingLoanDeadlines,
} from "@/utils/loan-upcoming-deadlines";
import { HomeSection } from "@/components/dashboard/tabs/home/home-section";

const PREVIEW_LIMIT = 3;

export const HomeLoansSection = () => {
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const { data: localLoans, isLoading } = useQuery({
    queryKey: ["loans", "local", spaceCode],
    queryFn: async () =>
      (await loadCachedLoansInfiniteData(spaceCode)) ?? null,
    enabled: !!spaceCode,
    staleTime: Infinity,
  });

  const loans = useMemo(
    () => localLoans?.pages.flatMap((page) => page.loans ?? []) ?? [],
    [localLoans],
  );

  const borrowedDeadlines = getUpcomingLoanDeadlines(loans, "borrowed").slice(
    0,
    PREVIEW_LIMIT,
  );
  const lentDeadlines = getUpcomingLoanDeadlines(loans, "lent").slice(
    0,
    PREVIEW_LIMIT,
  );
  const previewDeadlines = [...borrowedDeadlines, ...lentDeadlines]
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
    .slice(0, PREVIEW_LIMIT);

  const activeLoans = loans.filter(
    (loan) => loan.status === "active" && loan.outstandingBalance > 0,
  );
  const totalOutstanding = activeLoans.reduce(
    (sum, loan) => sum + Number(loan.outstandingBalance ?? 0),
    0,
  );
  const outstandingCurrency =
    activeLoans[0]?.outstandingBalanceCurrency ?? "PHP";

  return (
    <HomeSection title="Loans" href="/dashboard/loans" linkLabel="See all">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="medium" />
        </div>
      ) : null}

      {!isLoading && loans.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No loans yet.
        </p>
      ) : null}

      {!isLoading && loans.length > 0 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Active loans</p>
                <p className="font-semibold text-primary">
                  {activeLoans.length}{" "}
                  {activeLoans.length === 1 ? "loan" : "loans"}
                  {activeLoans.length > 0
                    ? ` · ${formatCurrency(totalOutstanding, outstandingCurrency)} outstanding`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          {previewDeadlines.length > 0 ? (
            <div className="space-y-2">
              {previewDeadlines.map((deadline) => (
                <Link
                  key={deadline.loan.id}
                  href={`/dashboard/loans/detail?loanId=${deadline.loan.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary">
                      {deadline.loan.entityName}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {formatLoanDueLabel(deadline.dueDate, deadline.isOverdue)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {formatCurrency(
                      deadline.paymentAmount,
                      deadline.loan.outstandingBalanceCurrency,
                    )}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </HomeSection>
  );
};
