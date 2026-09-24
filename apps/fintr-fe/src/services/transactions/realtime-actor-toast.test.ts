import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  formatToastTransactionNote,
  realtimeSpaceCurrencyChangedMessage,
  realtimeTransactionToastMessage,
  shouldShowRealtimeActorToast,
} from "./realtime-actor-toast";

describe("shouldShowRealtimeActorToast", () => {
  it("shows when actor auth id is present", () => {
    expect(
      shouldShowRealtimeActorToast({
        actorAuthId: "auth0|peer",
      }),
    ).toBe(true);
  });

  it("shows for the same auth id on another tab when not a local echo", () => {
    expect(
      shouldShowRealtimeActorToast({
        actorAuthId: "auth0|me",
      }),
    ).toBe(true);
  });

  it("skips local echoes", () => {
    expect(
      shouldShowRealtimeActorToast({
        actorAuthId: "auth0|me",
        isLocalEcho: true,
      }),
    ).toBe(false);
  });

  it("skips when actor auth id is missing", () => {
    expect(
      shouldShowRealtimeActorToast({
        actorAuthId: "",
      }),
    ).toBe(false);
  });
});

describe("realtimeTransactionToastMessage", () => {
  it("builds added / updated / deleted copy", () => {
    expect(
      realtimeTransactionToastMessage({
        action: "added",
        fullName: "Alex Actor",
      }),
    ).toBe("Alex Actor has added a transaction");

    expect(
      realtimeTransactionToastMessage({
        action: "updated",
        fullName: "Alex Actor",
      }),
    ).toBe("Alex Actor has updated a transaction");

    expect(
      realtimeTransactionToastMessage({
        action: "deleted",
        fullName: "Alex Actor",
      }),
    ).toBe("Alex Actor has deleted a transaction");
  });

  it("builds loan payment copy", () => {
    expect(
      realtimeTransactionToastMessage({
        action: "added",
        fullName: "Alex Actor",
        transactionType: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      }),
    ).toBe("Alex Actor has recorded a loan payment");

    expect(
      realtimeTransactionToastMessage({
        action: "deleted",
        fullName: "Alex Actor",
        transactionType: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      }),
    ).toBe("Alex Actor has deleted a loan payment");
  });

  it("falls back when name is blank", () => {
    expect(
      realtimeTransactionToastMessage({
        action: "updated",
        fullName: "  ",
      }),
    ).toBe("Someone has updated a transaction");
  });
});

describe("realtimeSpaceCurrencyChangedMessage", () => {
  it("builds currency change copy", () => {
    expect(realtimeSpaceCurrencyChangedMessage("Alex Actor")).toBe(
      "Alex Actor changed the currency",
    );
  });

  it("falls back when name is blank", () => {
    expect(realtimeSpaceCurrencyChangedMessage("  ")).toBe(
      "Someone changed the currency",
    );
  });
});

describe("formatToastTransactionNote", () => {
  it("returns null for blank descriptions", () => {
    expect(formatToastTransactionNote(null)).toBeNull();
    expect(formatToastTransactionNote("   ")).toBeNull();
  });

  it("returns short notes unchanged", () => {
    expect(formatToastTransactionNote("T3")).toBe("T3");
  });

  it("truncates long notes", () => {
    const note = "a".repeat(100);
    expect(formatToastTransactionNote(note, 20)).toBe(`${"a".repeat(19)}…`);
  });
});
