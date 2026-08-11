"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronRight,
  FileText,
  Fingerprint,
  HandCoins,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import { ListView } from "@/components/dashboard/tabs/transactions/list-view";
import { useEntityDetail, ENTITY_DETAIL_KEY } from "@/hooks/async/useEntityDetail";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  createMerchantIdentifier,
  deleteMerchantIdentifier,
  EntityDetailTransaction,
} from "@/services/entities/mutation";
import {
  CombinedTransactionTypeEnum,
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { formatCurrency } from "@/lib/utils";
import { formatApiErrorMessage } from "@/utils/errorUtils";
import { EntityEditDialog } from "@/components/dashboard/entities/entity-edit-dialog";

type EntityDetailTab =
  | "transactions"
  | "loans"
  | "payments"
  | "identifiers";

type EntityDetailContentProps = {
  entityId: string;
};

const toIndexTransaction = (
  transaction: EntityDetailTransaction,
): IndexTransaction => ({
  id: transaction.id,
  date: transaction.date,
  description: transaction.description,
  amount: transaction.amount,
  amountCurrency: transaction.amountCurrency,
  categoryName: transaction.categoryName,
  subcategoryName: transaction.subcategoryName,
  fromAccountName: transaction.accountName,
  toAccountName: transaction.accountName,
  type:
    transaction.type === "income"
      ? CombinedTransactionTypeEnum.INCOME
      : CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  entityName: transaction.entityName ?? undefined,
});

const formatRowDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return format(parsed, "MMM d, yyyy");
};

const SectionHeading = ({
  title,
  count,
}: {
  title: string;
  count: number;
}) => (
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-primary">{title}</h2>
    <span className="text-sm text-muted-foreground">{count}</span>
  </div>
);

