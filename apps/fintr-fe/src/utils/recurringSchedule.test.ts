import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum, IndexTransaction } from "@/types/transactionTypes";
import {
  buildRecurringSeriesSummaries,
  buildUpcomingSeriesDisplayItems,
  filterRowsToSeriesRepresentatives,
  formatRelativeDueLabel,
  partitionRecurringSeries,
  prepareLedgerDisplayItems,
  repeatIntervalLabel,
  resolveInstallmentOccurrenceDisplay,
  resolveRootParentId,
  shouldCollapseIntervalInLedger,
} from "@/utils/recurringSchedule";
import { computeUpcomingSeriesDates } from "@/services/transactions/schedule-occurrence-dates";

const buildRow = (
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction => ({
  id: "tx-1",
  date: "2026-08-11",
  description: "Coffee",
  amount: 5,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("recurringSchedule", () => {
  it("labels repeat intervals for display", () => {
    expect(repeatIntervalLabel("every_day")).toBe("Every day");
    expect(repeatIntervalLabel("every_month")).toBe("Every month");
  });

  it("resolves root parent id from parent or schedule type", () => {
    expect(
      resolveRootParentId({
        id: "child",
        parentId: "root",
        scheduleType: "repeat",
      }),
    ).toBe("root");

    expect(
      resolveRootParentId({
        id: "root",
        parentId: null,
        scheduleType: "repeat",
      }),
    ).toBe("root");
  });

  it("collapses daily and weekly recurring rows in the ledger", () => {
    const rows = [
      buildRow({
        id: "root",
        date: "2026-08-10",
        scheduleType: "repeat",
        repeatInterval: "every_day",
        inSeries: true,
      }),
      buildRow({
        id: "child-1",
        parentId: "root",
        rootParentId: "root",
        date: "2026-08-11",
        scheduleType: "repeat",
        repeatInterval: "every_day",
        inSeries: true,
      }),
      buildRow({
        id: "monthly",
        date: "2026-08-12",
        scheduleType: "repeat",
        repeatInterval: "every_month",
        inSeries: true,
      }),
    ];

    const items = prepareLedgerDisplayItems(rows);

    expect(items.filter((item) => item.kind === "collapsed")).toHaveLength(1);
    expect(items.filter((item) => item.kind === "row")).toHaveLength(1);
    expect(
      items.find((item) => item.kind === "collapsed")?.kind === "collapsed"
        && (items.find((item) => item.kind === "collapsed") as {
          rows: IndexTransaction[];
        }).rows.length,
    ).toBe(2);
    expect(shouldCollapseIntervalInLedger("every_day")).toBe(true);
    expect(shouldCollapseIntervalInLedger("every_month")).toBe(false);
  });

  it("sorts collapsed recurring groups by earliest occurrence in view", () => {
    const rows = [
      buildRow({
        id: "daily-26",
        date: "2026-08-26",
        description: "Recurring2",
        scheduleType: "repeat",
        repeatInterval: "every_day",
        inSeries: true,
      }),
      buildRow({
        id: "weekly-root",
        date: "2026-08-18",
        description: "Every week 1",
        scheduleType: "repeat",
        repeatInterval: "every_week",
        inSeries: true,
      }),
      buildRow({
        id: "weekly-child",
        parentId: "weekly-root",
        rootParentId: "weekly-root",
        date: "2026-08-25",
        description: "Every week 1",
        scheduleType: "repeat",
        repeatInterval: "every_week",
        inSeries: true,
      }),
      buildRow({
        id: "daily-25",
        date: "2026-08-25",
        description: "Recurring2",
        scheduleType: "repeat",
        repeatInterval: "every_day",
        inSeries: true,
      }),
    ];

    const items = prepareLedgerDisplayItems(rows);
    const dates = items.map((item) =>
      item.kind === "row"
        ? item.row.date.slice(0, 10)
        : item.anchorDate.slice(0, 10),
    );

    expect(dates).toEqual([
      "2026-08-26",
      "2026-08-25",
      "2026-08-18",
    ]);
  });

  it("builds recurring series summaries and partitions upcoming vs inactive", () => {
    const summaries = buildRecurringSeriesSummaries(
      [
        buildRow({
          id: "daily-root",
          date: "2026-08-18",
          scheduleType: "repeat",
          repeatInterval: "every_day",
          inSeries: true,
        }),
        buildRow({
          id: "daily-child",
          parentId: "daily-root",
          rootParentId: "daily-root",
          date: "2026-08-19",
          scheduleType: "repeat",
          repeatInterval: "every_day",
          inSeries: true,
        }),
        buildRow({
          id: "old-root",
          date: "2024-01-01",
          scheduleType: "repeat",
          repeatInterval: "every_month",
          inSeries: true,
        }),
      ],
      "2026-08-18",
    );

    expect(summaries).toHaveLength(2);

    const partitioned = partitionRecurringSeries(summaries, "2026-08-18");
    expect(partitioned.upcoming.some((series) => series.rootParentId === "daily-root")).toBe(
      true,
    );
  });

  it("projects daily upcoming dates from the series anchor", () => {
    expect(
      computeUpcomingSeriesDates({
        parentDate: "2026-08-18",
        repeatInterval: "every_day",
        today: "2026-08-18",
        count: 4,
      }),
    ).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("skips dates on or before exclusiveThrough when today is already recorded", () => {
    expect(
      computeUpcomingSeriesDates({
        parentDate: "2026-08-18",
        repeatInterval: "every_day",
        today: "2026-08-18",
        exclusiveThroughDate: "2026-08-18",
        count: 3,
      }),
    ).toEqual([
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("uses tomorrow as next occurrence when today is already recorded", () => {
    const summaries = buildRecurringSeriesSummaries(
      [
        buildRow({
          id: "daily-root",
          date: "2026-08-18",
          scheduleType: "repeat",
          repeatInterval: "every_day",
          inSeries: true,
        }),
      ],
      "2026-08-18",
    );

    expect(summaries[0]?.nextOccurrenceDate).toBe("2026-08-19");
    expect(
      formatRelativeDueLabel(summaries[0]!.nextOccurrenceDate!, "2026-08-18"),
    ).toBe("Tomorrow");
  });

  it("keeps today and tomorrow as relative labels without a calendar date", () => {
    expect(formatRelativeDueLabel("2026-08-18", "2026-08-18")).toBe("Today");
    expect(formatRelativeDueLabel("2026-08-19", "2026-08-18")).toBe("Tomorrow");
  });

  it("appends the calendar date after in-n-days labels", () => {
    expect(formatRelativeDueLabel("2026-09-14", "2026-08-18")).toBe(
      "In 27 days (Sep 14)",
    );
    expect(formatRelativeDueLabel("2027-01-15", "2026-08-18")).toBe(
      "In 150 days (Jan 15, 2027)",
    );
  });

  it("builds upcoming display items from schedule rule, not only stored rows", () => {
    const summaries = buildRecurringSeriesSummaries(
      [
        buildRow({
          id: "daily-root",
          date: "2026-08-18",
          scheduleType: "repeat",
          repeatInterval: "every_day",
          inSeries: true,
        }),
        buildRow({
          id: "daily-child",
          parentId: "daily-root",
          rootParentId: "daily-root",
          date: "2026-08-31",
          scheduleType: "repeat",
          repeatInterval: "every_day",
          inSeries: true,
        }),
      ],
      "2026-08-18",
    );

    const series = summaries.find((entry) => entry.rootParentId === "daily-root");
    expect(series).toBeDefined();

    const upcoming = buildUpcomingSeriesDisplayItems(series!, "2026-08-18", 4);
    expect(upcoming.map((item) => item.date)).toEqual([
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
    ]);
    expect(upcoming.some((item) => item.isProjected)).toBe(true);
  });

  it("collapses installment children to one representative per series", () => {
    const representatives = filterRowsToSeriesRepresentatives([
      buildRow({
        id: "install4-aug",
        parentId: "install4-root",
        rootParentId: "install4-root",
        date: "2026-08-01",
        description: "INSTALL4",
        amount: 4166.67,
        scheduleType: "installment",
        installmentPeriod: 24,
        inSeries: true,
      }),
    ]);

    expect(representatives).toHaveLength(1);
    expect(representatives[0]?.description).toBe("INSTALL4");
    expect(representatives[0]?.rootParentId).toBe("install4-root");
    expect(representatives[0]?.date).toBe("2026-08-01");
  });

  it("sums actual installment payments instead of monthly times term", () => {
    const summaries = buildRecurringSeriesSummaries(
      [
        buildRow({
          id: "install5-root",
          date: "2026-01-01",
          description: "INSTALL5",
          amount: 10000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 240000,
          inSeries: true,
        }),
        buildRow({
          id: "install5-jul",
          parentId: "install5-root",
          rootParentId: "install5-root",
          date: "2026-07-01",
          description: "INSTALL5",
          amount: 50000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 240000,
          inSeries: true,
        }),
        buildRow({
          id: "install5-nov",
          parentId: "install5-root",
          rootParentId: "install5-root",
          date: "2027-11-01",
          description: "INSTALL5",
          amount: 20000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 240000,
          inSeries: true,
        }),
      ],
      "2026-08-19",
    );

    expect(summaries[0]?.installmentTotal).toBe(290000);
  });

  it("keeps the space-currency installment when a leftover FX row shares the date", () => {
    const summaries = buildRecurringSeriesSummaries(
      [
        buildRow({
          id: "install8-root",
          date: "2026-01-01",
          description: "INSTALL8",
          amount: 10000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-oct",
          parentId: "install8-root",
          rootParentId: "install8-root",
          date: "2027-10-01",
          description: "INSTALL8",
          amount: 20000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-nov-php",
          parentId: "install8-root",
          rootParentId: "install8-root",
          date: "2027-11-01",
          description: "INSTALL8",
          amount: 20000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-nov-gbp",
          parentId: "install8-oct",
          rootParentId: "install8-root",
          date: "2027-11-01",
          description: "INSTALL8",
          amount: -691,
          amountCurrency: "GBP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-dec-gbp",
          parentId: "install8-nov-gbp",
          rootParentId: "install8-root",
          date: "2027-12-01",
          description: "INSTALL8",
          amount: -691,
          amountCurrency: "GBP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-dec-php",
          parentId: "install8-root",
          rootParentId: "install8-root",
          date: "2027-12-01",
          description: "INSTALL8",
          amount: 20000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
      ],
      "2026-08-22",
    );

    const series = summaries.find(
      (entry) => entry.rootParentId === "install8-root",
    );
    expect(series).toBeDefined();

    const upcoming = buildUpcomingSeriesDisplayItems(
      series!,
      "2026-08-22",
      24,
    );
    const november = upcoming.find((item) => item.date === "2027-11-01");
    const december = upcoming.find((item) => item.date === "2027-12-01");

    expect(november?.row?.amount).toBe(20000);
    expect(november?.row?.amountCurrency).toBe("PHP");
    expect(december?.row?.amount).toBe(20000);
    expect(december?.row?.amountCurrency).toBe("PHP");
  });

  it("replaces a leftover negative FX installment with the space-currency payment", () => {
    const summaries = buildRecurringSeriesSummaries(
      [
        buildRow({
          id: "install8-root",
          date: "2026-01-01",
          description: "INSTALL8",
          amount: 10000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-oct",
          parentId: "install8-root",
          rootParentId: "install8-root",
          date: "2027-10-01",
          description: "INSTALL8",
          amount: 20000,
          amountCurrency: "PHP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
        buildRow({
          id: "install8-nov-gbp",
          parentId: "install8-oct",
          rootParentId: "install8-root",
          date: "2027-11-01",
          description: "INSTALL8",
          amount: -691,
          amountCurrency: "GBP",
          scheduleType: "installment",
          installmentPeriod: 24,
          installmentTotal: 270000,
          inSeries: true,
        }),
      ],
      "2026-08-22",
    );

    const series = summaries.find(
      (entry) => entry.rootParentId === "install8-root",
    );
    expect(series).toBeDefined();

    const leftover = series?.occurrences.find(
      (row) => row.id === "install8-nov-gbp",
    );
    const display = resolveInstallmentOccurrenceDisplay(
      leftover,
      series!,
      "PHP",
    );

    expect(display.amount).toBe(20000);
    expect(display.currency).toBe("PHP");
  });
});
