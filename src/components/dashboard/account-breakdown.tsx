import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { AccountBreakdown } from "@/services/insights/queries";
import { 
  Wallet, 
  CreditCard, 
  Smartphone, 
  PiggyBank, 
  TrendingUp, 
  DollarSign,
  Building2,
  Coins,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAccountTransactions } from "@/hooks/async/useAccountTransactions";
import { IndexTransaction, CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import DayDivider from "@/components/ui/day-divider";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface AccountBreakdownProps {
  data: AccountBreakdown;
  isLoading?: boolean;
}

const getAccountIcon = (category: string) => {
  const categoryLower = category.toLowerCase();
  
  switch (categoryLower) {
    case 'cash':
      return <Wallet className="h-4 w-4" />;
    case 'bank':
      return <Building2 className="h-4 w-4" />;
    case 'debit':
    case 'credit_card':
      return <CreditCard className="h-4 w-4" />;
    case 'e_wallet':
      return <Smartphone className="h-4 w-4" />;
    case 'investment':
      return <TrendingUp className="h-4 w-4" />;
    case 'loan':
      return <DollarSign className="h-4 w-4" />;
    case 'savings':
      return <PiggyBank className="h-4 w-4" />;
    default:
      return <Wallet className="h-4 w-4" />;
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className={`text-sm ${data.value < 0 ? 'text-red-900' : 'text-gray-600'}`}>
          {formatCurrency(data.value)} ({data.percentage})
        </p>
      </div>
    );
  }
  return null;
};

interface AccountTransactionsProps {
  accountName: string;
}

const AccountTransactions = ({ accountName }: AccountTransactionsProps) => {
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
    enabled: true 
  });

  // Initialize displayed transactions when data changes
  useEffect(() => {
    if (data?.pages) {
      const allTransactions = data.pages.flatMap(page => page.transactions);
      const uniqueTransactions = allTransactions.filter((transaction, index, array) => 
        array.findIndex(t => t.id === transaction.id) === index
      );
      
      // Show only first 10 transactions initially
      setDisplayedTransactions(uniqueTransactions.slice(0, 10));
      setHasMore(uniqueTransactions.length > 10 || !!hasNextPage);
    }
  }, [data, hasNextPage]);

  // Reset displayed transactions when account changes
  useEffect(() => {
    setDisplayedTransactions([]);
    setHasMore(true);
  }, [accountName]);

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
              const allTransactions = data.pages.flatMap(page => page.transactions);
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
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="small" />
          <span className="ml-2 text-sm text-gray-500">Loading transactions...</span>
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
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">No transactions found for this account this month.</p>
      </div>
    );
  }

  if (displayedTransactions.length === 0) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">No transactions found for this account this month.</p>
      </div>
    );
  }

  // Group displayed transactions by date and sort
  const transactionsByDate = displayedTransactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
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
    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Transactions</h4>
      <div className="max-h-96 overflow-y-auto space-y-4">
        {sortedDates.map((date) => (
          <div key={date}>
            <DayDivider date={date} textClassName="bg-gray-50" />
            <div className="space-y-2">
              {transactionsByDate[date].map((transaction) => (
                <div 
                  key={transaction.id}
                  className="flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
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
                      <p className="text-sm font-medium text-primary truncate">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.categoryName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      transaction.type === CombinedTransactionTypeEnum.INCOME
                        ? "text-teal-600"
                        : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                          ? "text-red-900"
                          : "text-blue-900"
                    }`}>
                      {transaction.type === CombinedTransactionTypeEnum.EXPENSE ? '-' : '+'}
                      {formatCurrency(Math.abs(transaction.amount))}
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

const AccountBreakdownComponent = ({ data, isLoading = false }: AccountBreakdownProps) => {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const handleAccountClick = (accountName: string) => {
    setExpandedAccount(prev => {
      // If clicking the same account, close it; otherwise, open the new one
      return prev === accountName ? null : accountName;
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0">
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
      <Card className="border-0">
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
    <Card className="border-0">
      <CardHeader className="px-4">
        <CardTitle>Account Breakdown</CardTitle>
        <div className="text-2xl font-bold text-teal-600">
          {formatCurrency(data.totalBalance)}
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
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
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
                        <div className={`text-sm font-semibold ${account.value < 0 ? 'text-red-900' : 'text-teal-600'}`}>
                          {formatCurrency(account.value)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {account.percentage}
                        </div>
                      </div>
                      <ChevronRight 
                        className={`h-4 w-4 text-gray-500 transition-transform duration-300 ease-in-out ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`} 
                      />
                    </div>
                  </div>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <AccountTransactions accountName={account.name} />
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
