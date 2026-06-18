import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActivitiesPage,
  ActivitiesTypeEnum,
  CombinedTransactionTypeEnum,
  IndexActivity,
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { formatCurrency, truncateText } from "@/lib/utils";
import { FileText, Calendar, Tag, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Image, Landmark } from "lucide-react";
import { InfiniteData } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { useAuthApi } from "@/hooks/useAuthApi";
import { fetchTransactionById } from "@/services/transactions/queries";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import { toast } from "sonner";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { cn } from "@/lib/utils";
import { indexTransactionDisplayMoney } from "@/utils/indexTransactionDisplay";
import {
  formatTransactionDayDividerDate,
  formatTransactionRowDate,
  getTransactionDayGroupKey,
} from "@/utils/dateUtils";
import {
  activityCategoryLine,
  activityPresentsAsIncome,
  activityPresentsAsTransfer,
  activityRecordId,
  activityRowIsEditable,
} from "@/utils/activityDisplay";

interface ListViewProps {
  variant?: "transactions" | "activities";
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  data?: InfiniteData<TransactionsPage> | InfiniteData<ActivitiesPage>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onRowEdit: (row: IndexTransaction | IndexActivity) => void;
  onRowDelete: (rowId: string) => void;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  /** When true, row amounts use booked (ledger) currency from the API instead of space-normalized. */
  showBookedCurrencies?: boolean;
}

function flattenRows(
  data: InfiniteData<TransactionsPage> | InfiniteData<ActivitiesPage>,
  variant: "transactions" | "activities",
): Array<IndexTransaction | IndexActivity> {
  return data.pages.flatMap((page) => {
    const row = page as TransactionsPage & ActivitiesPage;
    const rows =
      variant === "activities"
        ? (row.activities ?? row.transactions ?? [])
        : (row.transactions ?? row.activities ?? []);

    return rows;
  });
}

function rowCount(
  data: InfiniteData<TransactionsPage> | InfiniteData<ActivitiesPage>,
  variant: "transactions" | "activities",
): number {
  return flattenRows(data, variant).length;
}

