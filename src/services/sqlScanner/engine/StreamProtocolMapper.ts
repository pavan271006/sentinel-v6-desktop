/**
 * Sentinel WebSocket (wss://) & Binary gRPC-Web Stream Mapper
 *
 * Solves real-time protocol mapping by:
 * 1. Extracting WebSocket endpoints (wss://, /socket.io, /cable, /ws) and framing formats.
 * 2. Mapping JSON-RPC 2.0, Socket.io, and STOMP message structures into testable attack surfaces.
 * 3. Dissecting gRPC-Web client stubs (application/grpc-web+proto) to extract RPC methods and Protobuf fields.
 */

import { DiscoveredEndpoint, TargetSiteCrawler } from '../crawler/TargetSiteCrawler';

export interface WebSocketRoute {
  url: string;
  protocol: 'raw_ws' | 'socket_io' | 'json_rpc' | 'stomp';
  samplePayload?: string;
  parameters: { name: string; type: 'body_json'; sampleValue: string }[];
}

export interface GrpcWebMethod {
  servicePath: string;
  packageName: string;
  serviceName: string;
  methodName: string;
  requestFields: string[];
}

export class StreamProtocolMapper {
  /**
   * Dissects client-side JavaScript to extract WebSocket routes and event message schemas.
   */
  public static extractWebSocketEndpoints(
    origin: string,
    host: string,
    jsContent: string
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    if (!jsContent || jsContent.length < 20) return endpoints;

    // 1. WebSocket URLs: new WebSocket("wss://...") or new WebSocket("/ws/...")
    const wsUrlRegex = /(?:new\s+WebSocket|io|connectWs)\s*\(\s*["'`](wss?:\/\/[^"'\s`]+|\/(?:ws|socket|socket\.io|cable|stream|realtime|live)[^"'\s`]*)["'`]/gi;
    let match: RegExpExecArray | null;

    while ((match = wsUrlRegex.exec(jsContent)) !== null) {
      const rawWs = match[1];
      const normalizedPath = rawWs.startsWith('ws') ? new URL(rawWs).pathname : rawWs;

      // Extract possible JSON-RPC methods or emitted events nearby
      const jsonRpcRegex = /["']jsonrpc["']\s*:\s*["']2\.0["']\s*,\s*["']method["']\s*:\s*["']([a-zA-Z0-9_\.]+)["']/gi;
      const rpcMethods: string[] = [];
      let rpcMatch: RegExpExecArray | null;
      while ((rpcMatch = jsonRpcRegex.exec(jsContent)) !== null) {
        rpcMethods.push(rpcMatch[1]);
      }

      const sampleMethod = rpcMethods[0] || 'getStreamData';
      const samplePayload = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: sampleMethod,
        params: { id: '1', query: 'test' },
      });

      const params: { name: string; type: 'body_json'; sampleValue: string }[] = [
        { name: 'id', type: 'body_json', sampleValue: '1' },
        { name: 'query', type: 'body_json', sampleValue: 'test' },
      ];

      const scoring = TargetSiteCrawler.scoreSqliSurface('POST', normalizedPath, params);

      const headers: Record<string, string> = {
        Host: host,
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      };

      const rawRequest =
        `GET ${normalizedPath} HTTP/1.1\r\n` +
        Object.entries(headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        `\r\n\r\n${samplePayload}`;

      endpoints.push({
        id: `ep_ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        host,
        url: `${origin}${normalizedPath}`,
        path: normalizedPath,
        method: 'POST',
        headers,
        body: samplePayload,
        source: 'js_endpoint',
        params,
        sqliScore: scoring.sqliScore + 10,
        isSqliCandidate: true,
        sqliReason: `WebSocket real-time stream surface (JSON-RPC/Event frame); ${scoring.sqliReason}`,
        rawRequest,
        statusCode: 101,
        timestamp: Date.now(),
        workflowType: 'trigger',
      });
    }

    return endpoints;
  }

  /**
   * Dissects gRPC-Web client stubs to extract RPC service methods and synthesize Protobuf endpoints.
   */
  public static extractGrpcWebEndpoints(
    origin: string,
    host: string,
    jsContent: string
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    if (!jsContent || jsContent.length < 20) return endpoints;

    const grpcMethodRegex = /["'](\/([a-zA-Z0-9_\.]+)\.([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+))["']/gi;
    let match: RegExpExecArray | null;

    const seenPaths = new Set<string>();

    while ((match = grpcMethodRegex.exec(jsContent)) !== null) {
      const fullPath = match[1];
      const pkg = match[2];
      const service = match[3];
      const method = match[4];

      if (seenPaths.has(fullPath) || fullPath.includes('.js') || fullPath.includes('.css')) continue;
      seenPaths.add(fullPath);

      const params: { name: string; type: 'body_json'; sampleValue: string }[] = [
        { name: 'id', type: 'body_json', sampleValue: '1' },
        { name: 'filter', type: 'body_json', sampleValue: 'admin' },
      ];

      const scoring = TargetSiteCrawler.scoreSqliSurface('POST', fullPath, params);

      const headers: Record<string, string> = {
        Host: host,
        'Content-Type': 'application/grpc-web+proto',
        'X-Grpc-Web': '1',
        'X-User-Agent': 'grpc-web-javascript/0.1',
        Accept: 'application/grpc-web-text',
      };

      const sampleBody = `{"service":"${pkg}.${service}","method":"${method}","fields":{"id":"1","filter":"admin"}}`;

      const rawRequest =
        `POST ${fullPath} HTTP/1.1\r\n` +
        Object.entries(headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        `\r\n\r\n${sampleBody}`;

      endpoints.push({
        id: `ep_grpc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        host,
        url: `${origin}${fullPath}`,
        path: fullPath,
        method: 'POST',
        headers,
        body: sampleBody,
        source: 'js_endpoint',
        params,
        sqliScore: scoring.sqliScore + 15,
        isSqliCandidate: true,
        sqliReason: `gRPC-Web Binary Protobuf RPC (${pkg}.${service}/${method}); ${scoring.sqliReason}`,
        rawRequest,
        statusCode: 200,
        timestamp: Date.now(),
        workflowType: TargetSiteCrawler.classifyWorkflowType('POST', fullPath),
      });
    }

    return endpoints;
  }
}
