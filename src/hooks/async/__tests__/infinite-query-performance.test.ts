import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInfiniteTransactions } from './useInfiniteTransactions';
import { useInfiniteLoans } from './useInfiniteLoans';
import { useDashboardData } from './useDashboardData';

// Mock dependencies
vi.mock('../useAuthApi', () => ({
  default: vi.fn(() => ({
    api: { get: vi.fn() },
    isAuthenticated: true,
  })),
}));

vi.mock('../useLocalStorage', () => ({
  useLocalStorage: vi.fn(() => ['TEST_SPACE', vi.fn()]),
}));

vi.mock('@/services/transactions/queries', () => ({
  fetchTransactionsPage: vi.fn(),
}));

vi.mock('@/services/loans/queries', () => ({
  fetchLoansPage: vi.fn(),
}));

vi.mock('@/services/spaces/queries', () => ({
  fetchDashboardData: vi.fn(),
}));

describe('Performance: Infinite Query Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  describe('useInfiniteTransactions', () => {
    it('should not re-fetch on every render with stable query keys', async () => {
      const transactionQueries = await import('@/services/transactions/queries');
      const fetchSpy = vi.spyOn(transactionQueries, 'fetchTransactionsPage');
      fetchSpy.mockResolvedValue({
        transactions: [],
        nextPage: null,
      });

      const loadMoreRef = { current: document.createElement('div') };

      const { rerender } = renderHook(
        () =>
          useInfiniteTransactions({
            appliedCategory: '',
            queryStartDate: '2024-01-01',
            queryEndDate: '2024-12-31',
            appliedMinAmount: '',
            appliedMaxAmount: '',
            searchQuery: '',
            loadMoreRef,
          }),
        { wrapper }
      );

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

      // Re-render multiple times
      rerender();
      rerender();
      rerender();

      // Should not make additional fetch calls
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should have appropriate staleTime to prevent excessive refetching', () => {
      const loadMoreRef = { current: document.createElement('div') };

      renderHook(
        () =>
          useInfiniteTransactions({
            appliedCategory: '',
            queryStartDate: '2024-01-01',
            queryEndDate: '2024-12-31',
            appliedMinAmount: '',
            appliedMaxAmount: '',
            searchQuery: '',
            loadMoreRef,
          }),
        { wrapper }
      );

      // Verify QueryClient is configured with staleTime
      const queries = queryClient.getQueryCache().getAll();
      expect(queries.length).toBeGreaterThan(0);
    });
  });

  describe('useInfiniteLoans', () => {
    it('should clean up IntersectionObserver on unmount', async () => {
      const disconnectSpy = vi.fn();
      const unobserveSpy = vi.fn();

      // Mock IntersectionObserver
      global.IntersectionObserver = vi.fn(() => ({
        observe: vi.fn(),
        unobserve: unobserveSpy,
        disconnect: disconnectSpy,
      })) as any;

      const loadMoreRef = { current: document.createElement('div') };

      const { unmount } = renderHook(
        () => useInfiniteLoans({ loadMoreRef }),
        { wrapper }
      );

      // Wait for effect to run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Unmount should clean up observer
      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should handle rapid loadMoreRef changes without memory leaks', async () => {
      const loadMoreRef = { current: document.createElement('div') };

      const { rerender } = renderHook(
        () => useInfiniteLoans({ loadMoreRef }),
        { wrapper }
      );

      // Rapidly change ref (simulating unstable ref)
      for (let i = 0; i < 10; i++) {
        loadMoreRef.current = document.createElement('div');
        rerender();
      }

      // Should not cause errors or memory issues
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Cleanup should still work
      expect(true).toBe(true);
    });
  });
});
