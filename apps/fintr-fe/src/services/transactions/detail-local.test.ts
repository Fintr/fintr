import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum, type IndexTransaction } from "@/types/transactionTypes";

import { upsertLocalIndexTransaction } from "./local-cache";
import {
  applyListRowMoneyToDetail,
  cacheEditDetailFromIndexRow,
  cacheTransactionDetail,
  enrichTransactionEditDetail,
  loadCachedTransactionDetail,
  mapIndexTransactionToEditData,
  mapIndexTransactionToEditDataSync,
  normalizeTransactionEditDetail,
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
      accountId: "acc-cash",
      fromAccountId: "acc-cash",
      entityId: "ent-jollibee",
      entityName: "Jollibee",
    });

    expect(mapped).toMatchObject({
      id: "tx-1",
      amount: 120,
      accountName: "Cash",
      accountId: "acc-cash",
      entityId: "ent-jollibee",
      entityName: "Jollibee",
      transactionType: "expense",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    });
  });

  it("maps a this-only GBP bump onto edit-form seed without shrinking to 2 GBP", () => {
    const mapped = mapIndexTransactionToEditDataSync({
      id: "tx-install8-nov",
      date: "2027-11-01",
      description: "INSTALL8",
      amount: 200,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 250_000,
      parentId: "tx-install8-root",
      rootParentId: "tx-install8-root",
      currencyConversion: {
        originalAmount: 200,
        originalCurrency: "GBP",
        convertedAmount: 200,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    });

    expect(mapped).toMatchObject({
      amount: 200,
      amountCurrency: "GBP",
      installmentTotal: 250_000,
    });
    expect(mapped.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
    });
  });

  it("maps installment plan total onto edit-form seed", () => {
    const mapped = mapIndexTransactionToEditDataSync({
      id: "tx-install-nov",
      date: "2027-11-01",
      description: "INSTALL6",
      amount: 20_000,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 250_000,
      parentId: "tx-install-root",
      rootParentId: "tx-install-root",
    });

    expect(mapped).toMatchObject({
      amount: 200,
      amountCurrency: "GBP",
      installmentPeriod: 24,
      installmentTotal: 250_000,
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

  it("parses persisted currency_conversion from cached API detail payloads", () => {
    const normalized = normalizeTransactionEditDetail({
      id: "tx-install7",
      date: "2026-08-01",
      description: "INSTALL7",
      amount: 10_000,
      amount_currency: "PHP",
      booked_amount: 100,
      booked_amount_currency: "GBP",
      original_display_amount: 100,
      original_display_currency: "GBP",
      currency_conversion: {
        original_amount: 100,
        original_currency: "GBP",
        converted_amount: 10_000,
        converted_currency: "PHP",
        exchange_rate: 100,
        source: "recent",
      },
      installment_total: 240_000,
      installment_period: 24,
      schedule_type: "installment",
    });

    expect(normalized).toMatchObject({
      amount: 100,
      amountCurrency: "GBP",
      installmentTotal: 240_000,
      currencyConversion: {
        originalAmount: 100,
        originalCurrency: "GBP",
        convertedAmount: 10_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "recent",
      },
    });
  });

  it("normalizes snake_case schedule fields from cached detail payloads", () => {
    const normalized = normalizeTransactionEditDetail({
      id: "tx-repeat",
      schedule_type: "repeat",
      repeat_interval: "every_month",
      installment_period: 0,
    });

    expect(normalized).toMatchObject({
      scheduleType: ScheduleTypeEnum.REPEAT,
      repeatInterval: "every_month",
      installmentPeriod: 0,
    });
  });

  it("inherits repeat interval from the parent when resolving a series child", async () => {
    await cacheTransactionDetail("space-a", "tx-parent", {
      id: "tx-parent",
      scheduleType: ScheduleTypeEnum.REPEAT,
      repeatInterval: "every_week",
    });

    const listRow: Parameters<typeof resolveTransactionDetail>[0]["listRow"] = {
      id: "tx-child",
      date: "2026-08-31",
      description: "Recurring2",
      amount: 82.07,
      categoryName: "Food & Groceries",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      parentId: "tx-parent",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      hasImage: false,
    };

    await upsertLocalIndexTransaction("space-a", listRow);

    await cacheTransactionDetail("space-a", "tx-child", {
      id: "tx-child",
      schedule_type: "one_time",
      repeat_interval: "",
    });

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-child",
      type: CombinedTransactionTypeEnum.EXPENSE,
      listRow,
      preferLocal: true,
    });

    expect(detail).toMatchObject({
      scheduleType: ScheduleTypeEnum.REPEAT,
      repeatInterval: "every_week",
    });
  });

  it("inherits installment term from the parent when resolving a series child", async () => {
    await cacheTransactionDetail("space-a", "tx-install-parent", {
      id: "tx-install-parent",
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 12,
    });

    const listRow: Parameters<typeof resolveTransactionDetail>[0]["listRow"] = {
      id: "tx-install-child",
      date: "2026-09-18",
      description: "INSTALL1",
      amount: 82.07,
      categoryName: "Food & Groceries",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      parentId: "tx-install-parent",
      rootParentId: "tx-install-parent",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      hasImage: false,
    };

    await upsertLocalIndexTransaction("space-a", listRow);

    await cacheTransactionDetail("space-a", "tx-install-child", {
      id: "tx-install-child",
      schedule_type: "one_time",
      installment_period: 0,
    });

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-install-child",
      type: CombinedTransactionTypeEnum.EXPENSE,
      listRow,
      preferLocal: true,
    });

    expect(detail).toMatchObject({
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 12,
    });
  });

  it("prefers the root plan total over a stale child copy when opening edit", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-install-root",
      date: "2026-01-01",
      description: "INSTALL6",
      amount: 10_000,
      amountCurrency: "PHP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 250_000,
    });

    const listRow: Parameters<typeof resolveTransactionDetail>[0]["listRow"] = {
      id: "tx-install-dec",
      date: "2027-12-01",
      description: "INSTALL6",
      amount: 10_000,
      amountCurrency: "PHP",
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      parentId: "tx-install-root",
      rootParentId: "tx-install-root",
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      hasImage: false,
    };

    await upsertLocalIndexTransaction("space-a", listRow);

    // Cached child detail with a stale total must not win over the root.
    await cacheTransactionDetail("space-a", "tx-install-dec", {
      id: "tx-install-dec",
      description: "INSTALL6",
      date: "2027-12-01",
      amount: 10_000,
      amountCurrency: "PHP",
      categoryName: "Home",
      accountName: "Cash",
      transactionType: "expense",
      type: CombinedTransactionTypeEnum.EXPENSE,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      repeatInterval: "P1M",
      installmentPeriod: 24,
      installmentTotal: 240_000,
      file: null,
      entityName: "",
      hasCurrencyConversion: true,
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
    });

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-install-dec",
      type: CombinedTransactionTypeEnum.EXPENSE,
      listRow,
      preferLocal: true,
    });

    expect(detail).toMatchObject({
      installmentTotal: 250_000,
      installmentPeriod: 24,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
    });
  });

  it("prefers a fresh root index total over a stale cached root detail", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-install-root",
      date: "2026-01-01",
      description: "INSTALL8",
      amount: 10_000,
      amountCurrency: "PHP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 250_000,
    });

    await cacheTransactionDetail("space-a", "tx-install-root", {
      id: "tx-install-root",
      description: "INSTALL8",
      date: "2026-01-01",
      amount: 10_000,
      amountCurrency: "PHP",
      categoryName: "Home",
      accountName: "Cash",
      transactionType: "expense",
      type: CombinedTransactionTypeEnum.EXPENSE,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      repeatInterval: "P1M",
      installmentPeriod: 24,
      installmentTotal: 240_000,
      file: null,
      entityName: "",
    });

    const listRow: Parameters<typeof resolveTransactionDetail>[0]["listRow"] = {
      id: "tx-install-nov",
      date: "2027-11-01",
      description: "INSTALL8",
      amount: 20_000,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      parentId: "tx-install-root",
      rootParentId: "tx-install-root",
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 250_000,
      hasImage: false,
    };

    await upsertLocalIndexTransaction("space-a", listRow);

    await cacheTransactionDetail("space-a", "tx-install-nov", {
      id: "tx-install-nov",
      description: "INSTALL8",
      date: "2027-11-01",
      amount: 20_000,
      amountCurrency: "PHP",
      categoryName: "Home",
      accountName: "Cash",
      transactionType: "expense",
      type: CombinedTransactionTypeEnum.EXPENSE,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      repeatInterval: "P1M",
      installmentPeriod: 24,
      installmentTotal: 240_000,
      file: null,
      entityName: "",
      hasCurrencyConversion: true,
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
    });

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-install-nov",
      type: CombinedTransactionTypeEnum.EXPENSE,
      listRow,
      preferLocal: true,
    });

    expect(detail).toMatchObject({
      installmentTotal: 250_000,
    });
  });

  it("caches currency_conversion in IndexedDB from an index row with booked legs", async () => {
    const listRow: IndexTransaction = {
      id: "tx-install8",
      date: "2027-12-01",
      description: "INSTALL8",
      amount: 10_000,
      amountCurrency: "PHP",
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "GCash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      parentId: "tx-install8-root",
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      hasImage: false,
    };

    await cacheEditDetailFromIndexRow("space-a", listRow);
    const cached = await loadCachedTransactionDetail("space-a", "tx-install8");

    expect(
      (cached as { currencyConversion?: { exchangeRate?: number } })
        .currencyConversion,
    ).toMatchObject({
      originalCurrency: "GBP",
      convertedCurrency: "PHP",
      exchangeRate: 100,
    });
  });

  it("prefers index-row FX over stale cached detail without conversion when preferLocal", async () => {
    await cacheTransactionDetail("space-a", "tx-stale-fx", {
      id: "tx-stale-fx",
      date: "2027-12-01",
      description: "INSTALL8",
      amount: 10_000,
      amountCurrency: "PHP",
      categoryName: "Home",
      accountName: "GCash",
      transactionType: "expense",
      type: CombinedTransactionTypeEnum.EXPENSE,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      file: null,
      entityName: "",
      hasCurrencyConversion: false,
    });

    const listRow: IndexTransaction = {
      id: "tx-stale-fx",
      date: "2027-12-01",
      description: "INSTALL8",
      amount: 10_000,
      amountCurrency: "PHP",
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "GCash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      parentId: "tx-install8-root",
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      hasImage: false,
    };

    const detail = await resolveTransactionDetail({
      api: null,
      spaceId: "space-a",
      transactionId: "tx-stale-fx",
      type: CombinedTransactionTypeEnum.EXPENSE,
      listRow,
      preferLocal: true,
    });

    expect(detail.currencyConversion).toMatchObject({
      originalCurrency: "GBP",
      exchangeRate: 100,
    });
  });
});
