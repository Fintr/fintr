import { IndexTransaction, TransactionsPage } from "@/types/transactionTypes";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Image } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { InfiniteData } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Edit } from "lucide-react";
import { DeleteButton } from "@/components/dashboard/tabs/transactions/buttons/DeleteButton";

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
}: SheetsViewProps) {
    const tableRef = useRef<HTMLTableElement>(null);
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
    return (

        <div className="mt-4">
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isPending && (
                  <tr>
                    <td colSpan={5} className="text-center p-4">
                      <LoadingSpinner size="medium" />
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center p-4 bg-red-800"
                    >
                      Error: {error?.message}
                    </td>
                  </tr>
                )}
                {isSuccess &&
                  data?.pages && (() => {
                    // Flatten all transactions and deduplicate by ID as a safety measure
                    const allTransactions = data.pages.flatMap(page => page.transactions);
                    const uniqueTransactions = allTransactions.filter((transaction, index, array) => 
                      array.findIndex(t => t.id === transaction.id) === index
                    );
                    
                    return uniqueTransactions.map((transaction: IndexTransaction, index) => (
                      <tr
                        key={transaction.id}
                        className={
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                        data-transaction-id={transaction.id}
                      >
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
                              {new Date(
                                transaction.date
                              ).toLocaleDateString()}
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
                            >
                              {transaction.categoryName}
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
                                  transaction.amount > 0
                                    ? "#16a34a"
                                    : "#dc2626",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>
                                  {transaction.amount > 0 ? "+" : ""}
                                  {formatCurrency(transaction.amount)}
                                </span>
                                {/* Image icon - only show when hasImage is true */}
                                {transaction.hasImage && (
                                  <Image className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/30"
                              onClick={() => onRowEdit(transaction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <DeleteButton
                              onClick={() =>
                                onRowDelete(transaction.id)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Infinite scrolling elements */}
        <div ref={loadMoreRef} style={{ height: "10px" }} />
        
        {isFetchingNextPage && (
          <div className="text-center py-4">
            <LoadingSpinner size="small" />
          </div>
        )}
        
        {!hasNextPage &&
          isSuccess &&
          data &&
          !data.pages.every((p) => p.transactions.length === 0) && (
            <div className="text-center py-4 text-gray-400">
              No more transactions
            </div>
          )}
          
        {isSuccess &&
          (!data || data.pages.every((p) => p.transactions.length === 0)) && (
            <div className="text-center py-8 text-gray-500">
              No transactions found
            </div>
          )}
      </div>
    
    )
}
