export {
  DomainValidationError,
  assertValid,
  zodErrorToFieldMap,
  type DomainValidationFailure,
  type FieldErrorMap,
} from "./errors";

export {
  DELETE_SCOPES,
  EXCHANGE_RATE_SOURCES,
  REPEAT_INTERVALS,
  SCHEDULE_TYPES,
  TRANSACTION_TYPES,
  TRANSFER_SCHEDULE_TYPES,
  UPDATE_SCOPES,
  type DeleteScope,
  type ExchangeRateSource,
  type RepeatInterval,
  type ScheduleType,
  type TransactionType,
  type TransferScheduleType,
  type UpdateScope,
} from "./primitives";

export {
  createTransactionClientSchema,
  createTransactionParamsSchema,
  parseCreateTransactionClient,
  validateCreateTransactionClient,
  type CreateTransactionClient,
  type CreateTransactionClientInput,
  type CreateTransactionParams,
} from "./schemas/create-transaction";

export {
  createTransferClientSchema,
  createTransferParamsSchema,
  parseCreateTransferClient,
  validateCreateTransferClient,
  type CreateTransferClient,
  type CreateTransferClientInput,
  type CreateTransferParams,
} from "./schemas/create-transfer";

export {
  deleteTransactionClientSchema,
  deleteTransactionParamsSchema,
  parseDeleteTransactionClient,
  validateDeleteTransactionClient,
  type DeleteTransactionClient,
  type DeleteTransactionParams,
} from "./schemas/delete-transaction";

import type { ZodError } from "zod";

import { DomainValidationError, zodErrorToFieldMap } from "./errors";
import { parseCreateTransactionClient } from "./schemas/create-transaction";
import { parseCreateTransferClient } from "./schemas/create-transfer";
import { parseDeleteTransactionClient } from "./schemas/delete-transaction";

/**
 * Throws `{ success: false, message, details }` — the shape local-first
 * services and API error handlers already expect.
 */
export const assertCreateTransactionForOptimistic = (
  input: Parameters<typeof parseCreateTransactionClient>[0],
): void => {
  const result = parseCreateTransactionClient(input);
  if (!result.success) {
    throw validationFailureFromZod(result.error);
  }
};

export const assertCreateTransferForOptimistic = (
  input: Parameters<typeof parseCreateTransferClient>[0],
): void => {
  const result = parseCreateTransferClient(input);
  if (!result.success) {
    throw validationFailureFromZod(result.error);
  }
};

export const assertDeleteTransactionForOptimistic = (
  input: Parameters<typeof parseDeleteTransactionClient>[0],
): void => {
  const result = parseDeleteTransactionClient(input);
  if (!result.success) {
    throw validationFailureFromZod(result.error);
  }
};

const validationFailureFromZod = (error: ZodError) => {
  const details = zodErrorToFieldMap(error);
  const failure = new DomainValidationError(details);
  return failure.toJSON();
};
