import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { upsertLocalIndexTransaction } from "./local-cache";
import {
  applyListRowMoneyToDetail,
  cacheTransactionDetail,
  enrichTransactionEditDetail,
  mapIndexTransactionToEditData,
  mapIndexTransactionToEditDataSync,
  resolveTransactionDetail,
  seedTransactionEditFromListRow,
} from "./detail-local";
import {
  listAttachmentsForOwner,
  putLocalAttachment,
} from "@/services/attachments/local-store";

vi.mock("@/lib/auth-storage", () => ({
  AuthStorage: {
    getAccessToken: () => null,
  },
}));

vi.mock("@/lib/public-backend-url", () => ({
  getPublicBackendUrl: () => undefined,
}));

describe("transaction detail local", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
    vi.unstubAllGlobals();
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

  it("downloads a remote receipt into IndexedDB during local-first edit enrichment", async () => {
    const blob = new Blob(["remote-receipt"], { type: "image/jpeg" });
    const api = {
      get: vi.fn(async () => ({ data: blob })),
    };

    await upsertLocalIndexTransaction("space-a", {
      id: "tx-remote",
      date: "2026-08-08",
      description: "Remote receipt",
      amount: 40,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: true,
    });

    await cacheTransactionDetail("space-a", "tx-remote", {
      id: "tx-remote",
      date: "2026-08-08",
      description: "Remote receipt",
      amount: 40,
      categoryName: "Food",
      accountName: "Cash",
      transactionType: "expense",
      type: CombinedTransactionTypeEnum.EXPENSE,
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      files: [
        {
          id: "file-1",
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        },
      ],
    });

    const enriched = await enrichTransactionEditDetail({
      api: api as never,
      spaceId: "space-a",
      transaction: {
        id: "tx-remote",
        date: "2026-08-08",
        description: "Remote receipt",
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

    const stored = await listAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "tx-remote",
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.source).toBe("remote_download");
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

  it("seeds GBP original amount and manual rate when opening edit from a converted list row", () => {
    const listRow = {
      id: "tx-gbp",
      date: "2026-08-12",
      description: "EXTEST1",
      amount: 20_000,
      amountCurrency: "PHP",
      bookedAmount: -200,
      bookedAmountCurrency: "GBP",
      categoryName: "Medicine",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    const seed = seedTransactionEditFromListRow(listRow);

    expect(seed.data.amount).toBe(200);
    expect(seed.data.amountCurrency).toBe("GBP");
    expect(
      (seed.data as { original_display_currency?: string }).original_display_currency,
    ).toBe("GBP");
    expect(
      (seed.data as { original_display_amount?: number }).original_display_amount,
    ).toBe(200);
    expect(seed.data.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
      source: "manual",
    });
  });

  it("seeds GBP 200 from a conversion even when booked legs are both PHP", () => {
    const seed = seedTransactionEditFromListRow({
      id: "tx-gbp",
      date: "2026-08-12",
      description: "EXTEST2",
      amount: 20_000,
      amountCurrency: "PHP",
      bookedAmount: 20_000,
      bookedAmountCurrency: "PHP",
      categoryName: "Medicine",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
      currencyConversion: {
        originalAmount: 20_000,
        originalCurrency: "GBP",
        convertedAmount: 20_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "recent",
      },
    });

    expect(seed.data.amount).toBeCloseTo(200);
    expect(seed.data.amountCurrency).toBe("GBP");
    expect(
      (seed.data as { original_display_currency?: string }).original_display_currency,
    ).toBe("GBP");
    expect(seed.data.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
      source: "recent",
    });
  });

  it("preferLocal without cached detail still exposes GBP amount for edit", async () => {
    const listRow = {
      id: "tx-gbp",
      date: "2026-08-12",
      description: "EXTEST1",
      amount: 20_000,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      categoryName: "Medicine",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    await upsertLocalIndexTransaction("space-a", listRow);

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-gbp",
      type: CombinedTransactionTypeEnum.EXPENSE,
      listRow,
      preferLocal: true,
    });

    expect(detail.amount).toBe(200);
    expect(detail.amountCurrency).toBe("GBP");
    expect(detail.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
    });
  });

  it("does not replace GBP conversion with space PHP when the list row has no booked leg", () => {
    const detail = applyListRowMoneyToDetail(
      {
        id: "tx-gbp",
        date: "2026-08-12",
        description: "EXTEST2",
        amount: 20_000,
        amountCurrency: "PHP",
        categoryName: "Medicine",
        accountName: "SAMPLE BDO LONG ASS NAME",
        transactionType: "expense",
        type: CombinedTransactionTypeEnum.EXPENSE,
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        hasCurrencyConversion: true,
        original_display_amount: 200,
        original_display_currency: "GBP",
        currency_conversion: {
          original_amount: 200,
          original_currency: "GBP",
          converted_amount: 20_000,
          converted_currency: "PHP",
          exchange_rate: 100,
          source: "manual",
        },
      },
      {
        id: "tx-gbp",
        date: "2026-08-12",
        description: "EXTEST2",
        amount: 20_000,
        amountCurrency: "PHP",
        categoryName: "Medicine",
        fromAccountName: "SAMPLE BDO LONG ASS NAME",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    );

    expect(detail.amount).toBe(200);
    expect(detail.amountCurrency).toBe("GBP");
    expect(
      (detail as { original_display_currency?: string }).original_display_currency,
    ).toBe("GBP");
    expect(detail.hasCurrencyConversion).toBe(true);
    expect(
      (detail as { currencyConversion?: { originalCurrency?: string } })
        .currencyConversion?.originalCurrency,
    ).toBe("GBP");
  });

  it("keeps camelCase currencyConversion when overlaying a space-currency list row", () => {
    const detail = applyListRowMoneyToDetail(
      {
        id: "tx-gbp",
        date: "2026-08-12",
        description: "EXTEST2",
        amount: 20_000,
        amountCurrency: "PHP",
        categoryName: "Medicine",
        accountName: "SAMPLE BDO LONG ASS NAME",
        transactionType: "expense",
        type: CombinedTransactionTypeEnum.EXPENSE,
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        hasCurrencyConversion: true,
        originalDisplayAmount: 200,
        originalDisplayCurrency: "GBP",
        currencyConversion: {
          originalAmount: 200,
          originalCurrency: "GBP",
          convertedAmount: 20_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "manual",
        },
      },
      {
        id: "tx-gbp",
        date: "2026-08-12",
        description: "EXTEST2",
        amount: 20_000,
        amountCurrency: "PHP",
        categoryName: "Medicine",
        fromAccountName: "SAMPLE BDO LONG ASS NAME",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    );

    expect(detail.amount).toBe(200);
    expect(detail.amountCurrency).toBe("GBP");
    expect(detail.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
    });
  });
});
