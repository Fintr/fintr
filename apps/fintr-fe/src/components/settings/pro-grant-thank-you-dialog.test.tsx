import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { ProGrantThankYouDialog, formatProGrantDate } from "./pro-grant-thank-you-dialog";
import { ProGrantThankYouPrompt } from "./pro-grant-thank-you-prompt";

const proState = vi.hoisted(() => ({
  data: undefined as
    | {
        grantNotice?: { pending: boolean; expiresAt: string } | null;
      }
    | undefined,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: { post: vi.fn() } }),
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  PRO_ACCESS_QUERY_KEY: ["finance", "proAccess"],
  useProAccess: () => proState,
}));

describe("formatProGrantDate", () => {
  it("writes a calendar date", () => {
    expect(formatProGrantDate("2027-09-24T00:00:00.000Z")).toMatch(/September 2[34], 2027/);
  });
});

describe("ProGrantThankYouDialog", () => {
  beforeEach(() => {
    proState.data = undefined;
  });

  it("thanks the person and records that they saw it", async () => {
    const user = userEvent.setup();
    const post = vi.fn().mockResolvedValue({ data: {} });
    const onAcknowledged = vi.fn();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <ProGrantThankYouDialog
          api={{ post } as unknown as AxiosInstance}
          open
          expiresAt="2027-09-24T00:00:00.000Z"
          onAcknowledged={onAcknowledged}
        />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("img", { name: "A calm woman with glasses sitting on a quiet hill" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Thank you for using Fintr")).toBeInTheDocument();
    expect(screen.getByText(/1 year of Fintr Pro/)).toBeInTheDocument();
    expect(screen.getByText("Dashboard Insights")).toBeInTheDocument();
    expect(screen.getByText("AI chat")).toBeInTheDocument();
    expect(screen.getByText("Split with people")).toBeInTheDocument();
    expect(screen.getByText("Soon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Got it" }));

    expect(post).toHaveBeenCalledWith("/finance/pro_grant_acknowledgement");
    expect(onAcknowledged).toHaveBeenCalled();
  });
});

describe("ProGrantThankYouPrompt", () => {
  const renderPrompt = () => {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <ProGrantThankYouPrompt enabled />
      </QueryClientProvider>,
    );
  };

  it("stays closed until a grant is waiting", () => {
    proState.data = { grantNotice: { pending: false, expiresAt: "2027-09-24T00:00:00.000Z" } };

    renderPrompt();

    expect(screen.queryByText("Thank you for using Fintr")).not.toBeInTheDocument();
  });

  it("opens when the signed-in account has an unseen grant", () => {
    proState.data = { grantNotice: { pending: true, expiresAt: "2027-09-24T00:00:00.000Z" } };

    renderPrompt();

    expect(screen.getByText("Thank you for using Fintr")).toBeInTheDocument();
  });
});
