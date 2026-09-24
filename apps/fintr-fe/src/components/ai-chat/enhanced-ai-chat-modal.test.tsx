import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import EnhancedAiChatModal from "./enhanced-ai-chat-modal";

const proState = vi.hoisted(() => ({
  data: undefined as
    | {
        pro: boolean;
        source: string;
        trialDaysRemaining: number;
      }
    | undefined,
  isPending: false,
}));

vi.mock("@/hooks/async/useAiChat", () => ({
  useAiChat: () => ({
    messages: [],
    isLoading: false,
    error: null,
    currentStreamingMessage: "",
    isStreaming: false,
    currentConversationId: null,
    currentStreamingCharts: [],
    currentStreamingSegments: [],
    hasIncompleteChart: false,
    incompleteChartType: null,
    sendMessage: vi.fn(),
    cancelStreaming: vi.fn(),
    loadConversation: vi.fn(),
    startNewConversation: vi.fn(),
    setCurrentConversationId: vi.fn(),
    setChatState: vi.fn(),
  }),
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => proState,
}));

vi.mock("@/hooks/useAiLlmPriority", () => ({
  useAiLlmPriority: () => ({
    canChoose: false,
    priority: "cloud",
    setPriority: vi.fn(),
    localAvailable: false,
  }),
}));

vi.mock("@/hooks/async/useConversations", () => ({
  useConversations: () => ({
    fetchConversation: vi.fn(),
    createNewConversation: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock("@/hooks/async/useInfiniteMessages", () => ({
  useInfiniteMessages: () => ({
    messages: [],
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    setHasUserScrolled: vi.fn(),
  }),
}));

describe("EnhancedAiChatModal", () => {
  beforeEach(() => {
    proState.data = { pro: false, source: "none", trialDaysRemaining: 0 };
    proState.isPending = false;
  });

  it("requires Fintr Pro before someone can chat", () => {
    render(<EnhancedAiChatModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText("Fintr Pro is required for AI chat")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Fintr AI anything...")).toBeDisabled();
  });

  it("shows the monthly cap for a Fintr Pro user", () => {
    proState.data = { pro: true, source: "subscription", trialDaysRemaining: 0 };

    render(<EnhancedAiChatModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText("30 AI chats per month")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Fintr AI anything...")).toBeEnabled();
  });
});
