import { describe, expect, it, vi } from "vitest";

import {
  resolveBootstrapMonthlySummaries,
  verifyBootstrapTotals,
} from "./bootstrap-v2-helpers";
import type { SyncBootstrapResponse } from "@/types/syncTypes";

describe("resolveBootstrapMonthlySummaries", () => {
  it("reads camelCase monthlyFinancialSummaries from the bundle", () => {
    expect(
      resolveBootstrapMonthlySummaries({
        monthlyFinancialSummaries: [{ id: "1", month: 8 }],
      }),
    ).toEqual([{ id: "1", month: 8 }]);
  });

  it("falls back to snake_case monthly_financial_summaries", () => {
    expect(
      resolveBootstrapMonthlySummaries({
        monthly_financial_summaries: [{ id: "2", month: 7 }],
      }),
    ).toEqual([{ id: "2", month: 7 }]);
  });

  it("returns an empty array when summaries are missing", () => {
    expect(resolveBootstrapMonthlySummaries({})).toEqual([]);
  });
});

describe("bootstrap v2 totals verification", () => {
  it("passes when transaction count matches totals", () => {
    const bundle = {
      totals: {
        transactions: 2,
        loans: 0,
        budgetMonths: 1,
        truncated: false,
      },
      transactions: [{ id: "1" }, { id: "2" }],
    } as unknown as SyncBootstrapResponse;

    expect(() => verifyBootstrapTotals(bundle)).not.toThrow();
  });

  it("fails when truncated flag is set", () => {
    const bundle = {
      totals: {
        transactions: 0,
        loans: 0,
        budgetMonths: 0,
        truncated: true,
      },
      transactions: [],
    } as unknown as SyncBootstrapResponse;

    expect(() => verifyBootstrapTotals(bundle)).toThrow(/truncated/i);
  });

  it("fails when transaction count mismatches totals", () => {
    const bundle = {
      totals: {
        transactions: 3,
        loans: 0,
        budgetMonths: 0,
        truncated: false,
      },
      transactions: [{ id: "1" }],
    } as unknown as SyncBootstrapResponse;

    expect(() => verifyBootstrapTotals(bundle)).toThrow(/mismatch/i);
  });
});

describe("fetchSpaceBootstrap", () => {
  it("requests the bulk bootstrap endpoint", async () => {
    const { fetchSpaceBootstrap } = await import("./bootstrap-v2");

    const api = {
      get: vi.fn().mockResolvedValue({
        data: {
          data: {
            spaceId: "SPACE_1",
            latestSeq: 10,
            snapshotId: "snap-1",
            generatedAt: "2026-08-10T08:00:00.000Z",
            totals: {
              transactions: 0,
              loans: 0,
              budgetMonths: 0,
              truncated: false,
            },
            space: {},
            accounts: {},
            categories: {},
            transactions: [],
            monthlyFinancialSummaries: [],
            loans: [],
            budgetsByMonth: {},
            tags: [],
            entities: [],
          },
        },
      }),
    };

    const bundle = await fetchSpaceBootstrap(api as never, "SPACE_1");

    expect(api.get).toHaveBeenCalledWith(
      "/spaces/sync/bootstrap",
      expect.objectContaining({
        headers: { "X-Space-Code": "SPACE_1" },
      }),
    );
    expect(bundle.latestSeq).toBe(10);
  });
});
