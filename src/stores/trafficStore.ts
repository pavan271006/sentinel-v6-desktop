import { create } from 'zustand';
import {
  TrafficSummary,
  QuickFilterPreset,
} from '../types/traffic';
import { HttpqlValidationResult, HttpqlAstNode } from '../types/httpql';
import { UiTrafficEvent } from '../types/ipc';
import { parseHttpql, evaluateHttpql, validateHttpql } from '../utils/httpql';
import { ipcClient } from '../ipc/client';

export interface TrafficStoreState {
  // Core Data Buffers
  transactions: TrafficSummary[];
  transactionMap: Map<string, TrafficSummary>;
  filteredIndices: number[] | null;
  totalCapturedCount: number;

  // Limits & Streaming
  maxRingBufferSize: number;
  isStreaming: boolean;
  isPaused: boolean;
  autoScroll: boolean;

  // Filter & HTTPQL State
  httpqlQuery: string;
  httpqlValidation: HttpqlValidationResult;
  parsedAst: HttpqlAstNode | null;
  filterScopeOnly: boolean;
  filterErrorsOnly: boolean;
  filterMethods: string[];
  filterStatuses: Array<'2xx' | '3xx' | '4xx' | '5xx'>;
  filterMimes: string[];
  activePreset: QuickFilterPreset;

  // History
  queryHistory: string[];

  // Selection & Focus
  selectedId: string | null;
  selectedIds: Set<string>;
  focusedIndex: number;

  // Diff Modal State
  diffPair: [string, string] | null;
  diffModal: {
    isOpen: boolean;
    txA: TrafficSummary | null;
    txB: TrafficSummary | null;
  };

  // Actions
  addTransaction: (tx: TrafficSummary) => void;
  ingestBatch: (txs: TrafficSummary[]) => void;
  ingestStreamEvent: (event: UiTrafficEvent) => void;
  setHttpqlQuery: (query: string) => void;
  setScopeOnly: (scopeOnly: boolean) => void;
  toggleMethodFilter: (method: string) => void;
  toggleStatusFilter: (status: '2xx' | '3xx' | '4xx' | '5xx') => void;
  toggleMimeFilter: (mime: string) => void;
  setQuickPreset: (preset: QuickFilterPreset) => void;
  resetFilters: () => void;
  setSelectedId: (id: string | null, isMulti?: boolean) => void;
  toggleSelectId: (id: string) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  setFocusedIndex: (index: number) => void;
  setDiffPair: (txAId: string, txBId: string) => void;
  openDiffModal: (txA?: TrafficSummary | null, txB?: TrafficSummary | null) => void;
  closeDiffModal: () => void;
  clearTraffic: () => Promise<void>;
  setAutoScroll: (enabled: boolean) => void;
  toggleStreaming: () => void;
  fetchHistoricalPage: (offset: number, limit: number) => Promise<void>;
}

const STORAGE_KEY_HTTPQL_HISTORY = 'sentinel_httpql_query_history';

function loadStoredQueryHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HTTPQL_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredQueryHistory(history: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_HTTPQL_HISTORY, JSON.stringify(history.slice(0, 30)));
  } catch {
    // Ignore storage quota errors
  }
}

function matchesQuickFilters(
  tx: TrafficSummary,
  state: Pick<
    TrafficStoreState,
    'filterScopeOnly' | 'filterErrorsOnly' | 'filterMethods' | 'filterStatuses' | 'filterMimes'
  >
): boolean {
  if (state.filterScopeOnly && !tx.inScope) {
    return false;
  }
  if (state.filterErrorsOnly && tx.status < 400) {
    return false;
  }
  if (state.filterMethods.length > 0 && !state.filterMethods.includes(tx.method.toUpperCase())) {
    return false;
  }
  if (state.filterStatuses.length > 0) {
    const s = tx.status;
    const group = s >= 200 && s < 300 ? '2xx' : s >= 300 && s < 400 ? '3xx' : s >= 400 && s < 500 ? '4xx' : s >= 500 ? '5xx' : null;
    if (!group || !state.filterStatuses.includes(group)) {
      return false;
    }
  }
  if (state.filterMimes.length > 0) {
    const mime = (tx.mimeType || '').toLowerCase();
    const matchesAnyMime = state.filterMimes.some((m) => {
      if (m === 'json') return mime.includes('json');
      if (m === 'html') return mime.includes('html');
      if (m === 'js/css') return mime.includes('javascript') || mime.includes('css');
      if (m === 'binary') return mime.includes('octet-stream') || mime.includes('image') || mime.includes('pdf');
      return mime.includes(m.toLowerCase());
    });
    if (!matchesAnyMime) return false;
  }
  return true;
}

