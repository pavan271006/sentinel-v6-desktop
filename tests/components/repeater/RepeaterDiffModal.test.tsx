import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepeaterDiffModal } from '../../../src/components/repeater/RepeaterDiffModal';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../../src/stores/repeaterStore';
import { RepeaterRevisionItem } from '../../../src/types/repeater';

const MOCK_REV_A: RepeaterRevisionItem = {
  revisionId: 'rev-a',
  revisionNumber: 1,
  timestamp: '14:00:00',
  timestampMs: 1720000000000,
  method: 'POST',
  url: 'https://target.local/api',
  requestRaw: 'POST /api HTTP/1.1\r\n\r\n{"role":"guest"}',
  requestHeaders: [],
  requestBody: '{"role":"guest"}',
  responseBody: '{\n  "status": 200,\n  "role": "guest"\n}',
  statusCode: 200,
  durationMs: 40,
  sizeBytes: 30,
};

const MOCK_REV_B: RepeaterRevisionItem = {
  revisionId: 'rev-b',
  revisionNumber: 2,
  timestamp: '14:02:00',
  timestampMs: 1720000120000,
  method: 'POST',
  url: 'https://target.local/api',
  requestRaw: 'POST /api HTTP/1.1\r\n\r\n{"role":"admin"}',
  requestHeaders: [],
  requestBody: '{"role":"admin"}',
  responseBody: '{\n  "status": 200,\n  "role": "admin",\n  "mfa": false\n}',
  statusCode: 200,
  durationMs: 65,
  sizeBytes: 45,
};

describe('RepeaterDiffModal Component Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        {
          ...DEFAULT_INITIAL_TAB,
          id: 'rep-1',
          history: [MOCK_REV_A, MOCK_REV_B],
          baselineRevisionIndex: 0,
          activeRevisionIndex: 1,
          lastExecutionOutput: MOCK_REV_B,
        },
      ],
      activeTabId: 'rep-1',
      isDiffModalOpen: true,
      diffRevisionA: MOCK_REV_A,
      diffRevisionB: MOCK_REV_B,
    });
  });

  it('renders diff modal with revision selectors and delta metrics', () => {
    render(<RepeaterDiffModal />);

    expect(screen.getByText(/Differential Response Comparator/i)).toBeInTheDocument();
    expect(screen.getByText('Latency Δ:')).toBeInTheDocument();
    expect(screen.getByText('+25ms')).toBeInTheDocument();
    expect(screen.getByText('Size Δ:')).toBeInTheDocument();
    expect(screen.getByText('+15 B')).toBeInTheDocument();
  });

  it('renders diff viewer with original and modified titles', () => {
    render(<RepeaterDiffModal />);

    expect(screen.getByText(/Rev #1 \(14:00:00\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rev #2 \(14:02:00\)/)).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    render(<RepeaterDiffModal />);

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    expect(useRepeaterStore.getState().isDiffModalOpen).toBe(false);
  });
});
