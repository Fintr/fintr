import { describe, expect, it } from "vitest";

import { resolveUnfilteredInsightsSummary } from "./offline-calculations";
import type { InsightsSummary } from "./types";

const zeros: InsightsSummary = {
  totalIncome: 0,
  totalExpenses: 0,
  netSavings: 0,
};

const augustBuckets: InsightsSummary = {
  totalIncome: 1_641_483.57,
  totalExpenses: 2_189_334.81,
  netSavings: -547_851.24,
};

const augustCachedDashboard: InsightsSummary = {
  totalIncome: 1_641_483.57,
  totalExpenses: 1_810_920.05,
  netSavings: -169_436.48,
};

const partialPeriodTransactions: InsightsSummary = {
  totalIncome: 1_641_483.57,
  totalExpenses: 1_630_920.05,
  netSavings: 10_563.52,
};

describe("resolveUnfilteredInsightsSummary", () => {
  it("prefers monthly buckets over partial period transactions", () => {
    expect(
      resolveUnfilteredInsightsSummary({
        fromPeriodTransactions: partialPeriodTransactions,
        hybridSummary: partialPeriodTransactions,
        bucketSummary: augustBuckets,
      }),
    ).toEqual(augustBuckets);
  });

  it("falls back to hybrid summary when buckets are empty", () => {
    expect(
      resolveUnfilteredInsightsSummary({
        fromPeriodTransactions: zeros,
        hybridSummary: augustBuckets,
        bucketSummary: zeros,
      }),
    ).toEqual(augustBuckets);
  });

  it("falls back to monthly buckets when hybrid is empty", () => {
    expect(
      resolveUnfilteredInsightsSummary({
        fromPeriodTransactions: zeros,
        hybridSummary: zeros,
        bucketSummary: augustBuckets,
      }),
    ).toEqual(augustBuckets);
  });

  it("uses cached dashboard snapshot when buckets and txs are empty", () => {
    expect(
      resolveUnfilteredInsightsSummary({
        fromPeriodTransactions: zeros,
        hybridSummary: zeros,
        bucketSummary: zeros,
        cachedDashboardSummary: augustCachedDashboard,
      }),
    ).toEqual(augustCachedDashboard);
  });

  it("uses period transactions only when buckets have no signal", () => {
    expect(
      resolveUnfilteredInsightsSummary({
        fromPeriodTransactions: partialPeriodTransactions,
        hybridSummary: zeros,
        bucketSummary: zeros,
      }),
    ).toEqual(partialPeriodTransactions);
  });

  it("returns zeros when every IndexedDB source is empty", () => {
    expect(
      resolveUnfilteredInsightsSummary({
        fromPeriodTransactions: zeros,
        hybridSummary: zeros,
        bucketSummary: zeros,
        cachedDashboardSummary: zeros,
      }),
    ).toEqual(zeros);
  });
});
