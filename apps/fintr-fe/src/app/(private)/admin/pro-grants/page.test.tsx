import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ProGrantsPage from "./page";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api }),
}));

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ProGrantsPage />
    </QueryClientProvider>,
  );
};

describe("Pro grants page", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockResolvedValue({ data: { data: { grants: [] } } });
  });

  it("grants one year when an email is submitted", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: {
        data: {
          grant: {
            id: "grant-1",
            email: "early@example.com",
            expiresAt: "2027-09-24T00:00:00.000Z",
            acknowledgedAt: null,
            updatedAt: "2026-09-24T00:00:00.000Z",
          },
        },
      },
    });

    renderPage();

    await user.type(screen.getByLabelText("Email"), "early@example.com");
    await user.click(screen.getByRole("button", { name: "Grant 1 year" }));

    expect(api.post).toHaveBeenCalledWith("/admin/finance/pro_grants", {
      email: "early@example.com",
    });
  });
});
