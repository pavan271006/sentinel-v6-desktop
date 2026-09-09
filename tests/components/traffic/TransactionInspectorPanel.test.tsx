import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionInspectorPanel } from '../../../src/components/traffic/TransactionInspectorPanel';
import { useInspectorStore } from '../../../src/stores/inspectorStore';
import { TrafficSummary } from '../../../src/types/traffic';

describe('TransactionInspectorPanel Component', () => {
  beforeEach(() => {
    useInspectorStore.getState().clearCache();
    useInspectorStore.setState({
      activeTab: 'response',
      requestSubView: 'parsed',
      responseSubView: 'parsed',
    });
  });

  const sampleTx: TrafficSummary = {
    id: 'tx-000042',
    seqNumber: 42,
    timestamp: '11:22:33',
    timestampMs: 1720000042000,
    method: 'POST',
    url: 'https://target.local/api/v1/auth/login',
    host: 'target.local',
    path: '/api/v1/auth/login',
    status: 200,
    durationMs: 95,
    sizeBytes: 1024,
    inScope: true,
    mimeType: 'application/json',
    tags: ['scope:target', 'auth'],
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
    reqBlobId: 'blob-req-42',
    resBlobId: 'blob-res-42',
  };

  it('renders dual split panes with Request and Response headers', () => {
    render(<TransactionInspectorPanel transaction={sampleTx} />);

    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText(/Response/i)).toBeInTheDocument();
    expect(screen.getByTitle('Send to Repeater (Ctrl+R)')).toBeInTheDocument();
    expect(screen.getByTitle('Diff Revisions')).toBeInTheDocument();
  });

  it('switches between Request sub-views (pretty, raw, hex)', () => {
    render(<TransactionInspectorPanel transaction={sampleTx} />);

    const rawButtons = screen.getAllByRole('button', { name: /raw/i });
    expect(rawButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(rawButtons[0]);

    const hexButtons = screen.getAllByRole('button', { name: /hex/i });
    expect(hexButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(hexButtons[0]);
  });

  it('triggers send to repeater callback', () => {
    const handleRepeater = vi.fn();
    render(
      <TransactionInspectorPanel
        transaction={sampleTx}
        onSendToRepeater={handleRepeater}
      />
    );

    const repeaterBtn = screen.getByTitle('Send to Repeater (Ctrl+R)');
    fireEvent.click(repeaterBtn);

    expect(handleRepeater).toHaveBeenCalledWith(sampleTx);
  });

  it('triggers open diff callback', () => {
    const handleDiff = vi.fn();
    render(
      <TransactionInspectorPanel
        transaction={sampleTx}
        onOpenDiff={handleDiff}
      />
    );

    const diffBtn = screen.getByTitle('Diff Revisions');
    fireEvent.click(diffBtn);

    expect(handleDiff).toHaveBeenCalledWith(sampleTx);
  });

  it('updates search input and highlights matches', () => {
    render(<TransactionInspectorPanel transaction={sampleTx} />);

    const searchInputs = screen.getAllByPlaceholderText('Search');
    expect(searchInputs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0 highlights').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(searchInputs[0], { target: { value: 'POST' } });
    expect(screen.getAllByText(/matches/i).length).toBeGreaterThanOrEqual(1);
  });
});
