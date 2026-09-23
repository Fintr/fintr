import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosInstance } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WeeklyFeedbackDialog } from "./weekly-feedback-dialog";
import { WeeklyFeedbackPrompt } from "./weekly-feedback-prompt";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithQuery = (ui: ReactElement) => {
  const client = createTestQueryClient();
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
};

describe("WeeklyFeedbackDialog", () => {
  let mockApi: AxiosInstance;
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenChange = vi.fn();
    mockApi = {
      post: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as AxiosInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Close dismisses immediately without calling the API", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WeeklyFeedbackDialog api={mockApi} open onOpenChange={onOpenChange} />,
    );

    expect(await screen.findByText(/How's Fintr going this week/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("exposes dialog content to overlay stacking helpers", async () => {
    renderWithQuery(
      <WeeklyFeedbackDialog api={mockApi} open onOpenChange={onOpenChange} />,
    );

    expect(await screen.findByText(/How's Fintr going this week/i)).toBeInTheDocument();
    expect(document.querySelector("[data-modal-content]")).not.toBeNull();
  });

  it("Not now closes without calling the API", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WeeklyFeedbackDialog api={mockApi} open onOpenChange={onOpenChange} />,
    );

    expect(await screen.findByText(/How's Fintr going this week/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("Send feedback POSTs liked and improve areas", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WeeklyFeedbackDialog api={mockApi} open onOpenChange={onOpenChange} />,
    );

    await screen.findByText(/How's Fintr going this week/i);

    await user.click(within(screen.getByTestId("weekly-feedback-likes")).getByRole("button", { name: "Transactions" }));
    await user.click(within(screen.getByTestId("weekly-feedback-improve")).getByRole("button", { name: "Speed" }));
    await user.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledTimes(1);
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      "/product_pulse_feedbacks",
      expect.objectContaining({
        liked_areas: ["transactions"],
        improve_areas: ["speed"],
      }),
    );
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("WeeklyFeedbackPrompt", () => {
  let mockApi: AxiosInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean }).__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__ =
      true;
    localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", "2025-W01");
    mockApi = {
      post: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as AxiosInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    delete (window as Window & { __FINTR_E2E_SHOW_WEEKLY_FEEDBACK__?: boolean })
      .__FINTR_E2E_SHOW_WEEKLY_FEEDBACK__;
    vi.clearAllMocks();
  });

  it("opens after delay and marks handled when dismissed", async () => {
    renderWithQuery(<WeeklyFeedbackPrompt api={mockApi} enabled />);

    expect(screen.queryByText(/How's Fintr going this week/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/How's Fintr going this week/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(localStorage.getItem("fintr_weekly_feedback_v1_lastPromptWeekKey")).not.toBe("2025-W01");
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("closes when it becomes disabled", async () => {
    const { rerender } = renderWithQuery(
      <WeeklyFeedbackPrompt api={mockApi} enabled />,
    );

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/How's Fintr going this week/i)).toBeInTheDocument();

    rerender(<WeeklyFeedbackPrompt api={mockApi} enabled={false} />);

    expect(screen.queryByText(/How's Fintr going this week/i)).not.toBeInTheDocument();
  });
});
