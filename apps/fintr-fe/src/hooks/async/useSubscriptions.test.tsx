import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSubscriptionPlans,
  useCurrentSubscription,
  useCreateSubscription,
  useCancelSubscription,
  useCreateSponsorSubscription,
} from "./useSubscriptions";
import * as queries from "@/services/finance/subscriptions/queries";
import * as mutations from "@/services/finance/subscriptions/mutations";

// Mock the dependencies
vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: vi.fn().mockReturnValue({
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    getToken: vi.fn().mockResolvedValue("mock-token"),
  }),
}));

vi.mock("@/services/finance/subscriptions/queries", () => ({
  fetchSubscriptionPlans: vi.fn(),
  fetchCurrentSubscription: vi.fn(),
}));

vi.mock("@/services/finance/subscriptions/mutations", () => ({
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  createSponsorSubscription: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe("useSubscriptions hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useSubscriptionPlans", () => {
    it("fetches subscription plans successfully", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Starter",
          slug: "starter",
          tokenLimit: 100,
          priceCents: 9900,
          priceCurrency: "PHP",
          interval: "month",
          active: true,
        },
      ];

      vi.mocked(queries.fetchSubscriptionPlans).mockResolvedValue(mockPlans);

      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper });

      await waitFor(() => {
        expect(result.current.plans).toEqual(mockPlans);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("useCurrentSubscription", () => {
    it("fetches current subscriptions successfully", async () => {
      const mockSubscriptions = [
        {
          id: "sub-1",
          subscriptionPlan: {
            id: "plan-1",
            name: "Starter",
            slug: "starter",
            tokenLimit: 100,
            priceCents: 9900,
            priceCurrency: "PHP",
            interval: "month",
            active: true,
          },
          status: "active",
          subscriptionType: "paid",
          isSponsorSubscription: false,
          currentCycleCount: 1,
          startedAt: "2024-01-01T00:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(queries.fetchCurrentSubscription).mockResolvedValue(mockSubscriptions);

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.subscriptions).toEqual(mockSubscriptions);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("handles sponsor subscriptions correctly", async () => {
      const mockSubscriptions = [
        {
          id: "sub-1",
          subscriptionPlan: {
            id: "plan-1",
            name: "Pro",
            slug: "pro",
            tokenLimit: 300,
            priceCents: 29900,
            priceCurrency: "PHP",
            interval: "month",
            active: true,
          },
          status: "active",
          subscriptionType: "sponsor",
          isSponsorSubscription: true,
          sponsorMetadata: {
            sponsorCode: "TECH_CORP_2024",
            sponsorNotes: "Jane from TechCorp",
            createdBy: "admin-1",
          },
          currentCycleCount: 1,
          startedAt: "2024-01-01T00:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(queries.fetchCurrentSubscription).mockResolvedValue(mockSubscriptions);

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper });

      await waitFor(() => {
        expect(result.current.subscriptions[0].isSponsorSubscription).toBe(true);
        expect(result.current.subscriptions[0].subscriptionType).toBe("sponsor");
      });
    });
  });

  describe("useCreateSubscription", () => {
    it("creates a subscription successfully", async () => {
      const mockResponse = {
        subscription: {
          id: "sub-1",
          status: "active",
        },
        actionUrl: "https://example.com/action",
        status: "ACTIVE",
      };

      vi.mocked(mutations.createSubscription).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCreateSubscription(), { wrapper });

      await result.current.createSubscription({
        subscriptionPlanId: "plan-1",
      });

      await waitFor(() => {
        expect(mutations.createSubscription).toHaveBeenCalled();
      });
    });
  });

  describe("useCreateSponsorSubscription", () => {
    it("creates a sponsor subscription successfully", async () => {
      const mockResponse = {
        subscription: {
          id: "sub-1",
          status: "active",
          subscriptionType: "sponsor",
          isSponsorSubscription: true,
          sponsorMetadata: {
            sponsorCode: "TECH_CORP_2024",
            sponsorNotes: "Jane from TechCorp",
            createdBy: "admin-1",
          },
        },
      };

      vi.mocked(mutations.createSponsorSubscription).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCreateSponsorSubscription(), { wrapper });

      await result.current.createSponsorSubscription({
        spaceId: "space-123",
        subscriptionPlanId: "plan-1",
        sponsorCode: "TECH_CORP_2024",
        sponsorNotes: "Jane from TechCorp",
      });

      await waitFor(() => {
        expect(mutations.createSponsorSubscription).toHaveBeenCalledWith(
          expect.any(Object),
          {
            spaceId: "space-123",
            subscriptionPlanId: "plan-1",
            sponsorCode: "TECH_CORP_2024",
            sponsorNotes: "Jane from TechCorp",
          }
        );
      });
    });

    it("creates a sponsor subscription without optional fields", async () => {
      const mockResponse = {
        subscription: {
          id: "sub-1",
          status: "active",
          subscriptionType: "sponsor",
          isSponsorSubscription: true,
        },
      };

      vi.mocked(mutations.createSponsorSubscription).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCreateSponsorSubscription(), { wrapper });

      await result.current.createSponsorSubscription({
        spaceId: "space-123",
        subscriptionPlanId: "plan-1",
      });

      await waitFor(() => {
        expect(mutations.createSponsorSubscription).toHaveBeenCalledWith(
          expect.any(Object),
          {
            spaceId: "space-123",
            subscriptionPlanId: "plan-1",
          }
        );
      });
    });
  });

  describe("useCancelSubscription", () => {
    it("cancels a subscription successfully", async () => {
      const mockResponse = {
        subscription: {
          id: "sub-1",
          status: "inactive",
        },
      };

      vi.mocked(mutations.cancelSubscription).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCancelSubscription(), { wrapper });

      await result.current.cancelSubscription("sub-1");

      await waitFor(() => {
        expect(mutations.cancelSubscription).toHaveBeenCalledWith(
          expect.any(Object),
          "sub-1"
        );
      });
    });
  });
});
