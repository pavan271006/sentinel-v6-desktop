import { create } from 'zustand';

export interface ComparerState {
  textA: string;
  textB: string;
  mode: 'words' | 'bytes';
  setTextA: (text: string) => void;
  setTextB: (text: string) => void;
  setMode: (mode: 'words' | 'bytes') => void;
  sendToComparer: (tx: any) => void;
}

export const useComparerStore = create<ComparerState>((set, get) => ({
  textA: `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 42\r\n\r\n{"status": "success", "user": "admin", "role": "admin"}`,
  textB: `HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: 38\r\n\r\n{"status": "error", "user": "guest", "role": "anonymous"}`,
  mode: 'words',
  setTextA: (textA) => set({ textA }),
  setTextB: (textB) => set({ textB }),
  setMode: (mode) => set({ mode }),
  sendToComparer: (tx) => {
    const { textA } = get();
    const headers = tx?.reqHeaders || tx?.request?.headers || tx?.resHeaders || tx?.response?.headers || [];
    const headerLines = Array.isArray(headers) ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n') : '';
    const body = tx?.reqBody || tx?.request?.bodyText || tx?.resBody || tx?.response?.bodyText || '';
    const url = tx?.url || tx?.request?.url || '';
    const method = tx?.method || tx?.request?.method || 'GET';
    const raw = `${method} ${url} HTTP/1.1\r\n${headerLines}\r\n\r\n${body}`;

    if (!textA || textA.includes('{"status": "success"')) {
      set({ textA: raw });
    } else {
      set({ textB: raw });
    }
  },
}));
