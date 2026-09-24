import { describe, expect, it } from "vitest";

import { dashboardShellFromBootstrap } from "./dashboard-shell-from-bootstrap";
import type { SyncBootstrapResponse } from "@/types/syncTypes";

describe("dashboardShellFromBootstrap", () => {
  it("maps bootstrap dashboard shell fields", () => {
    const bundle = {
      spaceId: "space-1",
      latestSeq: 1,
      snapshotId: "snap",
      generatedAt: "2026-01-01T00:00:00.000Z",
      totals: {
        transactions: 0,
        loans: 0,
        budgetMonths: 0,
        truncated: false,
      },
      space: {},
      dashboardShell: {
        id: "space-1",
        goalDescription: "Save more",
        categoryOptions: [{ id: "1", label: "Food", value: "1" }],
        accountOptions: [{ label: "Cash", value: "Cash", currency: "PHP" }],
        expenseCategoryOptions: [],
        incomeCategoryOptions: [],
        earliestTransactionDate: "2024-01-01",
      },
      accounts: [],
      categories: [],
      tags: [],
      entities: [],
      transactions: [],
      monthlyFinancialSummaries: [],
      loans: [],
      budgetsByMonth: {},
    } satisfies SyncBootstrapResponse;

    const shell = dashboardShellFromBootstrap(bundle, "space-1");

    expect(shell).toEqual({
      id: "space-1",
      goalDescription: "Save more",
      categoryOptions: [{ id: "1", label: "Food", value: "1" }],
      accountOptions: [{ label: "Cash", value: "Cash", currency: "PHP" }],
      expenseCategoryOptions: [],
      incomeCategoryOptions: [],
      earliestTransactionDate: "2024-01-01",
    });
  });
});
