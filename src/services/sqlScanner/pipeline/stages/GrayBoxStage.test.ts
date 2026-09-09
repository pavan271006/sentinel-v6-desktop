import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrayBoxStage } from './GrayBoxStage';
import { ScanContext } from '../ScanContext';
import { ipcClient } from '../../../../ipc/client';

import { GhostNetwork } from '../../stealth/GhostNetwork';

describe('GrayBoxStage - Pipeline Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(GhostNetwork.prototype, 'executeRequest').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"status":"ok"}',
      timing: { dns: 0, tcp: 0, tls: 0, firstByte: 10, total: 10 },
      sizeBytes: 15,
      usedProxy: null,
      usedUserAgent: 'Mozilla/5.0',
    });
  });

  it('skips execution gracefully when grayBoxConfig is disabled', async () => {
    const ctx = new ScanContext({
      target: {
        id: 'target-1',
        name: 'Normal Target',
        rawRequest: 'GET /api/users?id=1 HTTP/1.1\r\nHost: example.com\r\n\r\n',
        url: 'https://example.com/api/users?id=1',
        method: 'GET',
        headers: [],
        body: '',
        parameters: [
          {
            id: 'p1',
            name: 'id',
            location: 'query',
            originalValue: '1',
            enabled: true,
          },
        ],
        testedInjectionTypes: {
          errorBased: true,
          booleanBased: true,
          timeBased: false,
          unionBased: false,
          orderBy: false,
          groupBy: false,
          having: false,
          stackedBased: false,
          secondOrder: false,
        },
        grayBoxConfig: {
          enabled: false,
        },
      },
    });

    const stage = new GrayBoxStage();
    expect(stage.id).toBe('gray_box_boundary');
    expect(stage.name).toContain('Gray-Box');

    await stage.execute(ctx);

    expect(ctx.findings.length).toBe(0);
  });

  it('executes hybrid gray-box boundary tests when enabled and captures findings', async () => {
    // Mock repeater IPC
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (_req: any) => {
      return {
        statusCode: 200,
        body: '{"status":"ok"}',
        headers: [{ name: 'content-type', value: 'application/json' }],
        durationMs: 30,
      } as any;
    });

    const ctx = new ScanContext({
      target: {
        id: 'target-gb',
        name: 'Gray-Box Enabled Target',
        rawRequest: 'POST /api/audit HTTP/1.1\r\nHost: target.local\r\nContent-Type: application/json\r\n\r\n{"action":"process"}',
        url: 'https://target.local/api/audit',
        method: 'POST',
        headers: [{ name: 'Content-Type', value: 'application/json', enabled: true }],
        body: '{"action":"process"}',
        parameters: [
          {
            id: 'p-action',
            name: 'action',
            location: 'body_json',
            originalValue: 'process',
            enabled: true,
          },
        ],
        testedInjectionTypes: {
          errorBased: true,
          booleanBased: true,
          timeBased: true,
          unionBased: true,
          orderBy: false,
          groupBy: false,
          having: false,
          stackedBased: false,
          secondOrder: true,
        },
        grayBoxConfig: {
          enabled: true,
          mode: 'hybrid',
          botBypassConfig: {
            enabled: true,
            bypassHeaders: { 'X-Forwarded-For': '127.0.0.1' },
          },
          iastConfig: {
            enabled: true,
            sharedSecret: 'test-secret',
          },
        },
      },
    });

    const stage = new GrayBoxStage();
    await stage.execute(ctx);

    // Verify findings and logs were captured
    expect(ctx.findings.length).toBeGreaterThanOrEqual(1);
    const finding = ctx.findings.find((f) => f.detectionMethod.includes('Gray-Box'));
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('Critical');
    expect(finding?.cwe).toBe('CWE-89');
    expect(finding?.sqliDetected).toBe(true);
  });
});
