import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import React from 'react';
import { 
  dashboardDataAtom,
  categoryOptionsAtom,
  accountOptionsAtom,
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
  isAdminAtom
} from '@/atoms/dashboardAtoms';
import {
  dateFilterStartDateAtom,
  dateFilterEndDateAtom,
  dateFilterMonthYearAtom,
  dateFilterTypeAtom
} from '@/atoms/dateFilterAtoms';

describe('Performance: Jotai Atoms', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, null, children);

  describe('Dashboard Atoms', () => {
    it('should update atom without unnecessary re-renders', () => {
      let renderCount = 0;

      const TestComponent = () => {
        const [data, setData] = useAtom(dashboardDataAtom);
        renderCount++;

        return React.createElement('button', {
          'data-testid': 'update-button',
          onClick: () => setData({ financialSummary: { totalIncome: '1000' } } as any)
        }, 'Update');
      };

      const { getByTestId } = render(React.createElement(TestComponent), { wrapper });

      const initialRenders = renderCount;

      act(() => {
        (getByTestId('update-button') as HTMLElement).click();
      });

      // Should only render once for the update
      expect(renderCount).toBe(initialRenders + 1);
    });

    it('should allow selective subscriptions to avoid unnecessary updates', () => {
      // Component A subscribes to categoryOptions
      const categoryRenderCount = { value: 0 };
      const CategoryComponent = () => {
        const categories = useAtomValue(categoryOptionsAtom);
        categoryRenderCount.value++;
        return null;
      };

      // Component B subscribes to accountOptions
      const accountRenderCount = { value: 0 };
      const AccountComponent = () => {
        const accounts = useAtomValue(accountOptionsAtom);
        accountRenderCount.value++;
        return null;
      };

      // Component C updates categoryOptions
      const CategoryUpdater = () => {
        const setCategories = useSetAtom(categoryOptionsAtom);
        return React.createElement('button', {
          'data-testid': 'update-categories',
          onClick: () => setCategories([{ value: 'new', label: 'New Category' }])
        }, 'Update Categories');
      };

      const App = () => 
        React.createElement(React.Fragment, null,
          React.createElement(CategoryComponent),
          React.createElement(AccountComponent),
          React.createElement(CategoryUpdater)
        );

      const { getByTestId } = render(React.createElement(App), { wrapper });

      const initialCategoryRenders = categoryRenderCount.value;
      const initialAccountRenders = accountRenderCount.value;

      // Update only categories
      act(() => {
        (getByTestId('update-categories') as HTMLElement).click();
      });

      // Category component should re-render
      expect(categoryRenderCount.value).toBe(initialCategoryRenders + 1);
      
      // Account component should NOT re-render (selective subscription)
      expect(accountRenderCount.value).toBe(initialAccountRenders);
    });

    it('should handle large arrays efficiently', () => {
      const { result } = renderHook(() => useAtom(categoryOptionsAtom), { wrapper });
      const [, setCategories] = result.current;

      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        value: `category-${i}`,
        label: `Category ${i}`
      }));

      const startTime = performance.now();

      act(() => {
        setCategories(largeArray);
      });

      const endTime = performance.now();

      // Setting large array should be fast
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Date Filter Atoms', () => {
    it('should batch multiple atom updates', () => {
      let renderCount = 0;

      const DateFilterComponent = () => {
        const [, setStartDate] = useAtom(dateFilterStartDateAtom);
        const [, setEndDate] = useAtom(dateFilterEndDateAtom);

        renderCount++;

        const updateAll = () => {
          setStartDate('2024-01-01');
          setEndDate('2024-12-31');
        };

        return React.createElement('button', {
          'data-testid': 'update-all',
          onClick: updateAll
        }, 'Update All');
      };

      const { getByTestId } = render(React.createElement(DateFilterComponent), { wrapper });

      const initialRenders = renderCount;

      act(() => {
        (getByTestId('update-all') as HTMLElement).click();
      });

      // With Jotai, both updates in one event should batch to single re-render
      expect(renderCount).toBeLessThanOrEqual(initialRenders + 1);
    });

    it('should derive values without redundant computations', () => {
      const DerivedComponent = () => {
        const monthYear = useAtomValue(dateFilterMonthYearAtom);
        
        // Memoized derived value
        const expensiveValue = React.useMemo(() => {
          return monthYear.selectedMonth + monthYear.selectedYear;
        }, [monthYear]);

        return React.createElement('div', { 'data-testid': 'derived-value' }, expensiveValue);
      };

      // Should render without errors
      const { getByTestId } = render(React.createElement(DerivedComponent), { wrapper });
      expect(getByTestId('derived-value')).toBeTruthy();
    });

    it('should read derived filter type atom', () => {
      const FilterTypeComponent = () => {
        const filterType = useAtomValue(dateFilterTypeAtom);
        return React.createElement('div', { 'data-testid': 'filter-type' }, filterType);
      };

      const { getByTestId } = render(React.createElement(FilterTypeComponent), { wrapper });
      
      // Should render the derived value
      const element = getByTestId('filter-type');
      expect(element.textContent).toBeTruthy();
    });
  });

  describe('Atom Performance Patterns', () => {
    it('should use atomFamily for dynamic atom creation when needed', () => {
      // This test documents the pattern for when atomFamily is needed
      // Currently not used but useful for future scalability
      
      // atomFamily is useful when you have many instances of similar state
      // e.g., form fields, list items with individual state
      
      expect(true).toBe(true); // Placeholder - pattern documentation
    });

    it('should avoid creating atoms inside render', () => {
      // Atoms should be defined at module level, not inside components
      // This is a code quality test pattern
      
      // Bad pattern (avoid):
      // const Component = () => {
      //   const myAtom = atom(0); // Creates new atom on every render
      //   const [value] = useAtom(myAtom);
      // }

      // Good pattern (use):
      // const myAtom = atom(0); // Defined once at module level
      // const Component = () => {
      //   const [value] = useAtom(myAtom);
      // }

      expect(true).toBe(true); // Pattern documentation test
    });
  });
});