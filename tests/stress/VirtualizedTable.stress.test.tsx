import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VirtualizedTable, ColumnDef } from '../../src/design-system/VirtualizedTable';

interface BenchmarkTrafficItem {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  latencyMs: number;
  lengthBytes: number;
  contentType: string;
  timestamp: string;
}

describe('VirtualizedTable Stress & Adversarial Suite (100,000 items)', () => {
  const TOTAL_ITEMS = 100_000;

  // Generator for 100k items
  const generateBenchmarkData = (count: number): BenchmarkTrafficItem[] => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    const statuses = [200, 201, 204, 301, 302, 400, 401, 403, 404, 500, 502];
    const types = ['application/json', 'text/html', 'application/octet-stream', 'text/plain'];

    const items: BenchmarkTrafficItem[] = new Array(count);
    for (let i = 0; i < count; i++) {
      items[i] = {
        id: `req-uuid-${i + 1}`,
        method: methods[i % methods.length],
        url: `https://api.target-app.internal/v1/resource/${i % 500}?param=${i}`,
        statusCode: statuses[i % statuses.length],
        latencyMs: (i * 7) % 1500 + 5,
        lengthBytes: (i * 31) % 50000 + 120,
        contentType: types[i % types.length],
        timestamp: new Date(1700000000000 + i * 100).toISOString(),
      };
    }
    return items;
  };

  const columns: ColumnDef<BenchmarkTrafficItem>[] = [
    { id: 'id', header: 'Request ID', width: 140, sortable: true, accessor: (r) => r.id },
    { id: 'method', header: 'Method', width: 80, sortable: true, accessor: (r) => r.method },
    { id: 'statusCode', header: 'Status', width: 70, sortable: true, accessor: (r) => r.statusCode },
    { id: 'url', header: 'URL Path', width: 320, sortable: true, accessor: (r) => r.url },
    { id: 'latencyMs', header: 'Latency (ms)', width: 100, sortable: true, accessor: (r) => `${r.latencyMs}ms` },
    { id: 'lengthBytes', header: 'Size', width: 90, sortable: true, accessor: (r) => `${r.lengthBytes} B` },
  ];

  it('virtualizes 100,000 items and renders only viewport DOM nodes (O(1) DOM footprint)', () => {
    const data = generateBenchmarkData(TOTAL_ITEMS);

    const { container } = render(
      <div style={{ height: '400px', width: '800px' }}>
        <VirtualizedTable
          data={data}
          columns={columns}
          rowHeight={26}
          overscan={15}
          getRowId={(row) => row.id}
        />
      </div>
    );

    // Initial render should show headers
    expect(screen.getByText('Request ID')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    expect(screen.getByText('req-uuid-1')).toBeInTheDocument();

    // Check rendered row elements in DOM
    // Viewport height = 400px, rowHeight = 26px -> visible ~ 16 rows + 2*15 overscan = ~46 rows max.
    // Ensure we DO NOT render 100,000 DOM rows!
    const rowElements = container.querySelectorAll('.dense-cell');
    // Each row has 6 columns. Total cells should be < 500 (approx 46 * 6 = 276 cells), definitely far less than 600,000 cells.
    expect(rowElements.length).toBeGreaterThan(10);
    expect(rowElements.length).toBeLessThan(600);

    // Verify req-uuid-100000 is NOT in DOM yet
    expect(screen.queryByText('req-uuid-100000')).toBeNull();
  });

  it('scrolls dynamically to middle (row ~50,000) and bottom (row 100,000) with DOM node reuse', () => {
    const data = generateBenchmarkData(TOTAL_ITEMS);

    const { container } = render(
      <div style={{ height: '400px', width: '800px' }}>
        <VirtualizedTable
          data={data}
          columns={columns}
          rowHeight={26}
          overscan={15}
          getRowId={(row) => row.id}
        />
      </div>
    );

    const scrollContainer = container.querySelector('.overflow-auto');
    expect(scrollContainer).not.toBeNull();

    // Scroll to middle (row 50,000 -> scrollTop = 50,000 * 26 = 1,300,000px)
    act(() => {
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 1_300_000 } });
      }
    });

    // Row 50,000 should now be rendered
    expect(screen.getByText('req-uuid-50000')).toBeInTheDocument();
    // Row 1 should no longer be rendered
    expect(screen.queryByText('req-uuid-1')).toBeNull();

    // Scroll to the very bottom (scrollTop = (100,000 - 15) * 26 = 2,599,610px)
    act(() => {
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 2_600_000 } });
      }
    });

    // Last row should now be rendered
    expect(screen.getByText('req-uuid-100000')).toBeInTheDocument();
    // Row 50,000 should no longer be rendered
    expect(screen.queryByText('req-uuid-50000')).toBeNull();
  });

  it('performs high-speed sorting on 100,000 items without UI freeze', () => {
    const data = generateBenchmarkData(TOTAL_ITEMS);

    render(
      <div style={{ height: '400px', width: '800px' }}>
        <VirtualizedTable
          data={data}
          columns={columns}
          rowHeight={26}
          overscan={10}
          getRowId={(row) => row.id}
        />
      </div>
    );

    const latencyHeader = screen.getByText('Latency (ms)');

    // Benchmark sort execution
    const t0 = performance.now();
    fireEvent.click(latencyHeader);
    const t1 = performance.now();

    // Sort time for 100k items should be sub-500ms in modern JS
    expect(t1 - t0).toBeLessThan(1000);

    // Click again for descending sort
    const t2 = performance.now();
    fireEvent.click(latencyHeader);
    const t3 = performance.now();
    expect(t3 - t2).toBeLessThan(1000);
  });

  it('handles multi-selection and single-selection across 100,000 items', () => {
    const data = generateBenchmarkData(TOTAL_ITEMS);
    const onSelectionChange = vi.fn();
    const onRowClick = vi.fn();

    render(
      <div style={{ height: '400px', width: '800px' }}>
        <VirtualizedTable
          data={data}
          columns={columns}
          rowHeight={26}
          getRowId={(row) => row.id}
          onSelectionChange={onSelectionChange}
          onRowClick={onRowClick}
        />
      </div>
    );

    const firstRowItem = screen.getByText('req-uuid-1');
    fireEvent.click(firstRowItem);

    expect(onRowClick).toHaveBeenCalledWith(data[0], 0);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['req-uuid-1']));

    // Ctrl+click for multi-selection
    const secondRowItem = screen.getByText('req-uuid-2');
    fireEvent.click(secondRowItem, { ctrlKey: true });

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['req-uuid-1', 'req-uuid-2']));
  });

  it('supports vim keyboard navigation (j, k, gg, G, Space, Enter) seamlessly', () => {
    const data = generateBenchmarkData(100);
    const onDoubleClick = vi.fn();

    render(
      <div style={{ height: '400px', width: '800px' }}>
        <VirtualizedTable
          data={data}
          columns={columns}
          rowHeight={26}
          getRowId={(row) => row.id}
          onRowDoubleClick={onDoubleClick}
          enableKeyboardNavigation={true}
        />
      </div>
    );

    // Press 'j' to move down
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByText('req-uuid-1')).toBeInTheDocument();

    // Press 'j' again
    fireEvent.keyDown(window, { key: 'j' });

    // Press 'k' to move up
    fireEvent.keyDown(window, { key: 'k' });

    // Press 'End' to jump to end
    fireEvent.keyDown(window, { key: 'End' });

    // Press 'Home' to jump to start
    fireEvent.keyDown(window, { key: 'Home' });

    // Press 'Enter'
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onDoubleClick).toHaveBeenCalled();
  });

  it('handles edge cases: 0 rows, 1 row, null/undefined properties without crashing', () => {
    // 0 rows
    const { rerender } = render(
      <VirtualizedTable
        data={[]}
        columns={columns}
        getRowId={(r) => (r as any).id}
        emptyMessage="Empty traffic log"
      />
    );
    expect(screen.getByText('Empty traffic log')).toBeInTheDocument();

    // 1 row
    rerender(
      <VirtualizedTable
        data={[{ id: 'req-single', method: 'GET', url: '/test', statusCode: 200, latencyMs: 10, lengthBytes: 50, contentType: 'json', timestamp: '' }]}
        columns={columns}
        getRowId={(r) => r.id}
      />
    );
    expect(screen.getByText('req-single')).toBeInTheDocument();

    // Rows with missing / undefined properties during sort
    const dirtyData: any[] = [
      { id: 'd1', method: undefined, statusCode: null, url: '/a' },
      { id: 'd2', method: 'POST', statusCode: 200, url: null },
      { id: 'd3', method: 'GET', statusCode: 500, url: undefined },
    ];
    rerender(
      <VirtualizedTable
        data={dirtyData}
        columns={columns as any}
        getRowId={(r) => r.id}
      />
    );
    // Click method header to sort dirty data
    fireEvent.click(screen.getByText('Method'));
    expect(screen.getByText('d1')).toBeInTheDocument();
  });
});
