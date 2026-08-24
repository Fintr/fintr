import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  collectIndexTransactionsFromQueryCaches,
  enrichLedgerTransactionsForDisplay,
  resolveLinkedTransferFeeRows,
  resolveSeriesRowsForDeleteScope,
  resolveTransactionInSeries,
  resolveTransactionInSeriesForDisplay,
} from "./resolve-delete-scope";

const transfer = (params: {
  id: string;
  date: string;
  inSeries?: boolean;
}) => ({
  id: params.id,
  date: params.date,
  description: "Transfer4",
  amount: 200,
  amountCurrency: "PHP",
  categoryName: "Transfer",
  fromAccountName: "BDO CC - Ella",
  toAccountName: "Cash - Ella",
  type: CombinedTransactionTypeEnum.TRANSFER,
  inSeries: params.inSeries ?? true,
  hasImage: false,
});

const fee = (params: { id: string; date: string }) => ({
  id: params.id,
  date: params.date,
  description: "Transfer fee for: Transfer4, amount: 200",
  amount: 20,
  amountCurrency: "PHP",
  categoryName: "Transfer Fee",
  fromAccountName: "BDO CC - Ella",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: true,
  hasImage: false,
});

describe("resolveTransactionInSeries", () => {
  it("returns true when the row has a parentId (series child)", () => {
    const child = {
      id: "child",
      date: "2026-08-08",
      description: "Recurring2",
      amount: 100,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      parentId: "parent-id",
      hasImage: false,
    };

    expect(resolveTransactionInSeries(child, [child])).toBe(true);
  });

  it("returns true when a sibling with the same fingerprint is marked inSeries", () => {
    const child = transfer({
      id: "t-child",
      date: "2026-08-08",
      inSeries: false,
    });
    const parent = transfer({
      id: "t-parent",
      date: "2026-08-01",
      inSeries: true,
    });

    expect(resolveTransactionInSeries(child, [child, parent])).toBe(true);
  });

  it("returns true when three rows share the fingerprint on different dates", () => {
    const base = {
      date: "2026-08-08",
      description: "Recurring2",
      amount: 100,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    expect(
      resolveTransactionInSeries(
        { ...base, id: "aug" },
        [
          { ...base, id: "aug" },
          { ...base, id: "sep", date: "2026-09-08" },
          { ...base, id: "oct", date: "2026-10-08" },
        ],
      ),
    ).toBe(true);
  });

  it("returns false for unrelated one-time rows", () => {
    const row = {
      id: "one-a",
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
    };

    expect(
      resolveTransactionInSeries(row, [{ ...row, id: "one-b", date: "2026-08-09" }]),
    ).toBe(false);
  });

  it("marks legacy fingerprint pairs as recurring for display only", () => {
    const base = {
      description: "Every week 1",
      amount: 328.3,
      amountCurrency: "PHP",
      categoryName: "Church",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    const rows = [
      { ...base, id: "aug-18", date: "2026-08-18" },
      { ...base, id: "aug-25", date: "2026-08-25" },
    ];

    expect(resolveTransactionInSeries(rows[0]!, rows)).toBe(false);
    expect(resolveTransactionInSeriesForDisplay(rows[0]!, rows)).toBe(true);
  });

  it("does not tag adjacent duplicate one-time rows for display", () => {
    const row = {
      id: "one-a",
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
    };

    expect(
      resolveTransactionInSeriesForDisplay(row, [{ ...row, id: "one-b", date: "2026-08-09" }]),
    ).toBe(false);
  });
});

describe("enrichLedgerTransactionsForDisplay", () => {
  it("tags stale recurring rows and infers inSeries for the ledger", () => {
    const base = {
      description: "Recurring2",
      amount: 82.07,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    const rows = [
      { ...base, id: "aug-18", date: "2026-08-18" },
      { ...base, id: "aug-19", date: "2026-08-19" },
      { ...base, id: "aug-20", date: "2026-08-20" },
    ];

    const enriched = enrichLedgerTransactionsForDisplay(rows);

    expect(enriched.every((row) => row.inSeries)).toBe(true);
    expect(enriched[0]?.scheduleType).toBe("repeat");
  });
});

describe("resolveSeriesRowsForDeleteScope", () => {
  it("expands from a stale one-time parent when siblings are marked inSeries", () => {
    const parent = transfer({
      id: "t-parent",
      date: "2026-08-01",
      inSeries: false,
    });
    const child = transfer({
      id: "t-child",
      date: "2026-08-08",
      inSeries: true,
    });

    const resolved = resolveSeriesRowsForDeleteScope({
      rows: [parent, child],
      target: parent,
      deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
    });

    expect(resolved.map((row) => row.id).sort()).toEqual([
      "t-child",
      "t-parent",
    ]);
  });

  it("does not fingerprint-match unrelated one-time rows under all_in_series", () => {
    const target = {
      id: "one-a",
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
    };
    const twin = {
      ...target,
      id: "one-b",
      date: "2026-08-09",
    };

    const resolved = resolveSeriesRowsForDeleteScope({
      rows: [target, twin],
      target,
      deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
    });

    expect(resolved.map((row) => row.id)).toEqual(["one-a"]);
  });

  it("still expands series when the target is marked inSeries", () => {
    const target = transfer({ id: "t-31", date: "2026-08-31", inSeries: true });
    const sibling = transfer({
      id: "t-30",
      date: "2026-08-30",
      inSeries: false,
    });

    const resolved = resolveSeriesRowsForDeleteScope({
      rows: [target, sibling],
      target,
      deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
    });

    expect(resolved.map((row) => row.id).sort()).toEqual(["t-30", "t-31"]);
  });

  it("removes all fingerprint matches for all_in_series even when sibling inSeries is stale", () => {
    const target = transfer({ id: "t-31", date: "2026-08-31", inSeries: true });
    const rows = [
      target,
      transfer({ id: "t-30", date: "2026-08-30", inSeries: false }),
      transfer({
        id: "other",
        date: "2026-08-29",
        inSeries: true,
      }),
    ];
    // Force different description on unrelated row
    rows[2] = { ...rows[2]!, description: "Other" };

    const resolved = resolveSeriesRowsForDeleteScope({
      rows,
      target,
      deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
    });

    expect(resolved.map((row) => row.id).sort()).toEqual(["t-30", "t-31"]);
  });

  it("matches the series parent when optimistic categoryName is Transfer and children are blank", () => {
    const parent = {
      ...transfer({ id: "t-parent", date: "2026-08-01", inSeries: true }),
      categoryName: "Transfer",
    };
    const child = {
      ...transfer({ id: "t-child", date: "2026-08-08", inSeries: true }),
      categoryName: "",
    };

    const resolved = resolveSeriesRowsForDeleteScope({
      rows: [parent, child],
      target: child,
      deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
    });

    expect(resolved.map((row) => row.id).sort()).toEqual([
      "t-child",
      "t-parent",
    ]);
  });
});

describe("resolveLinkedTransferFeeRows", () => {
  it("removes every matching fee across the series date range", () => {
    const transfers = [
      transfer({ id: "t-31", date: "2026-08-31" }),
      transfer({ id: "t-30", date: "2026-08-30" }),
    ];
    const rows = [
      ...transfers,
      fee({ id: "f-31", date: "2026-08-31" }),
      fee({ id: "f-30", date: "2026-08-30" }),
      fee({ id: "f-other", date: "2026-08-15" }),
    ];
    rows[rows.length - 1] = {
      ...rows[rows.length - 1]!,
      description: "Transfer fee for: Other, amount: 50",
    };

    const resolved = resolveLinkedTransferFeeRows({
      rows,
      transfers,
      deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
      targetDate: "2026-08-31",
    });

    expect(resolved.map((row) => row.id).sort()).toEqual(["f-30", "f-31"]);
  });
});

describe("collectIndexTransactionsFromQueryCaches", () => {
  it("reads rows from infinite transaction queries", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      [
        "transactions",
        "space-a",
        "[]",
        "2026-08-01",
        "2026-08-31",
        "",
        "",
        "",
        "[]",
        "network",
      ],
      {
        pages: [
          {
            transactions: [
              transfer({ id: "t-1", date: "2026-08-31" }),
              fee({ id: "f-1", date: "2026-08-31" }),
            ],
          },
        ],
        pageParams: [1],
      },
    );

    const rows = collectIndexTransactionsFromQueryCaches(
      queryClient,
      "space-a",
    );
    expect(rows.map((row) => row.id).sort()).toEqual(["f-1", "t-1"]);
  });
});
