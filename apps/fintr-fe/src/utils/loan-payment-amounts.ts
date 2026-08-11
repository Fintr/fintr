import type { LoanPayment } from "@/services/loans/payments";

export const parseLoanPaymentAmount = (value: unknown): number => {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const readField = (
  raw: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown => raw[camelKey] ?? raw[snakeKey];

export const normalizeLoanPayment = (raw: unknown): LoanPayment | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = record.id;
  if (id == null || id === "") {
    return null;
  }

  return {
    id: String(id),
    loanId: String(readField(record, "loanId", "loan_id") ?? ""),
    accountId: String(readField(record, "accountId", "account_id") ?? ""),
    accountName: String(readField(record, "accountName", "account_name") ?? ""),
    date: String(record.date ?? ""),
    principalPayment: parseLoanPaymentAmount(
      readField(record, "principalPayment", "principal_payment"),
    ),
    interestPayment: parseLoanPaymentAmount(
      readField(record, "interestPayment", "interest_payment"),
    ),
    totalPayment: parseLoanPaymentAmount(
      readField(record, "totalPayment", "total_payment"),
    ),
    currency: String(record.currency ?? "PHP"),
    notes:
      record.notes == null || record.notes === ""
        ? undefined
        : String(record.notes),
    adjustsAccountBalance:
      record.adjustsAccountBalance === false ||
      record.adjusts_account_balance === false
        ? false
        : true,
  };
};

export const normalizeLoanPayments = (raw: unknown): LoanPayment[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((payment) => normalizeLoanPayment(payment))
    .filter((payment): payment is LoanPayment => Boolean(payment));
};

/** Sum interest from recorded payments (actual paid/earned interest, not scheduled). */
export const sumActualLoanInterestPaid = (
  payments: Array<Pick<LoanPayment, "interestPayment"> | Record<string, unknown>>,
): number => {
  const sum = payments.reduce((acc, payment) => {
    const raw =
      payment &&
      typeof payment === "object" &&
      ("interestPayment" in payment || "interest_payment" in payment)
        ? readField(
            payment as Record<string, unknown>,
            "interestPayment",
            "interest_payment",
          )
        : (payment as LoanPayment).interestPayment;

    return acc + parseLoanPaymentAmount(raw);
  }, 0);

  return Math.round(sum * 100) / 100;
};
