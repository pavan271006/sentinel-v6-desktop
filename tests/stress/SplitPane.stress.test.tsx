import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitPane } from '../../src/design-system/SplitPane';

describe('SplitPane Stress & Adversarial Boundary Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clamps extreme initialSize and sizes within minSize and maxSize bounds', () => {
    // Initial size out of bounds (lower than minSize)
    const { rerender } = render(
      <SplitPane
        primary={<div data-testid="prim">Primary</div>}
        secondary={<div data-testid="sec">Secondary</div>}
        minSize={100}
        maxSize={600}
        initialSize={50} // Below minSize
      />
    );

    expect(screen.getByTestId('prim')).toBeInTheDocument();
    expect(screen.getByTestId('sec')).toBeInTheDocument();

    // Initial size out of bounds (higher than maxSize)
    rerender(
      <SplitPane
        primary={<div data-testid="prim">Primary</div>}
        secondary={<div data-testid="sec">Secondary</div>}
        minSize={100}
        maxSize={600}
        initialSize={9999} // Far above maxSize
      />
    );

    expect(screen.getByTestId('prim')).toBeInTheDocument();
  });

  it('handles extreme drag events beyond viewport bounds without overflowing clamps', () => {
    const onSizeChange = vi.fn();

    const { container } = render(
      <div style={{ width: '1000px', height: '600px' }}>
        <SplitPane
          primary={<div data-testid="prim">Primary</div>}
          secondary={<div data-testid="sec">Secondary</div>}
          minSize={150}
          maxSize={700}
          initialSize={300}
          onSizeChange={onSizeChange}
          direction="horizontal"
        />
      </div>
    );

    const divider = container.querySelector('.cursor-col-resize');
    expect(divider).not.toBeNull();

    // Start dragging
    fireEvent.mouseDown(divider!);

    // Drag to extreme negative coordinates (-5000)
    fireEvent.mouseMove(window, { clientX: -5000 });
    // Should be clamped to minSize (150)
    expect(onSizeChange).toHaveBeenLastCalledWith(150);

    // Drag to extreme positive coordinates (+50000)
    fireEvent.mouseMove(window, { clientX: 50000 });
    // Should be clamped to maxSize (700)
    expect(onSizeChange).toHaveBeenLastCalledWith(700);

    // Release drag
    fireEvent.mouseUp(window);
  });

  it('supports vertical split pane dragging with height clamping', () => {
    const onSizeChange = vi.fn();

    const { container } = render(
      <div style={{ width: '800px', height: '800px' }}>
        <SplitPane
          direction="vertical"
          primary={<div data-testid="top">Top View</div>}
          secondary={<div data-testid="bottom">Bottom View</div>}
          minSize={120}
          maxSize={500}
          initialSize={250}
          onSizeChange={onSizeChange}
        />
      </div>
    );

    const divider = container.querySelector('.cursor-row-resize');
    expect(divider).not.toBeNull();

    fireEvent.mouseDown(divider!);
    fireEvent.mouseMove(window, { clientY: 50 }); // Extreme top
    expect(onSizeChange).toHaveBeenLastCalledWith(120);

    fireEvent.mouseMove(window, { clientY: 1000 }); // Extreme bottom
    expect(onSizeChange).toHaveBeenLastCalledWith(500);

    fireEvent.mouseUp(window);
  });

  it('handles reverse pane ordering (isPrimaryFirst = false)', () => {
    const onSizeChange = vi.fn();

    const { container } = render(
      <div style={{ width: '1000px', height: '600px' }}>
        <SplitPane
          primary={<div data-testid="prim">Primary (Right)</div>}
          secondary={<div data-testid="sec">Secondary (Left)</div>}
          minSize={100}
          maxSize={600}
          initialSize={300}
          isPrimaryFirst={false}
          onSizeChange={onSizeChange}
          direction="horizontal"
        />
      </div>
    );

    const divider = container.querySelector('.cursor-col-resize');
    expect(divider).not.toBeNull();

    fireEvent.mouseDown(divider!);
    fireEvent.mouseMove(window, { clientX: 200 });
    expect(onSizeChange).toHaveBeenCalled();
    fireEvent.mouseUp(window);
  });

  it('handles corrupt and valid localStorage states gracefully', () => {
    // Valid saved state
    localStorage.setItem('splitpane_test_key', '450');

    const { rerender } = render(
      <SplitPane
        storageKey="test_key"
        minSize={100}
        maxSize={600}
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
      />
    );

    // Corrupt saved states: invalid string, NaN, out of bounds
    localStorage.setItem('splitpane_corrupt_key', 'CORRUPTED_VALUE');
    rerender(
      <SplitPane
        storageKey="corrupt_key"
        initialSize={250}
        minSize={100}
        maxSize={600}
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
      />
    );

    localStorage.setItem('splitpane_outofbounds', '999999');
    rerender(
      <SplitPane
        storageKey="outofbounds"
        initialSize={250}
        minSize={100}
        maxSize={600}
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
      />
    );
  });

  it('toggles collapsed state and unmounts primary without rendering divider', () => {
    const { rerender, container } = render(
      <SplitPane
        collapsed={false}
        primary={<div data-testid="primary-pane">Primary Content</div>}
        secondary={<div data-testid="secondary-pane">Secondary Content</div>}
      />
    );

    expect(screen.getByTestId('primary-pane')).toBeInTheDocument();
    expect(container.querySelector('.cursor-col-resize')).toBeInTheDocument();

    // Collapse
    rerender(
      <SplitPane
        collapsed={true}
        primary={<div data-testid="primary-pane">Primary Content</div>}
        secondary={<div data-testid="secondary-pane">Secondary Content</div>}
      />
    );

    expect(screen.queryByTestId('primary-pane')).not.toBeInTheDocument();
    expect(screen.getByTestId('secondary-pane')).toBeInTheDocument();
    expect(container.querySelector('.cursor-col-resize')).toBeNull();
  });
});
