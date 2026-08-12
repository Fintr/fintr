import type { AxiosInstance } from "axios";

import {
  claimOutboxRecord,
  listDistinctOutboxSpaceIds,
  listPendingOutboxOrdered,
  OUTBOX_COMMAND_LOAN_CREATE,
  OUTBOX_COMMAND_LOAN_DELETE,
  OUTBOX_COMMAND_LOAN_UPDATE,
  OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
  OUTBOX_COMMAND_LOAN_PAYMENT_DELETE,
  OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE,
  OUTBOX_COMMAND_SPACE_SETTINGS_UPDATE,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  OUTBOX_COMMAND_TRANSACTION_DELETE,
  OUTBOX_COMMAND_TRANSACTION_UPDATE,
  OUTBOX_COMMAND_TRANSFER_CREATE,
  OUTBOX_COMMAND_TRANSFER_DELETE,
  OUTBOX_COMMAND_TRANSFER_UPDATE,
  OUTBOX_COMMAND_USER_SETTINGS_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
  type LocalOutboxRecord,
} from "@/lib/local-db";
import {
  hydrateCreatePayload,
  syncAttachmentOwnerId,
} from "@/services/attachments/create-outbox";
import type { AttachmentOutboxFields } from "@/services/attachments/types";
import { updateUser } from "@/services/auth/user/mutations";
import type { UserSettingsUpdateOutboxPayload } from "@/services/auth/user/update-settings-local-first";
import {
  createLoan,
  deleteLoan,
  updateLoan,
  type CreateLoanType,
  type UpdateLoanType,
} from "@/services/loans/mutation";
import {
  createLoanPayment,
  deleteLoanPayment,
  updateLoanPayment,
} from "@/services/loans/payments";
import type { LoanPaymentCreateOutboxPayload } from "@/services/loans/payments/create-local-first";
import type { LoanPaymentUpdateOutboxPayload } from "@/services/loans/payments/update-local-first";
import { replaceLoanPaymentIdInLocalStores } from "@/services/loans/loan-payments-cache";
import { normalizeLoanPayment } from "@/utils/loan-payment-amounts";
import { spacesApi } from "@/services/spaces/api";
import type { SpaceSettingsUpdateOutboxPayload } from "@/services/spaces/update-settings-local-first";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type CreateTransactionType,
  type UpdateTransactionType,
} from "@/services/transactions/mutation";
import {
  removeLocalSeriesChildrenForMutation,
  replaceLocalIndexTransactionId,
} from "@/services/transactions/local-cache";
import type { TransactionDeleteOutboxPayload } from "@/services/transactions/delete-local-first";
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
  type CreateTransferType,
  type UpdateTransferType,
} from "@/services/transactions/transfers/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";

export type DrainOutboxResult = {
  processed: number;
  failed: number;
  stoppedEarly: boolean;
};

const drainingSpaces = new Set<string>();
let globalDrainPromise: Promise<DrainOutboxResult> | null = null;

const extractCreatedId = (response: unknown): string | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as Record<string, unknown>;
  const data = root.data;

  if (typeof root.id === "string" && root.id) {
    return root.id;
  }

  if (data && typeof data === "object") {
    const nestedId = (data as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId) {
      return nestedId;
    }
  }

  return undefined;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create transaction" ||
      error.message === "Failed to create loan" ||
      error.message === "Failed to create loan payment" ||
      error.message === "Failed to delete transaction" ||
      error.message === "Failed to update transfer" ||
      error.message === "Failed to update loan" ||
      error.message === "Failed to update loan payment" ||
      error.message.toLowerCase().includes("network")
    );
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; success?: unknown };
    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return true;
};

const drainTransactionCreate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = await hydrateCreatePayload(
    record.payload as CreateTransactionType & AttachmentOutboxFields,
  );
  const localId = `local:${record.clientMutationId}`;

  try {
    const serverResponse = await createTransaction(api, {
      ...payload,
      clientMutationId: record.clientMutationId,
    });
    const serverId = extractCreatedId(serverResponse) ?? localId;

    if (serverId !== localId) {
      await replaceLocalIndexTransactionId(record.spaceId, localId, serverId);
      await syncAttachmentOwnerId({
        spaceId: record.spaceId,
        ownerType: "transaction",
        localOwnerId: localId,
        serverOwnerId: serverId,
      });
    }

    // Server expands the series; drop optimistic local children to avoid dupes.
    await removeLocalSeriesChildrenForMutation(
      record.spaceId,
      record.clientMutationId,
    );

    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainTransactionDelete = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as TransactionDeleteOutboxPayload;

  try {
    await deleteTransaction(api, {
      id: payload.id,
      deleteScope: payload.deleteScope,
    });
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    // Already gone / other server errors: local delete stands; drop the outbox row.
    await removeOutboxRecord(record.id);
    return "ok";
  }
};

