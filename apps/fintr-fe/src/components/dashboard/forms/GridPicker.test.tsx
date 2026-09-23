import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import GridPicker from "./GridPicker";

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: {},
    isAuthenticated: true,
  }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-a", vi.fn()],
}));

vi.mock("@/hooks/async/useAccounts", () => ({
  useAccounts: () => ({
    accounts: [
      {
        id: "acc-eastwest",
        name: "EastWest",
        balance: "569889.23",
        balanceCurrency: "PHP",
        accountCategory: "debit",
      },
    ],
  }),
}));

const renderPicker = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <GridPicker
          pickerKind="account"
          label="Account"
          value=""
          onChange={() => undefined}
          open
          hideTrigger
          accounts={[
            {
              label: "EastWest",
              value: "EastWest",
              currency: "PHP",
              accountCategory: "debit",
              balance: -24430110.77,
            },
          ]}
        />
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("GridPicker account balances", () => {
  it("shows the accounts-list balance instead of a stale dashboard-shell balance", () => {
    renderPicker();

    expect(screen.getByText("₱569,889.23")).toBeInTheDocument();
    expect(screen.queryByText(/-₱24,430,110.77/)).not.toBeInTheDocument();
  });
});
