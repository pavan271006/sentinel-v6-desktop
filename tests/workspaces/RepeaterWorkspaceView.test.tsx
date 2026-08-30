import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RepeaterWorkspaceView } from '../../src/workspaces/RepeaterWorkspaceView';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../src/stores/repeaterStore';

describe('RepeaterWorkspaceView Integration Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        {
          ...DEFAULT_INITIAL_TAB,
          id: 'rep-1',
          title: 'Request #1',
          method: 'GET',
          url: 'https://target.local/api/v1/auth/login',
          history: [],
          isDirty: false,
          isExecuting: false,
        },
      ],
      activeTabId: 'rep-1',
      closedTabsStack: [],
      globalVariables: { host: 'target.local' },
      isHistoryDrawerOpen: false,
      isVariablesModalOpen: false,
      isDiffModalOpen: false,
      splitOrientation: 'horizontal',
    });
  });

  it('renders complete repeater workspace with tab bar, editor, response viewer, and split layout', () => {
    render(<RepeaterWorkspaceView />);

    expect(screen.getByText('Request #1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://target.local/api/v1/auth/login')).toBeInTheDocument();
    expect(screen.getByText(/No Response Captured/i)).toBeInTheDocument();
  });

  it('handles Ctrl+Enter hotkey to trigger request execution', async () => {
    render(<RepeaterWorkspaceView />);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    });

    const state = useRepeaterStore.getState();
    expect(state.tabs[0].history).toHaveLength(1);
    expect(state.tabs[0].history[0].statusCode).toBe(200);
  });

  it('handles Ctrl+T hotkey to create a new tab', () => {
    render(<RepeaterWorkspaceView />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }));
    });

    expect(useRepeaterStore.getState().tabs).toHaveLength(2);
  });

  it('handles Ctrl+H hotkey to open history drawer', () => {
    render(<RepeaterWorkspaceView />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true }));
    });

    expect(useRepeaterStore.getState().isHistoryDrawerOpen).toBe(true);
  });

  it('handles Ctrl+D hotkey to open diff modal', () => {
    render(<RepeaterWorkspaceView />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
    });

    expect(useRepeaterStore.getState().isDiffModalOpen).toBe(true);
  });

  it('handles Ctrl+\\ hotkey to toggle split orientation', () => {
    render(<RepeaterWorkspaceView />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', ctrlKey: true }));
    });

    expect(useRepeaterStore.getState().splitOrientation).toBe('vertical');
  });
});
