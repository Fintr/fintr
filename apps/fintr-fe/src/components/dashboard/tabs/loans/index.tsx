import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
} from "lucide-react";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import { useInfiniteLoans } from "@/hooks/async/useInfiniteLoans";
import { formatCurrency, cn } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";
import EditLoanModal from "@/components/dashboard/forms/EditLoanModal";
import DeleteLoanModal from "@/components/dashboard/forms/DeleteLoanModal";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { deleteLoanLocalFirst } from "@/services/loans/delete-local-first";
import { formatLoanTerm } from "@/utils/formatLoanTerm";
import { LoanProfilesSection } from "@/components/dashboard/tabs/loans/loan-profiles-section";
import { LoanUpcomingSections } from "@/components/dashboard/tabs/loans/loan-upcoming-sections";

interface LoansTabProps {}

const loanStatusClassName = (status: string) => {
  if (status === "paid_off") {
    return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400";
  }

  if (status === "defaulted") {
    return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-700";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400";
};

const formatMaturityDate = (maturityDate: string) =>
  new Date(maturityDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const LoansTab = ({}: LoansTabProps) => {
  const router = useRouter();
  const [isAddLoanOpen, setIsAddLoanOpen] = React.useState(false);
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

  const sortedLoans = React.useMemo(() => {
    return [...loans].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [loans]);

  let lastDisplayedDate: string | null = null;

  return (
    <Card className="border-0 px-2 shadow-none bg-transparent">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Loans</CardTitle>
        </div>
        <Button
          onClick={() => setIsAddLoanOpen(true)}
          className="bg-primary hover:bg-primary/80"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Loan
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-900 mb-4">Error loading loans</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        )}

        {isSuccess && sortedLoans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-muted-foreground mb-4">
              No loans yet
            </p>
            <p className="text-sm text-gray-400 dark:text-muted-foreground">
              Start tracking your loans by clicking &quot;Add Loan&quot;
            </p>
          </div>
        )}

        {isSuccess && sortedLoans.length > 0 && (
          <div className="space-y-2">
            <LoanProfilesSection loans={loans} />
            <LoanUpcomingSections loans={loans} />
            {sortedLoans.map((loan, idx) => {
              const loanDate = new Date(loan.date);
              const currentDate = loanDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              let showDivider = false;

              if (currentDate !== lastDisplayedDate) {
                showDivider = true;
                lastDisplayedDate = currentDate;
              }

              const isBorrowed = loan.loanType === "borrowed";
              const colorClass = isBorrowed ? "bg-red-900" : "bg-teal-600";
              const textColorClass = isBorrowed
                ? "text-red-900 dark:text-red-700"
                : "text-teal-600 dark:text-teal-500";
              const statusColorClass = loanStatusClassName(loan.status);
              const maturityLabel = formatMaturityDate(loan.maturityDate);

              return (
                <React.Fragment key={loan.id}>
                  {showDivider && (
                    <div
                      key={`divider-${currentDate}-${idx}`}
                      className="flex items-center my-5"
                    >
                      <div
                        className="border-t border-gray-300 dark:border-border"
                        style={{ width: "2rem" }}
                      />
                      <span className="text-xs font-semibold text-primary bg-background px-3">
                        {currentDate}
                      </span>
                      <div className="flex-grow border-t border-gray-300 dark:border-border" />
                    </div>
                  )}
                  <div
                    className="flex min-h-[64px] items-stretch rounded bg-white p-3 transition-colors hover:bg-gray-100 dark:bg-card dark:hover:bg-accent/50 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/loans/detail?loanId=${loan.id}`,
                      )
                    }
                  >
                    <div
                      className={cn(
                        "mr-3 w-1 flex-shrink-0 self-stretch rounded",
                        colorClass,
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <h4 className="truncate text-sm font-medium text-primary">
                            {loan.entityName}
                          </h4>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                              statusColorClass,
                            )}
                          >
                            {loan.status.replace("_", " ")}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            textColorClass,
                          )}
                        >
                          {formatCurrency(
                            loan.outstandingBalance,
                            loan.outstandingBalanceCurrency,
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-xs text-muted-foreground">
                          <span className={cn("font-medium", textColorClass)}>
                            {isBorrowed ? "Borrowed" : "Lent"}
                          </span>
                          <span aria-hidden="true"> · </span>
                          {loan.interestRate}%
                          <span aria-hidden="true"> · </span>
                          {formatLoanTerm(loan.loanTermMonths)}
                          <span aria-hidden="true"> · </span>
                          Matures {maturityLabel}
                        </p>
                        <div
                          className="flex shrink-0 items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EditLoanModal loan={loan} />
                          <DeleteLoanModal
                            loan={loan}
                            onDelete={handleDeleteLoan}
                          />
                        </div>
                      </div>

                      {loan.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {loan.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={loadMoreRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="flex justify-center items-center py-4">
                <LoadingSpinner />
              </div>
            )}
            {!hasNextPage && sortedLoans.length > 0 && (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-muted-foreground">
                No more loans to load
              </div>
            )}
          </div>
        )}
      </CardContent>

      <AddTransactionDialog
        isOpen={isAddLoanOpen}
        onClose={() => setIsAddLoanOpen(false)}
        initialTransactionType="loan"
        onAddTransaction={handleAddLoanSuccess}
      />
    </Card>
  );
};

export default LoansTab;
