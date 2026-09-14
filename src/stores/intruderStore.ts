import { create } from 'zustand';
import {
  IntruderCaptureFilterState,
  DEFAULT_INTRUDER_CAPTURE_FILTER,
} from '../components/fuzzer/IntruderCaptureFilterModal';

export interface AttackResultItem {
  id: number;
  payloads: string[];
  payloadSummary: string;
  statusCode: number;
  error: string;
  timeout: boolean;
  lengthBytes: number;
  timeMs: number;
  comment: string;
  rawRequest: string;
  rawResponse: string;
}

export interface IntruderTabState {
  id: string;
  title: string;
  targetUrl: string;
  requestText: string;
  attackType: 'Sniper attack' | 'Battering ram attack' | 'Pitchfork attack' | 'Cluster bomb attack';
  payloadSets: Record<number, string[]>;
  selectedPosition: number;
  concurrency: number;
  delayMs: number;
  updateHostHeader: boolean;
  updateContentLength: boolean;
  isAttackRunning: boolean;
  isAttackPaused: boolean;
  attackResults: AttackResultItem[];
  selectedResultId: number | null;
  showAttackModal: boolean;
  activeResultsSubtab: 'Results' | 'Positions';
  windowState: 'normal' | 'maximized' | 'minimized';
  captureFilter: IntruderCaptureFilterState;
  applyCaptureFilter: boolean;
  stealthIpRotation: boolean;
  ghostJitter: boolean;
  browserMimicry: boolean;
  adaptiveThrottle: boolean;
}

export interface IntruderState {
  tabs: IntruderTabState[];
  activeTabId: string;

  // Active Tab Shorthand Getters
  targetUrl: string;
  requestText: string;
  attackType: 'Sniper attack' | 'Battering ram attack' | 'Pitchfork attack' | 'Cluster bomb attack';
  payloadSets: Record<number, string[]>;
  selectedPosition: number;
  payloadItems: string[];

  // Tab Operations
  createTab: (seed?: Partial<IntruderTabState>) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  updateTab: (tabId: string, updates: Partial<IntruderTabState> | ((prev: IntruderTabState) => Partial<IntruderTabState>)) => void;
  updateActiveTab: (updates: Partial<IntruderTabState> | ((prev: IntruderTabState) => Partial<IntruderTabState>)) => void;

  // Shorthand Setters (operate on activeTab)
  setTargetUrl: (url: string | ((prev: string) => string)) => void;
  setRequestText: (text: string | ((prev: string) => string)) => void;
  setAttackType: (type: 'Sniper attack' | 'Battering ram attack' | 'Pitchfork attack' | 'Cluster bomb attack') => void;
  setSelectedPosition: (pos: number) => void;
  setPayloadSetForPosition: (pos: number, items: string[] | ((prev: string[]) => string[])) => void;
  setPayloadItems: (items: string[] | ((prev: string[]) => string[])) => void;
  sendToIntruder: (tx: any) => string;
}

export const DEFAULT_PAYLOADS = [
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

export function extractTabTitle(method: string, pathOrUrl: string): string {
  let path = pathOrUrl;
  try {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      path = new URL(pathOrUrl).pathname;
    }
  } catch {}
  if (path.length > 22) {
    path = path.slice(0, 19) + '...';
  }
  return `${method.toUpperCase()} ${path || '/'}`;
}

export function createDefaultTab(
  id: string,
  title?: string,
  targetUrl?: string,
  requestText?: string
): IntruderTabState {
  const req =
    requestText ||
    `POST /example?p1=§p1val§&p2=§p2val§ HTTP/1.0\r\nCookie: c=§cval§\r\nContent-Length: 17\r\n\r\np3=§p3val§&p4=§p4val§`;
  const url = targetUrl || 'https://ims.ritchennai.edu.in';
  const firstLine = req.split(/\r?\n/)[0] || 'POST /example';
  const [method, path] = firstLine.split(/\s+/);
  const derivedTitle = title || extractTabTitle(method || 'POST', path || '/example');

  return {
    id,
    title: derivedTitle,
    targetUrl: url,
    requestText: req,
    attackType: 'Sniper attack',
    selectedPosition: 1,
    payloadSets: {
      1: [...DEFAULT_PAYLOADS],
      2: ['password', '123456', 'admin', 'pass123', 'root', 'qwerty', 'letmein', 'welcome'],
      3: ['token1', 'token2', 'token3', 'token4'],
      4: ['val1', 'val2', 'val3', 'val4'],
    },
    concurrency: 100,
    delayMs: 0,
    updateHostHeader: true,
    updateContentLength: true,
    isAttackRunning: false,
    isAttackPaused: false,
    attackResults: [],
    selectedResultId: null,
    showAttackModal: false,
    activeResultsSubtab: 'Results',
    windowState: 'normal',
    captureFilter: { ...DEFAULT_INTRUDER_CAPTURE_FILTER },
    applyCaptureFilter: true,
    stealthIpRotation: true,
    ghostJitter: true,
    browserMimicry: true,
    adaptiveThrottle: true,
  };
}

const INITIAL_TAB = createDefaultTab('tab-1', 'POST /example');

