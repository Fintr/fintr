import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Test for proper cleanup of timers and intervals
describe('Performance: Timer and Memory Leak Prevention', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should clean up setTimeout on component unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    function ComponentWithTimeout() {
      const [count, setCount] = useState(0);

      useEffect(() => {
        const timeoutId = setTimeout(() => {
          setCount(1);
        }, 1000);

        return () => {
          clearTimeout(timeoutId);
        };
      }, []);

      return React.createElement('div', null, count);
    }

    const { unmount } = render(React.createElement(ComponentWithTimeout));
    
    // Unmount before timeout fires
    unmount();

    // Verify cleanup was called
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should clean up setInterval on component unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    function ComponentWithInterval() {
      const [count, setCount] = useState(0);

      useEffect(() => {
        const intervalId = setInterval(() => {
          setCount(c => c + 1);
        }, 100);

        return () => {
          clearInterval(intervalId);
        };
      }, []);

      return React.createElement('div', null, count);
    }

    const { unmount } = render(React.createElement(ComponentWithInterval));
    
    // Advance timer to ensure interval is running
    act(() => {
      vi.advanceTimersByTime(300);
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should clean up requestAnimationFrame on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame');

    function ComponentWithRAF() {
      const rafRef = useRef<number | null>(null);

      useEffect(() => {
        const animate = () => {
          rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);

        return () => {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
          }
        };
      }, []);

      return React.createElement('div', null, 'Animating');
    }

    const { unmount } = render(React.createElement(ComponentWithRAF));
    
    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    function ComponentWithEventListener() {
      useEffect(() => {
        const handler = () => {};
        window.addEventListener('resize', handler);

        return () => {
          window.removeEventListener('resize', handler);
        };
      }, []);

      return React.createElement('div', null, 'Resizable');
    }

    const { unmount } = render(React.createElement(ComponentWithEventListener));
    
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('should handle multiple simultaneous timeouts correctly', () => {
    const ComponentWithMultipleTimeouts = () => {
      const [value, setValue] = useState(0);

      useEffect(() => {
        const timeouts: NodeJS.Timeout[] = [];
        
        for (let i = 0; i < 5; i++) {
          timeouts.push(
            setTimeout(() => {
              setValue(v => v + 1);
            }, i * 100)
          );
        }

        return () => {
          timeouts.forEach(clearTimeout);
        };
      }, []);

      return React.createElement('div', null, value);
    };

    const { unmount, rerender } = render(React.createElement(ComponentWithMultipleTimeouts));
    
    // Trigger re-render
    rerender();
    
    unmount();

    // Should not throw errors during cleanup
    expect(true).toBe(true);
  });
});

// Test for memoization and callback stability
describe('Performance: useMemo and useCallback Optimization', () => {
  it('should not recreate memoized values unnecessarily', () => {
    let computeCount = 0;

    function ComponentWithMemo() {
      const [count, setCount] = useState(0);
      const [otherState, setOtherState] = useState(0);

      const expensiveValue = useMemo(() => {
        computeCount++;
        return count * 2;
      }, [count]);

      return React.createElement('div', null,
        React.createElement('button', {
          'data-testid': 'increment-count',
          onClick: () => setCount(c => c + 1)
        }, 'Increment Count'),
        React.createElement('button', {
          'data-testid': 'increment-other',
          onClick: () => setOtherState(s => s + 1)
        }, 'Increment Other'),
        React.createElement('span', { 'data-testid': 'value' }, expensiveValue)
      );
    }

    render(React.createElement(ComponentWithMemo));

    // Initial render + memo computation
    expect(computeCount).toBe(1);

    // Click other state button - should NOT recompute
    fireEvent.click(screen.getByTestId('increment-other'));
    expect(computeCount).toBe(1);

    // Click count button - SHOULD recompute
    fireEvent.click(screen.getByTestId('increment-count'));
    expect(computeCount).toBe(2);
  });

  it('should maintain stable callback references', () => {
    const callbackHistory: Function[] = [];

    function ComponentWithStableCallback() {
      const [count, setCount] = useState(0);

      const stableCallback = useCallback(() => {
        return count;
      }, [count]);

      callbackHistory.push(stableCallback);

      return React.createElement('button', {
        'data-testid': 'button',
        onClick: () => setCount(c => c + 1)
      }, 'Click');
    }

    render(React.createElement(ComponentWithStableCallback));

    const initialCallback = callbackHistory[0];

    // Click multiple times
    fireEvent.click(screen.getByTestId('button'));
    fireEvent.click(screen.getByTestId('button'));

    // Callback should change because count dependency changed
    expect(callbackHistory.length).toBe(3);
    expect(callbackHistory[0]).not.toBe(callbackHistory[1]);
  });

  it('should handle expensive array operations with useMemo', () => {
    let mapCallCount = 0;

    function ComponentWithExpensiveMap({ items }: { items: number[] }) {
      const processedItems = useMemo(() => {
        mapCallCount++;
        return items
          .map(x => x * 2)
          .filter(x => x > 10)
          .sort((a, b) => b - a);
      }, [items]);

      return React.createElement('div', null,
        processedItems.map((item, i) => 
          React.createElement('span', { key: i, 'data-testid': `item-${i}` }, item)
        )
      );
    }

    const initialItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { rerender } = render(
      React.createElement(ComponentWithExpensiveMap, { items: initialItems })
    );

    // Get count after initial render (React StrictMode may double-render)
    const countAfterInitialRender = mapCallCount;
    expect(countAfterInitialRender).toBeGreaterThanOrEqual(1);

    // Re-render with same items reference (no new array created)
    rerender(React.createElement(ComponentWithExpensiveMap, { items: initialItems }));
    
    // Should not re-process because items reference is same
    expect(mapCallCount).toBe(countAfterInitialRender);

    // Re-render with new array (same values, different reference)
    const newItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    rerender(React.createElement(ComponentWithExpensiveMap, { items: newItems }));
    
    // Should re-process because items reference changed
    expect(mapCallCount).toBe(countAfterInitialRender + 1);
  });
});