function computeFilteredIndices(
  transactions: TrafficSummary[],
  ast: HttpqlAstNode | null,
  state: Pick<
    TrafficStoreState,
    'filterScopeOnly' | 'filterErrorsOnly' | 'filterMethods' | 'filterStatuses' | 'filterMimes' | 'httpqlQuery'
  >
): number[] | null {
  const hasQuickFilters =
    state.filterScopeOnly ||
    state.filterErrorsOnly ||
    state.filterMethods.length > 0 ||
    state.filterStatuses.length > 0 ||
    state.filterMimes.length > 0;

  const rawQuery = (state.httpqlQuery || '').trim();
  const hasSearch = rawQuery.length > 0;

  if (!ast && !hasQuickFilters && !hasSearch) {
    return null; // All indices valid
  }

  const queryLower = rawQuery.toLowerCase();
  const indices: number[] = [];
  const n = transactions.length;

  for (let i = 0; i < n; i++) {
    const tx = transactions[i];
    if (hasQuickFilters && !matchesQuickFilters(tx, state)) {
      continue;
    }
    if (ast) {
      if (!evaluateHttpql(ast, tx)) {
        continue;
      }
    } else if (hasSearch) {
      // Free-text substring search across all fields
      const hostStr = (tx.host || '').toLowerCase();
      const pathStr = (tx.path || '').toLowerCase();
      const urlStr = (tx.url || '').toLowerCase();
      const methodStr = (tx.method || '').toLowerCase();
      const statusStr = String(tx.status || '');
      const mimeStr = (tx.mimeType || '').toLowerCase();
      const idStr = (tx.id || '').toLowerCase();

      const matchesSearch =
        urlStr.includes(queryLower) ||
        pathStr.includes(queryLower) ||
        hostStr.includes(queryLower) ||
        methodStr.includes(queryLower) ||
        statusStr.includes(queryLower) ||
        mimeStr.includes(queryLower) ||
        idStr.includes(queryLower);

      if (!matchesSearch) {
        continue;
      }
    }
    indices.push(i);
  }

  return indices;
}