function getActiveFields(tabs: IntruderTabState[], activeTabId: string) {
  const active = tabs.find((t) => t.id === activeTabId) || tabs[0] || INITIAL_TAB;
  return {
    targetUrl: active.targetUrl,
    requestText: active.requestText,
    attackType: active.attackType,
    payloadSets: active.payloadSets,
    selectedPosition: active.selectedPosition,
    payloadItems: active.payloadSets[active.selectedPosition] || active.payloadSets[1] || DEFAULT_PAYLOADS,
  };
}

export const useIntruderStore = create<IntruderState>((set, get) => ({
  tabs: [INITIAL_TAB],
  activeTabId: INITIAL_TAB.id,
  targetUrl: INITIAL_TAB.targetUrl,
  requestText: INITIAL_TAB.requestText,
  attackType: INITIAL_TAB.attackType,
  payloadSets: INITIAL_TAB.payloadSets,
  selectedPosition: INITIAL_TAB.selectedPosition,
  payloadItems: INITIAL_TAB.payloadSets[1] || DEFAULT_PAYLOADS,

  createTab: (seed) => {
    const newId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTab: IntruderTabState = {
      ...createDefaultTab(newId, seed?.title, seed?.targetUrl, seed?.requestText),
      ...seed,
      id: newId,
    };

    set((state) => {
      const nextTabs = [...state.tabs, newTab];
      return {
        tabs: nextTabs,
        activeTabId: newId,
        ...getActiveFields(nextTabs, newId),
      };
    });

    return newId;
  },

  closeTab: (tabId) => {
    set((state) => {
      if (state.tabs.length <= 1) return state; // Always keep at least 1 tab
      const nextTabs = state.tabs.filter((t) => t.id !== tabId);
      const nextActiveId =
        state.activeTabId === tabId
          ? nextTabs[Math.max(0, nextTabs.length - 1)].id
          : state.activeTabId;

      return {
        tabs: nextTabs,
        activeTabId: nextActiveId,
        ...getActiveFields(nextTabs, nextActiveId),
      };
    });
  },

  setActiveTabId: (tabId) =>
    set((state) => ({
      activeTabId: tabId,
      ...getActiveFields(state.tabs, tabId),
    })),

  renameTab: (tabId, title) =>
    set((state) => {
      const nextTabs = state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t));
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, state.activeTabId),
      };
    }),

  updateTab: (tabId, updates) =>
    set((state) => {
      const nextTabs = state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const resolved = typeof updates === 'function' ? updates(t) : updates;
        return { ...t, ...resolved };
      });
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, state.activeTabId),
      };
    }),

  updateActiveTab: (updates) => {
    const { activeTabId, updateTab } = get();
    updateTab(activeTabId, updates);
  },

  setTargetUrl: (url) => {
    const { activeTabId } = get();
    set((state) => {
      const nextTabs = state.tabs.map((t) => {
        if (t.id !== activeTabId) return t;
        const nextUrl = typeof url === 'function' ? url(t.targetUrl) : url;
        return { ...t, targetUrl: nextUrl };
      });
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, activeTabId),
      };
    });
  },

  setRequestText: (text) => {
    const { activeTabId } = get();
    set((state) => {
      const nextTabs = state.tabs.map((t) => {
        if (t.id !== activeTabId) return t;
        const nextText = typeof text === 'function' ? text(t.requestText) : text;
        const firstLine = nextText.split(/\r?\n/)[0] || '';
        const [method, path] = firstLine.split(/\s+/);
        const autoTitle = method && path ? extractTabTitle(method, path) : t.title;
        return { ...t, requestText: nextText, title: autoTitle };
      });
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, activeTabId),
      };
    });
  },

  setAttackType: (attackType) => {
    const { activeTabId } = get();
    set((state) => {
      const nextTabs = state.tabs.map((t) => (t.id === activeTabId ? { ...t, attackType } : t));
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, activeTabId),
      };
    });
  },

  setSelectedPosition: (selectedPosition) => {
    const { activeTabId } = get();
    set((state) => {
      const nextTabs = state.tabs.map((t) => (t.id === activeTabId ? { ...t, selectedPosition } : t));
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, activeTabId),
      };
    });
  },

  setPayloadSetForPosition: (pos, items) => {
    const { activeTabId } = get();
    set((state) => {
      const nextTabs = state.tabs.map((t) => {
        if (t.id !== activeTabId) return t;
        const current = t.payloadSets[pos] || [];
        const updated = typeof items === 'function' ? items(current) : items;
        return {
          ...t,
          payloadSets: {
            ...t.payloadSets,
            [pos]: updated,
          },
        };
      });
      return {
        tabs: nextTabs,
        ...getActiveFields(nextTabs, activeTabId),
      };
    });
  },

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

    const headerLines = Array.isArray(headers)
      ? headers.map((h: any) => `${h.name}: ${h.value}`).join('\r\n')
      : '';
    const rawReq = tx?.rawRequest && (!Array.isArray(headers) || headers.length === 0)
      ? tx.rawRequest
      : `${method} ${markedPath} HTTP/1.1\r\n${headerLines}\r\n\r\n${markedBody}`;
    const tabTitle = extractTabTitle(method, markedPath);

    const newTabId = get().createTab({
      title: tabTitle,
      targetUrl: url,
      requestText: rawReq,
    });

    return newTabId;
  },
}));

