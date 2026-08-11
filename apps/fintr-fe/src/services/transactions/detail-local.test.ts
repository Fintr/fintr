import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { upsertLocalIndexTransaction } from "./local-cache";
import {
  mapIndexTransactionToEditData,
  mapIndexTransactionToEditDataSync,
  resolveTransactionDetail,
} from "./detail-local";

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
});
