import React, { useRef, useState } from "react";
import { IndexTransaction, CombinedTransactionTypeEnum, TransactionsPage } from "@/types/transactionTypes";
import { formatCurrency, truncateText } from "@/lib/utils";
import { FileText, Calendar, Tag, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Copy, Check, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfiniteData } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ImageLightbox from "@/components/crm/ImageLightbox";
import { useAuthApi } from "@/hooks/useAuthApi";
import { fetchTransactionById } from "@/services/transactions/queries";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import { toast } from "sonner";
import { useSpaceContext } from "@/hooks/useSpaceContext";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; filename?: string; contentType?: string; byteSize?: number }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [hoveredCalculatedId, setHoveredCalculatedId] = useState<string | null>(null);
  const { api } = useAuthApi();
  
  // Get space context for currency
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

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

  const handleImageClick = async (transaction: IndexTransaction) => {
    if (!api) return;

    try {
      let transactionData;
      
      if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
        transactionData = await fetchTransferById(api, transaction.id);
      } else {
        transactionData = await fetchTransactionById(api, transaction.id);
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
    <div className="space-y-2 bg-white rounded-lg overflow-hidden p-2">
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
            
            // Flatten all transactions and deduplicate by ID as a safety measure
            const allTransactions = data.pages.flatMap(page => page.transactions);
            const uniqueTransactions = allTransactions.filter((transaction, index, array) => 
              array.findIndex(t => t.id === transaction.id) === index
            );
            
            return uniqueTransactions.map((transaction: IndexTransaction, idx: number) => {
              const transactionDate = new Date(transaction.date);
              const currentDate = transactionDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              let showDivider = false;

              if (currentDate !== lastDisplayedDate) {
                showDivider = true;
                lastDisplayedDate = currentDate;
              }

              return (
                <React.Fragment key={transaction.id}>
                  {showDivider && (
                    <div
                      key={`divider-${currentDate}-${idx}`}
                      className="flex items-center my-5"
                    >
                      <div className="border-t border-gray-300" style={{width: '2rem'}} />
                      <span className="text-xs font-semibold text-primary bg-white px-3">
                        {currentDate}
                      </span>
                      <div className="flex-grow border-t border-gray-300" />
                    </div>
                  )}
                  <div 
                    className="transaction-item relative flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors min-h-[60px] cursor-pointer"
                    onClick={() => {
                      if (!transaction.hasLoanPayment) {
                        onRowEdit(transaction);
                      }
                    }}
                  >
                    {/* Calculated indicator - triangle in upper right corner */}
                    {transaction.calculated && (
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
                            className="absolute top-0 right-0 w-0 h-0 border-l-[5px] border-l-transparent border-t-[5px] border-t-primary cursor-pointer hover:border-t-primary/90 transition-colors z-10"
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
                    {/* Color indicator */}
                      <div
                      className={`w-1 h-12 rounded mr-3 flex-shrink-0 ${
                          transaction.type === CombinedTransactionTypeEnum.INCOME
                            ? "bg-teal-600"
                          : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                            ? "bg-red-900"
                            : "bg-blue-900"
                        }`}
                    />
                    
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 md:gap-2">
                        {/* This div contains the description and the ID popover */}
                        <div className="flex items-center gap-1 md:gap-2 flex-auto min-w-0"> {/* Added flex-auto and min-w-0 */} 
                          <h4 className="font-medium text-sm text-primary truncate"> {/* Removed flex-1 and min-w-0 */} 
                            {transaction.description}
                          </h4>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyId(transaction.id);
                                }}
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
                              <Image className="h-4 w-4 min-w-4 min-h-4 text-primary" />
                            </button>
                          )}
                        </div>
                        {/* This div contains the amount and type badge */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div
                                  className={`font-semibold text-sm ${
                              transaction.type === CombinedTransactionTypeEnum.INCOME
                                ? "text-teal-600"
                                      : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                                ? "text-red-900"
                                : "text-blue-900"
                            }`}
                          >
                              {transaction.amount < 0
                                ? `-${formatCurrency(Math.abs(transaction.amount), spaceCurrency)}`
                                : formatCurrency(transaction.amount, spaceCurrency)}
                          </div>
                          <span
                                  className={`px-1 md:px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 gap-1 ${
                              transaction.type === CombinedTransactionTypeEnum.INCOME
                                      ? "bg-teal-100/50  text-teal-600"
                                      : transaction.type === CombinedTransactionTypeEnum.EXPENSE
                                      ? "bg-red-100/50 text-red-900"
                                      : "bg-blue-100/50 text-blue-900"
                            }`}
                          >
                                  {transaction.type === CombinedTransactionTypeEnum.INCOME && <ArrowUpRight className="h-3 w-3 inline" />}
                                  {transaction.type === CombinedTransactionTypeEnum.EXPENSE && <ArrowDownLeft className="h-3 w-3 inline" />}
                                  {transaction.type === CombinedTransactionTypeEnum.TRANSFER && <ArrowLeftRight className="h-3 w-3 inline" />}
                            <span className="hidden md:inline">{transaction.type}</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center text-xs text-gray-600 flex-1 min-w-0 overflow-hidden">
                          <span className="flex-shrink-0 whitespace-nowrap">{new Date(transaction.date).toLocaleDateString()}</span>
                          <span className="hidden md:block truncate ml-4" title={transaction.categoryName}>{transaction.categoryName}</span>
                          <span className="md:hidden truncate ml-2 md:ml-4 min-w-0" title={transaction.categoryName}>{transaction.categoryName}</span>
                          {(transaction.fromAccountName || transaction.toAccountName) && (
                            <>
                              <span className="hidden md:block truncate ml-4" title={
                                transaction.fromAccountName && transaction.toAccountName 
                                  ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                                  : transaction.fromAccountName 
                                  ? `${transaction.fromAccountName}`
                                  : `${transaction.toAccountName}`
                              }>
                                {transaction.fromAccountName && transaction.toAccountName 
                                  ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                                  : transaction.fromAccountName 
                                  ? `${transaction.fromAccountName}`
                                  : `${transaction.toAccountName}`
                                }
                              </span>
                              <span className="md:hidden truncate ml-2 md:ml-4 min-w-0" title={
                                transaction.fromAccountName && transaction.toAccountName 
                                  ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                                  : transaction.fromAccountName 
                                  ? `${transaction.fromAccountName}`
                                  : `${transaction.toAccountName}`
                              }>
                                {transaction.fromAccountName && transaction.toAccountName 
                                  ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                                  : transaction.fromAccountName 
                                  ? `${transaction.fromAccountName}`
                                  : `${transaction.toAccountName}`
                                }
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

      <ImageLightbox
        images={lightboxImages}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
