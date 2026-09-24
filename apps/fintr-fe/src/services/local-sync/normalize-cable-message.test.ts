import { describe, expect, it } from "vitest";

import { cableMessageToSpaceChange } from "./normalize-cable-message";

describe("cableMessageToSpaceChange", () => {
  it("maps sync_change messages directly", () => {
    const change = cableMessageToSpaceChange({
      type: "sync_change",
      seq: 42,
      op: "transaction.created",
      spaceId: "SPACE_1",
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
          type: "expense",
          inSeries: false,
          hasImage: false,
        },
      },
    });

    expect(change).toEqual(
      expect.objectContaining({
        seq: 42,
        op: "transaction.created",
        occurredAt: "2026-08-10T08:00:00.000Z",
      }),
    );
  });

  it("maps legacy transaction_created to transaction.created with seq 0", () => {
    const change = cableMessageToSpaceChange({
      type: "transaction_created",
      spaceId: "SPACE_1",
      transaction: {
        id: "tx-legacy",
        date: "2026-08-10",
        description: "Tea",
        amount: 80,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: "expense",
        inSeries: false,
        hasImage: false,
      },
    });

    expect(change).toEqual(
      expect.objectContaining({
        seq: 0,
        op: "transaction.created",
      }),
    );
  });

  it("maps legacy space_currency_changed to space.settings.updated", () => {
    const change = cableMessageToSpaceChange({
      type: "space_currency_changed",
      spaceId: "SPACE_1",
      currency: "USD",
      defaultTransactionCurrency: "EUR",
    });

    expect(change).toEqual(
      expect.objectContaining({
        seq: 0,
        op: "space.settings.updated",
        payload: {
          spaceId: "SPACE_1",
          currency: "USD",
          defaultTransactionCurrency: "EUR",
        },
      }),
    );
  });

  it("maps sync_change settings ops directly", () => {
    const change = cableMessageToSpaceChange({
      type: "sync_change",
      seq: 7,
      op: "space.settings.updated",
      spaceId: "SPACE_1",
      payload: {
        spaceId: "SPACE_1",
        currency: "PHP",
      },
    });

    expect(change).toEqual(
      expect.objectContaining({
        seq: 7,
        op: "space.settings.updated",
      }),
    );
  });
});