const drainTransactionUpdate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as UpdateTransactionType;

  try {
    await updateTransaction(api, payload);
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainTransferCreate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = await hydrateCreatePayload(
    record.payload as CreateTransferType & AttachmentOutboxFields,
  );
  const localId = `local:${record.clientMutationId}`;

  try {
    const serverResponse = await createTransfer(api, {
      ...payload,
      clientMutationId: record.clientMutationId,
    });
    const serverId = extractCreatedId(serverResponse) ?? localId;

    if (serverId !== localId) {
      await replaceLocalIndexTransactionId(record.spaceId, localId, serverId);
      await syncAttachmentOwnerId({
        spaceId: record.spaceId,
        ownerType: "transfer",
        localOwnerId: localId,
        serverOwnerId: serverId,
      });
    }

    // Server expands the series; drop optimistic local children (+ child fees).
    // Keeps parent transfer-fee placeholder for realtime dedupe.
    await removeLocalSeriesChildrenForMutation(
      record.spaceId,
      record.clientMutationId,
    );

    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainTransferDelete = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as {
    id: string;
    deleteScope: DeleteScopeEnum;
  };

  try {
    await deleteTransfer(api, {
      id: payload.id,
      deleteScope: payload.deleteScope,
    });
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await removeOutboxRecord(record.id);
    return "ok";
  }
};

const drainLoanCreate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = await hydrateCreatePayload(
    record.payload as CreateLoanType & AttachmentOutboxFields,
  );
  const localId = `local:${record.clientMutationId}`;

  try {
    const serverResponse = await createLoan(api, payload);
    const serverId = extractCreatedId(serverResponse) ?? localId;

    if (serverId !== localId) {
      await replaceLocalIndexTransactionId(record.spaceId, localId, serverId);
      await syncAttachmentOwnerId({
        spaceId: record.spaceId,
        ownerType: "loan",
        localOwnerId: localId,
        serverOwnerId: serverId,
      });
    }

    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainLoanDelete = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as { id: string };

  try {
    await deleteLoan(api, payload.id);
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await removeOutboxRecord(record.id);
    return "ok";
  }
};

const drainLoanPaymentCreate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as LoanPaymentCreateOutboxPayload;
  const localId = `local:${record.clientMutationId}`;
  const { loanId, ...paymentData } = payload;

  try {
    const serverResponse = await createLoanPayment(api, loanId, paymentData);
    const created =
      normalizeLoanPayment(
        (serverResponse as { data?: unknown })?.data ?? serverResponse,
      ) ?? null;
    const serverId = created?.id ?? extractCreatedId(serverResponse) ?? localId;

    if (serverId !== localId) {
      await replaceLocalIndexTransactionId(record.spaceId, localId, serverId);
      if (created) {
        await replaceLoanPaymentIdInLocalStores({
          spaceCode: record.spaceId,
          loanId,
          previousId: localId,
          nextPayment: created,
        });
      }
    }

    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainLoanPaymentDelete = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as { loanId: string; paymentId: string };

  try {
    await deleteLoanPayment(api, payload.loanId, payload.paymentId);
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await removeOutboxRecord(record.id);
    return "ok";
  }
};

const drainTransferUpdate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as UpdateTransferType;

  try {
    await updateTransfer(api, payload);
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainLoanUpdate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as UpdateLoanType;

  try {
    await updateLoan(api, payload);
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainLoanPaymentUpdate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as LoanPaymentUpdateOutboxPayload;
  const { loanId, paymentId, ...paymentData } = payload;

  try {
    await updateLoanPayment(api, loanId, paymentId, paymentData);
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainSpaceSettingsUpdate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as SpaceSettingsUpdateOutboxPayload;

  try {
    await spacesApi.updateSpace(api, payload.spaceId, {
      name: payload.name,
      ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
      ...(payload.defaultTransactionCurrency !== undefined
        ? {
            defaultTransactionCurrency: payload.defaultTransactionCurrency,
          }
        : {}),
    });
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

const drainUserSettingsUpdate = async (params: {
  api: AxiosInstance;
  record: LocalOutboxRecord;
}): Promise<"ok" | "network" | "failed"> => {
  const { api, record } = params;
  const payload = record.payload as UserSettingsUpdateOutboxPayload;

  try {
    await updateUser({
      api,
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
    });
    await removeOutboxRecord(record.id);
    return "ok";
  } catch (error) {
    if (isNetworkLikeError(error)) {
      await updateOutboxStatus({
        id: record.id,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Network error draining outbox",
      });
      return "network";
    }

    await updateOutboxStatus({
      id: record.id,
      status: "failed",
      lastError:
        error instanceof Error
          ? error.message
          : "Validation error draining outbox",
    });
    return "failed";
  }
};

export const drainOutboxForSpace = async (params: {
  api: AxiosInstance;
  spaceId: string;
}): Promise<DrainOutboxResult> => {
  const { api, spaceId } = params;
  if (!spaceId) {
    return { processed: 0, failed: 0, stoppedEarly: false };
  }

  if (drainingSpaces.has(spaceId)) {
    return { processed: 0, failed: 0, stoppedEarly: true };
  }

  drainingSpaces.add(spaceId);
  let processed = 0;
  let failed = 0;
  let stoppedEarly = false;

  try {
    const pending = await listPendingOutboxOrdered({ spaceId });

    for (const record of pending) {
      const claimed = await claimOutboxRecord(record.id);
      if (!claimed) continue;

      if (record.commandType === OUTBOX_COMMAND_TRANSACTION_CREATE) {
        const outcome = await drainTransactionCreate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_TRANSACTION_DELETE) {
        const outcome = await drainTransactionDelete({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_TRANSACTION_UPDATE) {
        const outcome = await drainTransactionUpdate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_TRANSFER_CREATE) {
        const outcome = await drainTransferCreate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_TRANSFER_DELETE) {
        const outcome = await drainTransferDelete({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_TRANSFER_UPDATE) {
        const outcome = await drainTransferUpdate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_LOAN_CREATE) {
        const outcome = await drainLoanCreate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_LOAN_DELETE) {
        const outcome = await drainLoanDelete({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_LOAN_UPDATE) {
        const outcome = await drainLoanUpdate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_LOAN_PAYMENT_CREATE) {
        const outcome = await drainLoanPaymentCreate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_LOAN_PAYMENT_DELETE) {
        const outcome = await drainLoanPaymentDelete({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE) {
        const outcome = await drainLoanPaymentUpdate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_SPACE_SETTINGS_UPDATE) {
        const outcome = await drainSpaceSettingsUpdate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      if (record.commandType === OUTBOX_COMMAND_USER_SETTINGS_UPDATE) {
        const outcome = await drainUserSettingsUpdate({ api, record });
        if (outcome === "ok") {
          processed += 1;
        } else if (outcome === "failed") {
          failed += 1;
        } else {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      await updateOutboxStatus({
        id: record.id,
        status: "failed",
        lastError: `Unsupported outbox command: ${record.commandType}`,
      });
      failed += 1;
    }
  } finally {
    drainingSpaces.delete(spaceId);
  }

  return { processed, failed, stoppedEarly };
};

/**
 * Drain pending outbox commands for all spaces that have work, sequentially per space.
 * Mutexed so concurrent online/sync triggers do not interleave.
 */
export const drainAllOutboxes = async (params: {
  api: AxiosInstance;
  spaceIds?: string[];
}): Promise<DrainOutboxResult> => {
  if (globalDrainPromise) {
    return globalDrainPromise;
  }

  globalDrainPromise = (async () => {
    const spaceIds =
      params.spaceIds ?? (await listDistinctOutboxSpaceIds());
    let processed = 0;
    let failed = 0;
    let stoppedEarly = false;

    for (const spaceId of spaceIds) {
      const result = await drainOutboxForSpace({
        api: params.api,
        spaceId,
      });
      processed += result.processed;
      failed += result.failed;
      if (result.stoppedEarly) {
        stoppedEarly = true;
      }
    }

    return { processed, failed, stoppedEarly };
  })();

  try {
    return await globalDrainPromise;
  } finally {
    globalDrainPromise = null;
  }
};
