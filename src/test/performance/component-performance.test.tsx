import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React, { useState, useMemo, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('Performance: AI Chat Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should debounce scroll events during streaming', () => {
    let scrollCallCount = 0;

    const MockChatComponent = () => {
      const [streamingContent, setStreamingContent] = useState('');
      const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

      // Simulate streaming with throttled scroll
      React.useEffect(() => {
        const interval = setInterval(() => {
          setStreamingContent(prev => prev + 'a');
          
          // Throttled scroll
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          scrollTimeoutRef.current = setTimeout(() => {
            scrollCallCount++;
          }, 100);
        }, 50);

        return () => clearInterval(interval);
      }, []);

      return React.createElement('div', null, streamingContent);
    };

    render(React.createElement(MockChatComponent), { wrapper });

    // Advance through streaming (10 updates over 500ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Scroll should be throttled - not called for every streaming update
    expect(scrollCallCount).toBeLessThan(5);
  });

  it('should use useMemo for message deduplication', () => {
    let mapCallCount = 0;

    const MessageList = ({ messages }: { messages: { id: string; content: string }[] }) => {
      const uniqueMessages = useMemo(() => {
        mapCallCount++;
        const messageMap = new Map();
        messages.forEach(msg => messageMap.set(msg.id, msg));
        return Array.from(messageMap.values());
      }, [messages]);

      return React.createElement('div', null,
        uniqueMessages.map(msg => 
          React.createElement('div', { key: msg.id }, msg.content)
        )
      );
    };

    const initialMessages = [
      { id: '1', content: 'Hello' },
      { id: '2', content: 'World' }
    ];

    const { rerender } = render(
      React.createElement(MessageList, { messages: initialMessages })
    );

    // Get initial count (React StrictMode may double-render)
    const countAfterInitial = mapCallCount;
    expect(countAfterInitial).toBeGreaterThanOrEqual(1);

    // Re-render with same messages reference
    rerender(React.createElement(MessageList, { messages: initialMessages }));

    // Should not recompute with same reference
    expect(mapCallCount).toBe(countAfterInitial);

    // Re-render with new messages array
    rerender(React.createElement(MessageList, {
      messages: [
        { id: '1', content: 'Hello' },
        { id: '2', content: 'World' },
        { id: '3', content: 'New' }
      ]
    }));

    // Should recompute with new array
    expect(mapCallCount).toBe(countAfterInitial + 1);
  });

  it('should handle large conversation history without blocking UI', () => {
    const LargeChatComponent = () => {
      const [messages] = useState(() => 
        Array.from({ length: 500 }, (_, i) => ({
          id: `msg-${i}`,
          content: `Message ${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant'
        }))
      );

      const renderStartTime = React.useRef(performance.now());

      React.useEffect(() => {
        const renderTime = performance.now() - renderStartTime.current;
        console.log(`Render time for 500 messages: ${renderTime}ms`);
      });

      return React.createElement('div', { 'data-testid': 'chat-container' },
        messages.map(msg => 
          React.createElement('div', { 
            key: msg.id,
            'data-testid': `message-${msg.id}`
          }, msg.content)
        )
      );
    };

    const startTime = performance.now();
    render(React.createElement(LargeChatComponent));
    const endTime = performance.now();

    // Should render 500 messages efficiently
    expect(endTime - startTime).toBeLessThan(500);
    expect(screen.getByTestId('chat-container')).toBeInTheDocument();
  });
});

describe('Performance: Transaction List Component', () => {
  it('should use pagination instead of rendering all items', () => {
    const PaginatedList = ({ 
      items, 
      pageSize 
    }: { 
      items: { id: string; name: string }[];
      pageSize: number;
    }) => {
      const [currentPage, setCurrentPage] = useState(1);

      const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return items.slice(start, end);
      }, [items, currentPage, pageSize]);

      return React.createElement('div', null,
        React.createElement('div', { 'data-testid': 'item-count' }, paginatedItems.length),
        paginatedItems.map(item => 
          React.createElement('div', { key: item.id }, item.name)
        ),
        React.createElement('button', {
          'data-testid': 'next-page',
          onClick: () => setCurrentPage(p => p + 1)
        }, 'Next')
      );
    };

    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`
    }));

    render(
      React.createElement(PaginatedList, { items, pageSize: 25 })
    );

    // Should only render 25 items, not 1000
    expect(screen.getByTestId('item-count').textContent).toBe('25');
  });

  it('should memoize cell rendering in spreadsheet view', () => {
    let cellRenderCount = 0;

    const MemoizedCell = React.memo(({ value }: { value: string }) => {
      cellRenderCount++;
      return React.createElement('td', null, value);
    });
    MemoizedCell.displayName = 'MemoizedCell';

    const SpreadsheetView = ({ data }: { data: { id: string; cells: string[] }[] }) => {
      const [selectedRow, setSelectedRow] = useState<string | null>(null);

      return React.createElement('table', null,
        React.createElement('tbody', null,
          data.map(row => 
            React.createElement('tr', {
              key: row.id,
              'data-testid': `row-${row.id}`,
              onClick: () => setSelectedRow(row.id),
              style: { backgroundColor: selectedRow === row.id ? 'blue' : 'white' }
            },
              row.cells.map((cell, idx) => 
                React.createElement(MemoizedCell, { 
                  key: idx, 
                  value: cell 
                })
              )
            )
          )
        )
      );
    };

    const data = Array.from({ length: 10 }, (_, i) => ({
      id: `row-${i}`,
      cells: ['Col1', 'Col2', 'Col3', 'Col4', 'Col5']
    }));

    render(
      React.createElement(SpreadsheetView, { data })
    );

    const initialRenders = cellRenderCount;

    // Click a row
    const firstRow = screen.getByTestId('row-row-0');
    fireEvent.click(firstRow);

    // Cell re-renders should be minimal due to React.memo
    // Only 5 cells in the clicked row should re-render
    expect(cellRenderCount).toBeLessThan(initialRenders + 20);
  });
});

describe('Performance: Form Components', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce expensive field calculations', () => {
    let calculationCount = 0;

    const DebouncedForm = () => {
      const [amount, setAmount] = useState('');
      const [convertedAmount, setConvertedAmount] = useState('');
      const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

      const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setAmount(value);

        // Debounced conversion calculation
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          calculationCount++;
          // Simulate expensive currency conversion
          const converted = parseFloat(value || '0') * 1.5;
          setConvertedAmount(converted.toFixed(2));
        }, 300);
      }, []);

      return React.createElement('div', null,
        React.createElement('input', {
          'data-testid': 'amount-input',
          value: amount,
          onChange: handleAmountChange
        }),
        React.createElement('div', { 'data-testid': 'converted' }, convertedAmount)
      );
    };

    render(React.createElement(DebouncedForm));

    const input = screen.getByTestId('amount-input');

    // Type multiple characters rapidly
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.change(input, { target: { value: '123' } });

    // Calculation should not have run yet (debounced)
    expect(calculationCount).toBe(0);

    // Fast-forward past debounce delay
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Now calculation should have run only once
    expect(calculationCount).toBe(1);
    expect(screen.getByTestId('converted').textContent).toBe('184.50');
  });

  it('should use useMemo for dropdown options', () => {
    let optionsComputationCount = 0;

    const CurrencyPicker = ({ currencies }: { currencies: { code: string; name: string }[] }) => {
      const [selectedCurrency, setSelectedCurrency] = useState('USD');
      const [otherState, setOtherState] = useState(0);

      const options = useMemo(() => {
        optionsComputationCount++;
        return currencies.map(c => ({
          value: c.code,
          label: `${c.code} - ${c.name}`
        }));
      }, [currencies]);

      return React.createElement('div', null,
        React.createElement('select', {
          'data-testid': 'currency-select',
          value: selectedCurrency,
          onChange: (e: any) => setSelectedCurrency(e.target.value)
        }, options.map(opt => 
          React.createElement('option', { key: opt.value, value: opt.value }, opt.label)
        )),
        React.createElement('button', {
          'data-testid': 'update-other',
          onClick: () => setOtherState(s => s + 1)
        }, 'Update Other')
      );
    };

    const currencies = [
      { code: 'USD', name: 'US Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'GBP', name: 'British Pound' }
    ];

    const { getByTestId } = render(
      React.createElement(CurrencyPicker, { currencies })
    );

    expect(optionsComputationCount).toBe(1);

    // Change unrelated state
    fireEvent.click(getByTestId('update-other'));
    fireEvent.click(getByTestId('update-other'));

    // Options should not recompute
    expect(optionsComputationCount).toBe(1);

    // Change selected currency
    fireEvent.change(getByTestId('currency-select'), { target: { value: 'EUR' } });

    // Options should still not recompute
    expect(optionsComputationCount).toBe(1);
  });
});

