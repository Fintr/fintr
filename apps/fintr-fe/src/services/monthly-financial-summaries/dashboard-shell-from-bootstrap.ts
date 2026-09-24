import type { DashboardShell } from "@/services/monthly-financial-summaries/local-cache";
import type { SyncBootstrapResponse } from "@/types/syncTypes";
import type { DashboardData } from "@/types/spaceTypes";

const DEFAULT_GOAL_DESCRIPTION =
  "Set your own financial freedom goal, whatever milestone or lifestyle you're aiming for.";

export const dashboardShellFromBootstrap = (
  bundle: SyncBootstrapResponse,
  spaceCode: string,
): DashboardShell | null => {
  const raw = bundle.dashboardShell;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const shell = raw as Record<string, unknown>;

  return {
    id: String(shell.id ?? spaceCode),
    categoryOptions:
      (shell.categoryOptions as DashboardData["categoryOptions"]) ?? [],
    accountOptions:
      (shell.accountOptions as DashboardData["accountOptions"]) ?? [],
    expenseCategoryOptions:
      (shell.expenseCategoryOptions as DashboardData["expenseCategoryOptions"]) ??
      [],
    incomeCategoryOptions:
      (shell.incomeCategoryOptions as DashboardData["incomeCategoryOptions"]) ??
      [],
    goalDescription:
      typeof shell.goalDescription === "string"
        ? shell.goalDescription
        : DEFAULT_GOAL_DESCRIPTION,
    earliestTransactionDate:
      typeof shell.earliestTransactionDate === "string"
        ? shell.earliestTransactionDate
        : null,
  };
};
