import { z } from "zod";

import {
  EXCHANGE_RATE_SOURCES,
  REPEAT_INTERVALS,
  SCHEDULE_TYPES,
  TRANSACTION_TYPES,
} from "../primitives";

const nonEmptyString = z.string().trim().min(1);

const repeatIntervalSchema = z.enum(REPEAT_INTERVALS);

const scheduleTypeSchema = z.enum(SCHEDULE_TYPES);

const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

/**
 * Client create-transaction payload (camelCase).
 * Mirrors `Transactions::Operations::CreateTransaction::Contract` where the
 * FE shape maps 1:1; space/user context is validated separately on the server.
 */
export const createTransactionClientSchema = z
  .object({
    amount: z.number().finite(),
    description: z.string().optional(),
    transactionType: transactionTypeSchema,
    categoryName: z.string().optional(),
    categoryId: z.string().optional(),
    subcategoryId: z.string().optional(),
    accountName: z.string().optional(),
    date: z.string(),
    scheduleType: scheduleTypeSchema,
    repeatInterval: z.string().optional(),
    installmentPeriod: z.number().optional(),
    file: z.unknown().optional(),
    draftId: z.string().optional(),
    fileId: z.string().optional(),
    original_currency: z.string().optional(),
    exchange_rate: z.number().optional(),
    exchange_rate_source: z.enum(EXCHANGE_RATE_SOURCES).optional(),
    clientMutationId: z.string().optional(),
    entityName: z.string().optional(),
    receiptMerchantDetected: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
    tags: z.array(z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be greater than 0",
        path: ["amount"],
      });
    }

    if (!data.date?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "is required",
        path: ["date"],
      });
    }

    if (!data.categoryName?.trim() && !data.categoryId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "category_id or category_name is required",
        path: ["categoryId"],
      });
    }

    if (data.subcategoryId?.trim() && !data.categoryId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "is required when subcategory_id is provided",
        path: ["categoryId"],
      });
    }

    if (!data.accountName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be filled",
        path: ["accountName"],
      });
    }

    if (
      data.scheduleType === "repeat" &&
      !data.repeatInterval?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be provided for recurring transactions",
        path: ["repeatInterval"],
      });
    }

    if (
      data.scheduleType === "repeat" &&
      data.repeatInterval?.trim() &&
      !repeatIntervalSchema.safeParse(data.repeatInterval).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be a valid interval",
        path: ["repeatInterval"],
      });
    }

    if (data.scheduleType === "installment") {
      const period = data.installmentPeriod;
      if (
        period == null ||
        !Number.isFinite(period) ||
        !Number.isInteger(period) ||
        period <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "must be a positive integer",
          path: ["installmentPeriod"],
        });
      }
    }

    if (
      data.exchange_rate != null &&
      (!Number.isFinite(data.exchange_rate) || data.exchange_rate <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be greater than 0",
        path: ["exchange_rate"],
      });
    }

    if (
      data.exchange_rate != null &&
      Number.isFinite(data.exchange_rate) &&
      data.exchange_rate > 0 &&
      !data.original_currency?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be provided when exchange rate is specified",
        path: ["original_currency"],
      });
    }
  });

export type CreateTransactionClientInput = z.input<
  typeof createTransactionClientSchema
>;
export type CreateTransactionClient = z.infer<
  typeof createTransactionClientSchema
>;

/**
 * Server params (snake_case) for `CreateTransaction`.
 * Used by parity fixtures and future sync command validation.
 */
export const createTransactionParamsSchema = z
  .object({
    user_id: nonEmptyString,
    space_id: nonEmptyString,
    transfer_id: z.string().optional(),
    skip_calculation: z.boolean().nullable().optional(),
    skip_embedding: z.boolean().optional(),
    amount: z.number().finite(),
    date: z.string(),
    transaction_type: transactionTypeSchema,
    category_name: z.string().nullable().optional(),
    category_id: z.string().nullable().optional(),
    subcategory_id: z.string().nullable().optional(),
    account_id: z.string().nullable().optional(),
    account_name: z.string().nullable().optional(),
    description: z.string().optional(),
    entity_name: z.string().nullable().optional(),
    receipt_merchant_detected: z.string().nullable().optional(),
    schedule_type: scheduleTypeSchema,
    repeat_interval: z.string().nullable().optional(),
    repeat_count: z.number().int().optional(),
    installment_period: z.number().int().optional(),
    installment_count: z.number().int().optional(),
    draft: z.boolean().optional(),
    draft_id: z.string().nullable().optional(),
    original_currency: z.string().optional(),
    exchange_rate: z.number().optional(),
    exchange_rate_source: z.enum(EXCHANGE_RATE_SOURCES).optional(),
    amount_in_currency: z.string().optional(),
    initial_balance: z.boolean().optional(),
    client_mutation_id: z.string().optional(),
    tag_ids: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.schedule_type === "repeat" &&
      !data.repeat_interval?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be provided for recurring transactions",
        path: ["repeat_interval"],
      });
    }

    if (
      data.schedule_type === "repeat" &&
      data.repeat_interval?.trim() &&
      !repeatIntervalSchema.safeParse(data.repeat_interval).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be a valid interval",
        path: ["repeat_interval"],
      });
    }

    if (data.schedule_type === "installment") {
      const period = data.installment_period;
      if (
        period == null ||
        !Number.isInteger(period) ||
        period <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "must be a positive integer",
          path: ["installment_period"],
        });
      }
    }

    if (!data.category_name?.trim() && !data.category_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "category_id or category_name is required",
        path: ["category_id"],
      });
    }

    if (data.subcategory_id?.trim() && !data.category_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "is required when subcategory_id is provided",
        path: ["category_id"],
      });
    }

    if (!data.account_id?.trim() && !data.account_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be filled",
        path: ["account_name"],
      });
    }

    if (
      data.exchange_rate != null &&
      (!Number.isFinite(data.exchange_rate) || data.exchange_rate <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be greater than 0",
        path: ["exchange_rate"],
      });
    }

    if (
      data.exchange_rate != null &&
      Number.isFinite(data.exchange_rate) &&
      data.exchange_rate > 0 &&
      !data.original_currency?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be provided when exchange rate is specified",
        path: ["original_currency"],
      });
    }
  });

export type CreateTransactionParams = z.infer<
  typeof createTransactionParamsSchema
>;

export const parseCreateTransactionClient = (
  input: CreateTransactionClientInput,
) => createTransactionClientSchema.safeParse(input);

export const validateCreateTransactionClient = (
  input: CreateTransactionClientInput,
): CreateTransactionClient =>
  createTransactionClientSchema.parse(input);
