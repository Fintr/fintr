import { z } from "zod";

import { DELETE_SCOPES } from "../primitives";

/**
 * Mirrors `Transactions::Operations::DeleteTransaction::Contract`.
 */
export const deleteTransactionClientSchema = z.object({
  id: z.string().trim().min(1),
  deleteScope: z.enum(DELETE_SCOPES).optional(),
});

export type DeleteTransactionClient = z.infer<
  typeof deleteTransactionClientSchema
>;

export const deleteTransactionParamsSchema = z.object({
  id: z.string().trim().min(1),
  delete_scope: z.enum(DELETE_SCOPES).optional(),
});

export type DeleteTransactionParams = z.infer<
  typeof deleteTransactionParamsSchema
>;

export const parseDeleteTransactionClient = (
  input: z.input<typeof deleteTransactionClientSchema>,
) => deleteTransactionClientSchema.safeParse(input);

export const validateDeleteTransactionClient = (
  input: z.input<typeof deleteTransactionClientSchema>,
): DeleteTransactionClient => deleteTransactionClientSchema.parse(input);
