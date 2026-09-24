import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import { applySpaceChange } from "./apply-change";
import * as applyLoanChange from "./apply-loan-change";
import * as applySettingsChange from "./apply-settings-change";
import * as applyTransactionChange from "./apply-transaction-change";

describe("applySpaceChange", () => {
  const spaceId = "SPACE_APPLY";
  const queryClient = new QueryClient();

  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  it("dedupes by seq via appliedSeqs ring buffer", async () => {
    const createdSpy = vi
      .spyOn(applyTransactionChange, "applyTransactionCreated")
      .mockResolvedValue();

    const change = {
      seq: 99,
      op: "transaction.created" as const,
      occurredAt: "2026-08-10T08:00:00.000Z",
      payload: {
        transaction: {
          id: "tx-1",
          date: "2026-08-10",
          description: "Coffee",
          amount: 120,
          categoryName: "Food",
          fromAccountName: "Cash",
          toAccountName: "",
          type: "expense" as const,
          inSeries: false,
          hasImage: false,
        },
      },
    };

    await applySpaceChange({
      spaceId,
      change,
      queryClient,
      source: "pull",
    });

    await applySpaceChange({
      spaceId,
      change,
      queryClient,
      source: "cable",
    });

    expect(createdSpy).toHaveBeenCalledTimes(1);
  });

  it("routes space.settings.updated to applySpaceSettingsChange", async () => {
    const settingsSpy = vi
      .spyOn(applySettingsChange, "applySpaceSettingsChange")
      .mockResolvedValue();

    await applySpaceChange({
      spaceId,
      change: {
        seq: 12,
        op: "space.settings.updated",
        occurredAt: "2026-08-10T08:00:00.000Z",
        payload: {
          currency: "USD",
          spaceId,
        },
      },
      queryClient,
      source: "pull",
    });

    expect(settingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId,
        payload: expect.objectContaining({ currency: "USD" }),
      }),
    );
  });

  it("routes loan.created to applyLoanCreated", async () => {
    const loanSpy = vi
      .spyOn(applyLoanChange, "applyLoanCreated")
      .mockResolvedValue();

    await applySpaceChange({
      spaceId,
      change: {
        seq: 13,
        op: "loan.created",
        occurredAt: "2026-08-10T08:00:00.000Z",
        payload: {
          loan: {
            id: "loan-1",
            date: "2026-08-10",
            loanType: "borrowed",
          },
        },
      },
      queryClient,
      source: "pull",
    });

    expect(loanSpy).toHaveBeenCalled();
  });
});
