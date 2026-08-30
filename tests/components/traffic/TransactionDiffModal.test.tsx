import { describe, it, expect, vi } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionDiffModal } from '../../../src/components/traffic/TransactionDiffModal';
import { TrafficSummary } from '../../../src/types/traffic';

describe('TransactionDiffModal Component', () => {
  const txA: TrafficSummary = {
    id: 'tx-000001',
    seqNumber: 1,
    timestamp: '10:00:00',
    timestampMs: 1720000000000,
    method: 'GET',
    url: 'https://target.local/api/profile',
    host: 'target.local',
    path: '/api/profile',
    status: 200,
    durationMs: 45,
    sizeBytes: 256,
    inScope: true,
    mimeType: 'application/json',
    tags: ['scope:target'],
  };

  const txB: TrafficSummary = {
    id: 'tx-000002',
    seqNumber: 2,
    timestamp: '10:00:05',
    timestampMs: 1720000005000,
    method: 'POST',
    url: 'https://target.local/api/profile',
    host: 'target.local',
    path: '/api/profile',
    status: 403,
    durationMs: 120,
    sizeBytes: 512,
    inScope: true,
    mimeType: 'application/json',
    tags: ['scope:target'],
  };

  it('renders side-by-side diff when open', () => {
    render(
      <TransactionDiffModal
        isOpen={true}
        onClose={() => {}}
        transactionA={txA}
        transactionB={txB}
      />
    );

    expect(screen.getByText('Differential Transaction Inspector')).toBeInTheDocument();
    expect(screen.getByText('Baseline A:')).toBeInTheDocument();
    expect(screen.getByText('Modified B:')).toBeInTheDocument();
  });

  it('switches diff targets between Response Body, Request Body, Headers and Summary', () => {
    render(
      <TransactionDiffModal
        isOpen={true}
        onClose={() => {}}
        transactionA={txA}
        transactionB={txB}
      />
    );

    // Switch to Request Body
    const reqBodyBtn = screen.getByRole('button', { name: 'Request Body' });
    fireEvent.click(reqBodyBtn);
    expect(reqBodyBtn).toHaveClass('text-accent-cyan');

    // Switch to Headers
    const headersBtn = screen.getByRole('button', { name: 'Headers' });
    fireEvent.click(headersBtn);
    expect(headersBtn).toHaveClass('text-accent-cyan');

    // Switch to Summary
    const summaryBtn = screen.getByRole('button', { name: 'Summary' });
    fireEvent.click(summaryBtn);
    expect(summaryBtn).toHaveClass('text-accent-cyan');
  });

  it('swaps Baseline A and Modified B transactions when swap button is clicked', () => {
    const handleSelectA = vi.fn();
    const handleSelectB = vi.fn();

    render(
      <TransactionDiffModal
        isOpen={true}
        onClose={() => {}}
        transactionA={txA}
        transactionB={txB}
        onSelectTransactionA={handleSelectA}
        onSelectTransactionB={handleSelectB}
      />
    );

    const swapBtn = screen.getByTitle('Swap Baseline A and Modified B');
    fireEvent.click(swapBtn);

    expect(handleSelectA).toHaveBeenCalledWith(txB);
    expect(handleSelectB).toHaveBeenCalledWith(txA);
  });

  it('does not render content when isOpen is false', () => {
    render(
      <TransactionDiffModal
        isOpen={false}
        onClose={() => {}}
        transactionA={txA}
        transactionB={txB}
      />
    );

    expect(screen.queryByText('Differential Transaction Inspector')).not.toBeInTheDocument();
  });
});