export const useTrafficStore = create<TrafficStoreState>((set, get) => ({
  transactions: [],
  transactionMap: new Map(),
  filteredIndices: null,
  totalCapturedCount: 0,

  maxRingBufferSize: 50000,
  isStreaming: true,
  isPaused: false,
  autoScroll: true,

  httpqlQuery: '',
  httpqlValidation: { valid: true, referencedFields: [] },
  parsedAst: null,
  filterScopeOnly: false,
  filterErrorsOnly: false,
  filterMethods: [],
  filterStatuses: [],
  filterMimes: [],
  activePreset: 'all',

  queryHistory: loadStoredQueryHistory(),

  selectedId: null,
  selectedIds: new Set(),
  focusedIndex: 0,

  diffPair: null,
  diffModal: {
    isOpen: false,
    txA: null,
    txB: null,
  },

  addTransaction: (tx: TrafficSummary) => {
    const state = get();
    if (state.isPaused) return;

    let transactions = [...state.transactions];
    let transactionMap = new Map(state.transactionMap);

    const existingIdx = transactions.findIndex((t) => t.id === tx.id);
    if (existingIdx !== -1) {
      // Merge with existing transaction
      transactions[existingIdx] = { ...transactions[existingIdx], ...tx };
      transactionMap.set(tx.id, transactions[existingIdx]);
    } else {
      transactions.push(tx);
      // Evict oldest if exceeding maxRingBufferSize
      if (transactions.length > state.maxRingBufferSize) {
        const removed = transactions.shift();
        if (removed) {
          transactionMap.delete(removed.id);
        }
      }
      transactionMap.set(tx.id, tx);
    }

    const filteredIndices = computeFilteredIndices(transactions, state.parsedAst, state);

    set({
      transactions,
      transactionMap,
      filteredIndices,
      totalCapturedCount: existingIdx !== -1 ? state.totalCapturedCount : state.totalCapturedCount + 1,
      selectedId: state.selectedId === null && transactions.length === 1 ? tx.id : state.selectedId,
    });
  },

  ingestBatch: (txs: TrafficSummary[]) => {
    if (txs.length === 0) return;
    const state = get();
    if (state.isPaused) return;

    const transactions = [...state.transactions, ...txs].slice(-state.maxRingBufferSize);
    const transactionMap = new Map();

    for (const t of transactions) {
      transactionMap.set(t.id, t);
    }

    const filteredIndices = computeFilteredIndices(transactions, state.parsedAst, state);

    set({
      transactions,
      transactionMap,
      filteredIndices,
      totalCapturedCount: state.totalCapturedCount + txs.length,
      selectedId: state.selectedId === null && transactions.length > 0 ? transactions[0].id : state.selectedId,
    });
  },

  ingestStreamEvent: (event: UiTrafficEvent) => {
    const state = get();
    if (state.isPaused) return;

    let host = '';
    let path = '/';
    try {
      const u = new URL(event.uri);
      host = u.hostname;
      path = u.pathname + u.search;
    } catch {
      host = 'target.local';
      path = event.uri;
    }

    const contentType = (event.resHeaders || []).find((h) => h.name.toLowerCase() === 'content-type')?.value?.toLowerCase() || '';
    const mimeType = contentType.includes('json') || path.includes('api') || path.includes('graphql')
      ? 'application/json'
      : contentType.includes('image')
      ? 'image'
      : contentType.includes('javascript')
      ? 'javascript'
      : contentType.includes('css')
      ? 'css'
      : 'text/html';

    const summary: TrafficSummary = {
      id: event.transactionId,
      seqNumber: state.totalCapturedCount + 1,
      timestamp: new Date().toLocaleTimeString(),
      timestampMs: Date.now(),
      method: event.method,
      url: event.uri,
      host,
      path,
      status: event.status,
      durationMs: event.durationMs,
      sizeBytes: event.resBody ? event.resBody.length : 512,
      inScope: event.inScope,
      mimeType,
      tags: event.tags || (event.inScope ? ['in-scope'] : ['out-of-scope']),
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      reqHeaders: event.reqHeaders,
      reqBody: event.reqBody,
      resHeaders: event.resHeaders,
      resBody: event.resBody,
    };

    get().addTransaction(summary);
  },

  setHttpqlQuery: (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      const filteredIndices = computeFilteredIndices(get().transactions, null, get());
      set({
        httpqlQuery: '',
        httpqlValidation: { valid: true, referencedFields: [] },
        parsedAst: null,
        filteredIndices,
      });
      return;
    }

    const val = validateHttpql(query);
    const { ast } = parseHttpql(query);
    const parsedAst = val.valid ? ast : null;
    const nextState = { ...get(), httpqlQuery: query };
    const filteredIndices = computeFilteredIndices(get().transactions, parsedAst, nextState);

    // Update query history if valid
    if (val.valid && trimmed.length > 2) {
      const history = [trimmed, ...get().queryHistory.filter((q) => q !== trimmed)].slice(0, 30);
      saveStoredQueryHistory(history);
      set({ queryHistory: history });
    }

    set({
      httpqlQuery: query,
      httpqlValidation: val,
      parsedAst,
      filteredIndices,
    });
  },

  setScopeOnly: (scopeOnly: boolean) => {
    const nextState = { ...get(), filterScopeOnly: scopeOnly };
    const filteredIndices = computeFilteredIndices(get().transactions, get().parsedAst, nextState);
    set({ filterScopeOnly: scopeOnly, filteredIndices });
  },

  toggleMethodFilter: (method: string) => {
    const upper = method.toUpperCase();
    const current = get().filterMethods;
    const next = current.includes(upper) ? current.filter((m) => m !== upper) : [...current, upper];
    const nextState = { ...get(), filterMethods: next };
    const filteredIndices = computeFilteredIndices(get().transactions, get().parsedAst, nextState);
    set({ filterMethods: next, filteredIndices });
  },

  toggleStatusFilter: (status: '2xx' | '3xx' | '4xx' | '5xx') => {
    const current = get().filterStatuses;
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    const nextState = { ...get(), filterStatuses: next };
    const filteredIndices = computeFilteredIndices(get().transactions, get().parsedAst, nextState);
    set({ filterStatuses: next, filteredIndices });
  },

  toggleMimeFilter: (mime: string) => {
    const lower = mime.toLowerCase();
    const current = get().filterMimes;
    const next = current.includes(lower) ? current.filter((m) => m !== lower) : [...current, lower];
    const nextState = { ...get(), filterMimes: next };
    const filteredIndices = computeFilteredIndices(get().transactions, get().parsedAst, nextState);
    set({ filterMimes: next, filteredIndices });
  },

  setQuickPreset: (preset: QuickFilterPreset) => {
    let filterScopeOnly = false;
    let filterErrorsOnly = false;
    let filterMethods: string[] = [];
    let filterStatuses: Array<'2xx' | '3xx' | '4xx' | '5xx'> = [];
    let filterMimes: string[] = [];

    switch (preset) {
      case 'in_scope':
        filterScopeOnly = true;
        break;
      case 'errors_only':
        filterErrorsOnly = true;
        filterStatuses = ['4xx', '5xx'];
        break;
      case 'methods_mutating':
        filterMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        break;
      case 'media_json':
        filterMimes = ['json'];
        break;
      case 'media_html':
        filterMimes = ['html'];
        break;
      case 'media_bin':
        filterMimes = ['binary'];
        break;
      case 'all':
      default:
        break;
    }

    const nextState = {
      ...get(),
      filterScopeOnly,
      filterErrorsOnly,
      filterMethods,
      filterStatuses,
      filterMimes,
      activePreset: preset,
    };
    const filteredIndices = computeFilteredIndices(get().transactions, get().parsedAst, nextState);

    set({
      filterScopeOnly,
      filterErrorsOnly,
      filterMethods,
      filterStatuses,
      filterMimes,
      activePreset: preset,
      filteredIndices,
    });
  },

  resetFilters: () => {
    const nextState = {
      ...get(),
      httpqlQuery: '',
      httpqlValidation: { valid: true, referencedFields: [] },
      parsedAst: null,
      filterScopeOnly: false,
      filterErrorsOnly: false,
      filterMethods: [],
      filterStatuses: [],
      filterMimes: [],
      activePreset: 'all' as QuickFilterPreset,
    };
    const filteredIndices = computeFilteredIndices(get().transactions, null, nextState);

    set({
      httpqlQuery: '',
      httpqlValidation: { valid: true, referencedFields: [] },
      parsedAst: null,
      filterScopeOnly: false,
      filterErrorsOnly: false,
      filterMethods: [],
      filterStatuses: [],
      filterMimes: [],
      activePreset: 'all',
      filteredIndices,
    });
  },

  setSelectedId: (id: string | null, isMulti = false) => {
    const state = get();
    if (!id) {
      set({ selectedId: null });
      return;
    }

    if (isMulti) {
      const selectedIds = new Set(state.selectedIds);
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
      set({ selectedId: id, selectedIds });
    } else {
      set({ selectedId: id, selectedIds: new Set([id]) });
    }
  },

  toggleSelectId: (id: string) => {
    const selectedIds = new Set(get().selectedIds);
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    set({ selectedIds });
  },

  selectAllVisible: () => {
    const state = get();
    const visibleTxs =
      state.filteredIndices === null
        ? state.transactions
        : state.filteredIndices.map((i) => state.transactions[i]);
    const selectedIds = new Set(visibleTxs.map((t) => t.id));
    set({ selectedIds });
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  setFocusedIndex: (focusedIndex: number) => {
    set({ focusedIndex });
  },

  setDiffPair: (txAId: string, txBId: string) => {
    const txA = get().transactionMap.get(txAId) || null;
    const txB = get().transactionMap.get(txBId) || null;
    set({
      diffPair: [txAId, txBId],
      diffModal: {
        isOpen: true,
        txA,
        txB,
      },
    });
  },

  openDiffModal: (txA?: TrafficSummary | null, txB?: TrafficSummary | null) => {
    const state = get();
    let effectiveA = txA;
    let effectiveB = txB;

    if (!effectiveA) {
      if (state.selectedIds.size >= 2) {
        const ids = Array.from(state.selectedIds);
        effectiveA = state.transactionMap.get(ids[0]) || null;
        effectiveB = state.transactionMap.get(ids[1]) || null;
      } else if (state.selectedId) {
        effectiveA = state.transactionMap.get(state.selectedId) || null;
        effectiveB = state.transactions[0] || null;
      } else if (state.transactions.length >= 2) {
        effectiveA = state.transactions[0];
        effectiveB = state.transactions[1];
      }
    }

    set({
      diffModal: {
        isOpen: true,
        txA: effectiveA || null,
        txB: effectiveB || null,
      },
    });
  },

  closeDiffModal: () => {
    set((state) => ({
      diffModal: {
        ...state.diffModal,
        isOpen: false,
      },
    }));
  },

  clearTraffic: async () => {
    try {
      await ipcClient.clearTraffic();
    } catch {
      // IPC fallback handles local
    }
    set({
      transactions: [],
      transactionMap: new Map(),
      filteredIndices: null,
      selectedId: null,
      selectedIds: new Set(),
      focusedIndex: 0,
      totalCapturedCount: 0,
    });
  },

  setAutoScroll: (autoScroll: boolean) => {
    set({ autoScroll });
  },

  toggleStreaming: () => {
    set((state) => ({ isPaused: !state.isPaused }));
  },

  fetchHistoricalPage: async (offset: number, limit: number) => {
    try {
      const result = await ipcClient.getTrafficPage({
        offset,
        limit,
        filterHttpql: get().httpqlQuery || undefined,
        inScopeOnly: get().filterScopeOnly || undefined,
      });
      if (result && result.items) {
        get().ingestBatch(result.items);
      }
    } catch (err) {
      console.warn('[TrafficStore] fetchHistoricalPage failed:', err);
    }
  },
}));
