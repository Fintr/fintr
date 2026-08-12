import { describe, expect, it } from "vitest";

import {
  positiveTransactionFormAmount,
  positiveTransactionFormAmountString,
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
});
