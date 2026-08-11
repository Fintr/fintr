import { describe, expect, it } from "vitest";

import {
  buildTransferFeeDescription,
  localTransferFeeId,
} from "./fee-description";

describe("buildTransferFeeDescription", () => {
  it("includes the note when present", () => {
    expect(
      buildTransferFeeDescription({
        description: "Move to savings",
        transferAmount: 1000,
      }),
    ).toBe("Transfer fee for: Move to savings, amount: 1000");
  });

  it("omits the for-clause when note is blank", () => {
    expect(
      buildTransferFeeDescription({
        description: "   ",
        transferAmount: 250.5,
      }),
    ).toBe("Transfer fee, amount: 250.5");
  });

  it("builds a stable local fee id", () => {
    expect(localTransferFeeId("abc")).toBe("local:abc:fee");
  });
});
