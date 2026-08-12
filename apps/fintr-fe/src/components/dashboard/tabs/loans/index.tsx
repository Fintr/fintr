import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddLoanDialog } from "@/components/dashboard/forms/add-loan-dialog";
import { useInfiniteLoans } from "@/hooks/async/useInfiniteLoans";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { deleteLoanLocalFirst } from "@/services/loans/delete-local-first";
import { LoanProfilesSection } from "@/components/dashboard/tabs/loans/loan-profiles-section";
import { LoanUpcomingSections } from "@/components/dashboard/tabs/loans/loan-upcoming-sections";
import { LoanListRow } from "@/components/dashboard/tabs/loans/loan-list-row";
import {
  LoanListFilter as LoanListFilterTabs,
  loanListFilterEmptyMessage,
  type LoanListFilter,
} from "@/components/dashboard/tabs/loans/loan-list-filter";
import { getAllLoansSectionCopy } from "@/components/dashboard/tabs/loans/loan-all-loans-section-copy";
import type { Loan } from "@/services/loans/queries";
import { cn } from "@/lib/utils";
import {
  excludeLoansById,
  getFeaturedUpcomingLoanIds,
  partitionAndSortLoans,
} from "@/utils/loan-upcoming-deadlines";

interface LoansTabProps {}

const filterLoansForInsights = (
  loans: Loan[],
  filter: LoanListFilter,
): Loan[] => {
  if (filter === "paid_off") {
    return [];
  }

  if (filter === "borrowed") {
    return loans.filter((loan) => loan.loanType === "borrowed");
  }

  if (filter === "lent") {
    return loans.filter((loan) => loan.loanType === "lent");
  }

  return loans;
};

