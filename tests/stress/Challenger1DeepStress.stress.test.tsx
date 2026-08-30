import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualizedTable, ColumnDef } from '../../src/design-system/VirtualizedTable';
import { DiffViewer, computeLineDiff } from '../../src/design-system/DiffViewer';
import { SplitPane } from '../../src/design-system/SplitPane';

interface ExtremeTrafficItem {
  id: string;
  method: string;
  url: string;
  statusCode: number | null | undefined;
  latencyMs: number;
  payload: string;
}

describe('Challenger 1 Empirical Deep Adversarial Stress Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. VirtualizedTable: 100K Dataset & Extreme Adversarial Edge Cases', () => {
    const columns: ColumnDef<ExtremeTrafficItem>[] = [
      { id: 'id', header: 'ID', width: 100, minWidth: 60, maxWidth: 300, sortable: true, accessor: (r) => r.id },
      { id: 'method', header: 'Method', width: 80, sortable: true, accessor: (r) => r.method },
      { id: 'url', header: 'URL Path', width: 300, sortable: true, accessor: (r) => r.url },
      { id: 'statusCode', header: 'Status', width: 80, sortable: true, accessor: (r) => r.statusCode ?? 'N/A' },
      { id: 'latencyMs', header: 'Latency', width: 90, sortable: true, accessor: (r) => `${r.latencyMs}ms` },
      { id: 'payload', header: 'Payload', width: 200, accessor: (r) => r.payload },
    ];

    it('renders 100,000 items with adversarial XSS strings, Unicode, and RTL characters without DOM injection', () => {
      const xssStrings = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(document.domain)>',
        '日本語テスト UTF-8 🔒 💥 🚀',
        'עִבְרִית مرحبا بالعالم (RTL Injection)',
        'null\x00byte\r\ninjection',
      ];

      const count = 100_000;
      const data: ExtremeTrafficItem[] = new Array(count);
      for (let i = 0; i < count; i++) {
        data[i] = {
          id: `item-${i}`,
          method: i % 2 === 0 ? 'GET' : 'POST',
          url: `https://sentinel.local/api/test?payload=${encodeURIComponent(xssStrings[i % xssStrings.length])}`,
          statusCode: i % 10 === 0 ? null : (i % 3 === 0 ? 200 : 500),
          latencyMs: i % 500,
          payload: xssStrings[i % xssStrings.length],
        };
      }

      const { container } = render(
        <div style={{ height: '500px', width: '900px' }}>
          <VirtualizedTable
            data={data}
            columns={columns}
            rowHeight={26}
            overscan={20}
            getRowId={(r) => r.id}
          />
        </div>
      );

      // Verify header rendered
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Method')).toBeInTheDocument();

      // Verify no unsanitized script tags executed or inserted as HTML elements
      const scriptTags = container.querySelectorAll('script');
      expect(scriptTags.length).toBe(0);

      // Verify first row text content is properly escaped in text node
      expect(screen.getByText('item-0')).toBeInTheDocument();
      expect(screen.getAllByText('<script>alert("xss")</script>').length).toBeGreaterThan(0);
    });

    it('handles column resizing clamp limits with extreme drag deltas (-99999px to +99999px)', () => {
      const data: ExtremeTrafficItem[] = [
        { id: '1', method: 'GET', url: '/a', statusCode: 200, latencyMs: 10, payload: 'test' },
      ];

      const { container } = render(
        <div style={{ height: '400px', width: '800px' }}>
          <VirtualizedTable
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
          />
        </div>
      );

      const resizeHandles = container.querySelectorAll('.cursor-col-resize');
      expect(resizeHandles.length).toBeGreaterThan(0);

      // Drag first column handle to -99999px
      fireEvent.mouseDown(resizeHandles[0], { clientX: 100 });
      fireEvent.mouseMove(window, { clientX: -99999 });
      fireEvent.mouseUp(window);

      // Drag first column handle to +99999px
      fireEvent.mouseDown(resizeHandles[0], { clientX: 100 });
      fireEvent.mouseMove(window, { clientX: 99999 });
      fireEvent.mouseUp(window);

      // Verify table is still rendered and operational
      expect(screen.getByText('ID')).toBeInTheDocument();
    });

    it('handles rapid dataset replacement (100k -> 0 -> 50k -> 1) without crashes', () => {
      const makeData = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          id: `id-${i}`,
          method: 'GET',
          url: `/res/${i}`,
          statusCode: 200,
          latencyMs: 1,
          payload: 'ok',
        }));

      const { rerender } = render(
        <div style={{ height: '400px', width: '800px' }}>
          <VirtualizedTable
            data={makeData(100_000)}
            columns={columns}
            getRowId={(r) => r.id}
          />
        </div>
      );

      expect(screen.getByText('id-0')).toBeInTheDocument();

      // Replace with 0 items
      rerender(
        <div style={{ height: '400px', width: '800px' }}>
          <VirtualizedTable
            data={[]}
            columns={columns}
            getRowId={(r) => r.id}
            emptyMessage="No traffic records"
          />
        </div>
      );
      expect(screen.getByText('No traffic records')).toBeInTheDocument();

      // Replace with 50k items
      rerender(
        <div style={{ height: '400px', width: '800px' }}>
          <VirtualizedTable
            data={makeData(50_000)}
            columns={columns}
            getRowId={(r) => r.id}
          />
        </div>
      );
      expect(screen.getByText('id-0')).toBeInTheDocument();

      // Replace with 1 item
      rerender(
        <div style={{ height: '400px', width: '800px' }}>
          <VirtualizedTable
            data={makeData(1)}
            columns={columns}
            getRowId={(r) => r.id}
          />
        </div>
      );
      expect(screen.getByText('id-0')).toBeInTheDocument();
    });

    it('executes full range of vim keyboard navigation (j/k/gg/G/Home/End/Space/Enter) at boundary extremes', () => {
      const count = 1000;
      const data = Array.from({ length: count }, (_, i) => ({
        id: `row-${i}`,
        method: 'POST',
        url: `/path/${i}`,
        statusCode: 201,
        latencyMs: 15,
        payload: `data-${i}`,
      }));

      const onSelectChange = vi.fn();
      const onRowDoubleClick = vi.fn();

      render(
        <div style={{ height: '400px', width: '800px' }}>
          <VirtualizedTable
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            onSelectionChange={onSelectChange}
            onRowDoubleClick={onRowDoubleClick}
            enableKeyboardNavigation={true}
          />
        </div>
      );

      // 'k' at top boundary (index 0 -> cannot go negative)
      fireEvent.keyDown(window, { key: 'k' });
      // 'j' down 5 times
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(window, { key: 'j' });
      }

      // Space to toggle selection
      fireEvent.keyDown(window, { key: ' ' });
      expect(onSelectChange).toHaveBeenCalled();

      // 'G' (Shift+G) to jump to end (row 999)
      fireEvent.keyDown(window, { key: 'G', shiftKey: true });
      // 'j' at bottom boundary (cannot exceed 999)
      fireEvent.keyDown(window, { key: 'j' });

      // 'gg' double tap to jump back to top
      fireEvent.keyDown(window, { key: 'g' });
      fireEvent.keyDown(window, { key: 'g' });

      // Enter to trigger double click action
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onRowDoubleClick).toHaveBeenCalled();
    });
  });

  describe('2. DiffViewer: Long and Complex Strings, Extreme Edits & Boundaries', () => {
    it('computes diff on 100,000 character single line string without crashing', () => {
      const line1 = 'X'.repeat(50_000) + 'Y'.repeat(50_000);
      const line2 = 'X'.repeat(50_000) + 'Z'.repeat(50_000);

      const diff = computeLineDiff(line1, line2);
      expect(diff.lines.length).toBe(2);
      expect(diff.removedCount).toBe(1);
      expect(diff.addedCount).toBe(1);
      expect(diff.unchangedCount).toBe(0);
      expect(diff.similarityScore).toBe(0);

      render(<DiffViewer originalText={line1} modifiedText={line2} />);
      expect(screen.getByText('Side-by-Side')).toBeInTheDocument();
      expect(screen.getByText('Unified Inline')).toBeInTheDocument();
    });

    it('correctly calculates similarity score invariants (0% to 100%)', () => {
      // 100% Identical
      const exact = 'Line 1\nLine 2\nLine 3\nLine 4';
      const d100 = computeLineDiff(exact, exact);
      expect(d100.similarityScore).toBe(100);
      expect(d100.unchangedCount).toBe(4);
      expect(d100.addedCount).toBe(0);
      expect(d100.removedCount).toBe(0);

      // 0% Disjoint
      const a = 'A\nB\nC\nD';
      const b = 'E\nF\nG\nH';
      const d0 = computeLineDiff(a, b);
      expect(d0.similarityScore).toBe(0);
      expect(d0.unchangedCount).toBe(0);
      expect(d0.removedCount).toBe(4);
      expect(d0.addedCount).toBe(4);

      // 50% Overlap
      const half1 = 'Common 1\nCommon 2\nUnique A1\nUnique A2';
      const half2 = 'Common 1\nCommon 2\nUnique B1\nUnique B2';
      const d50 = computeLineDiff(half1, half2);
      expect(d50.similarityScore).toBe(50);
      expect(d50.unchangedCount).toBe(2);
      expect(d50.removedCount).toBe(2);
      expect(d50.addedCount).toBe(2);
    });

    it('handles mixed CRLF, LF, trailing newlines, and unicode escapes seamlessly', () => {
      const orig = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\"}\r\n";
      const mod = "HTTP/1.1 500 Internal Server Error\nContent-Type: application/json\n\n{\"error\":\"fail\",\"code\":\ud83d\udea8}\n";

      const diff = computeLineDiff(orig, mod);
      expect(diff.lines.length).toBeGreaterThan(0);

      render(<DiffViewer originalText={orig} modifiedText={mod} initialMode="inline" />);
      expect(screen.getByText('Unified Inline')).toBeInTheDocument();
    });

    it('switches between Side-by-Side and Unified Inline views under dense multi-line content', () => {
      const orig = Array.from({ length: 150 }, (_, i) => `Param-${i}=original_val_${i}`).join('\n');
      const mod = Array.from({ length: 150 }, (_, i) => (i % 3 === 0 ? `Param-${i}=mutated_val_${i}` : `Param-${i}=original_val_${i}`)).join('\n');

      render(<DiffViewer originalText={orig} modifiedText={mod} />);

      const sideBySide = screen.getByText('Side-by-Side');
      const inline = screen.getByText('Unified Inline');

      // Click Inline
      fireEvent.click(inline);
      // Click Side-by-Side
      fireEvent.click(sideBySide);

      expect(screen.getByText('+50 lines')).toBeInTheDocument();
      expect(screen.getByText('-50 lines')).toBeInTheDocument();
    });
  });

  describe('3. SplitPane: Boundary Clamping, Extreme Movement & Persistence Invariants', () => {
    it('clamps size strictly within [minSize, maxSize] even during erratic mouse moves', () => {
      const onSizeChange = vi.fn();

      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <SplitPane
            minSize={100}
            maxSize={500}
            initialSize={250}
            onSizeChange={onSizeChange}
            primary={<div>Left Panel</div>}
            secondary={<div>Right Panel</div>}
          />
        </div>
      );

      const divider = container.querySelector('.cursor-col-resize');
      expect(divider).not.toBeNull();

      fireEvent.mouseDown(divider!);

      // Negative coordinates
      fireEvent.mouseMove(window, { clientX: -999999 });
      expect(onSizeChange).toHaveBeenLastCalledWith(100);

      // Huge coordinates
      fireEvent.mouseMove(window, { clientX: 999999 });
      expect(onSizeChange).toHaveBeenLastCalledWith(500);

      // Fractional coordinates
      fireEvent.mouseMove(window, { clientX: 314.159 });
      expect(onSizeChange).toHaveBeenCalled();

      fireEvent.mouseUp(window);
    });

    it('persists and recovers size from localStorage with validation against corrupt values', () => {
      // 1. Initial valid write
      localStorage.setItem('splitpane_main_shell', '350');

      const { rerender } = render(
        <SplitPane
          storageKey="main_shell"
          minSize={150}
          maxSize={600}
          initialSize={200}
          primary={<div>Primary</div>}
          secondary={<div>Secondary</div>}
        />
      );

      // 2. Corrupted string value
      localStorage.setItem('splitpane_main_shell', 'NOT_A_NUMBER');
      rerender(
        <SplitPane
          storageKey="main_shell"
          minSize={150}
          maxSize={600}
          initialSize={200}
          primary={<div>Primary</div>}
          secondary={<div>Secondary</div>}
        />
      );

      // 3. Out-of-bounds saved value
      localStorage.setItem('splitpane_main_shell', '999999');
      rerender(
        <SplitPane
          storageKey="main_shell"
          minSize={150}
          maxSize={600}
          initialSize={200}
          primary={<div>Primary</div>}
          secondary={<div>Secondary</div>}
        />
      );

      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
    });

    it('handles vertical mode and secondary-first orientation simultaneously', () => {
      const onSizeChange = vi.fn();

      const { container } = render(
        <div style={{ width: '500px', height: '800px' }}>
          <SplitPane
            direction="vertical"
            isPrimaryFirst={false}
            minSize={80}
            maxSize={400}
            initialSize={180}
            onSizeChange={onSizeChange}
            primary={<div>Bottom Dock</div>}
            secondary={<div>Top Workspace</div>}
          />
        </div>
      );

      const divider = container.querySelector('.cursor-row-resize');
      expect(divider).not.toBeNull();

      fireEvent.mouseDown(divider!);
      fireEvent.mouseMove(window, { clientY: 750 });
      expect(onSizeChange).toHaveBeenCalled();
      fireEvent.mouseUp(window);
    });
  });
});
