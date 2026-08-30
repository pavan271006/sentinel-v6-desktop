import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandPalette } from '../../src/components/palette/CommandPalette';
import { useCommandPaletteStore } from '../../src/stores/commandPaletteStore';

describe('CommandPalette Stress & Adversarial Fuzzing Suite', () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().close();
    useCommandPaletteStore.getState().setQuery('');
    useCommandPaletteStore.getState().setSelectedIndex(0);
  });

  it('handles rapid opening, closing, and toggling without state drift', () => {
    render(<CommandPalette />);

    // Rapid Ctrl+K toggling 50 times
    for (let i = 0; i < 50; i++) {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    }

    // After even number of toggles (50), it should be closed
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);

    // One more toggle opens it
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    expect(screen.getByPlaceholderText(/Type a command/i)).toBeInTheDocument();
  });

  it('fuzzes search query with special regex characters, XSS vectors, and null bytes', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByPlaceholderText(/Type a command/i);

    const maliciousQueries = [
      '.*+?^${}()|[]\\/',
      '(?=.*[a-z])(?=.*[A-Z])',
      '[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+',
      '<script>alert("XSS")</script>',
      '\' OR \'1\'=\'1',
      '-- ; DROP TABLE requests; --',
      '\x00\x01\x02\xFF',
      '\\u0000\\uFFFF',
      ' '.repeat(100),
      'A'.repeat(5000),
    ];

    for (const query of maliciousQueries) {
      act(() => {
        fireEvent.change(input, { target: { value: query } });
      });
      // Should not throw RegExp errors or crash
      expect(useCommandPaletteStore.getState().query).toBe(query);
    }
  });

  it('handles rapid keystroke fuzzing (200 rapid changes) with zero UI lag', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByPlaceholderText(/Type a command/i);

    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const char = String.fromCharCode(65 + (i % 26));
      act(() => {
        fireEvent.change(input, { target: { value: `search-${char}-${i}` } });
      });
    }
    const t1 = performance.now();

    expect(t1 - t0).toBeLessThan(1000); // 200 input events in under 1 second
  });

  it('navigates list boundaries with ArrowUp, ArrowDown and wraps around', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByPlaceholderText(/Type a command/i);

    // Initial selected index is 0
    expect(useCommandPaletteStore.getState().selectedIndex).toBe(0);

    // ArrowUp on top item wraps around to last item
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(useCommandPaletteStore.getState().selectedIndex).toBeGreaterThan(0);

    // ArrowDown on last item wraps back to 0
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(useCommandPaletteStore.getState().selectedIndex).toBe(0);
  });

  it('executes active command on Enter and closes palette', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.change(input, { target: { value: 'Traffic' } });

    // Press Enter to execute first match
    fireEvent.keyDown(input, { key: 'Enter' });

    // Palette should now be closed
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });
});
