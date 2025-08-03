import React, { useRef } from "react";
import { IndexTransaction, CombinedTransactionTypeEnum, TransactionsPage } from "@/types/transactionTypes";
import { formatCurrency } from "@/lib/utils";
import { FileText, Calendar, Tag, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfiniteData } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import LoadingSpinner from "@/components/ui/loading-spinner";

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
  loadMoreRef: React.RefObject<HTMLDivElement>;
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
  loadMoreRef,
}: ListViewProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyId = async (id: string) => {
    try {
      // Check if navigator.clipboard is available (browser environment)
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
      } else {
        console.warn("Clipboard API not available");
      }
    } catch (err) {
      console.error("Failed to copy ID:", err);
    }
  };

  return (
    <div className="space-y-2 bg-white rounded-lg overflow-hidden p-2">
      {isPending && (
        <div className="text-center py-4">
          <LoadingSpinner size="medium" />
        </div>
      )}
      {isError && error && (
        <div className="text-red-500 text-center py-4">Error: {error.message}</div>
      )}
      {isSuccess && data && (
        <>
          {(() => {
            let lastDisplayedMonthYear: string | null = null;
            
            // Flatten all transactions and deduplicate by ID as a safety measure
            const allTransactions = data.pages.flatMap(page => page.transactions);
            const uniqueTransactions = allTransactions.filter((transaction, index, array) => 
              array.findIndex(t => t.id === transaction.id) === index
            );
            
            return uniqueTransactions.map((transaction: IndexTransaction, idx: number) => {
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
                <React.Fragment key={transaction.id}>
                  {showDivider && (
                    <div
                      key={`divider-${currentMonthYear}-${idx}`}
                      className="flex items-center my-3"
                    >
                      <div className="flex-grow border-t border-gray-300" />
                      <span className="px-3 text-xs font-semibold text-primary bg-white">
                        {currentMonthYear}
                      </span>
                      <div className="flex-grow border-t border-gray-300" />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors min-h-[60px]">
                    {/* Color indicator */}
                      <div
                      className={`w-1 h-12 rounded mr-3 flex-shrink-0 ${
                          transaction.type === CombinedTransactionTypeEnum.INCOME
                            ? "bg-emerald-500"
                          : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                            ? "bg-red-500"
                            : "bg-blue-500"
                        }`}
                    />
                    
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         {/* This div contains the description and the ID popover */}
                          <div className="flex items-center gap-2 flex-auto min-w-0"> {/* Added flex-auto and min-w-0 */} 
                            <h4 className="font-medium text-sm text-primary truncate pr-2"> {/* Removed flex-1 and min-w-0 */} 
                          {transaction.description}
                            </h4>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                                  onClick={() => handleCopyId(transaction.id)}
                                  title={copiedId === transaction.id ? "Copied!" : `Click to copy ID: ${transaction.id}`}
                                >
                                  {copiedId === transaction.id ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2">
                                <p className="text-xs">
                                  {copiedId === transaction.id ? "Copied!" : `ID: ${transaction.id}`}
                              </p>
                              </PopoverContent>
                            </Popover>
                        </div>
                          {/* This div contains the amount and type badge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                              className={`font-semibold text-sm ${
                          transaction.type === CombinedTransactionTypeEnum.INCOME
                            ? "text-emerald-600"
                                  : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      >
                          {transaction.amount > 0 ? "+" : ""}
                          {formatCurrency(transaction.amount)}
                      </div>
                      <span
                              className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                          transaction.type === CombinedTransactionTypeEnum.INCOME
                                  ? "bg-emerald-100 text-emerald-700"
                                  : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                        }`}
                      >
                              {transaction.type === CombinedTransactionTypeEnum.INCOME && <ArrowUpRight className="h-3 w-3 inline mr-1" />}
                              {transaction.type === CombinedTransactionTypeEnum.EXPENSE && <ArrowDownLeft className="h-3 w-3 inline mr-1" />}
                              {transaction.type === CombinedTransactionTypeEnum.TRANSFER && <ArrowLeftRight className="h-3 w-3 inline mr-1" />}
                        {transaction.type}
                      </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>{new Date(transaction.date).toLocaleDateString()}</span>
                          <span className="truncate">{transaction.categoryName}</span>
                          {(transaction.fromAccountName || transaction.toAccountName) && (
                            <span className="truncate">
                              {transaction.fromAccountName && transaction.toAccountName 
                                ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                                : transaction.fromAccountName 
                                ? `From: ${transaction.fromAccountName}`
                                : `To: ${transaction.toAccountName}`
                              }
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1 flex-shrink-0">
                        <Button
                            variant="ghost"
                          size="sm"
                            className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
                          onClick={() => onRowEdit(transaction)}
                        >
                          Edit
                        </Button>
                        <Button
                            variant="ghost"
                          size="sm"
                            className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => onRowDelete(transaction.id)}
                        >
                          Delete
                        </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
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
        <div className="text-center py-2 text-sm">
          <LoadingSpinner size="small" />
        </div>
      )}
      {!hasNextPage &&
        isSuccess &&
        data &&
        !data.pages.every((p) => p.transactions.length === 0) && (
          <div className="text-center py-2 text-xs text-gray-400">
            No more transactions
          </div>
        )}
    </div>
  );
}
