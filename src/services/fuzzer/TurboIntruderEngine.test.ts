import { describe, it, expect, vi } from 'vitest';
import { TurboIntruderEngine } from './TurboIntruderEngine';
import { ipcClient } from '../../ipc/client';

describe('TurboIntruderEngine with Robust Anomaly Clustering', () => {
  it('detects statistical outliers using Modified Z-Score and clusters similar responses', async () => {
    // Mock IPC repeater responses: baseline is 200 OK with 100 bytes, but payload 'admin' returns 500 bytes (anomaly)
    let callCount = 0;
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (params: any) => {
      callCount++;
      const isTarget = params.rawRequest.includes('supersecret_admin');
      return {
        tabId: params.tabId,
        statusCode: isTarget ? 200 : 200,
        body: isTarget ? 'A'.repeat(800) : 'A'.repeat(100),
        durationMs: isTarget ? 450 : 20,
        rawResponse: isTarget ? 'HTTP/1.1 200 OK\r\n\r\n' + 'A'.repeat(800) : 'HTTP/1.1 200 OK\r\n\r\n' + 'A'.repeat(100),
      } as any;
    });

    const payloads = ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'supersecret_admin', 'user7', 'user8'];
    const engine = new TurboIntruderEngine({
      targetUrl: 'https://api.target.com/test',
      requestTemplate: 'POST /test HTTP/1.1\r\nHost: api.target.com\r\n\r\nusername=§payload§',
      payloads,
      concurrentWorkers: 2,
    });

    const results = await engine.run();
    expect(results.length).toBe(payloads.length);

    const adminResult = results.find((r) => r.payload === 'supersecret_admin');
    expect(adminResult).toBeDefined();
    expect(adminResult?.isAnomaly).toBe(true);
    expect(adminResult?.anomalyReason).toContain('Statistical length outlier');
    expect(adminResult?.lengthZScore).toBeGreaterThanOrEqual(3.5);
  });
});
