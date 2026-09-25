"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDetailPushExit } from "@/components/dashboard/detail-push-transition";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileText, Pencil } from "lucide-react";

import { AccountIconBadge } from "@/components/dashboard/account-icon-badge";
import { CategoryIconBadge } from "@/components/dashboard/category-icon-badge";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import { TagChip } from "@/components/ui/tag-chip";
import EditTransactionDialog, {
  type EditTransactionSuccessOptions,
} from "@/components/dashboard/forms/EditTransactionDialog";
import { normalizeRealtimeIndexTransaction } from "@/hooks/useTransactionsRealtime";
import { TagDestinationDialog } from "@/components/dashboard/transactions/tag-destination-dialog";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useEntities } from "@/hooks/async/useEntities";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePreferLocalTransactionReads } from "@/hooks/useOfflineReadMode";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/accountTypes";
import { findCategoryTreeOptionForTransaction } from "@/types/categoryTreeTypes";
import { downloadPublicFileCopy } from "@/services/attachments/download-remote";
import { resolveAttachmentsForTransaction } from "@/services/attachments/resolve";
import { loadLocalIndexTransactionById } from "@/services/transactions/local-cache";
import { resolveTransactionDetail } from "@/services/transactions/detail-local";
import { coalesceIndexRelationIds } from "@/services/transactions/relation-ids-local";
import { fetchTransactionById } from "@/services/transactions/queries";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import {
  CombinedTransactionTypeEnum,
  type IndexTransaction,
} from "@/types/transactionTypes";
import { formatIndexTransactionListAmount } from "@/utils/indexTransactionDisplay";
import {
  buildAccountDetailHref,
  buildEntityDetailHref,
  buildRecurringSeriesDetailHref,
} from "@/utils/detailHrefs";
import { buildCategoryDetailHref } from "@/utils/categoryManagement";
import { formatTransactionRowDate } from "@/utils/dateUtils";
import {
  activityPresentsAsIncome,
  activityPresentsAsTransfer,
} from "@/utils/activityDisplay";
import { transactionRowTitle } from "@/utils/transactionDescription";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  isRecurringRow,
  repeatIntervalLabel,
  resolveRootParentId,
  resolveRowRepeatInterval,
} from "@/utils/recurringSchedule";
import { RecurringScheduleBadge } from "@/components/dashboard/recurring/recurring-schedule-badge";
import { formatWithDelimiters } from "@/lib/utils";
import { formatFxQuoteLabel, humanFxQuote } from "@/utils/fxQuoteDisplay";
import {
  moneyFieldsFromDetailPayload,
  transactionViewMoney,
} from "@/utils/transactionViewMoney";
import { resolveCategoryAppearance } from "@/utils/categoryAppearance";

type TransactionDetailContentProps = {
  transactionId: string;
};

const RECEIPT_THUMB_FRAME_CLASS =
  "relative block h-[10.5rem] w-full overflow-hidden rounded-lg bg-muted/40 sm:h-48 "
  + "cursor-pointer transition-opacity hover:opacity-95 "
  + "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
  + "focus-visible:ring-offset-2";

const isImageAttachment = (
  contentType?: string,
  url?: string,
  filename?: string,
): boolean => {
  if (contentType?.startsWith("image/")) {
    return true;
  }

  if (contentType === "application/pdf") {
    return false;
  }

  const name = filename ?? "";
  if (/\.pdf$/i.test(name) || /\.pdf($|\?)/i.test(url ?? "")) {
    return false;
  }

  if (/\.(jpe?g|png|gif|webp|heic)$/i.test(name) || /\.(jpe?g|png|gif|webp|heic)($|\?)/i.test(url ?? "")) {
    return true;
  }

  return Boolean(url);
};

const typeLabel = (type: CombinedTransactionTypeEnum): string => {
  if (type === CombinedTransactionTypeEnum.INCOME) {
    return "Income";
  }
  if (type === CombinedTransactionTypeEnum.TRANSFER) {
    return "Transfer";
  }
  if (type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT) {
    return "Loan";
  }
  if (type === CombinedTransactionTypeEnum.LOAN_PAYMENT) {
    return "Loan payment";
  }
  return "Expense";
};

