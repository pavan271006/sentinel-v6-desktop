import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CommandPalette } from '../../src/components/palette/CommandPalette';
import { useCommandPaletteStore } from '../../src/stores/commandPaletteStore';

describe('CommandPalette Component', () => {
  it('opens on Ctrl+K and filters commands by query', () => {
    render(<CommandPalette />);

    // Initially closed
    expect(screen.queryByPlaceholderText(/Type a command/i)).not.toBeInTheDocument();

    // Trigger Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText(/Type a command/i)).toBeInTheDocument();

    // Type search query
    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.change(input, { target: { value: 'Repeater' } });

    expect(screen.getByText('Switch to Repeater (Manual Testing)')).toBeInTheDocument();
  });

  it('closes on Escape key press', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    expect(screen.getByPlaceholderText(/Type a command/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/Type a command/i)).not.toBeInTheDocument();
  });
});
