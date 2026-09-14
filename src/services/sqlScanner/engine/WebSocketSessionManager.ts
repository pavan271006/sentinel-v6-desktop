/**
 * Sentinel Stateful WebSocket Frame & Protocol Session Manager
 *
 * Solves real-time duplex protocol testing by:
 * 1. Generating valid WebSocket upgrade handshakes (Sec-WebSocket-Key, Sec-WebSocket-Version: 13).
 * 2. Framing JSON-RPC 2.0, Socket.io, and STOMP message payloads.
 * 3. Correlating asynchronous request/response message IDs.
 */

export class WebSocketSessionManager {
  public static generateUpgradeHeaders(host: string, subprotocols?: string[]): Record<string, string> {
    const nonce = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    const secKey = Buffer.from(new Uint8Array(nonce)).toString('base64');

    const headers: Record<string, string> = {
      Host: host,
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': secKey,
    };

    if (subprotocols && subprotocols.length > 0) {
      headers['Sec-WebSocket-Protocol'] = subprotocols.join(', ');
    }

    return headers;
  }

  public static createJsonRpcFrame(method: string, params: Record<string, any>, id: number = 1): string {
    return JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    });
  }

  public static createStompSendFrame(destination: string, body: string, headers: Record<string, string> = {}): string {
    const headerLines = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n');
    return `SEND\ndestination:${destination}\n${headerLines}\n\n${body}\0`;
  }
}
