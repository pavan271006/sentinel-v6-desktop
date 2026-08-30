import { describe, it, expect, vi } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualTrafficTable } from '../../../src/components/traffic/VirtualTrafficTable';
import { TrafficSummary } from '../../../src/types/traffic';

describe('VirtualTrafficTable Component', () => {
  const sampleTransactions: TrafficSummary[] = [
    {
      id: 'tx-000001',
      seqNumber: 1,
      timestamp: '10:00:01',
      timestampMs: 1720000001000,
      method: 'GET',
      url: 'https://target.local/api/v1/users',
      host: 'target.local',
      path: '/api/v1/users',
      status: 200,
      durationMs: 45,
      sizeBytes: 2048,
      inScope: true,
      mimeType: 'application/json',
      tags: ['scope:target'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    },
    {
      id: 'tx-000002',
      seqNumber: 2,
      timestamp: '10:00:02',
      timestampMs: 1720000002000,
      method: 'POST',
      url: 'https://target.local/api/v1/auth/login',
      host: 'target.local',
      path: '/api/v1/auth/login',
      status: 401,
      durationMs: 120,
      sizeBytes: 512,
      inScope: true,
      mimeType: 'application/json',
      tags: ['scope:target'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    },
    {
      id: 'tx-000003',
      seqNumber: 3,
      timestamp: '10:00:03',
      timestampMs: 1720000003000,
      method: 'GET',
      url: 'http://insecure.target.local/static/app.js',
      host: 'insecure.target.local',
      path: '/static/app.js',
      status: 304,
      durationMs: 15,
      sizeBytes: 0,
      inScope: false,
      mimeType: 'application/javascript',
      tags: ['scope:out-of-scope'],
    },
  ];

  it('renders transactions with method badges, status badges, and scope indicators', () => {
    render(
      <VirtualTrafficTable
        transactions={sampleTransactions}
        selectedTxId="tx-000001"
        onSelectTx={() => {}}
      />
    );

    expect(screen.getByText('tx-000001')).toBeInTheDocument();
    expect(screen.getByText('tx-000002')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/users')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/auth/login')).toBeInTheDocument();
  });

  it('handles row selection click', () => {
    const handleSelect = vi.fn();
    render(
      <VirtualTrafficTable
        transactions={sampleTransactions}
        selectedTxId={null}
        onSelectTx={handleSelect}
      />
    );

    const row = screen.getByText('tx-000002');
    fireEvent.click(row);

    expect(handleSelect).toHaveBeenCalledWith(sampleTransactions[1], 1, false);
  });

  it('shows bulk action toolbar when multiple items are selected', () => {
    const selectedIds = new Set(['tx-000001', 'tx-000002']);
    const handleOpenDiff = vi.fn();

    render(
      <VirtualTrafficTable
        transactions={sampleTransactions}
        selectedTxId="tx-000001"
        selectedTxIds={selectedIds}
        onSelectTx={() => {}}
        onOpenDiff={handleOpenDiff}
      />
    );

    expect(screen.getByText('2 transactions selected')).toBeInTheDocument();

    const diffBtn = screen.getByRole('button', { name: /Diff Selected/i });
    expect(diffBtn).toBeInTheDocument();
    fireEvent.click(diffBtn);

    expect(handleOpenDiff).toHaveBeenCalledWith(sampleTransactions[0], sampleTransactions[1]);
  });

  it('handles double click row callback', () => {
    const handleDoubleClick = vi.fn();
    render(
      <VirtualTrafficTable
        transactions={sampleTransactions}
        selectedTxId={null}
        onSelectTx={() => {}}
        onDoubleClickTx={handleDoubleClick}
      />
    );

    const row = screen.getByText('tx-000001');
    fireEvent.doubleClick(row);

    expect(handleDoubleClick).toHaveBeenCalledWith(sampleTransactions[0]);
  });

  it('displays empty state when transactions array is empty', () => {
    render(
      <VirtualTrafficTable
        transactions={[]}
        selectedTxId={null}
        onSelectTx={() => {}}
        emptyMessage="No traffic records"
      />
    );

    expect(screen.getByText('No traffic records')).toBeInTheDocument();
  });
});
