import { create } from 'zustand';

export interface ComparerState {
  textA: string;
  textB: string;
  mode: 'words' | 'bytes';
  viewMode: 'pretty' | 'raw' | 'hex';
  setTextA: (text: string) => void;
  setTextB: (text: string) => void;
  setMode: (mode: 'words' | 'bytes') => void;
  setViewMode: (viewMode: 'pretty' | 'raw' | 'hex') => void;
  sendToComparer: (tx: any, target?: 'request' | 'response') => void;
  sendRequestToComparer: (tx: any) => void;
  sendResponseToComparer: (tx: any) => void;
}

export const useComparerStore = create<ComparerState>((set, get) => ({
  textA: `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 42\r\n\r\n{"status": "success", "user": "admin", "role": "admin"}`,
  textB: `HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: 38\r\n\r\n{"status": "error", "user": "guest", "role": "anonymous"}`,
  mode: 'words',
  viewMode: 'pretty',
  setTextA: (textA) => set({ textA }),
  setTextB: (textB) => set({ textB }),
  setMode: (mode) => set({ mode }),
  setViewMode: (viewMode) => set({ viewMode }),

  sendToComparer: (tx, target = 'request') => {
    if (target === 'response') {
      get().sendResponseToComparer(tx);
    } else {
      get().sendRequestToComparer(tx);
    }
  },

  sendRequestToComparer: (tx) => {
    const { textA } = get();
    let raw = '';
    if (typeof tx === 'string') {
      raw = tx;
    } else if (tx?.rawRequest) {
      raw = tx.rawRequest;
    } else {
      const headers = tx?.reqHeaders || tx?.request?.headers || [];
      const headerLines = Array.isArray(headers) ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n') : '';
      const body = tx?.reqBody || tx?.request?.bodyText || (typeof tx?.request?.bodyBytes === 'string' ? tx.request.bodyBytes : '') || '';
      let urlPath = tx?.url || tx?.request?.url || '/';
      try {
        if (urlPath.startsWith('http')) {
          const u = new URL(urlPath);
          urlPath = u.pathname + u.search;
        }
      } catch {}
      const method = tx?.method || tx?.request?.method || 'GET';
      raw = `${method} ${urlPath} HTTP/1.1\r\n${headerLines}\r\n\r\n${body}`;
    }

    if (!textA || textA.includes('{"status": "success"')) {
      set({ textA: raw });
    } else {
      set({ textB: raw });
    }
  },

  sendResponseToComparer: (tx) => {
    const { textA } = get();
    let raw = '';
    if (typeof tx === 'string') {
      raw = tx;
    } else if (tx?.rawResponse || tx?.responseRaw) {
      raw = tx.rawResponse || tx.responseRaw;
    } else {
      const headers = tx?.resHeaders || tx?.response?.headers || [];
      const headerLines = Array.isArray(headers) ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n') : '';
      const body = tx?.resBody || tx?.response?.bodyText || (typeof tx?.response?.bodyBytes === 'string' ? tx.response.bodyBytes : '') || '';
      const status = tx?.status || tx?.response?.statusCode || 200;
      const statusText = tx?.statusText || tx?.response?.statusText || 'OK';
      raw = `HTTP/1.1 ${status} ${statusText}\r\n${headerLines}\r\n\r\n${body}`;
    }

    if (!textA || textA.includes('{"status": "success"')) {
      set({ textA: raw });
    } else {
      set({ textB: raw });
    }
  },
}));