const LoansTab = ({}: LoansTabProps) => {
  const router = useRouter();
  const [isAddLoanOpen, setIsAddLoanOpen] = React.useState(false);
  const [loanFilter, setLoanFilter] = React.useState<LoanListFilter>("all");
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const {
    loans,
    isFetching,
    isError,
    refetch,
    isSuccess,
    isFetchingNextPage,
    hasNextPage,
  } = useInfiniteLoans({ loadMoreRef });

  const isLoading = isFetching && loans.length === 0;
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions write:transactions",
  });

  const handleAddLoanSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["loans"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setIsAddLoanOpen(false);
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (!api) {
      throw new Error("API not available");
    }

    const loan = loans.find((row) => row.id === loanId);
    if (!loan || !spaceCode) {
      throw new Error("Loan not found");
    }

    const result = await deleteLoanLocalFirst(
      api,
      { spaceId: spaceCode, loan },
      { queryClient, waitForSync: false },
    );

    void Promise.resolve(result.syncPromise)
      .then(async (synced) => {
        if (synced.pendingSync) {
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["loans"] });
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .catch(() => undefined);

    return { success: true, pendingSync: result.pendingSync };
  };

  const { activeLoans, completedLoans } = React.useMemo(() => {
    if (loanFilter === "paid_off") {
      const completed = loans
        .filter((loan) => loan.status === "paid_off")
        .sort((left, right) => {
          const leftDate = left.paidOffDate
            ? new Date(left.paidOffDate).getTime()
            : new Date(left.date).getTime();
          const rightDate = right.paidOffDate
            ? new Date(right.paidOffDate).getTime()
            : new Date(right.date).getTime();
          return rightDate - leftDate;
        });

      return { activeLoans: [], completedLoans: completed };
    }

    return partitionAndSortLoans(loans, {
      includeCompleted: loanFilter === "all",
      loanType:
        loanFilter === "borrowed"
          ? "borrowed"
          : loanFilter === "lent"
            ? "lent"
            : undefined,
    });
  }, [loanFilter, loans]);

  const loansForInsights = React.useMemo(
    () => filterLoansForInsights(loans, loanFilter),
    [loanFilter, loans],
  );

  const showInsights =
    loanFilter !== "paid_off" && loansForInsights.length > 0;

  const featuredUpcomingLoanIds = React.useMemo(() => {
    if (!showInsights) {
      return new Set<string>();
    }

    return getFeaturedUpcomingLoanIds(loansForInsights, {
      loanType:
        loanFilter === "borrowed"
          ? "borrowed"
          : loanFilter === "lent"
            ? "lent"
            : undefined,
    });
  }, [loanFilter, loansForInsights, showInsights]);

  const listActiveLoans = React.useMemo(
    () => excludeLoansById(activeLoans, featuredUpcomingLoanIds),
    [activeLoans, featuredUpcomingLoanIds],
  );

  const allLoansSectionCopy = React.useMemo(
    () =>
      getAllLoansSectionCopy(loanFilter, {
        hasFeaturedUpcoming: featuredUpcomingLoanIds.size > 0,
        hasRemainingLoans: listActiveLoans.length > 0,
      }),
    [featuredUpcomingLoanIds.size, listActiveLoans.length, loanFilter],
  );

  const openLoan = (loanId: string) => {
    router.push(`/dashboard/loans/detail?loanId=${loanId}`);
  };

  const hasVisibleLoans =
    activeLoans.length > 0 || completedLoans.length > 0;

  return (
    <Card className="border-0 bg-transparent px-2 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Loans</CardTitle>
        </div>
        <Button
          onClick={() => setIsAddLoanOpen(true)}
          className="bg-primary hover:bg-primary/80"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Loan
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {isError && (
          <div className="py-12 text-center">
            <p className="mb-4 text-red-900">Error loading loans</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        )}

        {isSuccess && loans.length > 0 ? (
          <div className="mb-4">
            <LoanListFilterTabs value={loanFilter} onChange={setLoanFilter} />
          </div>
        ) : null}

        {isSuccess && loans.length === 0 && (
          <div className="py-12 text-center">
            <p className="mb-4 text-gray-500 dark:text-muted-foreground">
              No loans yet
            </p>
            <p className="mb-4 text-sm text-gray-400 dark:text-muted-foreground">
              Start tracking your loans by adding your first one.
            </p>
            <Button onClick={() => setIsAddLoanOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Loan
            </Button>
          </div>
        )}

        {isSuccess && loans.length > 0 && !hasVisibleLoans && (
          <div className="py-12 text-center">
            <p className="text-gray-500 dark:text-muted-foreground">
              {loanListFilterEmptyMessage(loanFilter)}
            </p>
          </div>
        )}

        {isSuccess && hasVisibleLoans && (
          <div className="space-y-2">
            {showInsights ? (
              <>
                <LoanProfilesSection loans={loansForInsights} />
                <LoanUpcomingSections loans={loansForInsights} />
              </>
            ) : null}

            {activeLoans.length > 0 ? (
              <section
                className={cn(
                  "space-y-2",
                  showInsights ? "mt-8" : undefined,
                )}
              >
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-primary">
                    {allLoansSectionCopy.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {allLoansSectionCopy.description}
                  </p>
                </div>
                {listActiveLoans.length > 0 ? (
                  listActiveLoans.map((loan) => (
                    <LoanListRow
                      key={loan.id}
                      loan={loan}
                      variant="active"
                      onOpen={openLoan}
                      onDelete={handleDeleteLoan}
                    />
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    {allLoansSectionCopy.emptyMessage ??
                      "All active loans are listed above."}
                  </p>
                )}
              </section>
            ) : null}

            {completedLoans.length > 0 ? (
              <section className="mt-8 space-y-2">
                {loanFilter === "all" ? (
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-primary">
                      Completed
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Loans you have fully paid off
                    </p>
                  </div>
                ) : null}
                {completedLoans.map((loan) => (
                  <LoanListRow
                    key={loan.id}
                    loan={loan}
                    variant="completed"
                    onOpen={openLoan}
                    onDelete={handleDeleteLoan}
                  />
                ))}
              </section>
            ) : null}

            <div ref={loadMoreRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner />
              </div>
            )}
            {!hasNextPage && loans.length > 0 && loanFilter !== "paid_off" ? (
              <div className="py-4 text-center text-sm text-gray-500 dark:text-muted-foreground">
                No more loans to load
              </div>
            ) : null}
          </div>
        )}
      </CardContent>

      <AddLoanDialog
        isOpen={isAddLoanOpen}
        onClose={() => setIsAddLoanOpen(false)}
        onSuccess={handleAddLoanSuccess}
      />
    </Card>
  );
};

export default LoansTab;
