import { describe, it, expect, beforeEach } from 'vitest';
import { useTrafficStore } from '../../src/stores/trafficStore';
import { TrafficSummary } from '../../src/types/traffic';
import { UiTrafficEvent } from '../../src/types/ipc';

describe('TrafficStore (useTrafficStore)', () => {
  beforeEach(async () => {
    await useTrafficStore.getState().clearTraffic();
    useTrafficStore.getState().resetFilters();
  });

  const createDummyTx = (idNum: number, method = 'GET', status = 200, inScope = true): TrafficSummary => ({
    id: `tx-${idNum.toString().padStart(6, '0')}`,
    seqNumber: idNum,
    timestamp: '12:00:00',
    timestampMs: 1720000000000 + idNum * 1000,
    method,
    url: `https://target.local/api/item/${idNum}`,
    host: 'target.local',
    path: `/api/item/${idNum}`,
    status,
    durationMs: 50 + idNum,
    sizeBytes: 100 + idNum * 10,
    inScope,
    mimeType: 'application/json',
    tags: inScope ? ['scope:target'] : ['scope:out-of-scope'],
  });

  it('ingests batch of transactions and maintains map and count', () => {
    const store = useTrafficStore.getState();
    const batch = [
      createDummyTx(1, 'GET', 200, true),
      createDummyTx(2, 'POST', 201, true),
      createDummyTx(3, 'DELETE', 404, false),
    ];

    store.ingestBatch(batch);

    const updated = useTrafficStore.getState();
    expect(updated.transactions).toHaveLength(3);
    expect(updated.transactionMap.size).toBe(3);
    expect(updated.totalCapturedCount).toBe(3);
    expect(updated.transactionMap.get('tx-000001')?.method).toBe('GET');
  });

  it('ingests UiTrafficEvent and calculates derived path, host, and timing', () => {
    const store = useTrafficStore.getState();
    const event: UiTrafficEvent = {
      transactionId: 'tx-stream-001',
      timestamp: { seconds: 1720000000, nanos: 0 },
      method: 'PUT',
      uri: 'https://api.target.local/v1/update',
      status: 204,
      durationMs: 120,
      inScope: true,
      tags: ['scope:target', 'mutation'],
    };

    store.ingestStreamEvent(event);

    const updated = useTrafficStore.getState();
    expect(updated.transactions).toHaveLength(1);
    const tx = updated.transactions[0];
    expect(tx.id).toBe('tx-stream-001');
    expect(tx.method).toBe('PUT');
    expect(tx.host).toBe('api.target.local');
    expect(tx.path).toBe('/v1/update');
    expect(tx.status).toBe(204);
  });

  it('respects ring buffer capacity by evicting oldest items when exceeding limit', () => {
    const store = useTrafficStore.getState();
    useTrafficStore.setState({ maxRingBufferSize: 5 });

    const batch = [
      createDummyTx(1),
      createDummyTx(2),
      createDummyTx(3),
      createDummyTx(4),
      createDummyTx(5),
      createDummyTx(6), // should evict tx-000001
      createDummyTx(7), // should evict tx-000002
    ];

    store.ingestBatch(batch);

    const updated = useTrafficStore.getState();
    expect(updated.transactions).toHaveLength(5);
    expect(updated.transactions[0].id).toBe('tx-000003');
    expect(updated.transactions[4].id).toBe('tx-000007');
    expect(updated.transactionMap.has('tx-000001')).toBe(false);
    expect(updated.transactionMap.has('tx-000007')).toBe(true);
  });

  it('evaluates HTTPQL filter and filters transaction indices', () => {
    const store = useTrafficStore.getState();
    store.ingestBatch([
      createDummyTx(1, 'GET', 200, true),
      createDummyTx(2, 'POST', 400, true),
      createDummyTx(3, 'POST', 500, false),
      createDummyTx(4, 'GET', 404, true),
    ]);

    store.setHttpqlQuery('req.method == "POST" and res.status >= 400');

    const updated = useTrafficStore.getState();
    expect(updated.httpqlValidation.valid).toBe(true);
    expect(updated.filteredIndices).toEqual([1, 2]); // indices of tx-000002 and tx-000003
  });

  it('applies quick filters (scope only SEC-01, method pills, status pills)', () => {
    const store = useTrafficStore.getState();
    store.ingestBatch([
      createDummyTx(1, 'GET', 200, true),
      createDummyTx(2, 'POST', 201, false),
      createDummyTx(3, 'PUT', 404, true),
      createDummyTx(4, 'DELETE', 500, true),
    ]);

    // Enable Scope Only
    store.setScopeOnly(true);
    let state = useTrafficStore.getState();
    expect(state.filteredIndices).toEqual([0, 2, 3]);

    // Toggle Method Filter for PUT & DELETE
    store.toggleMethodFilter('PUT');
    store.toggleMethodFilter('DELETE');
    state = useTrafficStore.getState();
    expect(state.filteredIndices).toEqual([2, 3]);

    // Toggle Status Filter for 4xx
    store.toggleStatusFilter('4xx');
    state = useTrafficStore.getState();
    expect(state.filteredIndices).toEqual([2]); // Only tx-000003 matches
  });

  it('handles single selection and multi-selection sets', () => {
    const store = useTrafficStore.getState();
    store.ingestBatch([createDummyTx(1), createDummyTx(2), createDummyTx(3)]);

    // Single select
    store.setSelectedId('tx-000002');
    let state = useTrafficStore.getState();
    expect(state.selectedId).toBe('tx-000002');
    expect(state.selectedIds.has('tx-000002')).toBe(true);

    // Multi-select with toggle
    store.toggleSelectId('tx-000003');
    state = useTrafficStore.getState();
    expect(state.selectedIds.size).toBe(2);
    expect(state.selectedIds.has('tx-000002')).toBe(true);
    expect(state.selectedIds.has('tx-000003')).toBe(true);

    // Select all visible
    store.selectAllVisible();
    state = useTrafficStore.getState();
    expect(state.selectedIds.size).toBe(3);

    // Clear selection
    store.clearSelection();
    state = useTrafficStore.getState();
    expect(state.selectedIds.size).toBe(0);
  });

  it('manages diff pair and opens diff modal', () => {
    const store = useTrafficStore.getState();
    store.ingestBatch([createDummyTx(1, 'GET', 200), createDummyTx(2, 'POST', 403)]);

    store.setDiffPair('tx-000001', 'tx-000002');

    const state = useTrafficStore.getState();
    expect(state.diffPair).toEqual(['tx-000001', 'tx-000002']);
    expect(state.diffModal.isOpen).toBe(true);
    expect(state.diffModal.txA?.id).toBe('tx-000001');
    expect(state.diffModal.txB?.id).toBe('tx-000002');

    store.closeDiffModal();
    expect(useTrafficStore.getState().diffModal.isOpen).toBe(false);
  });

  it('toggles streaming pause state and auto-scroll', () => {
    const store = useTrafficStore.getState();
    expect(store.isPaused).toBe(false);

    store.toggleStreaming();
    expect(useTrafficStore.getState().isPaused).toBe(true);

    store.setAutoScroll(false);
    expect(useTrafficStore.getState().autoScroll).toBe(false);
  });
});
