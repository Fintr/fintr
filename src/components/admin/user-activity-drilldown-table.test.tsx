import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserActivityDrilldownTable } from "@/components/admin/user-activity-drilldown-table";
import type { UserActivityDrilldownRow } from "@/services/admin/analytics/queries";

describe("UserActivityDrilldownTable", () => {
  it("renders Name and Email columns with user identity from rows", () => {
    const rows: UserActivityDrilldownRow[] = [
      {
        id: "user-uuid-1",
        email: "pat@example.com",
        fullName: "Pat Example",
        apiRequestCount: 3,
        dashboardViewedCount: 1,
        totalRequests: 3,
        transactionsCreated: 2,
        standaloneTransactions: 2,
        transferLegTransactions: 0,
        transfersCreated: 0,
        receiptScans: 1,
        aiChatUsages: 4,
        aiInteractions: 2,
      },
    ];

    render(<UserActivityDrilldownTable rows={rows} />);

    expect(screen.getByRole("columnheader", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Email/ })).toBeInTheDocument();
    expect(screen.getByText("Pat Example")).toBeInTheDocument();
    expect(screen.getByText("pat@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy email pat@example\.com/i })
    ).toBeInTheDocument();
  });

  it("renders averageRow as the first data row with no copy button", () => {
    const averageRow: UserActivityDrilldownRow = {
      id: "average",
      email: "—",
      fullName: "Average (all users)",
      apiRequestCount: 2.5,
      dashboardViewedCount: 1,
      totalRequests: 3.5,
      transactionsCreated: 0,
      standaloneTransactions: 0,
      transferLegTransactions: 0,
      transfersCreated: 0,
      receiptScans: 0.5,
      aiChatUsages: 0,
      aiInteractions: 0,
    };
    const rows: UserActivityDrilldownRow[] = [
      {
        id: "user-uuid-1",
        email: "pat@example.com",
        fullName: "Pat Example",
        apiRequestCount: 3,
        dashboardViewedCount: 1,
        totalRequests: 4,
        transactionsCreated: 0,
        standaloneTransactions: 0,
        transferLegTransactions: 0,
        transfersCreated: 0,
        receiptScans: 0,
        aiChatUsages: 0,
        aiInteractions: 0,
      },
    ];

    const { container } = render(<UserActivityDrilldownTable rows={rows} averageRow={averageRow} />);

    const tbodyRows = container.querySelectorAll("tbody tr");
    expect(tbodyRows.length).toBe(2);
    expect(tbodyRows[0]).toHaveTextContent("Average (all users)");
    expect(tbodyRows[0]).toHaveTextContent("2.50");
    expect(screen.getByRole("button", { name: /Copy email pat@example\.com/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy email —/i })).not.toBeInTheDocument();
  });
});
