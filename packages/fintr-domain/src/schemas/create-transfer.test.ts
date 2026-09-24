import { describe, expect, it } from "vitest";

import {
  assertCreateTransferForOptimistic,
  createTransferClientSchema,
} from "../index";

const validTransfer = {
  amount: 100,
  transactionCost: 5,
  fromAccountName: "Cash",
  toAccountName: "Bank",
  date: "2026-08-08",
  scheduleType: "one_time" as const,
};

describe("createTransferClientSchema", () => {
  it("accepts a valid transfer", () => {
    expect(createTransferClientSchema.safeParse(validTransfer).success).toBe(
      true,
    );
  });

  it("rejects identical from/to accounts", () => {
    const result = createTransferClientSchema.safeParse({
      ...validTransfer,
      toAccountName: "Cash",
    });
    expect(result.success).toBe(false);
  });

  it("requires repeat interval for recurring transfers", () => {
    const result = createTransferClientSchema.safeParse({
      ...validTransfer,
      scheduleType: "repeat",
    });
    expect(result.success).toBe(false);
  });
});

describe("assertCreateTransferForOptimistic", () => {
  it("throws structured validation failures", () => {
    try {
      assertCreateTransferForOptimistic({
        ...validTransfer,
        amount: 0,
      });
      expect.unreachable("expected validation failure");
    } catch (error) {
      expect(error).toMatchObject({
        success: false,
        details: expect.objectContaining({
          amount: expect.any(Array),
        }),
      });
    }
  });
});
