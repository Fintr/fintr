import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar as CalendarLucide,
  Percent,
  FileText,
} from "lucide-react";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import { useInfiniteLoans } from "@/hooks/async/useInfiniteLoans";
import { formatCurrency } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";
import EditLoanModal from "@/components/dashboard/forms/EditLoanModal";
import DeleteLoanModal from "@/components/dashboard/forms/DeleteLoanModal";
import { useAuthApi } from "@/hooks/useAuthApi";
import { deleteLoan } from "@/services/loans/mutation";
import { formatLoanTerm } from "@/utils/formatLoanTerm";

interface LoansTabProps {}

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
    const response = await deleteLoan(api, loanId);
    queryClient.invalidateQueries({ queryKey: ["loans"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    return response;
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
          <CardDescription>
            Manage your borrowed and lent money
          </CardDescription>
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
              const statusColorClass =
                loan.status === "paid_off"
                  ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                  : loan.status === "defaulted"
                    ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-700"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400";

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
                    className="flex min-h-[80px] items-center justify-between rounded bg-white p-3 transition-colors hover:bg-gray-100 dark:bg-card dark:hover:bg-accent/50 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/loans/detail?loanId=${loan.id}`,
                      )
                    }
                  >
                    <div
                      className={`w-1 rounded mr-3 flex-shrink-0 self-stretch ${colorClass}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-auto min-w-0">
                          <h4 className="font-medium text-sm text-primary truncate">
                            {loan.entityName}
                          </h4>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${statusColorClass}`}
                          >
                            {loan.status.replace("_", " ")}
                          </span>
                        </div>
                        <div
                          className={`font-semibold text-sm ${textColorClass} flex-shrink-0`}
                        >
                          {formatCurrency(
                            loan.outstandingBalance,
                            loan.outstandingBalanceCurrency,
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-muted-foreground relative">
                        <div className="flex items-center gap-1">
                          <CalendarLucide className="h-3 w-3" />
                          <span>
                            {loanDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          <span>{loan.interestRate}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Principal:</span>
                          <span>
                            {formatCurrency(
                              loan.principalAmount,
                              loan.principalAmountCurrency,
                            )}
                          </span>
                        </div>
                        {loan.description && (
                          <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
                            <FileText className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{loan.description}</span>
                          </div>
                        )}
                      </div>

                      {loan.description && (
                        <div className="md:hidden flex items-center gap-1 mt-1 mb-1 text-xs text-gray-600 dark:text-muted-foreground">
                          <FileText className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{loan.description}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                        <div className="flex items-center gap-3">
                          <span className={`${textColorClass} font-medium`}>
                            {isBorrowed ? "Borrowed" : "Lent"}
                          </span>
                          <span className="text-gray-500 dark:text-muted-foreground">
                            <span className="font-medium">Term:</span>{" "}
                            {formatLoanTerm(loan.loanTermMonths)}
                          </span>
                          <span className="text-gray-500 dark:text-muted-foreground">
                            Matures:{" "}
                            {new Date(loan.maturityDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                          {loan.files && loan.files.length > 0 && (
                            <span className="text-gray-500 dark:text-muted-foreground">
                              {loan.files.length} file
                              {loan.files.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EditLoanModal loan={loan} />
                          <DeleteLoanModal
                            loan={loan}
                            onDelete={handleDeleteLoan}
                          />
                        </div>
                      </div>
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
