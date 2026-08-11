import { z } from "zod";

import {
  EXCHANGE_RATE_SOURCES,
  REPEAT_INTERVALS,
  TRANSFER_SCHEDULE_TYPES,
} from "../primitives";

const repeatIntervalSchema = z.enum(REPEAT_INTERVALS);

const scheduleTypeSchema = z.enum(TRANSFER_SCHEDULE_TYPES);

/**
 * Client create-transfer payload (camelCase).
 * Mirrors `Transactions::Operations::Transfers::CreateTransfer::Contract`.
 */
export const createTransferClientSchema = z
  .object({
    amount: z.number().finite(),
    transactionCost: z.number().optional(),
    fromAccountName: z.string().optional(),
    toAccountName: z.string().optional(),
    description: z.string().optional(),
    date: z.string(),
    scheduleType: scheduleTypeSchema,
    repeatInterval: z.string().optional(),
    file: z.unknown().optional(),
    exchange_rate: z.number().optional(),
    exchange_rate_source: z.enum(EXCHANGE_RATE_SOURCES).optional(),
    clientMutationId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be greater than 0",
        path: ["amount"],
      });
    }

    const transactionCost = data.transactionCost ?? 0;
    if (!Number.isFinite(transactionCost) || transactionCost < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be positive",
        path: ["transactionCost"],
      });
    }

    if (!data.date?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "is required",
        path: ["date"],
      });
    }

    if (!data.fromAccountName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "is required",
        path: ["fromAccountName"],
      });
    }

    if (!data.toAccountName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "is required",
        path: ["toAccountName"],
      });
    }

    if (
      data.fromAccountName?.trim() &&
      data.toAccountName?.trim() &&
      data.fromAccountName === data.toAccountName
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be different from from account",
        path: ["toAccountName"],
      });
    }

    if (
      data.scheduleType === "repeat" &&
      !data.repeatInterval?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be provided for recurring transfers",
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
  });

export type CreateTransferClientInput = z.input<typeof createTransferClientSchema>;
export type CreateTransferClient = z.infer<typeof createTransferClientSchema>;

export const createTransferParamsSchema = z
  .object({
    user_id: z.string().trim().min(1),
    space_id: z.string().trim().min(1),
    amount: z.number().finite(),
    transaction_cost: z.number().finite(),
    date: z.string(),
    from_account_name: z.string().trim().min(1),
    to_account_name: z.string().trim().min(1),
    description: z.string().optional(),
    schedule_type: scheduleTypeSchema,
    repeat_interval: z.string().nullable().optional(),
    repeat_count: z.number().int().optional(),
    exchange_rate: z.number().optional(),
    exchange_rate_source: z.enum(EXCHANGE_RATE_SOURCES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be greater than 0",
        path: ["amount"],
      });
    }

    if (data.transaction_cost < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be positive",
        path: ["transaction_cost"],
      });
    }

    if (
      data.schedule_type === "repeat" &&
      !data.repeat_interval?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be provided for recurring transfers",
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
  });

export type CreateTransferParams = z.infer<typeof createTransferParamsSchema>;

export const parseCreateTransferClient = (
  input: CreateTransferClientInput,
) => createTransferClientSchema.safeParse(input);

export const validateCreateTransferClient = (
  input: CreateTransferClientInput,
): CreateTransferClient => createTransferClientSchema.parse(input);
