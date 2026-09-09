import { create } from 'zustand';

export type HttpMatchRuleItemType =
  | 'Request header'
  | 'Request body'
  | 'Request first line'
  | 'Response header'
  | 'Response body'
  | 'Response first line'
  | 'Request param name'
  | 'Request param value';

export interface HttpMatchReplaceRule {
  id: string;
  enabled: boolean;
  item: HttpMatchRuleItemType;
  name: string;
  match: string;
  replace: string;
  type: 'Regex' | 'Literal';
  comment: string;
}

export interface WsMatchReplaceRule {
  id: string;
  enabled: boolean;
  direction: 'To server' | 'To client' | 'Both';
  match: string;
  replace: string;
  type: 'Regex' | 'Literal';
  comment: string;
}

export interface MatchReplaceState {
  httpRules: HttpMatchReplaceRule[];
  selectedHttpRuleId: string | null;
  httpOnlyInScope: boolean;

  wsRules: WsMatchReplaceRule[];
  selectedWsRuleId: string | null;
  wsOnlyInScope: boolean;

  // HTTP Rule Actions
  addHttpRule: (rule: Omit<HttpMatchReplaceRule, 'id'>) => void;
  updateHttpRule: (id: string, rule: Partial<HttpMatchReplaceRule>) => void;
  removeHttpRule: (id: string) => void;
  toggleHttpRule: (id: string) => void;
  moveHttpRule: (id: string, direction: 'up' | 'down') => void;
  selectHttpRule: (id: string | null) => void;
  setHttpOnlyInScope: (onlyInScope: boolean) => void;

  // WS Rule Actions
  addWsRule: (rule: Omit<WsMatchReplaceRule, 'id'>) => void;
  updateWsRule: (id: string, rule: Partial<WsMatchReplaceRule>) => void;
  removeWsRule: (id: string) => void;
  toggleWsRule: (id: string) => void;
  moveWsRule: (id: string, direction: 'up' | 'down') => void;
  selectWsRule: (id: string | null) => void;
  setWsOnlyInScope: (onlyInScope: boolean) => void;

  // Rule Execution Engine
  applyHttpRules: (rawContent: string, isResponse: boolean, isInScope?: boolean) => string;
  applyWsRules: (payload: string, direction: 'To server' | 'To client', isInScope?: boolean) => string;
}

const DEFAULT_HTTP_RULES: HttpMatchReplaceRule[] = [
  {
    id: 'http-rule-1',
    enabled: false,
    item: 'Request header',
    name: '',
    match: '^User-Agent.*$',
    replace: 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    type: 'Regex',
    comment: 'Emulate Edge',
  },
  {
    id: 'http-rule-2',
    enabled: false,
    item: 'Request header',
    name: '',
    match: '^User-Agent.*$',
    replace: 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    type: 'Regex',
    comment: 'Emulate iOS',
  },
  {
    id: 'http-rule-3',
    enabled: false,
    item: 'Request header',
    name: '',
    match: '^User-Agent.*$',
    replace: 'User-Agent: Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    type: 'Regex',
    comment: 'Emulate Android',
  },
  {
    id: 'http-rule-4',
    enabled: false,
    item: 'Request header',
    name: '',
    match: '^If-Modified-Since.*$',
    replace: '',
    type: 'Regex',
    comment: 'Require non-cached response',
  },
  {
    id: 'http-rule-5',
    enabled: false,
    item: 'Request header',
    name: '',
    match: '^If-None-Match.*$',
    replace: '',
    type: 'Regex',
    comment: 'Require non-cached response',
  },
  {
    id: 'http-rule-6',
    enabled: false,
    item: 'Request header',
    name: '',
    match: '^Accept-Encoding.*$',
    replace: 'Accept-Encoding: identity',
    type: 'Regex',
    comment: 'Disable gzip / accept identity',
  },
];

const DEFAULT_WS_RULES: WsMatchReplaceRule[] = [
  {
    id: 'ws-rule-1',
    enabled: false,
    direction: 'To server',
    match: 'PING',
    replace: 'PING_CUSTOM',
    type: 'Literal',
    comment: 'Custom WebSocket Keepalive Ping',
  },
  {
    id: 'ws-rule-2',
    enabled: false,
    direction: 'Both',
    match: '"user":"guest"',
    replace: '"user":"admin"',
    type: 'Literal',
    comment: 'Privilege escalation simulation',
  },
];

