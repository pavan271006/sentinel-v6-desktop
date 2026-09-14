import { create } from 'zustand';

export interface WebSocketMessageItem {
  id: string;
  seqNumber: number;
  url: string;
  direction: 'To server' | 'To client';
  edited: boolean;
  lengthBytes: number;
  notes: string;
  tls: boolean;
  time: string;
  timestampMs: number;
  listenerPort: number;
  webSocketId: number;
  payload: string;
  binary: boolean;
}

export interface WebSocketFilterSettings {
  showOnlyInScope: boolean;
  showToServer: boolean;
  showToClient: boolean;
  searchTerm: string;
  caseSensitive: boolean;
  isRegex: boolean;
}

export const DEFAULT_WS_FILTER: WebSocketFilterSettings = {
  showOnlyInScope: false,
  showToServer: true,
  showToClient: true,
  searchTerm: '',
  caseSensitive: false,
  isRegex: false,
};

export interface WebSocketStoreState {
  messages: WebSocketMessageItem[];
  selectedMessageId: string | null;
  filterSettings: WebSocketFilterSettings;
  filterOn: boolean;
  viewMode: 'Pretty' | 'Raw' | 'Hex';

  // Actions
  selectMessage: (id: string | null) => void;
  addMessage: (msg: Omit<WebSocketMessageItem, 'id' | 'seqNumber'>) => string;
  clearMessages: () => void;
  setFilterSettings: (settings: Partial<WebSocketFilterSettings>) => void;
  setFilterOn: (on: boolean) => void;
  setViewMode: (mode: 'Pretty' | 'Raw' | 'Hex') => void;
  updateMessageNotes: (id: string, notes: string) => void;
  sendCustomWebSocketMessage: (url: string, payload: string) => void;
}

export const useWebSocketStore = create<WebSocketStoreState>((set, get) => ({
  messages: [],
  selectedMessageId: null,
  filterSettings: { ...DEFAULT_WS_FILTER },
  filterOn: true,
  viewMode: 'Raw',

  selectMessage: (selectedMessageId) => set({ selectedMessageId }),

  addMessage: (msg) => {
    const id = `ws-msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    set((state) => {
      const nextSeq = state.messages.length + 1;
      const newItem: WebSocketMessageItem = {
        ...msg,
        id,
        seqNumber: nextSeq,
      };
      return {
        messages: [newItem, ...state.messages],
        selectedMessageId: state.selectedMessageId || id,
      };
    });
    return id;
  },

  clearMessages: () => set({ messages: [], selectedMessageId: null }),

  setFilterSettings: (settings) =>
    set((state) => ({
      filterSettings: { ...state.filterSettings, ...settings },
    })),

  setFilterOn: (filterOn) => set({ filterOn }),

  setViewMode: (viewMode) => set({ viewMode }),

  updateMessageNotes: (id, notes) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, notes } : m)),
    })),

  sendCustomWebSocketMessage: (url, payload) => {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]} ${now.getDate()} ${now.toLocaleString('default', { month: 'short' })}`;

    get().addMessage({
      url,
      direction: 'To server',
      edited: false,
      lengthBytes: new TextEncoder().encode(payload).length,
      notes: '',
      tls: url.startsWith('wss://') || url.startsWith('https://'),
      time: timeStr,
      timestampMs: Date.now(),
      listenerPort: 8080,
      webSocketId: 1,
      payload,
      binary: false,
    });

    // Simulate server echo response
    setTimeout(() => {
      get().addMessage({
        url,
        direction: 'To client',
        edited: false,
        lengthBytes: new TextEncoder().encode(payload === 'PING' ? 'PONG' : payload).length,
        notes: '',
        tls: url.startsWith('wss://') || url.startsWith('https://'),
        time: timeStr,
        timestampMs: Date.now(),
        listenerPort: 8080,
        webSocketId: 1,
        payload: payload === 'PING' ? 'PONG' : payload.startsWith('{') ? `{"status":"ack","data":${payload}}` : `ACK: ${payload}`,
        binary: false,
      });
    }, 150);
  },
}));
