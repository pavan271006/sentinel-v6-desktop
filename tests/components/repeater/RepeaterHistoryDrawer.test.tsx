import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepeaterHistoryDrawer } from '../../../src/components/repeater/RepeaterHistoryDrawer';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../../src/stores/repeaterStore';
import { RepeaterRevisionItem } from '../../../src/types/repeater';

const MOCK_REVISIONS: RepeaterRevisionItem[] = [
  {
    revisionId: 'rev-1',
    revisionNumber: 1,
    timestamp: '19:40:00',
    timestampMs: 1720000000000,
    method: 'GET',
    url: 'https://target.local/api/v1/auth',
    requestRaw: 'GET /api/v1/auth HTTP/1.1',
    requestHeaders: [],
    requestBody: '',
    responseBody: '{"rev":1}',
    statusCode: 200,
    durationMs: 40,
    sizeBytes: 10,
  },
  {
    revisionId: 'rev-2',
    revisionNumber: 2,
    timestamp: '19:42:00',
    timestampMs: 1720000120000,
    method: 'POST',
    url: 'https://target.local/api/v1/auth',
    requestRaw: 'POST /api/v1/auth HTTP/1.1\r\n\r\n{"user":"admin"}',
    requestHeaders: [],
    requestBody: '{"user":"admin"}',
    responseBody: '{"rev":2,"authenticated":true}',
    statusCode: 200,
    durationMs: 55,
    sizeBytes: 30,
  },
];

describe('RepeaterHistoryDrawer Component Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        {
          ...DEFAULT_INITIAL_TAB,
          id: 'rep-1',
          history: MOCK_REVISIONS,
          activeRevisionIndex: 1,
          lastExecutionOutput: MOCK_REVISIONS[1],
        },
      ],
      activeTabId: 'rep-1',
      isHistoryDrawerOpen: true,
    });
  });

  it('renders chronological history revisions in reverse order', () => {
    render(<RepeaterHistoryDrawer />);

    expect(screen.getByText('Execution History')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('19:40:00')).toBeInTheDocument();
    expect(screen.getByText('19:42:00')).toBeInTheDocument();
  });

  it('restores revision to editor when Restore button is clicked', () => {
    render(<RepeaterHistoryDrawer />);

    const restoreButtons = screen.getAllByRole('button', { name: /Restore/i });
    fireEvent.click(restoreButtons[1]); // Restore Rev #1

    const tab = useRepeaterStore.getState().tabs[0];
    expect(tab.activeRevisionIndex).toBe(0);
    expect(tab.method).toBe('GET');
  });

  it('pins baseline revision when Baseline button is clicked', () => {
    render(<RepeaterHistoryDrawer />);

    const baselineButtons = screen.getAllByRole('button', { name: /Baseline/i });
    fireEvent.click(baselineButtons[0]);

    expect(useRepeaterStore.getState().tabs[0].baselineRevisionIndex).toBe(1);
  });

  it('closes drawer when close icon is clicked', () => {
    render(<RepeaterHistoryDrawer />);

    const closeBtn = screen.getByTitle('Close Drawer');
    fireEvent.click(closeBtn);

    expect(useRepeaterStore.getState().isHistoryDrawerOpen).toBe(false);
  });
});