const asIndexTransaction = (
  transactionId: string,
  payload: Record<string, unknown>,
): IndexTransaction => {
  const normalized = normalizeRealtimeIndexTransaction(payload);
  if (normalized) {
    return normalized;
  }

  const typeRaw = String(payload.type ?? "expense");
  const type =
    typeRaw === "income"
      ? CombinedTransactionTypeEnum.INCOME
      : typeRaw === "transfer"
        ? CombinedTransactionTypeEnum.TRANSFER
        : CombinedTransactionTypeEnum.EXPENSE;
  const money = moneyFieldsFromDetailPayload(payload);
  const bookedAmount = money.bookedAmount;
  const bookedAmountCurrency = money.bookedAmountCurrency ?? "";
  const amount = money.amount;
  const amountCurrency = money.amountCurrency ?? "";
  const accountName = String(
    payload.accountName ?? payload.fromAccountName ?? "",
  );
  const isExpense = type === CombinedTransactionTypeEnum.EXPENSE;
  const accountId = (payload.accountId as string | null | undefined) ?? null;
  const fromAccountId =
    (payload.fromAccountId as string | null | undefined) ??
    (isExpense ? accountId : null);
  const toAccountId =
    (payload.toAccountId as string | null | undefined) ??
    (type === CombinedTransactionTypeEnum.INCOME ? accountId : null);

  return {
    id: String(payload.id ?? transactionId),
    date: String(payload.date ?? ""),
    description: String(payload.description ?? ""),
    amount,
    amountCurrency,
    bookedAmount,
    bookedAmountCurrency,
    currencyConversion: money.currencyConversion,
    categoryName: String(payload.categoryName ?? ""),
    subcategoryName: (payload.subcategoryName as string | null) ?? null,
    categoryId: (payload.categoryId as string | undefined) ?? undefined,
    subcategoryId: (payload.subcategoryId as string | null | undefined) ?? null,
    fromAccountName: String(
      payload.fromAccountName ?? (isExpense ? accountName : ""),
    ),
    toAccountName: String(
      payload.toAccountName ?? (isExpense ? "" : accountName),
    ),
    type,
    inSeries: Boolean(payload.inSeries),
    hasImage: Array.isArray(payload.files) && payload.files.length > 0,
    entityName: (payload.entityName as string | undefined) ?? undefined,
    entityId: (payload.entityId as string | null | undefined) ?? null,
    accountId,
    fromAccountId,
    toAccountId,
    tags: Array.isArray(payload.tags) ? payload.tags : undefined,
  };
};