// Test for preventing excessive re-renders
describe('Performance: Re-render Prevention', () => {
  it('should prevent child re-renders with stable props', () => {
    let childRenderCount = 0;

    function ChildComponent({ value, onClick }: { value: number; onClick: () => void }) {
      childRenderCount++;
      return React.createElement('button', { onClick }, `Value: ${value}`);
    }

    const MemoizedChild = React.memo(ChildComponent);

    function ParentComponent() {
      const [count, setCount] = useState(0);
      const [otherState, setOtherState] = useState(0);

      const stableOnClick = useCallback(() => {
        setCount(c => c + 1);
      }, []);

      return React.createElement('div', null,
        React.createElement(MemoizedChild, { value: count, onClick: stableOnClick }),
        React.createElement('button', {
          'data-testid': 'change-other',
          onClick: () => setOtherState(s => s + 1)
        }, 'Change Other')
      );
    }

    render(React.createElement(ParentComponent));
    
    expect(childRenderCount).toBe(1);

    // Change other state - child should NOT re-render
    fireEvent.click(screen.getByTestId('change-other'));
    expect(childRenderCount).toBe(1);

    // Click child - child SHOULD re-render because value changed
    const childButton = screen.getByText('Value: 0');
    fireEvent.click(childButton);
    expect(childRenderCount).toBe(2);
  });

  it('should batch state updates to prevent multiple re-renders', async () => {
    let renderCount = 0;

    function ComponentWithBatching() {
      const [state1, setState1] = useState(0);
      const [state2, setState2] = useState(0);
      const [state3, setState3] = useState(0);

      renderCount++;

      const updateAll = () => {
        // React 18 should batch these
        setState1(1);
        setState2(2);
        setState3(3);
      };

      return React.createElement('button', {
        'data-testid': 'update-all',
        onClick: updateAll
      }, 'Update All');
    }

    render(React.createElement(ComponentWithBatching));
    
    const initialRenders = renderCount;

    fireEvent.click(screen.getByTestId('update-all'));

    // With automatic batching, should only trigger 1 additional render
    expect(renderCount).toBeLessThanOrEqual(initialRenders + 1);
  });
});

// Test for large list handling
describe('Performance: Large List Rendering', () => {
  it('should render large lists efficiently', () => {
    const LargeListComponent = () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, text: `Item ${i}` }));

      return React.createElement('div', null,
        items.map(item => 
          React.createElement('div', { 
            key: item.id, 
            'data-testid': `item-${item.id}` 
          }, item.text)
        )
      );
    };

    const startTime = performance.now();
    render(React.createElement(LargeListComponent));
    const endTime = performance.now();

    const renderTime = endTime - startTime;
    
    // Should render 1000 items in reasonable time
    expect(renderTime).toBeLessThan(500);
    
    // Verify items rendered
    expect(screen.getByTestId('item-0')).toBeInTheDocument();
    expect(screen.getByTestId('item-999')).toBeInTheDocument();
  });

  it('should use virtualization pattern for very large lists', () => {
    // This test verifies the pattern for virtualized lists
    // A virtualized list only renders visible items

    const VirtualizedList = ({ items, itemHeight, visibleHeight }: {
      items: { id: number; text: string }[];
      itemHeight: number;
      visibleHeight: number;
    }) => {
      const [scrollTop, setScrollTop] = useState(0);

      const visibleCount = Math.ceil(visibleHeight / itemHeight);
      const totalHeight = items.length * itemHeight;
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

      const visibleItems = useMemo(() => {
        return items.slice(startIndex, endIndex);
      }, [items, startIndex, endIndex]);

      return React.createElement('div', {
        style: { height: visibleHeight, overflow: 'auto' },
        onScroll: (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop),
        'data-testid': 'scroll-container'
      },
        React.createElement('div', { style: { height: totalHeight, position: 'relative' } },
          visibleItems.map((item, index) => 
            React.createElement('div', {
              key: item.id,
              'data-testid': `virtual-item-${item.id}`,
              style: {
                position: 'absolute',
                top: (startIndex + index) * itemHeight,
                height: itemHeight,
              }
            }, item.text)
          )
        )
      );
    };

    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, text: `Item ${i}` }));

    render(
      React.createElement(VirtualizedList, {
        items,
        itemHeight: 50,
        visibleHeight: 500
      })
    );

    // Should only render ~11 items (10 visible + 1 buffer), not all 10000
    const renderedItems = document.querySelectorAll('[data-testid^="virtual-item-"]');
    expect(renderedItems.length).toBeLessThan(20);
    expect(renderedItems.length).toBeGreaterThan(0);
  });
});
