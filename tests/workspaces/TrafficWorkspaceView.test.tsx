import { describe, it, expect, beforeEach } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/react';
import { TrafficWorkspaceView } from '../../src/workspaces/TrafficWorkspaceView';
import { useTrafficStore } from '../../src/stores/trafficStore';
import { useInspectorStore } from '../../src/stores/inspectorStore';

describe('TrafficWorkspaceView Component', () => {
  beforeEach(async () => {
    await useTrafficStore.getState().clearTraffic();
    useTrafficStore.getState().resetFilters();
    useInspectorStore.getState().clearCache();
  });

  it('renders traffic workspace with query bar, quick filters, table and inspector', async () => {
    render(<TrafficWorkspaceView />);

    expect(screen.getByPlaceholderText(/Filter traffic with HTTPQL/i)).toBeInTheDocument();
    expect(screen.getByText('Scope Only')).toBeInTheDocument();
    expect(screen.getByTitle('Auto-scroll enabled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Capturing/i })).toBeInTheDocument();
  });

  it('filters traffic when HTTPQL query is typed and submitted', async () => {
    render(<TrafficWorkspaceView />);

    const input = screen.getByPlaceholderText(/Filter traffic with HTTPQL/i);
    fireEvent.change(input, { target: { value: 'res.status >= 400' } });
    const enterBtn = screen.getByTitle('Execute Query (Enter)');
    fireEvent.click(enterBtn);

    const state = useTrafficStore.getState();
    expect(state.httpqlQuery).toBe('res.status >= 400');
  });


  it('toggles stream pause and auto-scroll buttons in header', async () => {
    render(<TrafficWorkspaceView />);

    const pauseBtn = screen.getByTitle('Pause traffic stream');
    fireEvent.click(pauseBtn);

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(useTrafficStore.getState().isPaused).toBe(true);

    const autoScrollBtn = screen.getByTitle('Auto-scroll enabled');
    fireEvent.click(autoScrollBtn);
    expect(useTrafficStore.getState().autoScroll).toBe(false);
  });

  it('opens TransactionDiffModal when Diff button is clicked', async () => {
    render(<TrafficWorkspaceView />);

    const diffBtn = screen.getByTitle('Open Transaction Diff Modal (Ctrl+D)');
    fireEvent.click(diffBtn);

    expect(useTrafficStore.getState().diffModal.isOpen).toBe(true);
    expect(screen.getByText('Differential Transaction Inspector')).toBeInTheDocument();
  });

  it('clears traffic history when Clear button is clicked', async () => {
    render(<TrafficWorkspaceView />);

    const clearBtn = screen.getByTitle('Clear all transaction history');
    fireEvent.click(clearBtn);

    const state = useTrafficStore.getState();
    expect(state.transactions).toHaveLength(0);
  });
});
