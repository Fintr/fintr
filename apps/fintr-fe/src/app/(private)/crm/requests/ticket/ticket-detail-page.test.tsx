import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockSearchParamGet = vi.fn<string | null, [string]>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamGet(key),
  }),
}));

vi.mock("@/hooks/async/useTickets", () => ({
  useTicket: vi.fn(),
  useCreateTicketResponse: vi.fn(),
  useUpdateAdminTicket: vi.fn(),
}));

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: vi.fn(),
  };
});

vi.mock("@/components/crm/ImageGallery", () => ({
  default: () => null,
}));

vi.mock("@/components/crm/ImageUploadInput", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/expandable-textarea", () => ({
  default: () => <textarea data-testid="expandable-textarea-mock" readOnly />,
}));

import TicketDetailPage from "./ticket-detail-page";
import {
  useTicket,
  useCreateTicketResponse,
  useUpdateAdminTicket,
} from "@/hooks/async/useTickets";
import { useAtomValue } from "jotai";

describe("TicketDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAtomValue).mockReturnValue(false);
    vi.mocked(useCreateTicketResponse).mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false,
    } as ReturnType<typeof useCreateTicketResponse>);
    vi.mocked(useUpdateAdminTicket).mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false,
    } as ReturnType<typeof useUpdateAdminTicket>);
  });

  it("shows guidance when the id query param is missing", () => {
    mockSearchParamGet.mockReturnValue(null);
    vi.mocked(useTicket).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTicket>);

    render(<TicketDetailPage />);

    expect(screen.getByText(/missing a ticket id/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to tickets/i })).toHaveAttribute(
      "href",
      "/crm/requests",
    );
  });

  it("treats whitespace-only id as missing after trim", () => {
    mockSearchParamGet.mockImplementation((key) => (key === "id" ? "   " : null));
    vi.mocked(useTicket).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTicket>);

    render(<TicketDetailPage />);

    expect(screen.getByText(/missing a ticket id/i)).toBeInTheDocument();
  });

  it("shows a loading indicator while the ticket is loading", () => {
    mockSearchParamGet.mockImplementation((key) =>
      key === "id" ? "cd6098bb-7c4c-47d5-80ab-38bcb23e83e1" : null,
    );
    vi.mocked(useTicket).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTicket>);

    render(<TicketDetailPage />);

    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders the ticket title when the ticket loads", () => {
    mockSearchParamGet.mockImplementation((key) =>
      key === "id" ? "cd6098bb-7c4c-47d5-80ab-38bcb23e83e1" : null,
    );
    vi.mocked(useTicket).mockReturnValue({
      data: {
        title: "Billing question",
        status: "open",
        priority: "medium",
        ticketType: "general",
        userName: "Test User",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
        description: "Hello",
        images: [],
        responses: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTicket>);

    render(<TicketDetailPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Billing question" }),
    ).toBeInTheDocument();
  });

  it("shows an error panel when the ticket request fails", () => {
    mockSearchParamGet.mockImplementation((key) =>
      key === "id" ? "cd6098bb-7c4c-47d5-80ab-38bcb23e83e1" : null,
    );
    vi.mocked(useTicket).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as ReturnType<typeof useTicket>);

    render(<TicketDetailPage />);

    expect(screen.getByText(/failed to load ticket/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
