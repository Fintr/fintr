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

import CrmSupportTicketPage from "./page";
import {
  useTicket,
  useCreateTicketResponse,
  useUpdateAdminTicket,
} from "@/hooks/async/useTickets";
import { useAtomValue } from "jotai";

describe("CrmSupportTicketPage", () => {
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

  it("renders the ticket detail through the Suspense boundary", async () => {
    mockSearchParamGet.mockImplementation((key) =>
      key === "id" ? "cd6098bb-7c4c-47d5-80ab-38bcb23e83e1" : null,
    );
    vi.mocked(useTicket).mockReturnValue({
      data: {
        title: "Shell test ticket",
        status: "open",
        priority: "low",
        ticketType: "general",
        userName: "User",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
        description: "Hi",
        images: [],
        responses: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTicket>);

    render(<CrmSupportTicketPage />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Shell test ticket" }),
    ).toBeInTheDocument();
  });
});
