import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSqlScannerStore } from '../../src/stores/sqlScannerStore';
import { ipcClient } from '../../src/ipc/client';

describe('sqlScannerStore stopScan execution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSqlScannerStore.getState().resetScan();
  });

  it('immediately sets scanState to aborted and halts orchestrator when stopScan is called', async () => {
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return {
        statusCode: 200,
        body: '<html>OK</html>',
        headers: [],
        durationMs: 80,
      } as any;
    });

    const store = useSqlScannerStore.getState();
    const scanPromise = store.startScan();

    await new Promise((r) => setTimeout(r, 15));

    const runningState = useSqlScannerStore.getState();
    expect(runningState.scanState).toBe('running');
    expect(runningState.orchestrator).not.toBeNull();

    useSqlScannerStore.getState().stopScan();

    const stoppedState = useSqlScannerStore.getState();
    expect(stoppedState.scanState).toBe('aborted');
    expect(stoppedState.scanVerdict).not.toBe('IN_PROGRESS');
    expect(stoppedState.orchestrator).toBeNull();

    await scanPromise;

    const finalState = useSqlScannerStore.getState();
    expect(finalState.scanState).toBe('aborted');
    expect(finalState.orchestrator).toBeNull();
  });
});
