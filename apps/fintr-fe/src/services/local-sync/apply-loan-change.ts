import type { QueryClient } from "@tanstack/react-query";

import {
  cacheLoanDetail,
  removeLoanFromCachedPages,
  upsertLoanInCachedPages,
} from "@/services/loans/local-cache";
import {
  removeLoanPaymentFromLocalStores,
  upsertLoanPaymentInLocalStores,
} from "@/services/loans/loan-payments-cache";
import {
  removeLoanFromQueryCaches,
  upsertLoanInQueryCaches,
} from "@/services/loans/loans-list-cache";
import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import type {
  LoanChangePayload,
  LoanPaymentChangePayload,
  SpaceChange,
  SyncLoan,
  SyncLoanPayment,
} from "@/types/syncTypes";

const asString = (value: unknown): string =>
  value == null ? "" : String(value);

const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value == null) {
    return undefined;
  }

  return value === "true" || value === 1;
};

const readField = (
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown => record[camelKey] ?? record[snakeKey];

const normalizeLoan = (raw: SyncLoan): Loan | null => {
  const id = asString(raw.id);
  if (!id) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const loanTypeRaw = asString(readField(record, "loanType", "loan_type"));
  const statusRaw = asString(record.status);

  return {
    id,
    date: asString(record.date),
    description:
      record.description == null ? null : asString(record.description),
    loanType: loanTypeRaw === "lent" ? "lent" : "borrowed",
    loanTermMonths: asNumber(readField(record, "loanTermMonths", "loan_term_months")),
    maturityDate: asString(readField(record, "maturityDate", "maturity_date")),
    status:
      statusRaw === "paid_off" || statusRaw === "defaulted"
        ? statusRaw
        : "active",
    paidOffDate:
      readField(record, "paidOffDate", "paid_off_date") == null
        ? null
        : asString(readField(record, "paidOffDate", "paid_off_date")),
    interestRate: asNumber(readField(record, "interestRate", "interest_rate")),
    adjustsAccountBalance: asBoolean(
      readField(record, "adjustsAccountBalance", "adjusts_account_balance"),
    ),
    entityName: asString(readField(record, "entityName", "entity_name")),
    accountName: asString(readField(record, "accountName", "account_name")),
    principalAmount: asNumber(
      readField(record, "principalAmount", "principal_amount"),
    ),
    principalAmountCurrency: asString(
      readField(record, "principalAmountCurrency", "principal_amount_currency"),
    ),
    outstandingBalance: asNumber(
      readField(record, "outstandingBalance", "outstanding_balance"),
    ),
    outstandingBalanceCurrency: asString(
      readField(
        record,
        "outstandingBalanceCurrency",
        "outstanding_balance_currency",
      ),
    ),
    value: asNumber(record.value),
    income: asNumber(record.income),
    expense: asNumber(record.expense),
    totalValue: asNumber(readField(record, "totalValue", "total_value")),
    files: Array.isArray(record.files)
      ? (record.files as Loan["files"])
      : [],
    loanPayments: Array.isArray(record.loanPayments ?? record.loan_payments)
      ? ((record.loanPayments ?? record.loan_payments) as Loan["loanPayments"])
      : undefined,
    amortizationSchedule: Array.isArray(
      record.amortizationSchedule ?? record.amortization_schedule,
    )
      ? ((record.amortizationSchedule ??
          record.amortization_schedule) as Loan["amortizationSchedule"])
      : undefined,
  };
};

const normalizeLoanPayment = (raw: SyncLoanPayment): LoanPayment | null => {
  const id = asString(raw.id);
  const loanId = asString(raw.loanId ?? (raw as Record<string, unknown>).loan_id);
  if (!id || !loanId) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  return {
    id,
    loanId,
    accountId: asString(readField(record, "accountId", "account_id")),
    accountName: asString(readField(record, "accountName", "account_name")),
    date: asString(record.date),
    principalPayment: asNumber(
      readField(record, "principalPayment", "principal_payment"),
    ),
    interestPayment: asNumber(
      readField(record, "interestPayment", "interest_payment"),
    ),
    totalPayment: asNumber(
      readField(record, "totalPayment", "total_payment"),
    ),
    currency: asString(record.currency),
    notes: record.notes == null ? undefined : asString(record.notes),
    adjustsAccountBalance: asBoolean(
      readField(record, "adjustsAccountBalance", "adjusts_account_balance"),
    ),
  };
};

export type ApplyLoanChangeParams = {
  spaceId: string;
  targetSpace?: string;
  change: SpaceChange;
  queryClient: QueryClient;
};

export const applyLoanCreated = async (
  params: ApplyLoanChangeParams,
): Promise<void> => {
  const payload = params.change.payload as LoanChangePayload;
  if (!("loan" in payload) || !payload.loan) {
    return;
  }

  const loan = normalizeLoan(payload.loan);
  if (!loan) {
    return;
  }

  const spaceCode = params.targetSpace ?? params.spaceId;

  upsertLoanInQueryCaches(params.queryClient, { spaceCode, loan });
  await upsertLoanInCachedPages(spaceCode, loan);
};

export const applyLoanUpdated = applyLoanCreated;

export const applyLoanDeleted = async (
  params: ApplyLoanChangeParams,
): Promise<void> => {
  const payload = params.change.payload as LoanChangePayload;
  const loanId = asString(
    "loanId" in payload
      ? payload.loanId
      : "loan_id" in payload
        ? (payload as { loan_id?: string }).loan_id
        : "",
  );

  if (!loanId) {
    return;
  }

  const spaceCode = params.targetSpace ?? params.spaceId;

  removeLoanFromQueryCaches(params.queryClient, loanId);
  await removeLoanFromCachedPages(spaceCode, loanId);
};

export const applyLoanPaymentCreated = async (
  params: ApplyLoanChangeParams,
): Promise<void> => {
  const payload = params.change.payload as LoanPaymentChangePayload;
  if (!("loanPayment" in payload) || !payload.loanPayment) {
    return;
  }

  const payment = normalizeLoanPayment(payload.loanPayment);
  if (!payment) {
    return;
  }

  const spaceCode = params.targetSpace ?? params.spaceId;

  await upsertLoanPaymentInLocalStores({
    spaceCode,
    loanId: payment.loanId,
    payment,
    queryClient: params.queryClient,
  });
};

export const applyLoanPaymentUpdated = applyLoanPaymentCreated;

export const applyLoanPaymentDeleted = async (
  params: ApplyLoanChangeParams,
): Promise<void> => {
  const payload = params.change.payload as LoanPaymentChangePayload;
  const paymentId = asString(
    "loanPaymentId" in payload
      ? payload.loanPaymentId
      : "loan_payment_id" in payload
        ? (payload as { loan_payment_id?: string }).loan_payment_id
        : "",
  );
  const loanId = asString(
    "loanId" in payload
      ? payload.loanId
      : "loan_id" in payload
        ? (payload as { loan_id?: string }).loan_id
        : "",
  );

  if (!paymentId || !loanId) {
    return;
  }

  const spaceCode = params.targetSpace ?? params.spaceId;

  await removeLoanPaymentFromLocalStores({
    spaceCode,
    loanId,
    paymentId,
    queryClient: params.queryClient,
  });
};
