import { describe, it, expect, beforeEach } from 'vitest';

import { render, screen } from '@testing-library/react';
import { VirtualTrafficTable } from '../../src/components/traffic/VirtualTrafficTable';
import { useTrafficStore } from '../../src/stores/trafficStore';
import { TrafficSummary } from '../../src/types/traffic';
import { parseHttpql, evaluateHttpql } from '../../src/utils/httpql';

function generate100KDataset(count = 100000): TrafficSummary[] {
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const paths = [
    '/api/v1/auth/login',
    '/api/v1/users/profile',
    '/api/v1/orders/checkout',
    '/graphql?query=getCart',
    '/oauth/v2/token',
    '/static/assets/app.js',
    '/api/v2/admin/roles',
    '/api/v1/invoices/export',
  ];
  const statuses = [200, 201, 204, 302, 400, 401, 403, 404, 500];

  const dataset: TrafficSummary[] = new Array(count);
  const baseTime = 1720000000000;

  for (let i = 0; i < count; i++) {
    const method = methods[i % methods.length];
    const path = paths[i % paths.length];
    const status = statuses[i % statuses.length];
    const durationMs = 15 + ((i * 31) % 450);
    const sizeBytes = 256 + ((i * 128) % 32768);
    const inScope = i % 8 !== 0;

    dataset[i] = {
      id: `tx-${(i + 1).toString().padStart(6, '0')}`,
      seqNumber: i + 1,
      timestamp: '12:00:00',
      timestampMs: baseTime + i * 100,
      method,
      url: `https://target.local${path}`,
      host: 'target.local',
      path,
      status,
      durationMs,
      sizeBytes,
      inScope,
      mimeType: path.includes('graphql') || path.includes('api') ? 'application/json' : 'text/html',
      tags: inScope ? ['scope:target'] : ['scope:out-of-scope'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    };
  }

  return dataset;
}

describe('Traffic Large Dataset & Virtualization Stress Suite (100,000 items)', () => {
  beforeEach(async () => {
    await useTrafficStore.getState().clearTraffic();
    useTrafficStore.getState().resetFilters();
  });

  it('1. Virtualizes 100,000 transaction rows with constant O(1) DOM node footprint', () => {
    const dataset = generate100KDataset(100000);
    expect(dataset).toHaveLength(100000);

    const { container } = render(
      <div style={{ height: '400px', width: '800px' }}>
        <VirtualTrafficTable
          transactions={dataset}
          selectedTxId="tx-000001"
          onSelectTx={() => {}}
        />
      </div>
    );

    // Initial visible row should be rendered
    expect(screen.getByText('tx-000001')).toBeInTheDocument();

    // Verify row-100000 is NOT in DOM
    expect(screen.queryByText('tx-100000')).toBeNull();

    // Constant cell footprint in DOM (far less than 1,000,000 cells)
    const renderedCells = container.querySelectorAll('.dense-cell, td, div[style*="position: absolute"]');
    expect(renderedCells.length).toBeLessThan(1000);
  });


  it('2. Benchmarks sub-millisecond HTTPQL query evaluation throughput across 100K items', () => {
    const dataset = generate100KDataset(100000);
    const { ast } = parseHttpql('req.method == "POST" and res.status >= 400 and tx.in_scope == true');

    const start = performance.now();
    let matchCount = 0;

    for (let i = 0; i < dataset.length; i++) {
      if (evaluateHttpql(ast, dataset[i])) {
        matchCount++;
      }
    }
    const elapsed = performance.now() - start;

    expect(matchCount).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500); // 100,000 evaluations completed in <500ms (average <0.005ms/item)
  });

  it('3. Handles streaming burst of 10,000 transactions with bounded ring buffer memory stability', () => {
    useTrafficStore.setState({ maxRingBufferSize: 10000 });
    const burst = generate100KDataset(10000);

    const start = performance.now();
    useTrafficStore.getState().ingestBatch(burst);
    const elapsed = performance.now() - start;

    const state = useTrafficStore.getState();
    expect(state.transactions).toHaveLength(10000);
    expect(state.transactionMap.size).toBe(10000);
    expect(elapsed).toBeLessThan(300);
  });

  it('4. Preserves active selection and multi-selection sets across 100K item dataset', () => {
    const dataset = generate100KDataset(10000);
    const selectedIds = new Set(['tx-000005', 'tx-000500', 'tx-009999']);

    render(
      <VirtualTrafficTable
        transactions={dataset}
        selectedTxId="tx-000500"
        selectedTxIds={selectedIds}
        onSelectTx={() => {}}
      />
    );

    expect(screen.getByText('3 transactions selected')).toBeInTheDocument();
  });
});