export function ListView({
  variant = "transactions",
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
  showBookedCurrencies = false,
}: ListViewProps) {
  const router = useRouter();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; filename?: string; contentType?: string; byteSize?: number }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [hoveredCalculatedId, setHoveredCalculatedId] = useState<string | null>(null);
  const { api } = useAuthApi();
  
  // Get space context for currency
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

  const handleImageClick = async (row: IndexTransaction | IndexActivity) => {
    if (!api) return;

    try {
      let transactionData;

      const recordId =
        variant === "activities" && "activitableId" in row
          ? (row.activitableId ?? row.id)
          : row.id;

      if (row.type === CombinedTransactionTypeEnum.TRANSFER) {
        transactionData = await fetchTransferById(api, recordId);
      } else {
        transactionData = await fetchTransactionById(api, recordId);
      }

      if (transactionData?.files && Array.isArray(transactionData.files) && transactionData.files.length > 0) {
        const images = transactionData.files.map((file: any) => ({
          url: file.url,
          filename: file.filename,
          contentType: file.contentType,
          byteSize: file.byteSize,
        }));
        
        setLightboxImages(images);
        setLightboxIndex(0);
        setLightboxOpen(true);
      } else {
        toast.error("No image found for this transaction.");
      }
    } catch (error) {
      console.error("Error fetching transaction image:", error);
      toast.error("Failed to load transaction image.");
    }
  };

  return (
    <div className="space-y-3 rounded-lg overflow-hidden">
      {isPending && (
        <div className="text-center py-4">
          <LoadingSpinner size="medium" />
        </div>
      )}
      {isError && error && (
        <div className="text-red-900 text-center py-4">Error: {error.message}</div>
      )}
      {isSuccess && data && (
        <>
          {(() => {
            let lastDisplayedDate: string | null = null;
            
            // Flatten rows and deduplicate by ID as a safety measure
            const allRows = flattenRows(data, variant);
            const uniqueRows = allRows.filter((row, index, array) =>
              array.findIndex((r) => r.id === row.id) === index,
            );

            if (uniqueRows.length === 0) {
              return (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg bg-muted/20">
                  No activity for this account in the selected range.
                </p>
              );
            }

            // Daily net (income - expense) in space-normalized amounts for a consistent subtotal bar.
            const dailyTotals: Record<string, number> = {};
            const dailyCurrencies: Record<string, Set<string>> = {};
            uniqueRows.forEach((row) => {
              const dateKey = getTransactionDayGroupKey(row.date);
              if (!dailyTotals[dateKey]) {
                dailyTotals[dateKey] = 0;
                dailyCurrencies[dateKey] = new Set();
              }
              const amount = Number(row.amount) || 0;
              const rowCurrency = row.amountCurrency ?? spaceCurrency;
              if (activityPresentsAsIncome(row)) {
                dailyTotals[dateKey] += amount;
                dailyCurrencies[dateKey].add(rowCurrency);
              } else if (!activityPresentsAsTransfer(row)) {
                dailyTotals[dateKey] -= Math.abs(amount);
                dailyCurrencies[dateKey].add(rowCurrency);
              }
            });

            return uniqueRows.map((row: IndexTransaction | IndexActivity, idx: number) => {
              const transactionDate = new Date(row.date);
              const currentDate = getTransactionDayGroupKey(transactionDate);
              let showDivider = false;

              if (currentDate !== lastDisplayedDate) {
                showDivider = true;
                lastDisplayedDate = currentDate;
              }

              const dailyNet = dailyTotals[currentDate] || 0;
              const dayCurrencies = dailyCurrencies[currentDate];
              const dailyFormatCurrency =
                dayCurrencies && dayCurrencies.size === 1
                  ? [...dayCurrencies][0]
                  : spaceCurrency;

              const { amount: rowAmount, currency: rowCurrencyCode } =
                indexTransactionDisplayMoney(
                  row,
                  spaceCurrency,
                  showBookedCurrencies,
                );

              const subcategoryName = row.subcategoryName?.trim();
              const hasSubcategory = Boolean(subcategoryName);
              const categoryLine =
                activityCategoryLine(row as IndexActivity);
              const presentsAsIncome = activityPresentsAsIncome(row);
              const presentsAsTransfer = activityPresentsAsTransfer(row);

              const accountLine =
                row.fromAccountName && row.toAccountName
                  ? `${row.fromAccountName} → ${row.toAccountName}`
                  : row.fromAccountName || row.toAccountName || "";

              return (
                <React.Fragment key={row.id}>
                  {showDivider && (
                    <div
                      key={`divider-${currentDate}-${idx}`}
                      className="flex items-center my-5"
                    >
                      <div className="border-t border-gray-300 dark:border-border" style={{width: '2rem'}} />
                      <span className="text-xs font-semibold text-primary bg-background px-3">
                        {formatTransactionDayDividerDate(transactionDate)}
                      </span>
                      <div className="flex-grow border-t border-gray-300 dark:border-border" />
                      <span className={`text-xs font-semibold bg-background px-3 ${
                        dailyNet >= 0 ? 'text-teal-600 dark:text-teal-500' : 'text-red-900 dark:text-red-700'
                      }`}>
                        {dailyNet >= 0 ? '+' : ''}
                        {formatCurrency(dailyNet, dailyFormatCurrency)}
                      </span>
                      <div className="border-t border-gray-300 dark:border-border" style={{width: '2rem'}} />
                    </div>
                  )}
                  <div 
                    className={cn(
                      "transaction-item relative flex justify-between p-3 bg-white rounded hover:bg-gray-100 transition-colors cursor-pointer dark:bg-card dark:hover:bg-accent/50",
                      "items-stretch",
                      hasSubcategory
                        ? "min-h-[78px] md:min-h-[60px]"
                        : "min-h-[60px]",
                    )}
                    onClick={() => {
                      if (
                        "isLoanActivity" in row &&
                        row.isLoanActivity &&
                        row.loanId
                      ) {
                        router.push(
                          `/dashboard/loans/detail?loanId=${row.loanId}`,
                        );
                        return;
                      }

                      if (
                        variant === "activities"
                          ? activityRowIsEditable(row as IndexActivity)
                          : activityRowIsEditable(row as IndexActivity)
                      ) {
                        onRowEdit(row);
                      }
                    }}
                  >
                    {/* Calculated indicator - triangle in upper right corner */}
                    {row.calculated && (
                      <Popover
                        open={hoveredCalculatedId === row.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setHoveredCalculatedId(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <div
                            className="absolute top-0 right-0 w-0 h-0 border-l-[5px] border-l-transparent border-t-[5px] border-t-primary dark:border-t-[var(--primary-dark-mode)] cursor-pointer hover:border-t-primary/90 dark:hover:border-t-[color-mix(in_oklab,var(--primary-dark-mode)_90%,transparent)] transition-colors z-10"
                            role="button"
                            tabIndex={0}
                            onMouseEnter={() => setHoveredCalculatedId(row.id)}
                            onMouseLeave={() => setHoveredCalculatedId(null)}
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="end"
                          sideOffset={6}
                          className="w-auto p-1.5 bg-black/80 text-white text-xs border-0 shadow-lg"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onMouseEnter={() => setHoveredCalculatedId(row.id)}
                          onMouseLeave={() => setHoveredCalculatedId(null)}
                        >
                          Calculated
                        </PopoverContent>
                      </Popover>
                    )}
                    {/* Color indicator */}
                    <div
                      className={cn(
                        "w-1 shrink-0 self-center rounded mr-3 h-[90%] min-h-12",
                        presentsAsIncome
                          ? "bg-teal-600"
                          : presentsAsTransfer
                            ? "bg-blue-900"
                            : "bg-red-900",
                      )}
                    />
                    
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-1 md:gap-2">
                          <h4
                            className="line-clamp-2 min-w-0 flex-1 break-words font-medium text-sm text-primary dark:text-primary-dark-mode"
                            title={row.description}
                          >
                            {row.description}
                          </h4>
                          {row.hasImage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImageClick(row);
                              }}
                              className="shrink-0 cursor-pointer transition-opacity hover:opacity-70"
                              title="View image"
                            >
                              <Image className="h-4 w-4 min-h-4 min-w-4 text-primary dark:text-blue-500" />
                            </button>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div
                                  className={`font-semibold text-sm ${
                              presentsAsIncome
                                ? "text-teal-600 dark:text-teal-500"
                                      : presentsAsTransfer
                                ? "text-blue-900 dark:text-blue-400"
                                : "text-red-900 dark:text-red-700"
                            }`}
                          >
                              {rowAmount < 0
                                ? `-${formatCurrency(
                                    Math.abs(rowAmount),
                                    rowCurrencyCode,
                                  )}`
                                : formatCurrency(
                                    rowAmount,
                                    rowCurrencyCode,
                                  )}
                          </div>
                          <span
                                  className={`px-1 md:px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 gap-1 ${
                              presentsAsIncome
                                      ? "bg-teal-100/50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-500"
                                      : presentsAsTransfer
                                      ? "bg-blue-100/50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-400"
                                      : "bg-red-100/50 text-red-900 dark:bg-red-950/40 dark:text-red-700"
                            }`}
                          >
                                  {presentsAsIncome && <ArrowUpRight className="h-3 w-3 inline" />}
                                  {!presentsAsIncome && !presentsAsTransfer && <ArrowDownLeft className="h-3 w-3 inline" />}
                                  {presentsAsTransfer && <ArrowLeftRight className="h-3 w-3 inline" />}
                                  {(row.type === ActivitiesTypeEnum.LOAN_DISBURSEMENT ||
                                    row.type === ActivitiesTypeEnum.LOAN_PAYMENT ||
                                    row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT ||
                                    row.type === CombinedTransactionTypeEnum.LOAN_PAYMENT) && (
                                    <Landmark className="h-3 w-3 inline" />
                                  )}
                            <span className="hidden md:inline">
                              {row.type === ActivitiesTypeEnum.LOAN_DISBURSEMENT ||
                              row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT
                                ? "loan"
                                : row.type === ActivitiesTypeEnum.LOAN_PAYMENT ||
                                    row.type === CombinedTransactionTypeEnum.LOAN_PAYMENT
                                  ? "payment"
                                  : row.type}
                            </span>
                          </span>
                        </div>
                      </div>
                      
                      {hasSubcategory && (
                        <p
                          className="md:hidden mt-1 text-xs text-gray-600 truncate dark:text-muted-foreground"
                          title={categoryLine}
                        >
                          {categoryLine}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center text-xs text-gray-600 flex-1 min-w-0 overflow-hidden dark:text-muted-foreground">
                          <span className="flex-shrink-0 whitespace-nowrap">
                            {formatTransactionRowDate(row.date)}
                          </span>
                          <span
                            className="hidden md:block truncate ml-4"
                            title={categoryLine}
                          >
                            {categoryLine}
                          </span>
                          {!hasSubcategory && (
                            <span
                              className="md:hidden truncate ml-2 min-w-0"
                              title={categoryLine}
                            >
                              {categoryLine}
                            </span>
                          )}
                          {accountLine && (
                            <>
                              <span
                                className="hidden md:block truncate ml-4"
                                title={accountLine}
                              >
                                {accountLine}
                              </span>
                              <span
                                className="md:hidden truncate ml-2 min-w-0"
                                title={accountLine}
                              >
                                {accountLine}
                              </span>
                            </>
                          )}
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
      {isSuccess && (!data || rowCount(data, variant) === 0) && (
          <div className="text-center py-8 text-gray-500">
            {variant === "activities" ? "No activity found" : "No transactions found"}
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
        rowCount(data, variant) > 0 && (
          <div className="text-center py-2 text-xs text-gray-400">
            {variant === "activities" ? "No more activity" : "No more transactions"}
          </div>
        )}

      <ImageLightbox
        images={lightboxImages}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
