import React, { useRef } from "react";
import { IndexTransaction, TransactionTypeEnum, TransactionsPage } from "@/types/transactionTypes";
import { formatCurrency } from "@/lib/utils";
import { FileText, Calendar, Tag, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfiniteData } from "@tanstack/react-query";

interface ListViewProps {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  data?: InfiniteData<TransactionsPage>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onRowEdit: (transaction: IndexTransaction) => void;
  onRowDelete: (transactionId: string) => void;
}

export function ListView({
  isPending,
  isError,
  error,
  isSuccess,
  data,
  isFetchingNextPage,
  hasNextPage,
  onRowEdit,
  onRowDelete,
}: ListViewProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4 bg-white rounded-lg overflow-hidden p-4">
      {isPending && <div>Loading initial transactions...</div>}
      {isError && error && (
        <div className="text-red-500">Error: {error.message}</div>
      )}
      {isSuccess && data && (
        <>
          {(() => {
            let lastDisplayedMonthYear: string | null = null;
            return data.pages.map((page, pageIndex) => (
              <React.Fragment key={`page-${pageIndex}`}>
                {page.transactions.map(
                  (transaction: IndexTransaction, idx: number) => {
                    const transactionDate = new Date(transaction.date);
                    const currentMonthYear = `${transactionDate.toLocaleString(
                      "default",
                      { month: "long" }
                    )} ${transactionDate.getFullYear()}`;
                    let showDivider = false;

                    if (currentMonthYear !== lastDisplayedMonthYear) {
                      showDivider = true;
                      lastDisplayedMonthYear = currentMonthYear;
                    }

                    return (
                      <React.Fragment key={`${transaction.id}-${idx}`}>
                        {showDivider && (
                          <div
                            key={`divider-${currentMonthYear}`}
                            className="flex items-center my-4"
                          >
                            <div className="flex-grow border-t border-gray-300" />
                            <span className="px-2 text-sm font-semibold text-primary">
                              {currentMonthYear}
                            </span>
                            <div className="flex-grow border-t border-gray-300" />
                          </div>
                        )}
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex w-full">
                            <div
                              className={`w-2 self-stretch rounded-l-lg mr-4 ${
                                transaction.type === TransactionTypeEnum.INCOME
                                  ? "bg-emerald-500"
                                  : transaction.type ===
                                    TransactionTypeEnum.EXPENSE
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                              }`}
                            ></div>
                            <div className="flex-1">
                              <p className="font-medium text-primary flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-500" />
                                {transaction.description}
                              </p>
                              <p className="text-sm text-primary/70 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                {new Date(
                                  transaction.date
                                ).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-primary/70 flex items-center gap-2">
                                <Tag className="h-4 w-4 text-gray-500" />
                                {transaction.categoryName}
                              </p>
                              <div className="flex flex-col sm:flex-row sm:gap-4">
                                {transaction.fromAccountName && (
                                  <>
                                    <p className="text-sm text-primary/70 flex items-center gap-2">
                                      <ArrowUpRight className="h-4 w-4 text-gray-500" />
                                      From: {transaction.fromAccountName}
                                    </p>
                                  </>
                                )}
                                {transaction.toAccountName && (
                                  <>
                                    <p className="text-sm text-primary/70 flex items-center gap-2">
                                      <ArrowDownLeft className="h-4 w-4 text-gray-500" />
                                      To: {transaction.toAccountName}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 mt-4 lg:mt-0">
                            <div
                              className={`font-medium flex items-center gap-1 ${
                                transaction.type === TransactionTypeEnum.INCOME
                                  ? "text-emerald-600"
                                  : transaction.type ===
                                    TransactionTypeEnum.EXPENSE
                                  ? "text-red-600"
                                  : "text-blue-600"
                              }`}
                            >
                              <span>
                                {transaction.amount > 0 ? "+" : ""}
                              </span>
                              <span className="whitespace-nowrap">
                                {formatCurrency(transaction.amount)}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${
                                transaction.type === TransactionTypeEnum.INCOME
                                  ? "bg-emerald-100 text-emerald-800"
                                  : transaction.type ===
                                    TransactionTypeEnum.EXPENSE
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {transaction.type ===
                                TransactionTypeEnum.INCOME && (
                                <ArrowUpRight className="h-3 w-3" />
                              )}
                              {transaction.type ===
                                TransactionTypeEnum.EXPENSE && (
                                <ArrowDownLeft className="h-3 w-3" />
                              )}
                              {transaction.type ===
                                TransactionTypeEnum.TRANSFER && (
                                <ArrowLeftRight className="h-3 w-3" />
                              )}
                              {transaction.type}
                            </span>
                            <div className="flex space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-primary"
                                onClick={() => onRowEdit(transaction)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => onRowDelete(transaction.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }
                )}
              </React.Fragment>
            ));
          })()}
          <div ref={loadMoreRef} style={{ height: "10px" }} />
        </>
      )}
      {isSuccess &&
        (!data || data.pages.every((p) => p.transactions.length === 0)) && (
          <div className="text-center py-8 text-gray-500">
            No transactions found
          </div>
        )}
      {isFetchingNextPage && (
        <div className="text-center py-4">Loading more...</div>
      )}
      {!hasNextPage &&
        isSuccess &&
        data &&
        !data.pages.every((p) => p.transactions.length === 0) && (
          <div className="text-center py-4 text-gray-400">
            No more transactions
          </div>
        )}
    </div>
  );
}
