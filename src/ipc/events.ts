import { SentinelUiEvent } from '../types/ipc';
import { useEventBusStore } from '../stores/eventBusStore';
import { useTrafficStore } from '../stores/trafficStore';
import { isTauriEnvironment } from './client';

export type EventListener = (event: SentinelUiEvent) => void;

export class SentinelStreamDispatcher {
  private static instance: SentinelStreamDispatcher;
  private listeners: Set<EventListener> = new Set();
  private unlistenFn: (() => void) | null = null;
  private isListening = false;

  private constructor() {}

  public static getInstance(): SentinelStreamDispatcher {
    if (!SentinelStreamDispatcher.instance) {
      SentinelStreamDispatcher.instance = new SentinelStreamDispatcher();
    }
    return SentinelStreamDispatcher.instance;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispatch(event: SentinelUiEvent): void {
    // 1. Dispatch to global event bus store
    useEventBusStore.getState().handleIncomingEvent(event);

    // 2. If traffic event, directly ingest into trafficStore
    if (event.type === 'traffic') {
      useTrafficStore.getState().ingestStreamEvent(event.data);
    }

    // 3. Dispatch to custom subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[SentinelStreamDispatcher] Error in listener:', err);
      }
    });
  }

  public async startListening(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;

    if (isTauriEnvironment()) {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten1 = await listen<SentinelUiEvent>('sentinel://stream-event', (event) => {
          this.dispatch(event.payload);
        });
        const unlisten2 = await listen<any>('ui_traffic_event', (event) => {
          // Parse telemetry or traffic event
          if (event.payload) {
            this.dispatch({
              type: 'traffic',
              data: {
                transactionId: event.payload.id || `tx-${Date.now().toString().slice(-6)}`,
                timestamp: {
                  seconds: Math.floor(Date.now() / 1000),
                  nanos: 0,
                },
                method: event.payload.method || 'GET',
                uri: event.payload.url || 'https://www.gsmarena.com/',
                status: event.payload.status || 200,
                durationMs: event.payload.duration_ms || 45,
                inScope: true,
                tags: ['scope:target'],
                reqHeaders: event.payload.req_headers,
                reqBody: event.payload.req_body,
                resHeaders: event.payload.res_headers,
                resBody: event.payload.res_body,
              },
            });
          }
        });
        this.unlistenFn = () => {
          unlisten1();
          unlisten2();
        };
        useEventBusStore.getState().setStreamingConnected(true);
      } catch (err) {
        console.warn('[SentinelStreamDispatcher] Failed to attach Tauri event listener:', err);
      }
    } else {
      useEventBusStore.getState().setStreamingConnected(true);
    }
  }

  public stopListening(): void {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.isListening = false;
    useEventBusStore.getState().setStreamingConnected(false);
  }
}

export const streamDispatcher = SentinelStreamDispatcher.getInstance();
