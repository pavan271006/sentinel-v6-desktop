import { describe, it, expect, vi } from 'vitest';
import { streamDispatcher } from '../../src/ipc/events';
import { useEventBusStore } from '../../src/stores/eventBusStore';
import { SentinelUiEvent } from '../../src/types/ipc';

describe('SentinelStreamDispatcher & EventBus', () => {
  it('dispatches traffic event to subscribers and store', () => {
    const subscriber = vi.fn();
    const unsubscribe = streamDispatcher.subscribe(subscriber);

    const initialTrafficCount = useEventBusStore.getState().trafficCount;

    const event: SentinelUiEvent = {
      type: 'traffic',
      data: {
        transactionId: 'tx-test-999',
        timestamp: { seconds: 1723900000, nanos: 0 },
        method: 'POST',
        uri: 'https://target.local/api/v1/test',
        status: 201,
        durationMs: 45,
        inScope: true,
        tags: ['scope:target'],
      },
    };

    streamDispatcher.dispatch(event);

    expect(subscriber).toHaveBeenCalledWith(event);
    expect(useEventBusStore.getState().trafficCount).toBe(initialTrafficCount + 1);

    unsubscribe();
  });

  it('dispatches scope violation event and increments violation counter', () => {
    const initialViolations = useEventBusStore.getState().scopeViolationsCount;

    const event: SentinelUiEvent = {
      type: 'scope_violation',
      data: {
        requestId: 'req-blocked-1',
        attemptedUri: 'https://evil-out-of-scope.com',
        violationReason: 'Fail-closed: domain not in inclusion list',
        timestamp: { seconds: 1723900000, nanos: 0 },
      },
    };

    streamDispatcher.dispatch(event);
    expect(useEventBusStore.getState().scopeViolationsCount).toBe(initialViolations + 1);
  });
});
