import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWebSocketStore } from '../../src/stores/websocketStore';

describe('useWebSocketStore', () => {
  beforeEach(() => {
    useWebSocketStore.getState().clearMessages();
  });

  it('adds and selects WebSocket messages with calculated sequence numbers', () => {
    const id1 = useWebSocketStore.getState().addMessage({
      url: 'wss://target.local/ws/chat',
      direction: 'To server',
      edited: false,
      lengthBytes: 4,
      notes: 'Initial Ping',
      tls: true,
      time: '12:00:00',
      timestampMs: Date.now(),
      listenerPort: 8080,
      webSocketId: 1,
      payload: 'PING',
      binary: false,
    });

    const state = useWebSocketStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe(id1);
    expect(state.messages[0].seqNumber).toBe(1);
    expect(state.selectedMessageId).toBe(id1);
  });

  it('filters WebSocket messages by direction', () => {
    useWebSocketStore.getState().addMessage({
      url: 'wss://target.local/ws',
      direction: 'To server',
      edited: false,
      lengthBytes: 4,
      notes: '',
      tls: true,
      time: '12:00:00',
      timestampMs: Date.now(),
      listenerPort: 8080,
      webSocketId: 1,
      payload: 'PING',
      binary: false,
    });

    useWebSocketStore.getState().addMessage({
      url: 'wss://target.local/ws',
      direction: 'To client',
      edited: false,
      lengthBytes: 4,
      notes: '',
      tls: true,
      time: '12:00:01',
      timestampMs: Date.now() + 100,
      listenerPort: 8080,
      webSocketId: 1,
      payload: 'PONG',
      binary: false,
    });

    expect(useWebSocketStore.getState().messages).toHaveLength(2);

    useWebSocketStore.getState().setFilterSettings({ showToClient: false });
    expect(useWebSocketStore.getState().filterSettings.showToClient).toBe(false);
  });

  it('simulates custom WebSocket message and receives automated echo', async () => {
    vi.useFakeTimers();

    useWebSocketStore.getState().sendCustomWebSocketMessage('wss://target.local/chat', 'PING');

    expect(useWebSocketStore.getState().messages).toHaveLength(1);
    expect(useWebSocketStore.getState().messages[0].payload).toBe('PING');
    expect(useWebSocketStore.getState().messages[0].direction).toBe('To server');

    vi.advanceTimersByTime(200);

    expect(useWebSocketStore.getState().messages).toHaveLength(2);
    expect(useWebSocketStore.getState().messages[0].payload).toBe('PONG');
    expect(useWebSocketStore.getState().messages[0].direction).toBe('To client');

    vi.useRealTimers();
  });
});