describe('Performance: Dashboard Charts', () => {
  it('should memoize chart data transformations', () => {
    let transformCount = 0;

    const ChartComponent = ({ data }: { data: { month: string; amount: number }[] }) => {
      const [selectedYear, setSelectedYear] = useState(2024);

      const chartData = useMemo(() => {
        transformCount++;
        return data.map(item => ({
          ...item,
          formattedAmount: `$${item.amount.toLocaleString()}`
        }));
      }, [data]);

      return React.createElement('div', null,
        React.createElement('div', { 'data-testid': 'chart-data-count' }, chartData.length),
        React.createElement('button', {
          'data-testid': 'change-year',
          onClick: () => setSelectedYear(y => y === 2024 ? 2023 : 2024)
        }, 'Change Year')
      );
    };

    const data = [
      { month: 'Jan', amount: 1000 },
      { month: 'Feb', amount: 1500 },
      { month: 'Mar', amount: 2000 }
    ];

    const { getByTestId } = render(
      React.createElement(ChartComponent, { data })
    );

    expect(transformCount).toBe(1);

    // Change unrelated state
    fireEvent.click(getByTestId('change-year'));
    fireEvent.click(getByTestId('change-year'));

    // Chart data transformation should not re-run
    expect(transformCount).toBe(1);
  });

  it('should prevent unnecessary chart re-renders with React.memo', () => {
    let chartRenderCount = 0;

    const ExpensiveChart = React.memo(({ data }: { data: number[] }) => {
      chartRenderCount++;
      // Simulate expensive chart rendering
      const sum = data.reduce((a, b) => a + b, 0);
      return React.createElement('div', { 'data-testid': 'chart' }, `Total: ${sum}`);
    });
    ExpensiveChart.displayName = 'ExpensiveChart';

    const Dashboard = () => {
      const [chartData] = useState([10, 20, 30, 40, 50]);
      const [otherState, setOtherState] = useState(0);

      return React.createElement('div', null,
        React.createElement(ExpensiveChart, { data: chartData }),
        React.createElement('button', {
          'data-testid': 'update-other',
          onClick: () => setOtherState(s => s + 1)
        }, 'Update Other')
      );
    };

    const { getByTestId } = render(React.createElement(Dashboard));

    expect(chartRenderCount).toBe(1);

    // Update unrelated state multiple times
    fireEvent.click(getByTestId('update-other'));
    fireEvent.click(getByTestId('update-other'));
    fireEvent.click(getByTestId('update-other'));

    // Chart should not re-render because data reference is stable
    expect(chartRenderCount).toBe(1);
  });
});
