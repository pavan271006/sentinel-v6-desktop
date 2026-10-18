import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleJsonRpcLine,
  handleJsonRpcRequest,
  getMcpToolsList,
} from '../../scripts/sentinel_mcp_server';
import { ipcClient } from '../../src/ipc/client';

describe('Sentinel Stdio MCP Server (JSON-RPC 2.0 In-Memory & Protocol Suite)', () => {
  beforeEach(() => {
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (params: any) => {
      return {
        tabId: params?.tabId || 'test',
        statusCode: 200,
        statusText: 'OK',
        body: '{"status":"ok"}',
        headers: [{ name: 'content-type', value: 'application/json' }],
        roundTripTime: 12,
        time: 12,
        timestamp: Date.now(),
        rawResponse: 'HTTP/1.1 200 OK\r\n\r\n{"status":"ok"}',
      } as any;
    });
  });

  it('1. correctly enriches and exposes all 16 MCP tools', () => {
    const tools = getMcpToolsList();
    expect(tools.length).toBe(16);

    const names = tools.map((t) => t.name);
    // Core 4-pillar recon tools
    expect(names).toContain('sentinel_capture_full_knowledge_base');
    expect(names).toContain('sentinel_recon_infrastructure');
    expect(names).toContain('sentinel_dredge_client_bundles');
    expect(names).toContain('sentinel_stealth_browser_crawl');
    expect(names).toContain('sentinel_mine_historical_archives');
    expect(names).toContain('sentinel_discover_api_docs_and_debug');
    expect(names).toContain('sentinel_verify_origin_bypass');
    // Active pentest tools
    expect(names).toContain('sentinel_send_repeater_request');
    expect(names).toContain('sentinel_run_turbo_fuzzer');
    expect(names).toContain('sentinel_run_nuclei_scan');
    expect(names).toContain('sentinel_query_traffic_httpql');
    // Autonomous Pre-Assessment Agent tool
    expect(names).toContain('sentinel_run_autonomous_assessment');
  });

  it('2. handles MCP initialize handshake properly', async () => {
    const initReq = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'claude-desktop', version: '0.7.0' } },
    });

    const res = await handleJsonRpcLine(initReq);
    expect(res).toBeDefined();
    expect(res.id).toBe(1);
    expect(res.jsonrpc).toBe('2.0');
    expect(res.result.protocolVersion).toBe('2024-11-05');
    expect(res.result.serverInfo.name).toBe('sentinel-sovereign-recon');
    expect(res.result.serverInfo.version).toBe('6.0.0');
  });

  it('3. handles tools/list and returns valid inputSchema for each tool', async () => {
    const listReq = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    const res = await handleJsonRpcLine(listReq);
    expect(res.id).toBe(2);
    expect(Array.isArray(res.result.tools)).toBe(true);
    expect(res.result.tools.length).toBe(16);

    for (const tool of res.result.tools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('4. executes tools/call for query_traffic_httpql and returns formatted text', async () => {
    const callReq = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'sentinel_query_traffic_httpql',
        arguments: { query: 'req.method == "POST"' },
      },
    });

    const res = await handleJsonRpcLine(callReq);
    expect(res.id).toBe(3);
    expect(res.result.isError).toBe(false);
    expect(Array.isArray(res.result.content)).toBe(true);
    expect(res.result.content[0].type).toBe('text');

    const parsed = JSON.parse(res.result.content[0].text);
    expect(parsed.query).toBe('req.method == "POST"');
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  it('5. returns JSON-RPC error codes for parse error, unknown method, and notification ignore', async () => {
    // Malformed JSON
    const parseErr = await handleJsonRpcLine('{ invalid_json');
    expect(parseErr.error.code).toBe(-32700);

    // Unknown method
    const unknownMethod = await handleJsonRpcLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 42,
      method: 'unknown/method',
    }));
    expect(unknownMethod.error.code).toBe(-32601);

    // Notification (id is null/undefined) -> returns null
    const notif = await handleJsonRpcLine(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }));
    expect(notif).toBeNull();
  });
});
