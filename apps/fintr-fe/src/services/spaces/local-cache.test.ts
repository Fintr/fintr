import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import type { DashboardData } from "@/types/spaceTypes";

import {
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";

import {
  cacheDashboardResponse,
  loadCachedDashboardResponse,
} from "./local-cache";

const sampleDashboard = (): DashboardData => ({
  id: "dash-1",
  categoryOptions: [],
  accountOptions: [],
  expenseCategoryOptions: [],
  incomeCategoryOptions: [],
  goalDescription: "Save",
  financialSummary: {
    totalIncome: "100",
    totalExpenses: "40",
    netSavings: "60",
    savingsPercentage: "60",
    calculatedAt: "2026-08-07",
  },
});

describe("dashboard local-cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("caches and reloads dashboard by space + date range", async () => {
    const data = sampleDashboard();
    await cacheDashboardResponse("space-a", data, "2026-08-01", "2026-08-31");

    await expect(
      loadCachedDashboardResponse("space-a", "2026-08-01", "2026-08-31")
    ).resolves.toEqual(data);

    await expect(
      loadCachedDashboardResponse("space-a", "2026-07-01", "2026-07-31")
    ).resolves.toBeUndefined();
  });

  it("composes dashboard financial summary from monthly buckets when no exact cache", async () => {
    await cacheDashboardShell("space-a", {
      id: "dash-1",
      categoryOptions: [],
      accountOptions: [],
      expenseCategoryOptions: [],
      incomeCategoryOptions: [],
      goalDescription: "Save",
    });
    await cacheMonthlyFinancialSummaries("space-a", [
      {
        id: "jul",
        year: 2026,
        month: 7,
        currency: "PHP",
        fxBased: true,
        calculatedAt: "2026-07-31T00:00:00.000Z",
        totalIncome: 100,
        totalExpenses: 40,
        netSavings: 60,
        savingsPercentage: 60,
        monthStartDate: "2026-07-01",
        monthEndDate: "2026-07-31",
      },
    ]);

    const composed = await loadCachedDashboardResponse(
      "space-a",
      "2026-07-01",
      "2026-07-31",
    );

    expect(composed?.goalDescription).toBe("Save");
    expect(composed?.financialSummary.totalIncome).toBe("100");
    expect(composed?.financialSummary.totalExpenses).toBe("40");
  });
});
