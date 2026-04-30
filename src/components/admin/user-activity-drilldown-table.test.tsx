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
});
