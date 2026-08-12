import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { upsertLocalIndexTransaction } from "./local-cache";
import {
  cacheTransactionDetail,
  enrichTransactionEditDetail,
  mapIndexTransactionToEditData,
  mapIndexTransactionToEditDataSync,
  resolveTransactionDetail,
} from "./detail-local";
import { putLocalAttachment } from "@/services/attachments/local-store";

describe("transaction detail local", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("maps an IndexedDB list row into edit-form shape synchronously for modal seed", () => {
    const mapped = mapIndexTransactionToEditDataSync({
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    expect(mapped).toMatchObject({
      id: "tx-1",
      amount: 120,
      accountName: "Cash",
      transactionType: "expense",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    });
  });

  it("includes tags from list rows when seeding the edit modal", () => {
    const mapped = mapIndexTransactionToEditDataSync({
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
      tags: [{ id: "tag-1", name: "Japan 2026", color: "#ff0000" }],
    });

    expect(mapped).toMatchObject({
      tagIds: ["tag-1"],
      tags: [{ id: "tag-1", name: "Japan 2026", color: "#ff0000" }],
    });
  });

  it("maps an IndexedDB list row into edit-form shape", async () => {
    const mapped = await mapIndexTransactionToEditData("space-a", {
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    expect(mapped).toMatchObject({
      id: "tx-1",
      amount: 120,
      accountName: "Cash",
      transactionType: "expense",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    });
  });

  it("resolves preferLocal from the all-time cache without calling the API", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-local",
      date: "2026-08-08",
      description: "Offline row",
      amount: 40,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-local",
      type: CombinedTransactionTypeEnum.EXPENSE,
      preferLocal: true,
    });

    expect(detail.id).toBe("tx-local");
    expect(detail.description).toBe("Offline row");
  });

  it("enriches edit detail with a local attachment file when offline", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    await upsertLocalIndexTransaction("space-a", {
      id: "local:cid-1",
      date: "2026-08-08",
      description: "Receipt expense",
      amount: 40,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: true,
    });

    await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "local:cid-1",
      file,
    });

    const enriched = await enrichTransactionEditDetail({
      api: null,
      spaceId: "space-a",
      transaction: {
        id: "local:cid-1",
        date: "2026-08-08",
        description: "Receipt expense",
        amount: 40,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: true,
      },
      preferLocal: true,
    });

    expect(enriched.data.file).toBeInstanceOf(File);
    expect((enriched.data.file as File).name).toBe("receipt.jpg");
  });

  it("preferLocal uses list-row amount over a stale detail cache after an online edit", async () => {
    await cacheTransactionDetail("space-a", "tx-income", {
      id: "tx-income",
      date: "2026-08-11",
      description: "SAMPLE BDO LONG ASS NAME",
      amount: 1,
      categoryName: "Freelance",
      accountName: "Cash",
      transactionType: "income",
      type: CombinedTransactionTypeEnum.INCOME,
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      // Stale FX metadata left from before the amount edit.
      hasCurrencyConversion: true,
      original_display_amount: 24540.19,
      original_display_currency: "PHP",
      currency_conversion: {
        original_amount: 24540.19,
        original_currency: "PHP",
        converted_amount: 24540.19,
        converted_currency: "PHP",
        exchange_rate: 1,
        source: "manual",
      },
    });

    const listRow = {
      id: "tx-income",
      date: "2026-08-11",
      description: "SAMPLE BDO LONG ASS NAME",
      amount: 1,
      amountCurrency: "PHP",
      bookedAmount: 1,
      bookedAmountCurrency: "PHP",
      categoryName: "Freelance",
      fromAccountName: "",
      toAccountName: "Cash",
      type: CombinedTransactionTypeEnum.INCOME,
      inSeries: false,
      hasImage: false,
      tags: [{ id: "tag-japan", name: "Japan 2026", color: "#f472b6" }],
    };

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-income",
      type: CombinedTransactionTypeEnum.INCOME,
      listRow,
      preferLocal: true,
    });

    expect(detail.amount).toBe(1);
    expect(
      (detail as { original_display_amount?: number }).original_display_amount,
    ).toBeUndefined();
    expect(
      (detail as { currency_conversion?: unknown }).currency_conversion,
    ).toBeUndefined();
    expect(detail.hasCurrencyConversion).toBeFalsy();
  });
});
