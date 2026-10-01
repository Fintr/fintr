import { describe, expect, it } from "vitest";

import {
  assertCreateTransactionForOptimistic,
  createTransactionClientSchema,
  createTransactionParamsSchema,
} from "../index";

const validClientPayload = {
  amount: 50,
  transactionType: "expense" as const,
  categoryName: "Food",
  accountName: "Cash",
  date: "2026-08-08",
  scheduleType: "one_time" as const,
};

describe("createTransactionClientSchema", () => {
  it("accepts a minimal valid expense", () => {
    const result = createTransactionClientSchema.safeParse(validClientPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a negative expense and a negative income", () => {
    const expense = createTransactionClientSchema.safeParse({
      ...validClientPayload,
      amount: -40,
    });
    const income = createTransactionClientSchema.safeParse({
      ...validClientPayload,
      amount: -25,
      transactionType: "income",
      categoryName: "Salary",
    });

    expect(expense.success).toBe(true);
    expect(income.success).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = createTransactionClientSchema.safeParse({
      ...validClientPayload,
      amount: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "amount")).toBe(
        true,
      );
    }
  });

  it("requires repeat interval for recurring transactions", () => {
    const result = createTransactionClientSchema.safeParse({
      ...validClientPayload,
      scheduleType: "repeat",
    });
    expect(result.success).toBe(false);
  });

  it("requires installment period for installment transactions", () => {
    const result = createTransactionClientSchema.safeParse({
      ...validClientPayload,
      scheduleType: "installment",
    });
    expect(result.success).toBe(false);
  });

  it("requires original currency when exchange rate is set", () => {
    const result = createTransactionClientSchema.safeParse({
      ...validClientPayload,
      exchange_rate: 56.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("assertCreateTransactionForOptimistic", () => {
  it("throws the local-first validation failure shape", () => {
    try {
      assertCreateTransactionForOptimistic({
        ...validClientPayload,
        amount: 0,
      });
      expect.unreachable("expected validation failure");
    } catch (error) {
      expect(error).toMatchObject({
        success: false,
        message: "Validation failed",
        details: expect.objectContaining({
          amount: expect.any(Array),
        }),
      });
    }
  });
});

describe("createTransactionParamsSchema parity", () => {
  it("accepts snake_case payloads that mirror the backend contract", () => {
    const result = createTransactionParamsSchema.safeParse({
      user_id: "user-1",
      space_id: "space-1",
      amount: 100,
      date: "2026-08-08",
      transaction_type: "expense",
      category_name: "Food",
      account_name: "Cash",
      schedule_type: "repeat",
      repeat_interval: "every_month",
    });
    expect(result.success).toBe(true);
  });
});
