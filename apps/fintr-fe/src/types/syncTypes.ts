export type SyncActor = {
  userId: string;
  authId: string;
  fullName: string;
  photoUrl?: string;
};

export type SyncIndexTransaction = {
  id: string;
  date: string;
  createdAt?: string;
  description: string;
  amount: number;
  amountCurrency?: string;
  bookedAmount?: number;
  bookedAmountCurrency?: string;
  categoryName: string;
  subcategoryName?: string | null;
  categoryId?: string;
  subcategoryId?: string | null;
  fromAccountName: string;
  toAccountName: string;
  type:
    | "income"
    | "expense"
    | "transfer"
    | "loan_disbursement"
    | "loan_payment";
  inSeries: boolean;
  hasImage: boolean;
  hasLoanPayment?: boolean;
  calculated?: boolean;
  activitableId?: string;
  isLoanActivity?: boolean;
  loanType?: "borrowed" | "lent";
  loanId?: string;
  entityName?: string;
};

export type SyncLoan = Record<string, unknown> & { id: string };

export type SyncLoanPayment = Record<string, unknown> & {
  id: string;
  loanId: string;
};

export type TransactionChangePayload =
  | { transaction: SyncIndexTransaction }
  | { transactions: SyncIndexTransaction[] };

export type LoanChangePayload =
  | { loan: SyncLoan }
  | { loanId: string };

export type LoanPaymentChangePayload =
  | { loanPayment: SyncLoanPayment }
  | { loanPaymentId: string; loanId: string };

export type SpaceSettingsChangePayload = {
  spaceId?: string;
  currency: string;
  defaultTransactionCurrency?: string | null;
};

export type SpaceChangeOp =
  | "transaction.created"
  | "transaction.updated"
  | "transaction.deleted"
  | "loan.created"
  | "loan.updated"
  | "loan.deleted"
  | "loan_payment.created"
  | "loan_payment.updated"
  | "loan_payment.deleted"
  | "space.settings.updated";

export type SpaceChangePayload =
  | TransactionChangePayload
  | LoanChangePayload
  | LoanPaymentChangePayload
  | SpaceSettingsChangePayload;

export type SpaceChange = {
  seq: number;
  op: SpaceChangeOp;
  occurredAt: string;
  payload: SpaceChangePayload;
  actor?: SyncActor;
  originClientMutationId?: string;
  originTabId?: string;
  suppressActorToast?: boolean;
};

export type PullChangesResponse = {
  spaceId: string;
  since: number;
  latestSeq: number;
  oldestAvailableSeq: number;
  changes: SpaceChange[];
  hasMore: boolean;
};

export type BootstrapRequiredErrorDetails = {
  bootstrapRequired: true;
  oldestAvailableSeq: number;
};

export type PullSpaceChangesResult =
  | { status: "complete"; latestSeq: number }
  | { status: "bootstrap_required"; oldestAvailableSeq: number };

export type SyncBootstrapTotals = {
  transactions: number;
  loans: number;
  budgetMonths: number;
  truncated: boolean;
};

export type SyncBootstrapResponse = {
  spaceId: string;
  latestSeq: number;
  snapshotId: string;
  generatedAt: string;
  totals: SyncBootstrapTotals;
  space: Record<string, unknown>;
  accounts: unknown;
  categories: unknown;
  transactions: SyncIndexTransaction[];
  monthlyFinancialSummaries: unknown[];
  loans: unknown[];
  budgetsByMonth: Record<string, unknown>;
};

export type BootstrapV2Result = {
  latestSeq: number;
  errors: string[];
};

export type CableSyncMessage = {
  type: "sync_change";
  seq: number;
  op: SpaceChangeOp;
  spaceId: string;
  occurredAt?: string;
  payload: SpaceChangePayload;
  actor?: SyncActor | Record<string, unknown>;
  originClientMutationId?: string;
  originTabId?: string;
  suppressActorToast?: boolean;
};

export type CableLegacyTransactionMessage = {
  type:
    | "transaction_created"
    | "transaction_updated"
    | "transaction_deleted";
  spaceId: string;
  transaction?: Record<string, unknown>;
  transactions?: Array<Record<string, unknown>>;
  actor?: Record<string, unknown>;
  originTabId?: string;
  suppressActorToast?: boolean;
};

export type CableLegacySettingsMessage = {
  type: "space_currency_changed";
  spaceId: string;
  currency?: string;
  defaultTransactionCurrency?: string | null;
  actor?: Record<string, unknown>;
  originTabId?: string;
};

export type CableLegacyMessage =
  | CableLegacyTransactionMessage
  | CableLegacySettingsMessage;
