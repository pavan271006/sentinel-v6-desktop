import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBar } from '../../src/components/shell/StatusBar';
import { useAppShellStore } from '../../src/stores/appShellStore';

describe('StatusBar Component', () => {
  it('renders proxy, scope, database size and latency indicators', () => {
    render(<StatusBar />);

    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText(/127.0.0.1:8080/)).toBeInTheDocument();
    expect(screen.getByText(/FAIL-CLOSED/)).toBeInTheDocument();
    expect(screen.getByText(/IPC:/)).toBeInTheDocument();
  });

  it('toggles bottom drawer when console button is clicked', () => {
    render(<StatusBar />);

    const consoleBtn = screen.getByText('Console');
    fireEvent.click(consoleBtn);

    expect(useAppShellStore.getState().bottomDrawerOpen).toBe(true);
  });
});
