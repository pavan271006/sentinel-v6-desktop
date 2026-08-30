import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepeaterTabBar } from '../../../src/components/repeater/RepeaterTabBar';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../../src/stores/repeaterStore';

describe('RepeaterTabBar Component Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        { ...DEFAULT_INITIAL_TAB, id: 'rep-1', title: 'Request #1', method: 'GET', isDirty: false },
        { ...DEFAULT_INITIAL_TAB, id: 'rep-2', title: 'Request #2', method: 'POST', isDirty: true },
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

  it('renders all tabs with method badges and titles', () => {
    render(<RepeaterTabBar />);

    expect(screen.getByText('Request #1')).toBeInTheDocument();
    expect(screen.getByText('Request #2')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
  });

  it('displays dirty indicator for modified tabs', () => {
    render(<RepeaterTabBar />);
    const dirtyIndicators = screen.getAllByTestId('dirty-indicator');
    expect(dirtyIndicators).toHaveLength(1);
  });

  it('switches active tab on click', () => {
    render(<RepeaterTabBar />);
    const tab2 = screen.getByText('Request #2');
    fireEvent.click(tab2);

    expect(useRepeaterStore.getState().activeTabId).toBe('rep-2');
  });

  it('adds a new tab when clicking plus button', () => {
    render(<RepeaterTabBar />);
    const addBtn = screen.getByTitle(/New Tab/i);
    fireEvent.click(addBtn);

    expect(useRepeaterStore.getState().tabs).toHaveLength(3);
  });

  it('closes a tab when close button is clicked', () => {
    render(<RepeaterTabBar />);
    const closeBtn = screen.getByLabelText('Close tab Request #1');
    fireEvent.click(closeBtn);

    expect(useRepeaterStore.getState().tabs).toHaveLength(1);
    expect(useRepeaterStore.getState().activeTabId).toBe('rep-2');
    expect(useRepeaterStore.getState().closedTabsStack).toHaveLength(1);
  });

  it('opens history drawer when clicking History button', () => {
    render(<RepeaterTabBar />);
    const historyBtn = screen.getByRole('button', { name: /History/i });
    fireEvent.click(historyBtn);

    expect(useRepeaterStore.getState().isHistoryDrawerOpen).toBe(true);
  });

  it('opens variables modal when clicking Variables button', () => {
    render(<RepeaterTabBar />);
    const varsBtn = screen.getByRole('button', { name: /Variables/i });
    fireEvent.click(varsBtn);

    expect(useRepeaterStore.getState().isVariablesModalOpen).toBe(true);
  });
});
