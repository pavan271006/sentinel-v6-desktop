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

const SEED_WS_URL = 'https://0a68003d033b87c3807eda3900a2004e.web-security-academy.net/chat';

const SEED_MESSAGES: WebSocketMessageItem[] = [
  {
    id: 'ws-msg-1',
    seqNumber: 1,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:53:53 6 Sep',
    timestampMs: Date.now() - 60000,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PING',
    binary: false,
  },
  {
    id: 'ws-msg-2',
    seqNumber: 2,
    url: SEED_WS_URL,
    direction: 'To client',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:53:53 6 Sep',
    timestampMs: Date.now() - 59900,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PONG',
    binary: false,
  },
  {
    id: 'ws-msg-3',
    seqNumber: 3,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:53:58 6 Sep',
    timestampMs: Date.now() - 55000,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PING',
    binary: false,
  },
  {
    id: 'ws-msg-4',
    seqNumber: 4,
    url: SEED_WS_URL,
    direction: 'To client',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:53:58 6 Sep',
    timestampMs: Date.now() - 54900,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PONG',
    binary: false,
  },
  {
    id: 'ws-msg-5',
    seqNumber: 5,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:03 6 Sep',
    timestampMs: Date.now() - 50000,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PING',
    binary: false,
  },
  {
    id: 'ws-msg-6',
    seqNumber: 6,
    url: SEED_WS_URL,
    direction: 'To client',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:03 6 Sep',
    timestampMs: Date.now() - 49900,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PONG',
    binary: false,
  },
  {
    id: 'ws-msg-7',
    seqNumber: 7,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:08 6 Sep',
    timestampMs: Date.now() - 45000,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PING',
    binary: false,
  },
  {
    id: 'ws-msg-8',
    seqNumber: 8,
    url: SEED_WS_URL,
    direction: 'To client',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:08 6 Sep',
    timestampMs: Date.now() - 44900,
    listenerPort: 8080,
    webSocketId: 1,
    payload: 'PONG',
    binary: false,
  },
  {
    id: 'ws-msg-9',
    seqNumber: 9,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:18 6 Sep',
    timestampMs: Date.now() - 35000,
    listenerPort: 8080,
    webSocketId: 2,
    payload: 'PING',
    binary: false,
  },
  {
    id: 'ws-msg-10',
    seqNumber: 10,
    url: SEED_WS_URL,
    direction: 'To client',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:18 6 Sep',
    timestampMs: Date.now() - 34900,
    listenerPort: 8080,
    webSocketId: 2,
    payload: 'PONG',
    binary: false,
  },
  {
    id: 'ws-msg-11',
    seqNumber: 11,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:23 6 Sep',
    timestampMs: Date.now() - 30000,
    listenerPort: 8080,
    webSocketId: 2,
    payload: 'PING',
    binary: false,
  },
  {
    id: 'ws-msg-12',
    seqNumber: 12,
    url: SEED_WS_URL,
    direction: 'To client',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:24 6 Sep',
    timestampMs: Date.now() - 29900,
    listenerPort: 8080,
    webSocketId: 2,
    payload: 'PONG',
    binary: false,
  },
  {
    id: 'ws-msg-13',
    seqNumber: 13,
    url: SEED_WS_URL,
    direction: 'To server',
    edited: false,
    lengthBytes: 4,
    notes: '',
    tls: true,
    time: '00:54:28 6 Sep',
    timestampMs: Date.now() - 25000,
    listenerPort: 8080,
    webSocketId: 2,
    payload: 'PING',
    binary: false,
  },
];

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
  messages: SEED_MESSAGES,
  selectedMessageId: 'ws-msg-1',
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
