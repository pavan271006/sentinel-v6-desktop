import { describe, it, expect, beforeEach } from 'vitest';
import { useInterceptStore } from '../../src/stores/interceptStore';
import { useTrafficStore } from '../../src/stores/trafficStore';

describe('useInterceptStore', () => {
  beforeEach(() => {
    useInterceptStore.getState().dropAll();
    useTrafficStore.getState().clearTraffic();
  });

  it('enqueues a raw HTTP request properly into the intercepted queue', () => {
    const raw = 'GET /search?q=hi HTTP/1.1\r\nHost: www.google.com\r\nUser-Agent: TestAgent\r\n\r\n';
    const id = useInterceptStore.getState().enqueueRequest(raw, 'https://www.google.com/search?q=hi');

    const state = useInterceptStore.getState();
    expect(state.interceptedQueue).toHaveLength(1);
    expect(state.interceptedQueue[0].id).toBe(id);
    expect(state.interceptedQueue[0].method).toBe('GET');
    expect(state.interceptedQueue[0].host).toBe('www.google.com');
    expect(state.interceptedQueue[0].queryParams).toEqual([{ name: 'q', value: 'hi' }]);
    expect(state.selectedQueueId).toBe(id);
    expect(state.editedRawRequest).toBe(raw);
  });

  it('drops an intercepted request from the queue', () => {
    const raw1 = 'GET /one HTTP/1.1\r\nHost: example.com\r\n\r\n';
    const raw2 = 'GET /two HTTP/1.1\r\nHost: example.com\r\n\r\n';

    const id1 = useInterceptStore.getState().enqueueRequest(raw1, 'https://example.com/one');
    const id2 = useInterceptStore.getState().enqueueRequest(raw2, 'https://example.com/two');

    expect(useInterceptStore.getState().interceptedQueue).toHaveLength(2);

    useInterceptStore.getState().dropRequest(id1);

    const state = useInterceptStore.getState();
    expect(state.interceptedQueue).toHaveLength(1);
    expect(state.interceptedQueue[0].id).toBe(id2);
    expect(state.selectedQueueId).toBe(id2);
  });

  it('forwards an intercepted request and records it in trafficStore', async () => {
    const raw = 'GET /search?q=hi HTTP/1.1\r\nHost: www.google.com\r\n\r\n';
    const id = useInterceptStore.getState().enqueueRequest(raw, 'https://www.google.com/search?q=hi');

    await useInterceptStore.getState().forwardRequest(id);

    const state = useInterceptStore.getState();
    expect(state.interceptedQueue).toHaveLength(0);

    const traffic = useTrafficStore.getState().transactions;
    expect(traffic.length).toBeGreaterThan(0);
    expect(traffic[0].url).toContain('https://www.google.com/search?q=hi');
  });

  it('updates query parameters dynamically and syncs editedRawRequest', () => {
    const raw = 'GET /api/v1?page=1&size=20 HTTP/1.1\r\nHost: example.com\r\n\r\n';
    useInterceptStore.getState().enqueueRequest(raw, 'https://example.com/api/v1?page=1&size=20');

    useInterceptStore.getState().updateQueryParam('page', '2');

    const state = useInterceptStore.getState();
    expect(state.editedRawRequest).toContain('page=2');
    expect(state.interceptedQueue[0].queryParams[0]).toEqual({ name: 'page', value: '2' });
  });

  it('adds and deletes headers dynamically', () => {
    const raw = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
    useInterceptStore.getState().enqueueRequest(raw, 'https://example.com/');

    useInterceptStore.getState().addHeader('X-Custom-Auth', 'Bearer Token123');
    let state = useInterceptStore.getState();
    expect(state.editedRawRequest).toContain('X-Custom-Auth: Bearer Token123');

    useInterceptStore.getState().deleteHeader('X-Custom-Auth');
    state = useInterceptStore.getState();
    expect(state.editedRawRequest).not.toContain('X-Custom-Auth: Bearer Token123');
  });
});
