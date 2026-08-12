import { IndexTransaction, TransactionsPage, CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { Fragment, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Image } from "lucide-react";
import { formatCurrency, truncateText } from "@/lib/utils";
import { InfiniteData } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  TRANSACTION_DAY_DATA_ATTR,
  useAnchorTransactionsListToToday,
} from "@/hooks/useAnchorTransactionsListToToday";
import { resolveAttachmentsForTransaction } from "@/services/attachments/resolve";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import {
  formatIndexTransactionListAmount,
  indexTransactionDisplayMoney,
} from "@/utils/indexTransactionDisplay";
import { formatTransactionRowDate, getLocalIsoDateKey } from "@/utils/dateUtils";
import { activityShowsCalculatedIndicator } from "@/utils/activityDisplay";

interface SheetsViewProps {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    isSuccess: boolean;
    data?: InfiniteData<TransactionsPage> | null;
    onRowEdit: (transaction: IndexTransaction) => void;
    onRowDelete: (transactionId: string) => void;
    onCellClick: (id: string, field: string, value: string) => void;
    onCellDoubleClick: (id: string, field: string, value: string) => void;
    onKeyDown: (e: React.KeyboardEvent, transaction: IndexTransaction, field: string) => void;
    onSaveEdit: (id: string, field: string) => void;
    loadMoreRef: React.RefObject<HTMLDivElement>;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    /** When true, amount column uses booked (ledger) currency from the API instead of space-normalized. */
    showBookedCurrencies?: boolean;
    /** Land on today after reload (future days stay above). */
    anchorToToday?: boolean;
    queryStartDate?: string;
    queryEndDate?: string;
    fetchNextPage?: () => void;
    anchorResetKey?: string;
}
export function SheetsView({
    isPending,
    isError,
    error,
    isSuccess,
    data,
    onRowEdit,
    onRowDelete,
    onCellClick,
    onCellDoubleClick,
    onKeyDown,
    onSaveEdit,
    loadMoreRef,
    isFetchingNextPage,
    hasNextPage,
    showBookedCurrencies = false,
    anchorToToday = false,
    queryStartDate = "",
    queryEndDate = "",
    fetchNextPage,
    anchorResetKey = "",
}: SheetsViewProps) {
    const tableRef = useRef<HTMLTableElement>(null);
    const [hoveredCalculatedId, setHoveredCalculatedId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const [editingCell, setEditingCell] = useState<{
        id: string;
        field: string;
    } | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [selectedCell, setSelectedCell] = useState<{
        id: string;
        field: string;
    } | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; filename?: string; contentType?: string; byteSize?: number }>>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const lightboxRevokeRef = useRef<(() => void) | null>(null);
    const { api } = useAuthApi();
    const [spaceCode] = useLocalStorage("spaceCode", "");
    const preferLocal = useSkipCachedNetworkFetch();
    
    // Get space context for currency
    const { currentSpace } = useSpaceContext(api);
    const spaceCurrency = currentSpace?.currency ?? "PHP";
    const hasLoadedPages = Boolean(data?.pages?.length);

    const dayKeysNewestFirst = useMemo(() => {
      if (!data?.pages?.length) return [] as string[];

      const keys: string[] = [];
      let lastKey: string | null = null;
      const allTransactions = data.pages.flatMap((page) => page.transactions);
      for (const transaction of allTransactions) {
        const dayKey = getLocalIsoDateKey(transaction.date);
        if (dayKey !== lastKey) {
          keys.push(dayKey);
          lastKey = dayKey;
        }
      }
      return keys;
    }, [data]);

    useAnchorTransactionsListToToday({
      enabled: anchorToToday && Boolean(isSuccess || data?.pages?.length),
      startDate: queryStartDate,
      endDate: queryEndDate,
      dayKeysNewestFirst,
      hasNextPage: Boolean(hasNextPage),
      isFetchingNextPage,
      fetchNextPage,
      resetKey: anchorResetKey,
    });

    const handleCloseLightbox = () => {
        lightboxRevokeRef.current?.();
        lightboxRevokeRef.current = null;
        setLightboxOpen(false);
    };

    const handleImageClick = async (transaction: IndexTransaction) => {
        if (!preferLocal && !api) return;

        try {
            lightboxRevokeRef.current?.();
            lightboxRevokeRef.current = null;

            const result = await resolveAttachmentsForTransaction({
                api,
                spaceId: spaceCode,
                transactionId: transaction.id,
                type: transaction.type,
                listRow: transaction,
                preferLocal,
            });

            if (result.images.length > 0) {
                lightboxRevokeRef.current = result.revoke;
                setLightboxImages(result.images);
                setLightboxIndex(0);
                setLightboxOpen(true);
                return;
            }

            toast.error(
                preferLocal
                    ? "Image not available offline."
                    : "No image found for this transaction.",
            );
        } catch (error) {
            console.error("Error fetching transaction image:", error);
            toast.error("Failed to load transaction image.");
        }
    };

    return (

        <div className="mt-4">
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto md:overflow-x-auto overflow-x-hidden">
            <table className="w-full" ref={tableRef} tabIndex={0}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {isPending && !hasLoadedPages && (
                  <tr>
                    <td colSpan={4} className="text-center p-4">
                      <LoadingSpinner size="medium" />
                    </td>
                  </tr>
                )}
                {isError && !hasLoadedPages && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center p-4 bg-red-800"
                    >
                      Error: {error?.message ?? "Failed to load transactions"}
                    </td>
                  </tr>
                )}
                {hasLoadedPages &&
                  data?.pages && (() => {
                    // Flatten all transactions and deduplicate by ID as a safety measure
                    const allTransactions = data.pages.flatMap(page => page.transactions);
                    const uniqueTransactions = allTransactions.filter((transaction, index, array) => 
                      array.findIndex(t => t.id === transaction.id) === index
                    );
                    let lastIsoDay: string | null = null;
                    return uniqueTransactions.map((transaction: IndexTransaction, index) => {
                      const { amount: rowAmount, currency: rowCurrencyCode } =
                        indexTransactionDisplayMoney(
                          transaction,
                          spaceCurrency,
                          showBookedCurrencies,
                        );
                      const isoDay = getLocalIsoDateKey(transaction.date);
                      const isFirstRowOfDay = isoDay !== lastIsoDay;
                      lastIsoDay = isoDay;

                      return (
                      <Fragment key={transaction.id}>
                      <tr
                        className={`relative scroll-mt-3 ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                        data-transaction-id={transaction.id}
                        {...(isFirstRowOfDay
                          ? { [TRANSACTION_DAY_DATA_ATTR]: isoDay }
                          : {})}
                      >
                        {/* Calculated indicator - triangle in upper right corner */}
                        {activityShowsCalculatedIndicator(transaction) && (
                          <Popover
                            open={hoveredCalculatedId === transaction.id}
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
                                onMouseEnter={() => setHoveredCalculatedId(transaction.id)}
                                onMouseLeave={() => setHoveredCalculatedId(null)}
                              />
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              align="end"
                              sideOffset={6}
                              className="w-auto p-1.5 bg-black/80 text-white text-xs border-0 shadow-lg"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                              onMouseEnter={() => setHoveredCalculatedId(transaction.id)}
                              onMouseLeave={() => setHoveredCalculatedId(null)}
                            >
                              Calculated
                            </PopoverContent>
                          </Popover>
                        )}
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {editingCell?.id === transaction.id &&
                          editingCell?.field === "date" ? (
                            <div className="flex items-center">
                              <Input
                                ref={editInputRef}
                                type="date"
                                value={editValue}
                                onChange={(e) =>
                                  setEditValue(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  onKeyDown(e, transaction, "date")
                                }
                                className="h-7 py-1 px-2 text-sm"
                                autoFocus
                              />
                              <div className="flex ml-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    onSaveEdit(transaction.id, "date")
                                  }
                                >
                                  <Check className="h-4 w-4 text-teal-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingCell(null)}
                                >
                                  <X className="h-4 w-4 text-red-900" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`cursor-pointer px-2 py-1 rounded ${
                                selectedCell?.id === transaction.id &&
                                selectedCell?.field === "date"
                                  ? "bg-blue-100/50 outline-2 outline-blue-500"
                                  : "hover:bg-gray-100"
                              }`}
                              onClick={() =>
                                onCellClick(
                                  transaction.id,
                                  "date",
                                  transaction.date
                                )
                              }
                              onDoubleClick={() =>
                                onCellDoubleClick(
                                  transaction.id,
                                  "date",
                                  transaction.date
                                )
                              }
                              onKeyDown={(e) =>
                                onKeyDown(e, transaction, "date")
                              }
                            >
                              {formatTransactionRowDate(transaction.date)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {editingCell?.id === transaction.id &&
                          editingCell?.field === "description" ? (
                            <div className="flex items-center">
                              <Input
                                ref={editInputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) =>
                                  setEditValue(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  onKeyDown(
                                    e,
                                    transaction,
                                    "description"
                                  )
                                }
                                className="h-7 py-1 px-2 text-sm"
                                autoFocus
                              />
                              <div className="flex ml-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    onSaveEdit(
                                      transaction.id,
                                      "description"
                                    )
                                  }
                                >
                                  <Check className="h-4 w-4 text-teal-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingCell(null)}
                                >
                                  <X className="h-4 w-4 text-red-900" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`cursor-pointer px-2 py-1 rounded ${
                                selectedCell?.id === transaction.id &&
                                selectedCell?.field === "description"
                                  ? "bg-blue-100/50 outline outline-2 outline-blue-500"
                                  : "hover:bg-gray-100"
                              }`}
                              onClick={() =>
                                onCellClick(
                                  transaction.id,
                                  "description",
                                  transaction.description
                                )
                              }
                              onDoubleClick={() =>
                                onCellDoubleClick(
                                  transaction.id,
                                  "description",
                                  transaction.description
                                )
                              }
                              onKeyDown={(e) =>
                                onKeyDown(e, transaction, "description")
                              }
                            >
                              {transaction.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {editingCell?.id === transaction.id &&
                          editingCell?.field === "category" ? (
                            <div className="flex items-center">
                              <Select
                                value={editValue}
                                onValueChange={(value) => {
                                  setEditValue(value);
                                  onSaveEdit(
                                    transaction.id,
                                    "category"
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 py-1 px-2 text-sm">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="food">Food</SelectItem>
                                  <SelectItem value="transportation">
                                    Transportation
                                  </SelectItem>
                                  <SelectItem value="utilities">
                                    Utilities
                                  </SelectItem>
                                  <SelectItem value="entertainment">
                                    Entertainment
                                  </SelectItem>
                                  <SelectItem value="shopping">
                                    Shopping
                                  </SelectItem>
                                  <SelectItem value="house">
                                    House
                                  </SelectItem>
                                  <SelectItem value="income">
                                    Income
                                  </SelectItem>
                                  <SelectItem value="expense">
                                    Expense
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 ml-1"
                                onClick={() => setEditingCell(null)}
                              >
                                <X className="h-4 w-4 text-red-900" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className={`cursor-pointer px-2 py-1 rounded ${
                                selectedCell?.id === transaction.id &&
                                selectedCell?.field === "category"
                                  ? "bg-blue-100/50 outline outline-2 outline-blue-500"
                                  : "hover:bg-gray-100"
                              }`}
                              onClick={() =>
                                onCellClick(
                                  transaction.id,
                                  "category",
                                  transaction.categoryName
                                )
                              }
                              onDoubleClick={() =>
                                onCellDoubleClick(
                                  transaction.id,
                                  "category",
                                  transaction.categoryName
                                )
                              }
                              onKeyDown={(e) =>
                                onKeyDown(e, transaction, "category")
                              }
                              title={transaction.categoryName}
                            >
                              <span className="hidden md:block">{transaction.categoryName}</span>
                              <span className="md:hidden">{truncateText(transaction.categoryName, 10, false)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          {editingCell?.id === transaction.id &&
                          editingCell?.field === "amount" ? (
                            <div className="flex items-center">
                              <Input
                                ref={editInputRef}
                                type="number"
                                value={editValue}
                                onChange={(e) =>
                                  setEditValue(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  onKeyDown(e, transaction, "amount")
                                }
                                className="h-7 py-1 px-2 text-sm"
                                autoFocus
                              />
                              <div className="flex ml-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    onSaveEdit(transaction.id, "amount")
                                  }
                                >
                                  <Check className="h-4 w-4 text-teal-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingCell(null)}
                                >
                                  <X className="h-4 w-4 text-red-900" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`cursor-pointer px-2 py-1 rounded ${
                                selectedCell?.id === transaction.id &&
                                selectedCell?.field === "amount"
                                  ? "bg-blue-100/50 outline outline-2 outline-blue-500"
                                  : "hover:bg-gray-100"
                              }`}
                              onClick={() =>
                                onCellClick(
                                  transaction.id,
                                  "amount",
                                  transaction.amount.toString()
                                )
                              }
                              onDoubleClick={() =>
                                onCellDoubleClick(
                                  transaction.id,
                                  "amount",
                                  transaction.amount.toString()
                                )
                              }
                              onKeyDown={(e) =>
                                onKeyDown(e, transaction, "amount")
                              }
                              style={{
                                color:
                                  rowAmount > 0
                                    ? "#16a34a"
                                    : "#dc2626",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>
                                  {formatIndexTransactionListAmount(
                                    rowAmount,
                                    rowCurrencyCode,
                                    showBookedCurrencies,
                                  )}
                                </span>
                                {/* Image icon - only show when hasImage is true */}
                                {transaction.hasImage && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleImageClick(transaction);
                                    }}
                                    className="cursor-pointer hover:opacity-70 transition-opacity"
                                    title="View image"
                                  >
                                    <Image className="h-4 w-4 text-blue-700 dark:text-blue-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td 
                          className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (!transaction.hasLoanPayment) {
                              onRowEdit(transaction);
                            }
                          }}
                        >
                        </td>
                      </tr>
                      </Fragment>
                    );
                    });
                  })()}
                {hasNextPage && hasLoadedPages && (
                  <tr aria-hidden>
                    <td colSpan={8} className="p-0">
                      <div ref={loadMoreRef} className="h-8 w-full" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {isFetchingNextPage && (
          <div className="text-center py-4">
            <LoadingSpinner size="small" />
          </div>
        )}
        
        {!hasNextPage &&
          hasLoadedPages &&
          data &&
          !data.pages.every((p) => p.transactions.length === 0) && (
            <div className="text-center py-4 text-gray-400">
              No more transactions
            </div>
          )}
          
        {isSuccess &&
          hasLoadedPages &&
          data &&
          data.pages.every((p) => p.transactions.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              No transactions found
            </div>
          )}

        <ImageLightbox
          images={lightboxImages}
          isOpen={lightboxOpen}
          initialIndex={lightboxIndex}
          onClose={handleCloseLightbox}
        />
      </div>
    
    )
}
