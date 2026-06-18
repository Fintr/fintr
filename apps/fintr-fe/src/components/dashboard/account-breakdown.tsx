/**
 * @ai-context INSIGHTS_ACCOUNT_BREAKDOWN_CARD
 * Insights "Account Breakdown" card: total balance, account list with % share,
 * expandable recent transactions per account. Render is commented out in insights-tab.tsx;
 * say "bring back account breakdown" to restore.
 */
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { AccountBreakdown } from "@/services/insights/types";
import { 
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { getAccountCategoryIcon } from "@/utils/accountCategoryIcon";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useAccountTransactions } from "@/hooks/async/useAccountTransactions";
import { IndexTransaction, CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import DayDivider from "@/components/ui/day-divider";
import {
  formatTransactionDayDividerDate,
  getTransactionDayGroupKey,
} from "@/utils/dateUtils";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface AccountBreakdownProps {
  data: AccountBreakdown;
  isLoading?: boolean;
  /** ISO 4217 currency code for the current space (e.g. "PLN"). */
  currencyCode?: string;
  /** YYYY-MM-DD — must match insights / dashboard date filter when provided. */
  transactionsStartDate?: string;
  /** YYYY-MM-DD — must match insights / dashboard date filter when provided. */
  transactionsEndDate?: string;
}

const getAccountIcon = (category: string) => {
  const Icon = getAccountCategoryIcon(category);
  return <Icon className="h-4 w-4" />;
};

const CustomTooltip = ({ active, payload, currencyCode }: { active?: boolean; payload?: any[]; currencyCode?: string }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className={`text-sm ${data.value < 0 ? 'text-red-900' : 'text-gray-600'}`}>
          {formatCurrency(data.value, currencyCode || "PHP")} ({data.percentage})
        </p>
      </div>
    );
  }
  return null;
};

interface AccountTransactionsProps {
  accountName: string;
  /** Currency code used for formatting amounts. */
  currencyCode?: string;
  transactionsStartDate?: string;
  transactionsEndDate?: string;
}

