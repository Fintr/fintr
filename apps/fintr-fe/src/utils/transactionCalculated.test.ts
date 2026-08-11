import { describe, expect, it } from "vitest";

import { isTransactionCalculatedForDate } from "./transactionCalculated";

describe("isTransactionCalculatedForDate", () => {
  it("returns true when the transaction date is today", () => {
    expect(
      isTransactionCalculatedForDate("2026-08-08", "2026-08-08"),
    ).toBe(true);
  });

  it("returns true when the transaction date is in the past", () => {
    expect(
      isTransactionCalculatedForDate("2026-08-01", "2026-08-08"),
    ).toBe(true);
  });

  it("returns false when the transaction date is in the future", () => {
    expect(
      isTransactionCalculatedForDate("2026-08-09", "2026-08-08"),
    ).toBe(false);
  });

  it("uses the leading date segment for ISO datetime strings", () => {
    expect(
      isTransactionCalculatedForDate(
        "2026-08-08T16:00:00.000Z",
        "2026-08-08",
      ),
    ).toBe(true);
  });
});
