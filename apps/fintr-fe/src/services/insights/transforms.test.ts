import { describe, expect, it } from "vitest";
import {
  transformHealthScores,
  transformMetricCalculation,
  transformNarratives,
} from "./transforms";

describe("transformMetricCalculation", () => {
  it("maps snake_case labeled_formula and formula from API", () => {
    const result = transformMetricCalculation({
      labeled_formula: "(Net savings ÷ Total income) × 100",
      formula: "₱3,000 ÷ ₱10,000 × 100 = 30%",
      inputs: [{ label: "Total income", value: "₱10,000" }],
      notes: ["Uses transactions in your selected date range."],
    });

    expect(result).toEqual({
      labeledFormula: "(Net savings ÷ Total income) × 100",
      formula: "₱3,000 ÷ ₱10,000 × 100 = 30%",
      inputs: [{ label: "Total income", value: "₱10,000" }],
      notes: ["Uses transactions in your selected date range."],
    });
  });

  it("returns undefined when calculation is absent", () => {
    expect(transformMetricCalculation(undefined)).toBeUndefined();
  });
});

describe("transformHealthScores", () => {
  it("maps calculation breakdowns on each factor and overall score", () => {
    const result = transformHealthScores({
      financialHealthScore: "92%",
      savingsPercentage: {
        percentage: "36%",
        score: 100,
        calculation: {
          labeled_formula: "(Net savings ÷ Total income) × 100",
          formula: "₱80,236 ÷ ₱220,804 × 100 = 36%",
          inputs: [{ label: "Health score (bar)", value: "100" }],
          notes: ["The badge is your actual savings rate for the selected period."],
        },
      },
      debtToIncomeRatio: {
        percentage: "40%",
        score: 60,
        monthlyDebt: "1000",
        calculation: {
          labeled_formula: "Monthly debt payments ÷ Monthly income × 100",
          inputs: [],
          notes: [],
        },
      },
      budgetUsage: {
        percentage: "62%",
        score: 80,
        calculation: {
          labeled_formula: "Period expenses ÷ Total budget × 100",
          inputs: [],
          notes: [],
        },
      },
      calculation: {
        labeled_formula: "(Savings score × 50%) + (Budget score × 30%) + (Debt score × 20%)",
        formula: "(100 × 0.5) + (80 × 0.3) + (60 × 0.2) = 92%",
        inputs: [],
        notes: [],
      },
    });

    expect(result.score).toBe(92);
    expect(result.savingsPercentage.calculation?.labeledFormula).toContain(
      "Net savings",
    );
    expect(result.debtToIncomeRatio.calculation?.labeledFormula).toContain(
      "Monthly debt",
    );
    expect(result.budgetUsage.calculation?.labeledFormula).toContain(
      "Period expenses",
    );
    expect(result.calculation?.formula).toContain("92%");
  });
});

describe("transformNarratives", () => {
  it("maps snake_case insight action fields from API", () => {
    const result = transformNarratives({
      headline: { text: "Headline", sentiment: "positive" },
      metrics: [],
      insights: [
        {
          type: "category_trend",
          severity: "warning",
          title: "Food spending up",
          body: "Food is higher.",
          action_label: "Filter transactions",
          action_href: "/dashboard?category=Food",
        },
      ],
      dataQuality: {
        transaction_count: 1,
        categorized_percent: "100%",
        completeness_tier: "complete",
      },
    });

    expect(result.insights[0].actionLabel).toBe("Filter transactions");
    expect(result.insights[0].actionHref).toBe("/dashboard?category=Food");
    expect(result.dataQuality.transactionCount).toBe(1);
  });

  it("preserves insight action links for category filters", () => {
    const result = transformNarratives({
      headline: { text: "You kept ₱1 this period.", sentiment: "positive" },
      metrics: [],
      insights: [
        {
          type: "category_trend",
          severity: "warning",
          title: "Subscriptions & Hobbies spending up",
          body: "Subscriptions & Hobbies is 37% higher than the prior period.",
          actionLabel: "Filter transactions",
          actionHref: "/dashboard?category=Subscriptions+%26+Hobbies",
        },
      ],
      dataQuality: {
        transactionCount: 10,
        categorizedPercent: "90%",
        completenessTier: "complete",
      },
    });

    expect(result.insights[0].actionHref).toBe(
      "/dashboard?category=Subscriptions+%26+Hobbies",
    );
    expect(result.insights[0].actionLabel).toBe("Filter transactions");
  });

  it("maps profileKey and imageKey on profile insight cards", () => {
    const result = transformNarratives({
      headline: { text: "You look like a Strong Saver", sentiment: "positive" },
      metrics: [],
      insights: [
        {
          type: "profile",
          severity: "positive",
          title: "Strong Saver",
          body: "You retained 30%.",
          action_label: "View transactions",
          action_href: "/dashboard",
          profile_key: "strong_saver",
          image_key: "strong_saver",
        },
      ],
      dataQuality: {
        completeness_tier: "complete",
      },
    });

    expect(result.insights[0].profileKey).toBe("strong_saver");
    expect(result.insights[0].imageKey).toBe("strong_saver");
  });
});