const EmptySection = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const normalizeIdentifierText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export function EntityDetailContent({ entityId }: EntityDetailContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, refetch } = useEntityDetail(entityId);
  const [activeTab, setActiveTab] = useState<EntityDetailTab>("transactions");
  const [selectedTransaction, setSelectedTransaction] =
    useState<IndexTransaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [identifierInput, setIdentifierInput] = useState("");
  const [isAddingIdentifier, setIsAddingIdentifier] = useState(false);
  const [deletingIdentifierId, setDeletingIdentifierId] = useState<string | null>(
    null,
  );
  const [entityEditOpen, setEntityEditOpen] = useState(false);

  const entity = data?.entity;
  const transactions = data?.transactions ?? [];
  const loans = data?.loans ?? [];
  const loanPayments = data?.loanPayments ?? [];
  const identifiers = data?.identifiers ?? [];
  const isMerchant = entity?.entityType === "transaction";

  const transactionListData = useMemo<
    InfiniteData<TransactionsPage> | undefined
  >(() => {
    if (transactions.length === 0) {
      return undefined;
    }

    const rows = transactions.map(toIndexTransaction);

    return {
      pages: [
        {
          transactions: rows,
          nextPage: null,
          totalPages: 1,
          totalCount: rows.length,
          totals: null,
        },
      ],
      pageParams: [1],
    };
  }, [transactions]);

  const counts = useMemo(
    () => ({
      transactions: transactions.length,
      loans: loans.length,
      payments: loanPayments.length,
      identifiers: identifiers.length,
    }),
    [
      transactions.length,
      loans.length,
      loanPayments.length,
      identifiers.length,
    ],
  );

  const handleTransactionClick = (transaction: IndexTransaction) => {
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [ENTITY_DETAIL_KEY, entityId] });
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const refreshIdentifiers = () => {
    queryClient.invalidateQueries({ queryKey: [ENTITY_DETAIL_KEY, entityId] });
  };

  const handleAddIdentifier = async () => {
    const label = identifierInput.trim();
    if (!label) {
      toast.error("Enter identifier text first");
      return;
    }

    if (
      entity &&
      normalizeIdentifierText(label) === normalizeIdentifierText(entity.fullName)
    ) {
      toast.error("Identifier cannot be the same as the merchant name");
      return;
    }

    setIsAddingIdentifier(true);

    try {
      await createMerchantIdentifier(api, entityId, label);
      setIdentifierInput("");
      refreshIdentifiers();
      toast.success("Identifier added");
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Could not add identifier. Try again."),
      );
    } finally {
      setIsAddingIdentifier(false);
    }
  };

  const handleDeleteIdentifier = async (identifierId: string) => {
    setDeletingIdentifierId(identifierId);

    try {
      await deleteMerchantIdentifier(api, entityId, identifierId);
      refreshIdentifiers();
      toast.success("Identifier removed");
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Could not remove identifier. Try again."),
      );
    } finally {
      setDeletingIdentifierId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (isError || !entity) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-2 py-8">
        <p className="text-muted-foreground">Could not load this entity.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/space_settings/entities">Back to entities</Link>
          </Button>
        </div>
      </div>
    );
  }

  const entityLabel =
    entity.entityType === "transaction" ? "Merchant" : "Loan contact";

  const tabGridClass = isMerchant ? "grid-cols-4" : "grid-cols-3";

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <MerchantAvatar
            name={entity.fullName}
            photoUrl={entity.photoUrl}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-primary">
              {entity.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">{entityLabel}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setEntityEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden />
            Edit
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as EntityDetailTab)}
        >
          <TabsList
            className={`grid w-full min-w-0 ${tabGridClass} bg-white dark:bg-card dark:shadow-sm`}
          >
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">
              Transactions ({counts.transactions})
            </TabsTrigger>
            <TabsTrigger value="loans" className="text-xs sm:text-sm">
              Loans ({counts.loans})
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">
              Payments ({counts.payments})
            </TabsTrigger>
            {isMerchant ? (
              <TabsTrigger value="identifiers" className="text-xs sm:text-sm">
                Identifiers ({counts.identifiers})
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>

        {activeTab === "transactions" ? (
          <section className="space-y-3">
            <SectionHeading title="Transactions" count={counts.transactions} />
            {transactions.length === 0 ? (
              <EmptySection message="No transactions linked to this entity yet." />
            ) : (
              <ListView
                isPending={false}
                isError={false}
                error={null}
                isSuccess
                data={transactionListData}
                isFetchingNextPage={false}
                hasNextPage={false}
                onRowEdit={handleTransactionClick}
                onRowDelete={() => {}}
                loadMoreRef={loadMoreRef}
              />
            )}
          </section>
        ) : null}

        {activeTab === "loans" ? (
          <section className="space-y-3">
            <SectionHeading title="Loans" count={counts.loans} />
            {loans.length === 0 ? (
              <EmptySection message="No loans linked to this contact yet." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {loans.map((loan) => (
                  <li key={loan.id}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/loans/detail?loanId=${encodeURIComponent(loan.id)}`,
                        )
                      }
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {loan.description || "Loan"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatRowDate(loan.date)}
                          {` · ${loan.loanType === "borrowed" ? "Borrowed" : "Lent"}`}
                          {` · ${loan.status.replace("_", " ")}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(
                            loan.outstandingBalance,
                            loan.currency,
                          )}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {activeTab === "payments" ? (
          <section className="space-y-3">
            <SectionHeading title="Payments" count={counts.payments} />
            {loanPayments.length === 0 ? (
              <EmptySection message="No loan payments linked to this contact yet." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {loanPayments.map((payment) => (
                  <li key={payment.id}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/loans/detail?loanId=${encodeURIComponent(payment.loanId)}`,
                        )
                      }
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <HandCoins className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {payment.loanDescription || "Loan payment"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatRowDate(payment.date)}
                          {payment.accountName ? ` · ${payment.accountName}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(payment.totalPayment, payment.currency)}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {activeTab === "identifiers" && isMerchant ? (
          <section className="space-y-4">
            <SectionHeading title="Identifiers" count={counts.identifiers} />

            <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <ScanLine className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">
                    What are identifiers?
                  </p>
                  <p>
                    Identifiers are receipt text that Fintr links to{" "}
                    <span className="font-medium text-foreground">
                      {entity.fullName}
                    </span>
                    . Receipt scanning often reads a legal or register name that
                    does not match the merchant name you use.
                  </p>
                  <p>
                    When you scan a receipt and choose this merchant, Fintr
                    remembers the receipt description. Next time scanning finds
                    that same text, the expense is automatically assigned here.
                    You can also add identifiers manually below.
                  </p>
                  <p className="text-xs">
                    Example: scanning shows &quot;CORPORATION A&quot; but you
                    pick Dairy Queen — &quot;CORPORATION A&quot; becomes an
                    identifier for Dairy Queen.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={identifierInput}
                onChange={(event) => setIdentifierInput(event.target.value)}
                placeholder='e.g. "CORPORATION A"'
                disabled={isAddingIdentifier}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddIdentifier();
                  }
                }}
                aria-label="Identifier text"
              />
              <Button
                type="button"
                onClick={() => void handleAddIdentifier()}
                disabled={isAddingIdentifier || identifierInput.trim().length === 0}
                className="shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add identifier
              </Button>
            </div>

            {identifiers.length === 0 ? (
              <EmptySection message="No identifiers yet. Add receipt text above, or save a receipt expense and pick this merchant." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {identifiers.map((identifier) => (
                  <li key={identifier.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <Fingerprint className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {identifier.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Receipt scan text
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDeleteIdentifier(identifier.id)}
                        disabled={deletingIdentifierId === identifier.id}
                        aria-label={`Remove identifier ${identifier.label}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <EditTransactionDialog
        transaction={selectedTransaction}
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedTransaction(null);
        }}
        onSuccess={handleEditSuccess}
      />

      <EntityEditDialog
        entity={entity}
        entityLabel={entityLabel}
        open={entityEditOpen}
        onOpenChange={setEntityEditOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