export function TransactionDetailContent({
  transactionId,
}: TransactionDetailContentProps) {
  const router = useRouter();
  const { requestExit } = useDetailPushExit();
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const preferLocal = usePreferLocalTransactionReads(spaceCode);
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const { entities = [] } = useEntities("transaction");
  const { accounts = [] } = useAccounts();
  const {
    expenseCategoryOptions = [],
    incomeCategoryOptions = [],
  } = useTransactionCategories();
  const [editOpen, setEditOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [tagForDestination, setTagForDestination] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const localQuery = useQuery({
    queryKey: ["transactionView", "local", spaceCode, transactionId],
    queryFn: async () =>
      (await loadLocalIndexTransactionById(spaceCode, transactionId)) ?? null,
    enabled: Boolean(spaceCode && transactionId),
    staleTime: Infinity,
    networkMode: "always",
  });

  const transactionQuery = useQuery({
    queryKey: ["transactionView", spaceCode, transactionId, preferLocal ? "local" : "network"],
    queryFn: async () => {
      const localLatest =
        (await loadLocalIndexTransactionById(spaceCode, transactionId)) ??
        localQuery.data;

      if (preferLocal) {
        if (!localLatest) {
          return null;
        }

        try {
          const detail = await resolveTransactionDetail({
            api: null,
            spaceId: spaceCode,
            transactionId,
            type: localLatest.type,
            listRow: localLatest,
            preferLocal: true,
          });

          return mergeLocalIndexRow(
            asIndexTransaction(
              transactionId,
              detail as unknown as Record<string, unknown>,
            ),
            localLatest,
          );
        } catch {
          return localLatest;
        }
      }

      if (!api) {
        return localLatest;
      }

      try {
        const payload = await fetchTransactionById(api, transactionId);
        return mergeLocalIndexRow(
          asIndexTransaction(
            transactionId,
            (payload ?? {}) as Record<string, unknown>,
          ),
          localLatest,
        );
      } catch {
        try {
          const payload = await fetchTransferById(api, transactionId);
          return mergeLocalIndexRow(
            asIndexTransaction(
              transactionId,
              (payload ?? {}) as Record<string, unknown>,
            ),
            localLatest,
          );
        } catch {
          return localLatest;
        }
      }
    },
    enabled: Boolean(spaceCode && transactionId && (preferLocal || api)),
    placeholderData: localQuery.data ?? undefined,
    networkMode: "always",
    retry: false,
    staleTime: preferLocal ? Infinity : 0,
  });

  const transaction = transactionQuery.data ?? localQuery.data ?? null;
  const isLoading =
    (localQuery.isPending || transactionQuery.isPending) && !transaction;

  const attachmentsQuery = useQuery({
    queryKey: ["transactionView", "attachments", spaceCode, transactionId],
    queryFn: async () =>
      resolveAttachmentsForTransaction({
        api,
        spaceId: spaceCode,
        transactionId,
        type: (transaction?.type ?? CombinedTransactionTypeEnum.EXPENSE),
        listRow: transaction,
        preferLocal,
      }),
    enabled: Boolean(spaceCode && transactionId && transaction),
    staleTime: preferLocal ? Infinity : 0,
    networkMode: "always",
  });

  const attachmentImages = useMemo(
    () =>
      (attachmentsQuery.data?.images ?? []).filter((image) =>
        isImageAttachment(image.contentType, image.url, image.filename),
      ),
    [attachmentsQuery.data],
  );
  const attachmentFiles = attachmentsQuery.data?.images ?? [];
  const [downloadedReceiptUrl, setDownloadedReceiptUrl] = useState<string | null>(null);
  const receiptImage = attachmentImages[0];
  const receiptSrc = downloadedReceiptUrl ?? receiptImage?.url;

  const money = useMemo(() => {
    if (!transaction) {
      return null;
    }
    return transactionViewMoney(transaction, spaceCurrency);
  }, [spaceCurrency, transaction]);

  const refreshTransactionView = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["transactionView", "local", spaceCode, transactionId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["transactionView", spaceCode, transactionId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["transactionView", "attachments", spaceCode, transactionId],
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <p className="text-muted-foreground">Could not load this transaction.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/">Back to transactions</Link>
        </Button>
      </div>
    );
  }

  const presentsAsIncome = activityPresentsAsIncome(transaction);
  const presentsAsTransfer = activityPresentsAsTransfer(transaction);
  const title = transactionRowTitle({
    description: transaction.description,
    fallback: transaction.categoryName || typeLabel(transaction.type),
  });
  const accountId =
    transaction.accountId ??
    (presentsAsIncome ? transaction.toAccountId : transaction.fromAccountId);
  const entityId = transaction.entityId;
  const categoryHrefId = transaction.categoryId || transaction.subcategoryId;
  const categoryKind = presentsAsIncome ? "income" : "expense";
  const merchant = entities.find((entity) => entity.id === entityId);
  const fromAccount = findAccount(
    accounts,
    transaction.fromAccountId ?? (presentsAsIncome ? null : accountId),
    transaction.fromAccountName,
  );
  const toAccount = findAccount(
    accounts,
    transaction.toAccountId ?? (presentsAsIncome ? accountId : null),
    transaction.toAccountName,
  );
  const displayFromAccountName =
    fromAccount?.name ?? transaction.fromAccountName;
  const displayToAccountName = toAccount?.name ?? transaction.toAccountName;
  const displayAccountName = presentsAsIncome
    ? displayToAccountName
    : displayFromAccountName;
  const account = findAccount(accounts, accountId, displayAccountName);
  const matchedCategory = findCategoryTreeOptionForTransaction(
    {
      categoryName: transaction.categoryName,
      subcategoryName: transaction.subcategoryName,
    },
    expenseCategoryOptions,
    incomeCategoryOptions,
  );
  const categoryAppearance = resolveCategoryAppearance({
    name: transaction.categoryName,
    categoryType: categoryKind,
    icon: matchedCategory?.icon,
    color: matchedCategory?.color,
  });
  const canEdit =
    !transaction.hasLoanPayment &&
    !transaction.isLoanActivity &&
    (transaction.type === CombinedTransactionTypeEnum.EXPENSE ||
      transaction.type === CombinedTransactionTypeEnum.INCOME ||
      transaction.type === CombinedTransactionTypeEnum.TRANSFER);
  const seriesRootId = resolveRootParentId(transaction);
  const repeatInterval = resolveRowRepeatInterval(transaction);
  const showsRecurringContext = isRecurringRow(transaction) && seriesRootId;
  const isInstallment =
    transaction.scheduleType === ScheduleTypeEnum.INSTALLMENT
    || transaction.scheduleType === "installment"
    || (transaction.installmentPeriod ?? 0) > 0;

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">
              {typeLabel(transaction.type)}
            </p>
            <h1 className="truncate text-2xl font-bold text-primary">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatTransactionRowDate(transaction.date)}
            </p>
            {showsRecurringContext ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RecurringScheduleBadge repeatInterval={repeatInterval} size="md" />
                <Link
                  href={buildRecurringSeriesDetailHref(seriesRootId!)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {isInstallment ? "View installment" : "View recurring series"}
                </Link>
              </div>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edit
            </Button>
          ) : null}
        </div>

        {money ? (
          <div className="space-y-3">
            <p
              className={cn(
                "text-3xl font-semibold",
                presentsAsIncome
                  ? "text-teal-600 dark:text-teal-500"
                  : presentsAsTransfer
                    ? "text-primary"
                    : "text-red-900 dark:text-red-700",
              )}
            >
              {formatIndexTransactionListAmount(
                money.originalAmount,
                money.originalCurrency,
                true,
              )}
            </p>
            {money.hasConversion &&
            money.convertedAmount != null &&
            money.convertedCurrency ? (
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  →{" "}
                  {formatIndexTransactionListAmount(
                    money.convertedAmount,
                    money.convertedCurrency,
                    true,
                  )}
                </p>
                {money.exchangeRate != null &&
                Number.isFinite(money.exchangeRate) &&
                money.exchangeRate > 0 ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {(() => {
                      const quote = humanFxQuote(
                        money.exchangeRate,
                        money.originalCurrency,
                        money.convertedCurrency,
                      );
                      return `${formatWithDelimiters(quote.displayValue, {
                        minFractionDigits: 3,
                        maxFractionDigits: 3,
                      })} ${formatFxQuoteLabel(quote)}`;
                    })()}
                    {fxSourceHint(money.source)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {transaction.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {transaction.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() =>
                  setTagForDestination({ id: tag.id, name: tag.name })
                }
                aria-label={`Open ${tag.name}`}
              >
                <TagChip tag={tag} />
              </button>
            ))}
          </div>
        ) : null}

        <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {transaction.entityName ? (
            <ViewRow
              label="Merchant"
              value={transaction.entityName}
              href={entityId ? buildEntityDetailHref(entityId) : undefined}
              leading={
                <MerchantAvatar
                  name={transaction.entityName}
                  photoUrl={merchant?.photoUrl}
                  fileUrl={merchant?.photoFileUrl}
                  size={32}
                />
              }
            />
          ) : null}
          {presentsAsTransfer ? (
            <>
              <ViewRow
                label="From"
                value={displayFromAccountName}
                href={
                  transaction.fromAccountId
                    ? buildAccountDetailHref(transaction.fromAccountId)
                    : undefined
                }
                leading={
                  <AccountIconBadge
                    accountCategory={fromAccount?.accountCategory}
                    size="sm"
                  />
                }
              />
              <ViewRow
                label="To"
                value={displayToAccountName}
                href={
                  transaction.toAccountId
                    ? buildAccountDetailHref(transaction.toAccountId)
                    : undefined
                }
                leading={
                  <AccountIconBadge
                    accountCategory={toAccount?.accountCategory}
                    size="sm"
                  />
                }
              />
            </>
          ) : (
            <ViewRow
              label="Account"
              value={displayAccountName}
              href={
                accountId ? buildAccountDetailHref(accountId) : undefined
              }
              leading={
                <AccountIconBadge
                  accountCategory={account?.accountCategory}
                  size="sm"
                />
              }
            />
          )}
          {transaction.categoryName ? (
            <ViewRow
              label="Category"
              value={
                transaction.subcategoryName
                  ? `${transaction.categoryName} · ${transaction.subcategoryName}`
                  : transaction.categoryName
              }
              href={
                categoryHrefId
                  ? buildCategoryDetailHref(categoryHrefId, categoryKind)
                  : undefined
              }
              leading={
                <CategoryIconBadge
                  icon={categoryAppearance.icon}
                  color={categoryAppearance.color}
                  size="sm"
                />
              }
            />
          ) : null}
          {showsRecurringContext ? (
            <ViewRow
              label="Schedule"
              value={repeatIntervalLabel(repeatInterval)}
            />
          ) : null}
        </dl>

        {attachmentsQuery.isPending && (transaction.hasImage || attachmentFiles.length > 0) ? (
          <div className="h-[10.5rem] w-full animate-pulse rounded-lg bg-muted sm:h-48" />
        ) : attachmentImages.length > 0 ? (
          <button
            type="button"
            className={RECEIPT_THUMB_FRAME_CLASS}
            onClick={() => setLightboxOpen(true)}
            aria-label="View attached image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptSrc}
              alt=""
              className="pointer-events-none h-full w-full min-h-full min-w-full object-cover object-[50%_28%]"
              onError={() => {
                if (!receiptImage?.fileUrl || downloadedReceiptUrl) {
                  return;
                }

                void downloadPublicFileCopy(receiptImage.fileUrl).then((downloaded) => {
                  if (downloaded) {
                    setDownloadedReceiptUrl(downloaded);
                  }
                });
              }}
            />
          </button>
        ) : attachmentFiles.length > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {attachmentFiles[0]!.filename ?? "Attached file"}
            </span>
          </div>
        ) : null}
      </div>

      <TagDestinationDialog
        tag={tagForDestination}
        onClose={() => setTagForDestination(null)}
      />

      <EditTransactionDialog
        transaction={transaction}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={(options?: EditTransactionSuccessOptions) => {
          setEditOpen(false);
          setLightboxOpen(false);

          if (options?.deleted) {
            requestExit(() => {
              router.back();
            });
            return;
          }

          void refreshTransactionView();
        }}
      />

      {attachmentImages.length > 0 ? (
        <ImageLightbox
          images={attachmentImages}
          isOpen={lightboxOpen}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

const mergeLocalIndexRow = (
  mapped: IndexTransaction,
  local: IndexTransaction | null | undefined,
): IndexTransaction => {
  if (!local) {
    return mapped;
  }

  const mappedHasFx =
    Boolean(mapped.currencyConversion) ||
    (Boolean(mapped.bookedAmountCurrency?.trim()) &&
      mapped.bookedAmountCurrency?.trim().toUpperCase() !==
        (mapped.amountCurrency ?? "").trim().toUpperCase());

  return {
    ...local,
    ...mapped,
    tags: mapped.tags ?? local.tags,
    categoryId: mapped.categoryId || local.categoryId,
    subcategoryId: mapped.subcategoryId || local.subcategoryId,
    parentId: mapped.parentId ?? local.parentId ?? null,
    scheduleType: mapped.scheduleType ?? local.scheduleType,
    repeatInterval: mapped.repeatInterval ?? local.repeatInterval,
    rootParentId: mapped.rootParentId ?? local.rootParentId,
    installmentPeriod: mapped.installmentPeriod ?? local.installmentPeriod,
    fromAccountName: mapped.fromAccountName?.trim() || local.fromAccountName,
    toAccountName: mapped.toAccountName?.trim() || local.toAccountName,
    inSeries:
      mapped.inSeries
      || local.inSeries
      || Boolean(mapped.parentId ?? local.parentId)
      || (
        (mapped.scheduleType ?? local.scheduleType) === "repeat"
        || (mapped.scheduleType ?? local.scheduleType) === "installment"
      ),
    ...coalesceIndexRelationIds({ mapped, local }),
    currencyConversion: mapped.currencyConversion ?? local.currencyConversion,
    bookedAmount: mappedHasFx
      ? mapped.bookedAmount
      : (mapped.bookedAmount ?? local.bookedAmount),
    bookedAmountCurrency: mappedHasFx
      ? mapped.bookedAmountCurrency
      : (mapped.bookedAmountCurrency || local.bookedAmountCurrency),
    hasImage: mapped.hasImage || local.hasImage,
  };
};

const fxSourceHint = (source: string | null): string => {
  const normalized = source?.trim().toLowerCase() ?? "";
  if (normalized.includes("manual")) {
    return " · manual rate";
  }
  if (normalized.includes("recent")) {
    return " · recent rate";
  }
  return "";
};

const findAccount = (
  accounts: Account[],
  id?: string | null,
  name?: string,
) =>
  accounts.find((account) => account.id === id)
  ?? accounts.find((account) => Boolean(name) && account.name === name);

const ViewRow = ({
  label,
  value,
  href,
  leading,
}: {
  label: string;
  value?: string;
  href?: string;
  leading?: React.ReactNode;
}) => {
  if (!value) {
    return null;
  }

  const content = (
    <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
        </div>
      </div>
      {href ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <div>
      <Link href={href} className="block transition-colors hover:bg-muted/40">
        {content}
      </Link>
    </div>
  );
};
