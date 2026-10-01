import { describe, expect, it } from "vitest";

import {
  positiveTransactionFormAmount,
  positiveTransactionFormAmountString,
  signedTransactionAmount,
} from "./transactionFormAmount";

describe("transactionFormAmount", () => {
  it("returns absolute magnitude for signed expense amounts", () => {
    expect(positiveTransactionFormAmount(-200)).toBe(200);
    expect(positiveTransactionFormAmountString(-200)).toBe("200");
  });

  it("keeps positive amounts unchanged", () => {
    expect(positiveTransactionFormAmount(200)).toBe(200);
    expect(positiveTransactionFormAmountString("200")).toBe("200");
  });

  it("keeps a negative entry when the stored amount is negative", () => {
    expect(signedTransactionAmount(-40)).toBe(-40);
    expect(signedTransactionAmount("-25")).toBe(-25);
  });

  it("keeps a positive space magnitude when only the value sign is negative", () => {
    expect(signedTransactionAmount(-1000, 16.48)).toBe(1000);
  });
});
