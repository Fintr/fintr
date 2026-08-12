import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import {
  OFFLINE_BOOTSTRAP_END_DATE,
  OFFLINE_BOOTSTRAP_START_DATE,
} from "@/lib/local-sync/offline-bootstrap-dates";
import type { TransactionsPage } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  buildAllTimeTransactionsFilterKey,
  buildTransactionsFilterKey,
  cacheTransactionsAllPages,
  cacheTransactionsPage,
  insertTransactionNewestFirst,
  LOCAL_TRANSACTIONS_PAGE_SIZE,
  getLocalTransactionsPrefetchIndex,
  loadAllCachedTransactionsForInsights,
  loadCachedTransactionsInfiniteData,
  loadCachedTransactionsInRange,
  loadCachedTransactionsPage,
  loadCachedTransactionsPageAt,
  loadScatteredTransactionSnapshotsFromMeta,
  mergeFetchedTransactionsIntoAllTimeCache,
  replaceLocalIndexTransactionId,
  upsertLocalIndexTransaction,
  mergeIndexTransactionTags,
  mergeIndexTransactionMetadata,
  transactionsAllPagesCacheKey,
} from "./local-cache";
import { putLocalResponseSnapshot } from "@/lib/local-db/response-cache";

describe("transactions local-cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("prefers flat transaction index over stale page snapshots", async () => {
    const filterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await cacheTransactionsPage("space-a", filterKey, {
      transactions: [],
      nextPage: null,
      totalPages: 1,
      totalCount: 0,
      totals: null,
    });

    await upsertLocalIndexTransaction("space-a", {
      id: "older",
      date: "2026-08-09",
      createdAt: "2026-08-09T10:00:00.000Z",
      description: "older day",
      amount: 10,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await upsertLocalIndexTransaction("space-a", {
      id: "newer-first",
      date: "2026-08-10",
      createdAt: "2026-08-10T12:00:00.000Z",
      description: "newer first",
      amount: 20,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await upsertLocalIndexTransaction("space-a", {
      id: "newer-second",
      date: "2026-08-10",
      createdAt: "2026-08-10T11:00:00.000Z",
      description: "newer second",
      amount: 30,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const page = await loadCachedTransactionsPageAt("space-a", filterKey, 1);
    expect(page?.transactions.map((row) => row.id)).toEqual([
      "newer-first",
      "newer-second",
      "older",
    ]);
  });

  it("filters cached transactions by entry type (e.g. loans only)", async () => {
    const baseFilter = {
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    };

    await upsertLocalIndexTransaction("space-a", {
      id: "expense-row",
      date: "2026-08-10",
      description: "Medicine",
      amount: 100,
      amountCurrency: "PHP",
      categoryName: "Medicine",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await upsertLocalIndexTransaction("space-a", {
      id: "loan-payment-row",
      date: "2026-08-11",
      description: "Mortgage payment",
      amount: 500,
      amountCurrency: "PHP",
      categoryName: "Loan",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      inSeries: false,
      hasImage: false,
    });

    const allFilterKey = buildTransactionsFilterKey({
      ...baseFilter,
      entryType: "all",
    });
    const loansFilterKey = buildTransactionsFilterKey({
      ...baseFilter,
      entryType: "loans",
    });

    const allPage = await loadCachedTransactionsPageAt("space-a", allFilterKey, 1);
    expect(allPage?.transactions.map((row) => row.id)).toEqual([
      "loan-payment-row",
      "expense-row",
    ]);

    const loansPage = await loadCachedTransactionsPageAt(
      "space-a",
      loansFilterKey,
      1,
    );
    expect(loansPage?.transactions.map((row) => row.id)).toEqual([
      "loan-payment-row",
    ]);
  });

  it("filters entry type from a cached all-types page snapshot when the flat index is empty", async () => {
    const baseFilter = {
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    };

    const allFilterKey = buildTransactionsFilterKey({
      ...baseFilter,
      entryType: "all",
    });
    const expenseFilterKey = buildTransactionsFilterKey({
      ...baseFilter,
      entryType: "expense",
    });

    await cacheTransactionsPage("space-a", allFilterKey, {
      transactions: [
        {
          id: "expense-only",
          date: "2026-08-10",
          description: "Medicine",
          amount: 100,
          amountCurrency: "PHP",
          categoryName: "Medicine",
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
        },
        {
          id: "income-only",
          date: "2026-08-10",
          description: "Salary",
          amount: 500,
          amountCurrency: "PHP",
          categoryName: "Salary",
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.INCOME,
          inSeries: false,
          hasImage: false,
        },
      ],
      nextPage: null,
      totalPages: 1,
      totalCount: 2,
      totals: { income: 500, expense: 100, transfer: 0 },
    });

    const expensePage = await loadCachedTransactionsPageAt(
      "space-a",
      expenseFilterKey,
      1,
    );

    expect(expensePage?.transactions.map((row) => row.id)).toEqual([
      "expense-only",
    ]);
  });

  it("caches page 1 for a filter key", async () => {
    const filterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const page: TransactionsPage = {
      transactions: [],
      nextPage: null,
      totalPages: 1,
      totalCount: 0,
      totals: null,
    };

    await cacheTransactionsPage("space-a", filterKey, page);

    await expect(
      loadCachedTransactionsPage("space-a", filterKey)
    ).resolves.toEqual(page);
  });

  it("slices all-time cache into a month view, including empty months", async () => {
    const allTimeFilterKey = buildAllTimeTransactionsFilterKey({
      categoriesSerialized: "[]",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const julyFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const augustFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const allTimePages: TransactionsPage[] = [
      {
        transactions: [
          {
            id: "tx-july",
            amount: 100,
            date: "2026-07-15",
            type: CombinedTransactionTypeEnum.EXPENSE,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ];

    await cacheTransactionsAllPages("space-a", allTimeFilterKey, allTimePages);

    const july = await loadCachedTransactionsInfiniteData(
      "space-a",
      julyFilterKey,
    );
    expect(july?.pages[0]?.transactions).toHaveLength(1);
    expect(july?.pages[0]?.transactions[0]?.id).toBe("tx-july");

    const august = await loadCachedTransactionsInfiniteData(
      "space-a",
      augustFilterKey,
    );
    expect(august?.pages[0]?.transactions).toEqual([]);
    expect(august?.pages[0]?.totalCount).toBe(0);

    expect(allTimeFilterKey).toContain(OFFLINE_BOOTSTRAP_START_DATE);
    expect(allTimeFilterKey).toContain(OFFLINE_BOOTSTRAP_END_DATE);
  });

  it("pages local data for infinite scroll without hydrating everything", async () => {
    const allTimeFilterKey = buildAllTimeTransactionsFilterKey({
      categoriesSerialized: "[]",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const julyFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const transactions = Array.from(
      { length: LOCAL_TRANSACTIONS_PAGE_SIZE + 5 },
      (_, index) =>
        ({
          id: `tx-${index + 1}`,
          amount: 10,
          date: "2026-07-10",
          type: CombinedTransactionTypeEnum.EXPENSE,
        }) as TransactionsPage["transactions"][number],
    );

    await cacheTransactionsAllPages("space-a", allTimeFilterKey, [
      {
        transactions,
        nextPage: null,
        totalPages: 1,
        totalCount: transactions.length,
        totals: null,
      },
    ]);

    const seeded = await loadCachedTransactionsInfiniteData(
      "space-a",
      julyFilterKey,
    );
    expect(seeded?.pages).toHaveLength(1);
    expect(seeded?.pages[0]?.transactions).toHaveLength(
      LOCAL_TRANSACTIONS_PAGE_SIZE,
    );
    expect(seeded?.pages[0]?.nextPage).toBe(2);

    const page2 = await loadCachedTransactionsPageAt(
      "space-a",
      julyFilterKey,
      2,
    );
    expect(page2?.transactions).toHaveLength(5);
    expect(page2?.nextPage).toBeNull();
  });

  it("filters cached transactions by selected tags", async () => {
    const tagId = "tag-japan";
    const allTimeFilterKey = buildAllTimeTransactionsFilterKey({
      categoriesSerialized: "[]",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const taggedFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: JSON.stringify([tagId]),
    });

    await cacheTransactionsAllPages("space-a", allTimeFilterKey, [
      {
        transactions: [
          {
            id: "tx-tagged",
            amount: 50,
            date: "2026-07-10",
            type: CombinedTransactionTypeEnum.EXPENSE,
            tags: [{ id: tagId, name: "Japan", color: "#000" }],
          } as TransactionsPage["transactions"][number],
          {
            id: "tx-other",
            amount: 30,
            date: "2026-07-11",
            type: CombinedTransactionTypeEnum.EXPENSE,
            tags: [],
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 2,
        totals: null,
      },
    ]);

    const filtered = await loadCachedTransactionsInfiniteData(
      "space-a",
      taggedFilterKey,
    );

    expect(filtered?.pages[0]?.transactions).toHaveLength(1);
    expect(filtered?.pages[0]?.transactions[0]?.id).toBe("tx-tagged");
  });

  it("places the prefetch sentinel on the 11th item of the latest page", () => {
    expect(getLocalTransactionsPrefetchIndex(25, 25, true)).toBe(10);
    expect(getLocalTransactionsPrefetchIndex(50, 25, true)).toBe(35);
    expect(getLocalTransactionsPrefetchIndex(28, 3, true)).toBe(27);
    expect(getLocalTransactionsPrefetchIndex(25, 25, false)).toBeNull();
  });

  it("inserts newest same-day rows at the top by createdAt", () => {
    const existing = [
      {
        id: "a",
        date: "2026-08-08",
        createdAt: "2026-08-08T01:00:00.000Z",
        description: "First",
        amount: 1,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    ];

    const next = insertTransactionNewestFirst(existing, {
      ...existing[0],
      id: "b",
      createdAt: "2026-08-08T02:00:00.000Z",
      description: "Second",
    });

    expect(next.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("upserts a transaction into the all-time cache and replaces temp ids", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "local:temp-1",
      date: "2026-08-05",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const inRange = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(inRange).toHaveLength(1);
    expect(inRange[0]?.id).toBe("local:temp-1");

    await replaceLocalIndexTransactionId(
      "space-a",
      "local:temp-1",
      "server-99",
    );

    const after = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe("server-99");
  });

  it("keeps realtime converted money when replacing a local create id", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "local:temp-fx",
      date: "2026-08-10",
      description: "Starbucks",
      amount: 200,
      amountCurrency: "PHP",
      categoryName: "Coffee",
      fromAccountName: "BDO",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await upsertLocalIndexTransaction("space-a", {
      id: "server-fx",
      date: "2026-08-10",
      description: "Starbucks",
      amount: 16414.84,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      categoryName: "Coffee",
      fromAccountName: "BDO",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    await replaceLocalIndexTransactionId(
      "space-a",
      "local:temp-fx",
      "server-fx",
    );

    const after = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe("server-fx");
    expect(after[0]?.amount).toBe(16414.84);
    expect(after[0]?.bookedAmount).toBe(200);
    expect(after[0]?.bookedAmountCurrency).toBe("GBP");
  });

  it("preserves tags when a server upsert omits tag metadata", async () => {
    const tagId = "tag-japan-2026";

    await upsertLocalIndexTransaction("space-a", {
      id: "tx-tagged",
      date: "2026-08-09",
      description: "Trip spend",
      amount: 500,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
      tags: [{ id: tagId, name: "Japan 2026", color: "#0A3D62" }],
      tagIds: [tagId],
    });

    await upsertLocalIndexTransaction("space-a", {
      id: "tx-tagged",
      date: "2026-08-09",
      description: "Trip spend",
      amount: 500,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags?.map((tag) => tag.id)).toEqual([tagId]);
  });

  it("mergeIndexTransactionTags respects explicit tag clears", () => {
    const existing = {
      id: "tx-1",
      tags: [{ id: "tag-a", name: "A", color: "#000" }],
      tagIds: ["tag-a"],
    };

    const cleared = mergeIndexTransactionTags(
      existing as never,
      {
        id: "tx-1",
        tags: [],
        tagIds: [],
      } as never,
    );

    expect(cleared.tags).toEqual([]);
    expect(cleared.tagIds).toEqual([]);
  });

  it("mergeIndexTransactionTags preserves tags when incoming only has tags: []", () => {
    const existing = {
      id: "tx-1",
      tags: [{ id: "tag-a", name: "Japan 2026", color: "#000" }],
      tagIds: ["tag-a"],
    };

    const merged = mergeIndexTransactionTags(
      existing as never,
      {
        id: "tx-1",
        tags: [],
      } as never,
    );

    expect(merged.tags?.map((tag) => tag.id)).toEqual(["tag-a"]);
    expect(merged.tagIds).toEqual(["tag-a"]);
  });

  it("mergeIndexTransactionTags overlays tags without dropping existing row fields", () => {
    const existing = {
      id: "tx-1",
      amount: 10_000_000,
      categoryName: "Freelance",
      tags: [],
    };

    const merged = mergeIndexTransactionTags(
      existing as never,
      {
        id: "tx-1",
        amount: 164.15,
        tags: [{ id: "tag-a", name: "Japan 2026", color: "#000" }],
        tagIds: ["tag-a"],
      } as never,
    );

    expect(merged.amount).toBe(164.15);
    expect(merged.categoryName).toBe("Freelance");
    expect(merged.tagIds).toEqual(["tag-a"]);
  });

  it("preserves category metadata when a server upsert omits category fields", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-home",
      date: "2026-08-09",
      description: "Rent",
      amount: 15000,
      categoryName: "Home",
      categoryId: "cat-home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    await upsertLocalIndexTransaction("space-a", {
      id: "tx-home",
      date: "2026-08-09",
      description: "Rent",
      amount: 15000,
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.categoryId).toBe("cat-home");
  });

  it("mergeIndexTransactionMetadata preserves tags and category fields together", () => {
    const existing = {
      id: "tx-1",
      categoryId: "cat-home",
      categoryName: "Home",
      tags: [{ id: "tag-a", name: "A", color: "#000" }],
      tagIds: ["tag-a"],
    };

    const merged = mergeIndexTransactionMetadata(
      existing as never,
      {
        id: "tx-1",
        categoryName: "Home",
        amount: 100,
      } as never,
    );

    expect(merged.categoryId).toBe("cat-home");
    expect(merged.tags?.map((tag) => tag.id)).toEqual(["tag-a"]);
  });

  it("merges month-scoped fetches into the all-time cache for insights reads", async () => {
    const augustFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const augustPages: TransactionsPage[] = [
      {
        transactions: [
          {
            id: "tx-food",
            date: "2026-08-12",
            description: "Groceries",
            amount: 350,
            categoryName: "Food & Groceries",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ];

    await cacheTransactionsAllPages("space-a", augustFilterKey, augustPages);
    await mergeFetchedTransactionsIntoAllTimeCache("space-a", augustPages);

    const janToAug = await loadCachedTransactionsInRange(
      "space-a",
      "2026-01-01",
      "2026-08-31",
    );

    expect(janToAug).toHaveLength(1);
    expect(janToAug[0]?.categoryName).toBe("Food & Groceries");
  });

  it("falls back to month-scoped caches when the all-time store is empty", async () => {
    const augustFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const diningPages: TransactionsPage[] = [
      {
        transactions: [
          {
            id: "tx-dining",
            date: "2026-08-12",
            description: "Dinner",
            amount: 850,
            categoryName: "Dine Out & Entertainment",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ];

    await cacheTransactionsAllPages("space-a", augustFilterKey, diningPages);

    const allTime = await loadCachedTransactionsInRange(
      "space-a",
      "2026-01-01",
      "2026-08-31",
    );

    expect(allTime).toHaveLength(1);
    expect(allTime[0]?.categoryName).toBe("Dine Out & Entertainment");
  });

  it("merges scattered month caches when the all-time store is only partial", async () => {
    const spaceId = "space-partial-merge";
    const allTimeFilterKey = buildAllTimeTransactionsFilterKey({
      categoriesSerialized: "[]",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const julyFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await cacheTransactionsAllPages(spaceId, allTimeFilterKey, [
      {
        transactions: [
          {
            id: "tx-august",
            date: "2026-08-12",
            description: "August only",
            amount: 100,
            categoryName: "Food & Groceries",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ]);

    await cacheTransactionsAllPages(spaceId, julyFilterKey, [
      {
        transactions: [
          {
            id: "tx-july",
            date: "2026-07-08",
            description: "July only",
            amount: 200,
            categoryName: "Food & Groceries",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ]);

    const rows = await loadCachedTransactionsInRange(
      spaceId,
      "2026-07-01",
      "2026-08-31",
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id).sort()).toEqual(["tx-august", "tx-july"]);
  });

  it("includes online page-1 caches when the all-time store is empty", async () => {
    const spaceId = "space-page-one-only";
    const augustFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await cacheTransactionsPage(spaceId, augustFilterKey, {
      transactions: [
        {
          id: "tx-online-page-1",
          date: "2026-08-12",
          description: "Browsed online",
          amount: 450,
          categoryName: "Food & Groceries",
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
        } as TransactionsPage["transactions"][number],
      ],
      nextPage: 2,
      totalPages: 3,
      totalCount: 60,
      totals: null,
    });

    const rows = await loadCachedTransactionsInRange(
      spaceId,
      "2026-08-01",
      "2026-08-31",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("tx-online-page-1");
  });

  it("loads all-time UI ranges from month-scoped caches via page reads", async () => {
    const spaceId = "space-all-time-ui";
    const augustFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    const allTimeUiFilterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await cacheTransactionsAllPages(spaceId, augustFilterKey, [
      {
        transactions: [
          {
            id: "tx-august-all-time",
            date: "2026-08-12",
            description: "August dinner",
            amount: 500,
            categoryName: "Dine Out & Entertainment",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ]);

    const seeded = await loadCachedTransactionsInfiniteData(
      spaceId,
      allTimeUiFilterKey,
    );

    expect(seeded?.pages[0]?.transactions).toHaveLength(1);
    expect(seeded?.pages[0]?.transactions[0]?.id).toBe("tx-august-all-time");
  });

  it("reads transactionsAllPages snapshots stored as a single page object", async () => {
    const spaceId = "miguel-dagatan-gmail-com-personal-space";
    const filterKey = buildAllTimeTransactionsFilterKey({
      categoriesSerialized: "[]",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await putLocalResponseSnapshot(
      transactionsAllPagesCacheKey(spaceId, filterKey),
      {
        transactions: [
          {
            id: "dec-salary",
            date: "2025-12-31",
            description: "Salary",
            amount: 50000,
            categoryName: "Salary",
            fromAccountName: "",
            toAccountName: "Cash",
            type: CombinedTransactionTypeEnum.INCOME,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    );

    const scattered = await loadScatteredTransactionSnapshotsFromMeta(spaceId);
    expect(scattered).toHaveLength(1);
    expect(scattered[0]?.id).toBe("dec-salary");

    const insights = await loadAllCachedTransactionsForInsights(spaceId);
    expect(insights.some((row) => row.id === "dec-salary")).toBe(true);
  });

  it("keeps bootstrap tags when Dexie index has a tagless overwrite", async () => {
    const spaceId = "space-a";
    const tagId = "tag-japan-2026";
    const filterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: OFFLINE_BOOTSTRAP_START_DATE,
      endDate: OFFLINE_BOOTSTRAP_END_DATE,
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await cacheTransactionsAllPages(spaceId, filterKey, [
      {
        transactions: [
          {
            id: "tx-trip",
            date: "2026-03-15",
            description: "Tokyo",
            amount: 1200,
            categoryName: "Travel",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
            tags: [{ id: tagId, name: "Japan 2026", color: "#0A3D62" }],
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ]);

    await upsertLocalIndexTransaction(spaceId, {
      id: "tx-trip",
      date: "2026-03-15",
      description: "Tokyo",
      amount: 1200,
      categoryName: "Travel",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
      tags: [],
    });

    const insights = await loadAllCachedTransactionsForInsights(spaceId);
    const trip = insights.find((row) => row.id === "tx-trip");

    expect(trip?.tags?.map((tag) => tag.id)).toEqual([tagId]);
  });

  it("keeps Church categoryName when Dexie row omits category metadata", async () => {
    const spaceId = "space-a";
    const filterKey = buildTransactionsFilterKey({
      categoriesSerialized: "[]",
      startDate: OFFLINE_BOOTSTRAP_START_DATE,
      endDate: OFFLINE_BOOTSTRAP_END_DATE,
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });

    await cacheTransactionsAllPages(spaceId, filterKey, [
      {
        transactions: [
          {
            id: "tx-church",
            date: "2026-03-15",
            description: "Tithe",
            amount: 2500,
            categoryName: "Church",
            categoryId: "cat-church",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ]);

    await upsertLocalIndexTransaction(spaceId, {
      id: "tx-church",
      date: "2026-03-15",
      description: "Tithe",
      amount: 2500,
      categoryName: "",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const insights = await loadAllCachedTransactionsForInsights(spaceId);
    const church = insights.find((row) => row.id === "tx-church");

    expect(church?.categoryName).toBe("Church");
    expect(church?.categoryId).toBe("cat-church");
  });
});