const AccountTransactions = ({
  accountName,
  currencyCode,
  transactionsStartDate,
  transactionsEndDate,
}: AccountTransactionsProps) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [displayedTransactions, setDisplayedTransactions] = useState<IndexTransaction[]>([]);
  const [hasMore, setHasMore] = useState(true);
  
  const { 
    data, 
    isLoading, 
    isError, 
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useAccountTransactions({
    accountName,
    startDate: transactionsStartDate,
    endDate: transactionsEndDate,
    enabled: true,
  });

  // Keep displayed rows in sync with query data before paint. A separate "reset on
  // account/dates" effect used to run after this and clear the list while `data` still
  // held rows, which caused a persistent empty state despite a successful API response.
  useLayoutEffect(() => {
    if (!data?.pages?.length) {
      setDisplayedTransactions([]);
      setHasMore(true);
      return;
    }

    const allTransactions = data.pages.flatMap(
      (page) => page.transactions ?? [],
    );
    const uniqueTransactions = allTransactions.filter(
      (transaction, index, array) =>
        array.findIndex((t) => t.id === transaction.id) === index,
    );

    setDisplayedTransactions(uniqueTransactions.slice(0, 10));
    setHasMore(uniqueTransactions.length > 10 || !!hasNextPage);
  }, [
    data,
    hasNextPage,
    accountName,
    transactionsStartDate,
    transactionsEndDate,
  ]);

  // Infinite scroll implementation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingNextPage) {
          if (hasNextPage) {
            fetchNextPage();
          } else {
            // Load more from current data - exactly 10 items per page
            if (data?.pages) {
              const allTransactions = data.pages.flatMap(
                (page) => page.transactions ?? [],
              );
              const uniqueTransactions = allTransactions.filter((transaction, index, array) => 
                array.findIndex(t => t.id === transaction.id) === index
              );
              
              const currentCount = displayedTransactions.length;
              const nextBatch = uniqueTransactions.slice(currentCount, currentCount + 10);
              
              if (nextBatch.length > 0) {
                setDisplayedTransactions(prev => [...prev, ...nextBatch]);
                setHasMore(uniqueTransactions.length > currentCount + nextBatch.length);
              } else {
                setHasMore(false);
              }
            }
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, hasNextPage, fetchNextPage, data, displayedTransactions.length]);

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-background">
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="small" />
          <span className="ml-2 text-sm text-gray-500 dark:text-muted-foreground">Loading transactions...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-3 p-3 bg-red-50 rounded-lg">
        <p className="text-sm text-red-600">Error loading transactions: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  if (!data || !data.pages || data.pages.length === 0) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-background">
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          No transactions found for this account in the selected period.
        </p>
      </div>
    );
  }

  if (displayedTransactions.length === 0) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-background">
        <p className="text-sm text-gray-500 dark:text-muted-foreground">
          No transactions found for this account in the selected period.
        </p>
      </div>
    );
  }

  // Group displayed transactions by date and sort
  const transactionsByDate = displayedTransactions.reduce((acc, transaction) => {
    const date = getTransactionDayGroupKey(transaction.date);
    
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {} as Record<string, IndexTransaction[]>);

  // Sort dates in descending order (most recent first)
  const sortedDates = Object.keys(transactionsByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-background">
      <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-foreground">Recent Transactions</h4>
      <div className="max-h-96 overflow-y-auto overflow-x-hidden space-y-4">
        {sortedDates.map((date) => (
          <div key={date}>
            <DayDivider
              date={formatTransactionDayDividerDate(
                transactionsByDate[date][0].date,
              )}
              textClassName="bg-gray-50 dark:bg-background"
            />
            <div className="space-y-2">
              {transactionsByDate[date].map((transaction) => (
                <div 
                  key={transaction.id}
                  className="flex min-w-0 items-center justify-between rounded bg-white p-3 transition-colors hover:bg-gray-50 dark:bg-muted dark:hover:bg-muted/80"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div
                      className={`w-1 h-8 rounded flex-shrink-0 ${
                        transaction.type === CombinedTransactionTypeEnum.INCOME
                          ? "bg-teal-600"
                        : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                          ? "bg-red-900"
                          : "bg-blue-900"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate md:truncate" title={transaction.description}>
                        {transaction.description}
                      </p>
                      {transaction.type === CombinedTransactionTypeEnum.TRANSFER ? (
                        <p className="text-xs text-gray-500 truncate" title={`${transaction.fromAccountName || 'Unknown'} → ${transaction.toAccountName || 'Unknown'}`}>
                          {transaction.fromAccountName && transaction.toAccountName 
                            ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                            : transaction.fromAccountName 
                            ? `From: ${transaction.fromAccountName}`
                            : transaction.toAccountName 
                            ? `To: ${transaction.toAccountName}`
                            : transaction.categoryName
                          }
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 truncate" title={transaction.categoryName}>
                          {transaction.categoryName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-sm font-semibold ${
                      transaction.type === CombinedTransactionTypeEnum.INCOME
                        ? "text-teal-600"
                        : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                          ? "text-red-900"
                          : "text-blue-900"
                    }`}>
                      {(() => {
                        if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
                          // For transfers, determine the sign based on account perspective
                          // If this account is the source (fromAccount), it's negative (money going out)
                          // If this account is the destination (toAccount), it's positive (money coming in)
                          const isFromAccount = transaction.fromAccountName === accountName;
                          const isToAccount = transaction.toAccountName === accountName;
                          
                          if (isFromAccount && !isToAccount) {
                            // Money going out of this account
                            return `-${formatCurrency(Math.abs(transaction.amount), currencyCode || "PHP")}`;
                          } else if (isToAccount && !isFromAccount) {
                            // Money coming into this account
                            return `+${formatCurrency(Math.abs(transaction.amount), currencyCode || "PHP")}`;
                          } else {
                            // Fallback to original amount display
                            return `${transaction.amount > 0 ? "+" : ""}${formatCurrency(
                              transaction.amount,
                              currencyCode || "PHP",
                            )}`;
                          }
                        } else {
                          // For income and expenses, use the original logic
                          return `${
                            transaction.type === CombinedTransactionTypeEnum.EXPENSE ? "-" : "+"
                          }${formatCurrency(Math.abs(transaction.amount), currencyCode || "PHP")}`;
                        }
                      })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {isFetchingNextPage ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="small" />
                <span className="text-sm text-gray-500">Loading more...</span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Scroll to load more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AccountBreakdownComponent = ({
  data,
  isLoading = false,
  currencyCode,
  transactionsStartDate,
  transactionsEndDate,
}: AccountBreakdownProps) => {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const formatAmount = (value: number) =>
    formatCurrency(value, currencyCode || "PHP");

  const handleAccountClick = (accountName: string) => {
    setExpandedAccount(prev => {
      // If clicking the same account, close it; otherwise, open the new one
      return prev === accountName ? null : accountName;
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-4">
          <CardTitle>Account Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading account data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.breakdown || data.breakdown.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-4">
          <CardTitle>Account Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No account data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="px-4">
        <CardTitle>Account Breakdown</CardTitle>
        <div className="text-2xl font-bold text-teal-600 dark:text-teal-500">
          {formatAmount(data.totalBalance)}
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Account List */}
          <div className="space-y-3">
            {data.breakdown.map((account, index) => {
              const isExpanded = expandedAccount === account.name;
              
              return (
                <div key={account.name} className="space-y-0">
                  <div
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3 cursor-pointer transition-colors hover:bg-gray-100 dark:bg-background dark:hover:bg-muted"
                    onClick={() => handleAccountClick(account.name)}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: account.color }}
                      />
                      <div className="flex items-center space-x-2">
                        {getAccountIcon(account.category)}
                        <span className="font-medium text-sm">{account.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div
                          className={`text-sm font-semibold ${
                            account.value < 0
                              ? "text-red-900 dark:text-red-700"
                              : "text-teal-600 dark:text-teal-500"
                          }`}
                        >
                          {formatAmount(account.value)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-muted-foreground">
                          {account.percentage}
                        </div>
                      </div>
                      <ChevronRight 
                        className={`h-4 w-4 text-gray-500 dark:text-muted-foreground transition-transform duration-300 ease-in-out ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`} 
                      />
                    </div>
                  </div>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <AccountTransactions
                      accountName={account.name}
                      currencyCode={currencyCode}
                      transactionsStartDate={transactionsStartDate}
                      transactionsEndDate={transactionsEndDate}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountBreakdownComponent;
