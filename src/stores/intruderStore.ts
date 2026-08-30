import { create } from 'zustand';

export interface IntruderState {
  targetUrl: string;
  requestText: string;
  attackType: 'Sniper attack' | 'Battering ram attack' | 'Pitchfork attack' | 'Cluster bomb attack';
  payloadSets: Record<number, string[]>;
  selectedPosition: number;
  payloadItems: string[];
  setTargetUrl: (url: string | ((prev: string) => string)) => void;
  setRequestText: (text: string | ((prev: string) => string)) => void;
  setAttackType: (type: 'Sniper attack' | 'Battering ram attack' | 'Pitchfork attack' | 'Cluster bomb attack') => void;
  setSelectedPosition: (pos: number) => void;
  setPayloadSetForPosition: (pos: number, items: string[] | ((prev: string[]) => string[])) => void;
  setPayloadItems: (items: string[] | ((prev: string[]) => string[])) => void;
  sendToIntruder: (tx: any) => void;
}

const DEFAULT_PAYLOADS = [
  'admin',
  'user',
  'test',
  'guest',
  'root',
  'oracle',
  'administrator',
  'info',
  'mysql',
  'ftp',
  'pi',
  'puppet',
  "admin' OR 1=1--",
  '<script>alert(1)</script>',
  '../../etc/passwd',
  '${7*7}',
];

export const useIntruderStore = create<IntruderState>((set, get) => ({
  targetUrl: 'https://ims.ritchennai.edu.in',
  requestText: `POST /example?p1=§p1val§&p2=§p2val§ HTTP/1.0\r\nCookie: c=§cval§\r\nContent-Length: 17\r\n\r\np3=§p3val§&p4=§p4val§`,
  attackType: 'Sniper attack',
  selectedPosition: 1,
  payloadSets: {
    1: [...DEFAULT_PAYLOADS],
    2: ['password', '123456', 'admin', 'pass123', 'root', 'qwerty', 'letmein', 'welcome'],
    3: ['token1', 'token2', 'token3', 'token4'],
    4: ['val1', 'val2', 'val3', 'val4'],
  },
  get payloadItems() {
    const state = get();
    return state.payloadSets[state.selectedPosition] || state.payloadSets[1] || DEFAULT_PAYLOADS;
  },
  setTargetUrl: (url) => set((state) => ({ targetUrl: typeof url === 'function' ? url(state.targetUrl) : url })),
  setRequestText: (text) => set((state) => ({ requestText: typeof text === 'function' ? text(state.requestText) : text })),
  setAttackType: (attackType) => set({ attackType }),
  setSelectedPosition: (selectedPosition) => set({ selectedPosition }),
  setPayloadSetForPosition: (pos, items) =>
    set((state) => {
      const current = state.payloadSets[pos] || [];
      const updated = typeof items === 'function' ? items(current) : items;
      return {
        payloadSets: {
          ...state.payloadSets,
          [pos]: updated,
        },
      };
    }),
  setPayloadItems: (items) => {
    const { selectedPosition, setPayloadSetForPosition } = get();
    setPayloadSetForPosition(selectedPosition || 1, items);
  },
  sendToIntruder: (tx) => {
    const url = tx?.url || tx?.request?.url || '';
    const method = tx?.method || tx?.request?.method || 'GET';
    const headers = tx?.reqHeaders || tx?.request?.headers || [];
    const body = tx?.reqBody || tx?.request?.bodyText || '';
    const path = url.replace(/^https?:\/\/[^/]+/, '') || '/';

    // Auto-mark query parameter values with §...§
    let markedPath = path;
    if (markedPath.includes('?')) {
      const [base, query] = markedPath.split('?');
      const markedQuery = query
        .split('&')
        .map((pair: string) => {
          const [k, v] = pair.split('=');
          return v !== undefined ? `${k}=§${v}§` : k;
        })
        .join('&');
      markedPath = `${base}?${markedQuery}`;
    }

    let markedBody = body;
    if (markedBody && (markedBody.includes('=') || markedBody.includes('{'))) {
      if (markedBody.startsWith('{') || markedBody.startsWith('[')) {
        markedBody = markedBody.replace(/"([^"]+)":\s*"([^"]*)"/g, '"$1": "§$2§"');
      } else {
        markedBody = markedBody
          .split('&')
          .map((pair: string) => {
            const [k, v] = pair.split('=');
            return v !== undefined ? `${k}=§${v}§` : k;
          })
          .join('&');
      }
    }

    const headerLines = Array.isArray(headers) ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n') : '';
    const rawReq = `${method} ${markedPath} HTTP/1.1\r\n${headerLines}\r\n\r\n${markedBody}`;

    set({
      targetUrl: url,
      requestText: rawReq,
    });
  },
}));
