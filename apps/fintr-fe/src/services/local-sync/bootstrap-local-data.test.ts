import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import type { DashboardData } from "@/types/spaceTypes";
import type { TransactionsPage } from "@/types/transactionTypes";

import {
  bootstrapLocalData,
  refreshOnlineLocalCaches,
  seedReactQueryFromLocalCache,
  syncAllWorkspacesLocalData,
  syncLocalDataFromBackend,
} from "./bootstrap-local-data";
import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
} from "@/lib/local-db";
import {
  loadCachedTransactionsInRange,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import {
  monthRangesForOfflineHydration,
  offlineBootstrapDateRange,
} from "@/lib/local-sync/offline-bootstrap-dates";
import { loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import { loadCachedDashboardResponse } from "@/services/spaces/local-cache";
import { getCurrentMonthDates } from "@/utils/dateUtils";

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

const sampleTransactionsPage = (): TransactionsPage => ({
  transactions: [
    {
      id: "tx-1",
      amount: "10",
      amountCurrency: "PHP",
      date: "2026-08-01",
      type: "expense",
    } as TransactionsPage["transactions"][number],
  ],
  nextPage: null,
  totalPages: 1,
  totalCount: 1,
  totals: null,
});

const createApiMock = () => {
  const get = vi.fn(async (url: string) => {
    if (url === "/dashboard") {
      return { data: { data: { dashboard: sampleDashboard() } } };
    }

    if (url === "/transactions/accounts") {
      return { data: { data: { accounts: [] } } };
    }

    if (url === "/transactions/categories") {
      return { data: { data: { expenseCategories: [], incomeCategories: [] } } };
    }

    if (url === "/transactions/loans") {
      return {
        data: {
          data: {
            loans: [],
            pagination: { totalPages: 1, currentPage: 1 },
          },
        },
      };
    }

    if (url === "/budgets") {
      return { data: { data: { budgets: [], summary: null } } };
    }

    if (url === "/monthly_financial_summaries") {
      return {
        data: {
          data: {
            monthlyFinancialSummaries: [
              {
                id: "sum-1",
                year: 2026,
                month: 8,
                currency: "PHP",
                fxBased: true,
                calculatedAt: "2026-08-01T00:00:00.000Z",
                totalIncome: 100,
                totalExpenses: 40,
                netSavings: 60,
                savingsPercentage: 60,
                monthStartDate: "2026-08-01",
                monthEndDate: "2026-08-31",
              },
            ],
          },
        },
      };
    }

    if (url === "/auth/private") {
      return { data: { data: { spaceCode: "SPACE1" } } };
    }

    throw new Error(`Unexpected url ${url}`);
  });

  return { get } as unknown as AxiosInstance;
};

vi.mock("@/services/spaces/api", () => ({
  spacesApi: {
    getSpaces: vi.fn(),
    getSpace: vi.fn(),
  },
}));

vi.mock("@/services/transactions/queries", () => ({
  fetchTransactionsPage: vi.fn(),
}));

import { spacesApi } from "@/services/spaces/api";
import { fetchTransactionsPage } from "@/services/transactions/queries";

describe("bootstrap-local-data", () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await resetLocalDbForTests();
  });

  it("seeds React Query from IndexedDB snapshots", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const params = {
      spaceCode: "SPACE1",
      ...offlineBootstrapDateRange(),
    };
    const { firstDay, lastDay } = getCurrentMonthDates();

    vi.mocked(fetchTransactionsPage).mockResolvedValue(sampleTransactionsPage());
    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE1", name: "Personal" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    await syncLocalDataFromBackend(api, queryClient, params);

    const seeded = await seedReactQueryFromLocalCache(queryClient, {
      spaceCode: "SPACE1",
      startDate: firstDay,
      endDate: lastDay,
    });

    expect(seeded).toBe(true);
    expect(
      queryClient.getQueryData(["dashboard", "SPACE1", firstDay, lastDay]),
    ).toMatchObject({
      goalDescription: "Save",
      financialSummary: {
        totalIncome: "100",
        totalExpenses: "40",
        netSavings: "60",
      },
    });
  });

  it("caches monthly summary buckets once and budgets per month", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const params = {
      spaceCode: "SPACE1",
      ...offlineBootstrapDateRange(),
    };
    const julyPage: TransactionsPage = {
      ...sampleTransactionsPage(),
      transactions: [
        {
          ...sampleTransactionsPage().transactions[0],
          id: "tx-july",
          date: "2026-07-10",
        },
      ],
    };

    vi.mocked(fetchTransactionsPage).mockResolvedValue(julyPage);
    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE1", name: "Personal" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    await syncLocalDataFromBackend(api, queryClient, params);

    const monthRanges = monthRangesForOfflineHydration([julyPage]);
    expect(monthRanges[0]).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });

    for (const range of monthRanges) {
      await expect(
        loadCachedDashboardResponse(
          "SPACE1",
          range.startDate,
          range.endDate,
        ),
      ).resolves.toMatchObject({
        goalDescription: "Save",
        financialSummary: expect.objectContaining({
          totalIncome: expect.any(String),
        }),
      });
      await expect(
        loadCachedBudgetsResponse(
          "SPACE1",
          range.startDate,
          range.endDate,
        ),
      ).resolves.toMatchObject({ budgets: [] });
    }

    const dashboardCalls = vi
      .mocked(api.get)
      .mock.calls.filter(([url]) => url === "/dashboard");
    const summaryCalls = vi
      .mocked(api.get)
      .mock.calls.filter(([url]) => url === "/monthly_financial_summaries");
    expect(dashboardCalls.length).toBe(1);
    expect(summaryCalls.length).toBe(1);
  });

  it("syncs a single workspace from the backend", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const params = {
      spaceCode: "SPACE1",
      ...offlineBootstrapDateRange(),
    };

    vi.mocked(fetchTransactionsPage).mockResolvedValue(sampleTransactionsPage());
    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE1", name: "Personal" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    const result = await bootstrapLocalData(api, queryClient, params);

    expect(result.errors).toEqual([]);
    expect(result.dashboard?.goalDescription).toBe("Save");
    expect(result.transactionPages).toHaveLength(1);
  });

  it("syncs every workspace returned by the spaces API", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const params = offlineBootstrapDateRange();

    vi.mocked(spacesApi.getSpaces).mockResolvedValue({
      data: {
        data: {
          spaces: [
            { code: "SPACE1", name: "Personal" },
            { code: "SPACE2", name: "Business" },
          ],
        },
      },
    } as Awaited<ReturnType<typeof spacesApi.getSpaces>>);

    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE1", name: "Personal" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    vi.mocked(fetchTransactionsPage).mockResolvedValue(sampleTransactionsPage());

    const progressSnapshots: number[] = [];
    const result = await syncAllWorkspacesLocalData(api, queryClient, params, {
      onProgress: (progress) => {
        progressSnapshots.push(progress.overallProgress);
      },
    });

    expect(result.syncedSpaceCodes).toEqual(["SPACE1", "SPACE2"]);
    expect(result.failedSpaceCodes).toEqual([]);
    expect(progressSnapshots.at(-1)).toBe(100);
    expect(api.get).toHaveBeenCalled();
    expect(fetchTransactionsPage).toHaveBeenCalledTimes(2);
  });

  it("syncNewlyAccessibleWorkspaces only pulls workspaces missing from sync meta", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const params = offlineBootstrapDateRange();

    const { markOfflineSyncComplete } = await import("@/lib/local-db/sync-state");
    await markOfflineSyncComplete(["SPACE1"]);

    vi.mocked(spacesApi.getSpaces).mockResolvedValue({
      data: {
        data: {
          spaces: [
            { code: "SPACE1", name: "Personal" },
            { code: "SPACE2", name: "Shared" },
          ],
        },
      },
    } as Awaited<ReturnType<typeof spacesApi.getSpaces>>);

    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE2", name: "Shared" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    vi.mocked(fetchTransactionsPage).mockResolvedValue(sampleTransactionsPage());

    const { syncNewlyAccessibleWorkspaces } = await import(
      "./bootstrap-local-data"
    );
    const result = await syncNewlyAccessibleWorkspaces(api, queryClient, params);

    expect(result?.syncedSpaceCodes).toEqual(["SPACE2"]);
    expect(fetchTransactionsPage).toHaveBeenCalledTimes(1);
    expect(fetchTransactionsPage).toHaveBeenCalledWith(
      api,
      expect.objectContaining({
        requestConfig: expect.objectContaining({
          headers: expect.objectContaining({ "X-Space-Code": "SPACE2" }),
        }),
      }),
    );
  });

  it("preserves pending local: creates when pulling transactions from the server", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const params = {
      spaceCode: "SPACE1",
      ...offlineBootstrapDateRange(),
    };
    const clientMutationId = "cid-pending-local";
    const localId = `local:${clientMutationId}`;

    await upsertLocalIndexTransaction("SPACE1", {
      id: localId,
      date: "2026-08-08",
      description: "Offline snack",
      amount: 25,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await enqueueOutboxRecord({
      spaceId: "SPACE1",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId,
      payload: {
        amount: 25,
        description: "Offline snack",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
      },
    });

    vi.mocked(fetchTransactionsPage).mockResolvedValue(sampleTransactionsPage());
    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE1", name: "Personal" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    await syncLocalDataFromBackend(api, queryClient, params);

    const rows = await loadCachedTransactionsInRange(
      "SPACE1",
      "2026-08-01",
      "2026-08-31",
    );
    const ids = rows.map((row) => row.id).sort();
    expect(ids).toContain("tx-1");
    expect(ids).toContain(localId);
  });

  it("refreshOnlineLocalCaches pulls the active workspace and invalidates queries", async () => {
    const queryClient = new QueryClient();
    const api = createApiMock();
    const { firstDay, lastDay } = getCurrentMonthDates();

    vi.mocked(fetchTransactionsPage).mockResolvedValue({
      ...sampleTransactionsPage(),
      transactions: [
        {
          ...sampleTransactionsPage().transactions[0],
          id: "peer-tx-1",
          description: "From other user",
          date: "2026-08-08",
        },
      ],
    });
    vi.mocked(spacesApi.getSpace).mockResolvedValue({
      data: { data: { space: { code: "SPACE1", name: "Shared" } } },
    } as Awaited<ReturnType<typeof spacesApi.getSpace>>);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await refreshOnlineLocalCaches(api, queryClient, {
      spaceCode: "SPACE1",
      startDate: firstDay,
      endDate: lastDay,
    });

    const rows = await loadCachedTransactionsInRange(
      "SPACE1",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows.some((row) => row.id === "peer-tx-1")).toBe(true);
    expect(fetchTransactionsPage).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