export const useMatchReplaceStore = create<MatchReplaceState>((set, get) => ({
  httpRules: DEFAULT_HTTP_RULES,
  selectedHttpRuleId: 'http-rule-1',
  httpOnlyInScope: false,

  wsRules: DEFAULT_WS_RULES,
  selectedWsRuleId: null,
  wsOnlyInScope: false,

  addHttpRule: (rule) =>
    set((state) => {
      const id = `http-rule-${Date.now()}`;
      return {
        httpRules: [...state.httpRules, { ...rule, id }],
        selectedHttpRuleId: id,
      };
    }),

  updateHttpRule: (id, updated) =>
    set((state) => ({
      httpRules: state.httpRules.map((r) => (r.id === id ? { ...r, ...updated } : r)),
    })),

  removeHttpRule: (id) =>
    set((state) => {
      const newRules = state.httpRules.filter((r) => r.id !== id);
      return {
        httpRules: newRules,
        selectedHttpRuleId: state.selectedHttpRuleId === id ? newRules[0]?.id || null : state.selectedHttpRuleId,
      };
    }),

  toggleHttpRule: (id) =>
    set((state) => ({
      httpRules: state.httpRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    })),

  moveHttpRule: (id, direction) =>
    set((state) => {
      const index = state.httpRules.findIndex((r) => r.id === id);
      if (index === -1) return state;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= state.httpRules.length) return state;

      const newRules = [...state.httpRules];
      const [moved] = newRules.splice(index, 1);
      newRules.splice(targetIndex, 0, moved);
      return { httpRules: newRules };
    }),

  selectHttpRule: (id) => set({ selectedHttpRuleId: id }),
  setHttpOnlyInScope: (httpOnlyInScope) => set({ httpOnlyInScope }),

  addWsRule: (rule) =>
    set((state) => {
      const id = `ws-rule-${Date.now()}`;
      return {
        wsRules: [...state.wsRules, { ...rule, id }],
        selectedWsRuleId: id,
      };
    }),

  updateWsRule: (id, updated) =>
    set((state) => ({
      wsRules: state.wsRules.map((r) => (r.id === id ? { ...r, ...updated } : r)),
    })),

  removeWsRule: (id) =>
    set((state) => {
      const newRules = state.wsRules.filter((r) => r.id !== id);
      return {
        wsRules: newRules,
        selectedWsRuleId: state.selectedWsRuleId === id ? newRules[0]?.id || null : state.selectedWsRuleId,
      };
    }),

  toggleWsRule: (id) =>
    set((state) => ({
      wsRules: state.wsRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    })),

  moveWsRule: (id, direction) =>
    set((state) => {
      const index = state.wsRules.findIndex((r) => r.id === id);
      if (index === -1) return state;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= state.wsRules.length) return state;

      const newRules = [...state.wsRules];
      const [moved] = newRules.splice(index, 1);
      newRules.splice(targetIndex, 0, moved);
      return { wsRules: newRules };
    }),

  selectWsRule: (id) => set({ selectedWsRuleId: id }),
  setWsOnlyInScope: (wsOnlyInScope) => set({ wsOnlyInScope }),

  applyHttpRules: (rawContent, isResponse, isInScope = true) => {
    const { httpRules, httpOnlyInScope } = get();
    if (httpOnlyInScope && !isInScope) return rawContent;

    let modified = rawContent;
    const activeRules = httpRules.filter((r) => r.enabled);

    for (const rule of activeRules) {
      if (!rule.match) continue;

      // Filter applicable rule target
      if (isResponse && !rule.item.startsWith('Response')) continue;
      if (!isResponse && !rule.item.startsWith('Request')) continue;

      try {
        if (rule.type === 'Regex') {
          const regex = new RegExp(rule.match, 'gm');
          if (rule.replace === '') {
            // Delete matching line/content if replace is empty
            modified = modified.replace(regex, '').replace(/^\r?\n/gm, '');
          } else {
            modified = modified.replace(regex, rule.replace);
          }
        } else {
          modified = modified.split(rule.match).join(rule.replace);
        }
      } catch (err) {
        console.warn(`[MatchReplace] Error applying HTTP rule ${rule.comment}:`, err);
      }
    }

    return modified;
  },

  applyWsRules: (payload, direction, isInScope = true) => {
    const { wsRules, wsOnlyInScope } = get();
    if (wsOnlyInScope && !isInScope) return payload;

    let modified = payload;
    const activeRules = wsRules.filter((r) => r.enabled);

    for (const rule of activeRules) {
      if (!rule.match) continue;
      if (rule.direction !== 'Both' && rule.direction !== direction) continue;

      try {
        if (rule.type === 'Regex') {
          const regex = new RegExp(rule.match, 'g');
          modified = modified.replace(regex, rule.replace);
        } else {
          modified = modified.split(rule.match).join(rule.replace);
        }
      } catch (err) {
        console.warn(`[MatchReplace] Error applying WS rule ${rule.comment}:`, err);
      }
    }

    return modified;
  },
}));
