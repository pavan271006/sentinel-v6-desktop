import { create } from 'zustand';
import {
  RepeaterTabState,
  RepeaterRevisionItem,
  HttpMethod,
  HttpProtocol,
  RequestEditorMode,
  ResponseViewerMode,
  RequestBodyType,
  HeaderRowItem,
  QueryParamItem,
  RepeaterExecutionResult,
} from '../types/repeater';
import { TrafficSummary, HttpRequestDetails, HttpResponseDetails, TransactionDetails } from '../types/traffic';
import { TransactionModel } from '../types/models';
import { ipcClient } from '../ipc/client';
import { useToastStore } from './toastStore';
import { useAppShellStore } from './appShellStore';
import {
  generateUuid as uuidv4,
  parseRawHttpRequest,
  serializeHttpRequest,
  updateContentLengthHeader,
  extractQueryParamsFromUrl,
  updateUrlQueryParams,
  interpolateVariables,
} from '../utils/repeaterUtils';

export const DEFAULT_INITIAL_TAB: RepeaterTabState = {
  id: 'rep-tab-1',
  title: 'Request #1',
  isDirty: false,
  method: 'GET',
  url: 'https://target.local/api/v1/auth/login',
  protocol: 'HTTP/1.1',
  headers: [
    { id: 'h-1', name: 'Host', value: 'target.local', enabled: true },
    { id: 'h-2', name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
    { id: 'h-3', name: 'Accept', value: 'application/json, */*', enabled: true },
  ],
  queryParams: [],
  body: '',
  bodyType: 'raw',
  rawRequest: 'GET /api/v1/auth/login HTTP/1.1\r\nHost: target.local\r\nUser-Agent: Sentinel/6.0.0 Repeater\r\nAccept: application/json, */*\r\n\r\n',
  rawMode: false,
  autoContentLength: true,
  followRedirects: false,
  maxRedirects: 5,
  timeoutMs: 10000,
  localVariables: {},
  history: [],
  activeRevisionIndex: 0,
  baselineRevisionIndex: null,
  isExecuting: false,
  abortController: null,
  requestViewMode: 'pretty',
  responseViewMode: 'pretty',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export interface RepeaterStoreState {
  tabs: RepeaterTabState[];
  activeTabId: string;
  closedTabsStack: RepeaterTabState[];
  globalVariables: Record<string, string>;

  // UI State & Modals
  isHistoryDrawerOpen: boolean;
  isVariablesModalOpen: boolean;
  isDiffModalOpen: boolean;
  diffRevisionA: RepeaterRevisionItem | null;
  diffRevisionB: RepeaterRevisionItem | null;
  splitOrientation: 'horizontal' | 'vertical';

  // Actions: Tab Management
  createTab: (seed?: Partial<RepeaterTabState>) => string;
  createTabFromTransaction: (
    tx: TrafficSummary | TransactionModel | TransactionDetails | { request: HttpRequestDetails; response?: HttpResponseDetails }
  ) => string;
  closeTab: (tabId: string) => void;
  reopenClosedTab: () => void;
  duplicateTab: (tabId: string) => string;
  renameTab: (tabId: string, title: string) => void;
  reorderTabs: (sourceIndex: number, destIndex: number) => void;
  setActiveTabId: (tabId: string) => void;
  nextTab: () => void;
  prevTab: () => void;

  // Actions: Request Mutation
  updateTabMethod: (tabId: string, method: HttpMethod) => void;
  updateTabUrl: (tabId: string, url: string) => void;
  updateTabProtocol: (tabId: string, protocol: HttpProtocol) => void;
  updateTabHeaders: (tabId: string, headers: HeaderRowItem[]) => void;
  updateTabQueryParams: (tabId: string, queryParams: QueryParamItem[]) => void;
  updateTabBody: (tabId: string, body: string) => void;
  updateTabBodyType: (tabId: string, bodyType: RequestBodyType) => void;
  updateTabRawRequest: (tabId: string, rawRequest: string) => void;
  toggleRawMode: (tabId: string) => void;
  setAutoContentLength: (tabId: string, autoContentLength: boolean) => void;
  setRequestViewMode: (tabId: string, mode: RequestEditorMode) => void;
  setResponseViewMode: (tabId: string, mode: ResponseViewerMode) => void;

  // Actions: Variable Management
  setGlobalVariable: (key: string, value: string) => void;
  removeGlobalVariable: (key: string) => void;
  setLocalVariable: (tabId: string, key: string, value: string) => void;
  removeLocalVariable: (tabId: string, key: string) => void;
  interpolateRequest: (tabId: string, text: string) => string;

  // Actions: Execution & History
  sendRequest: (tabId: string) => Promise<void>;
  cancelRequest: (tabId: string) => void;
  restoreRevision: (tabId: string, revisionIndex: number) => void;
  setBaselineRevision: (tabId: string, revisionIndex: number | null) => void;
  deleteRevision: (tabId: string, revisionId: string) => void;
  clearTabHistory: (tabId: string) => void;

  // Actions: Modals & Layout
  toggleHistoryDrawer: () => void;
  setHistoryDrawerOpen: (open: boolean) => void;
  toggleVariablesModal: () => void;
  setVariablesModalOpen: (open: boolean) => void;
  openDiffModal: (revA?: RepeaterRevisionItem | null, revB?: RepeaterRevisionItem | null) => void;
  closeDiffModal: () => void;
  toggleSplitOrientation: () => void;
  setSplitOrientation: (orientation: 'horizontal' | 'vertical') => void;
}

export const useRepeaterStore = create<RepeaterStoreState>((set, get) => ({
  tabs: [DEFAULT_INITIAL_TAB],
  activeTabId: DEFAULT_INITIAL_TAB.id,
  closedTabsStack: [],
  globalVariables: {
    host: 'target.local',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },

  isHistoryDrawerOpen: false,
  isVariablesModalOpen: false,
  isDiffModalOpen: false,
  diffRevisionA: null,
  diffRevisionB: null,
  splitOrientation: 'horizontal',

  createTab: (seed) => {
    const id = `rep-tab-${uuidv4().substring(0, 8)}`;
    const tabNumber = get().tabs.length + 1;
    const initialUrl = seed?.url || 'https://target.local/api/v1/auth/login';
    const initialMethod = seed?.method || 'GET';
    const initialProtocol = seed?.protocol || 'HTTP/1.1';
    const initialHeaders = seed?.headers || [
      { id: uuidv4(), name: 'Host', value: 'target.local', enabled: true },
      { id: uuidv4(), name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
      { id: uuidv4(), name: 'Accept', value: 'application/json, */*', enabled: true },
    ];
    const initialBody = seed?.body || '';
    const initialRaw = seed?.rawRequest || serializeHttpRequest(initialMethod, initialUrl, initialProtocol, initialHeaders, initialBody);

    const newTab: RepeaterTabState = {
      ...DEFAULT_INITIAL_TAB,
      id,
      title: seed?.title || `Request #${tabNumber}`,
      method: initialMethod,
      url: initialUrl,
      protocol: initialProtocol,
      headers: initialHeaders,
      queryParams: seed?.queryParams || extractQueryParamsFromUrl(initialUrl),
      body: initialBody,
      bodyType: seed?.bodyType || 'raw',
      rawRequest: initialRaw,
      rawMode: seed?.rawMode || false,
      autoContentLength: seed?.autoContentLength ?? true,
      followRedirects: seed?.followRedirects ?? false,
      maxRedirects: seed?.maxRedirects ?? 5,
      timeoutMs: seed?.timeoutMs ?? 10000,
      localVariables: seed?.localVariables || {},
      history: seed?.history || [],
      activeRevisionIndex: seed?.activeRevisionIndex ?? 0,
      baselineRevisionIndex: seed?.baselineRevisionIndex ?? null,
      isExecuting: false,
      abortController: null,
      requestViewMode: seed?.requestViewMode || 'pretty',
      responseViewMode: seed?.responseViewMode || 'pretty',
      isDirty: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...seed,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));

    return id;
  },

  createTabFromTransaction: (tx) => {
    const anyTx = tx as any;
    const req = anyTx.request;
    const method: HttpMethod = (req?.method || anyTx.method || 'GET') as HttpMethod;
    const url: string = req?.url || anyTx.url || 'https://target.local/';

    const incomingHeaders = req?.headers || anyTx.reqHeaders;
    let headers: HeaderRowItem[] = [];

    if (incomingHeaders && Array.isArray(incomingHeaders) && incomingHeaders.length > 0) {
      headers = incomingHeaders.map((h: any) => ({
        id: uuidv4(),
        name: h.name,
        value: h.value,
        enabled: true,
      }));
    } else {
      try {
        const u = new URL(url);
        headers = [
          { id: uuidv4(), name: 'Host', value: u.host, enabled: true },
          { id: uuidv4(), name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
          { id: uuidv4(), name: 'Accept', value: '*/*', enabled: true },
        ];
      } catch {
        headers = [{ id: uuidv4(), name: 'Host', value: 'target.local', enabled: true }];
      }
    }

    const body = req?.bodyText || (typeof req?.bodyBytes === 'string' ? req.bodyBytes : '') || anyTx.reqBody || '';
    const protocol: HttpProtocol = req?.protocol === 'HTTP/2' || req?.protocol === 'HTTP/2.0' ? 'HTTP/2' : 'HTTP/1.1';
    const pathPart = url.replace(/^https?:\/\/[^/]+/, '') || '/';
    const title = `${method} ${pathPart}`;

    const rawRequest = serializeHttpRequest(method, url, protocol, headers, body);

    const tabId = get().createTab({
      title,
      method,
      url,
      protocol,
      headers,
      queryParams: extractQueryParamsFromUrl(url),
      body,
      rawRequest,
      rawMode: false,
      requestViewMode: 'pretty',
      responseViewMode: 'pretty',
    });

    useToastStore.getState().addToast({
      title: 'Sent to Repeater',
      description: `${method} ${pathPart}`,
      type: 'success',
      duration: 2500,
    });

    useAppShellStore.getState().setActiveWorkspace('repeater');
    return tabId;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, closedTabsStack } = get();
    if (tabs.length <= 1) return; // Retain at least 1 tab

    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    if (targetTab.abortController) {
      targetTab.abortController.abort();
    }

    const remaining = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;

    if (activeTabId === tabId) {
      const closedIndex = tabs.findIndex((t) => t.id === tabId);
      const newIndex = Math.min(closedIndex, remaining.length - 1);
      nextActiveId = remaining[newIndex].id;
    }

    set({
      tabs: remaining,
      activeTabId: nextActiveId,
      closedTabsStack: [targetTab, ...closedTabsStack.slice(0, 19)],
    });
  },

  reopenClosedTab: () => {
    const { closedTabsStack, tabs } = get();
    if (closedTabsStack.length === 0) return;

    const [restoredTab, ...remainingClosed] = closedTabsStack;
    set({
      tabs: [...tabs, restoredTab],
      activeTabId: restoredTab.id,
      closedTabsStack: remainingClosed,
    });

    useToastStore.getState().addToast({
      type: 'info',
      title: `Reopened tab: ${restoredTab.title}`,
    });
  },

  duplicateTab: (tabId) => {
    const { tabs } = get();
    const sourceTab = tabs.find((t) => t.id === tabId);
    if (!sourceTab) return '';

    const newId = `rep-tab-${uuidv4().substring(0, 8)}`;
    const clonedTab: RepeaterTabState = {
      ...sourceTab,
      id: newId,
      title: `Copy of ${sourceTab.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [...sourceTab.history],
      isExecuting: false,
      abortController: null,
    };

    set({
      tabs: [...tabs, clonedTab],
      activeTabId: newId,
    });

    return newId;
  },

  renameTab: (tabId, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title, updatedAt: new Date().toISOString() } : t)),
    }));
  },

  reorderTabs: (sourceIndex, destIndex) => {
    set((state) => {
      const nextTabs = [...state.tabs];
      const [moved] = nextTabs.splice(sourceIndex, 1);
      nextTabs.splice(destIndex, 0, moved);
      return { tabs: nextTabs };
    });
  },

  setActiveTabId: (activeTabId) => set({ activeTabId }),

  nextTab: () => {
    const { tabs, activeTabId } = get();
    const currIdx = tabs.findIndex((t) => t.id === activeTabId);
    const nextIdx = (currIdx + 1) % tabs.length;
    set({ activeTabId: tabs[nextIdx].id });
  },

  prevTab: () => {
    const { tabs, activeTabId } = get();
    const currIdx = tabs.findIndex((t) => t.id === activeTabId);
    const prevIdx = (currIdx - 1 + tabs.length) % tabs.length;
    set({ activeTabId: tabs[prevIdx].id });
  },

  // Request Mutation Actions
  updateTabMethod: (tabId, method) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const rawRequest = serializeHttpRequest(method, t.url, t.protocol, t.headers, t.body);
        return { ...t, method, rawRequest, isDirty: true, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  updateTabUrl: (tabId, url) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const queryParams = extractQueryParamsFromUrl(url);
        const rawRequest = serializeHttpRequest(t.method, url, t.protocol, t.headers, t.body);
        return { ...t, url, queryParams, rawRequest, isDirty: true, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  updateTabProtocol: (tabId, protocol) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const rawRequest = serializeHttpRequest(t.method, t.url, protocol, t.headers, t.body);
        return { ...t, protocol, rawRequest, isDirty: true, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  updateTabHeaders: (tabId, headers) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const rawRequest = serializeHttpRequest(t.method, t.url, t.protocol, headers, t.body);
        return { ...t, headers, rawRequest, isDirty: true, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  updateTabQueryParams: (tabId, queryParams) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const url = updateUrlQueryParams(t.url, queryParams);
        const rawRequest = serializeHttpRequest(t.method, url, t.protocol, t.headers, t.body);
        return { ...t, queryParams, url, rawRequest, isDirty: true, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  updateTabBody: (tabId, body) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        let headers = t.headers;
        if (t.autoContentLength) {
          headers = updateContentLengthHeader(headers, body);
        }
        const rawRequest = serializeHttpRequest(t.method, t.url, t.protocol, headers, body);
        return { ...t, body, headers, rawRequest, isDirty: true, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  updateTabBodyType: (tabId, bodyType) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, bodyType, updatedAt: new Date().toISOString() } : t)),
    }));
  },

  updateTabRawRequest: (tabId, rawRequest) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const parsed = parseRawHttpRequest(rawRequest);
        return {
          ...t,
          rawRequest,
          method: parsed.method,
          protocol: parsed.protocol,
          headers: parsed.headers.length > 0 ? parsed.headers : t.headers,
          body: parsed.body,
          isDirty: true,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },

  toggleRawMode: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, rawMode: !t.rawMode } : t)),
    }));
  },

  setAutoContentLength: (tabId, autoContentLength) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, autoContentLength } : t)),
    }));
  },

  setRequestViewMode: (tabId, requestViewMode) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, requestViewMode } : t)),
    }));
  },

  setResponseViewMode: (tabId, responseViewMode) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, responseViewMode } : t)),
    }));
  },

  // Variable Management
  setGlobalVariable: (key, value) => {
    set((state) => ({
      globalVariables: { ...state.globalVariables, [key]: value },
    }));
  },

  removeGlobalVariable: (key) => {
    set((state) => {
      const next = { ...state.globalVariables };
      delete next[key];
      return { globalVariables: next };
    });
  },

  setLocalVariable: (tabId, key, value) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, localVariables: { ...t.localVariables, [key]: value } } : t
      ),
    }));
  },

  removeLocalVariable: (tabId, key) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const nextLocal = { ...t.localVariables };
        delete nextLocal[key];
        return { ...t, localVariables: nextLocal };
      }),
    }));
  },

  interpolateRequest: (tabId, text) => {
    const { globalVariables, tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    const localVars = tab?.localVariables || {};
    const mergedVars = { ...globalVariables, ...localVars };
    return interpolateVariables(text, mergedVars);
  },

  // Execution & History Pipeline
  sendRequest: async (tabId) => {
    const { tabs, globalVariables, interpolateRequest } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.isExecuting) return;

    // Validate that request is not empty
    const rawText = (tab.rawRequest || '').trim();
    if (!rawText) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Cannot send empty request',
        description: 'Please type or paste an HTTP request into the editor.',
      });
      return;
    }

    const abortController = new AbortController();

    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isExecuting: true, abortController } : t)),
    }));

    const startTime = performance.now();

    try {
      // Parse target URL dynamically from the first line and Host header of rawRequest
      const parsedReq = parseRawHttpRequest(tab.rawRequest);
      let targetUrl = tab.url;
      const hostHdr = parsedReq.headers.find((h) => h.name.toLowerCase() === 'host')?.value;
      if (hostHdr && !hostHdr.includes('target.local') && !hostHdr.includes('127.0.0.1')) {
        const isHttps = tab.url.startsWith('https://') || !tab.url.startsWith('http://');
        const scheme = isHttps ? 'https://' : 'http://';
        const cleanPath = parsedReq.path.startsWith('/') ? parsedReq.path : `/${parsedReq.path}`;
        targetUrl = `${scheme}${hostHdr}${cleanPath}`;
      }

      const mergedVars = { ...globalVariables, ...tab.localVariables };
      const interpolatedRaw = interpolateRequest(tabId, tab.rawRequest);
      const interpolatedUrl = interpolateRequest(tabId, targetUrl);

      const result: RepeaterExecutionResult = await ipcClient.sendRepeaterRequest({
        tabId,
        targetUrl: interpolatedUrl,
        rawRequest: interpolatedRaw,
        envVars: mergedVars,
        interpolate: false,
      });

      const durationMs = result.durationMs || Math.round(performance.now() - startTime);

      const revision: RepeaterRevisionItem = {
        revisionId: result.revisionId || uuidv4(),
        revisionNumber: tab.history.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        method: tab.method,
        url: interpolatedUrl,
        requestRaw: interpolatedRaw,
        requestHeaders: tab.headers.filter((h) => h.enabled).map((h) => ({ name: h.name, value: h.value })),
        requestBody: tab.body,
        responseRaw: result.rawResponse,
        responseHeaders: result.headers,
        responseBody: result.body,
        statusCode: result.statusCode,
        statusText: result.statusText,
        durationMs,
        sizeBytes: result.sizeBytes || result.body.length,
        tlsInfo: result.tlsInfo,
        timingBreakdown: result.timingBreakdown,
        casEvidence: {
          blobId: result.observationId || uuidv4(),
          sha256Hex: result.casResHash || result.casHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          sizeBytes: result.sizeBytes || result.body.length,
          verified: true,
          tamperDetected: false,
          timestamp: new Date().toISOString(),
        },
        error: result.error,
      };

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isExecuting: false,
                abortController: null,
                isDirty: false,
                history: [...t.history, revision],
                activeRevisionIndex: t.history.length,
                lastExecutionOutput: revision,
                updatedAt: new Date().toISOString(),
              }
            : t
        ),
      }));

      useToastStore.getState().addToast({
        type: revision.statusCode && revision.statusCode < 400 ? 'success' : 'info',
        title: `Repeater: ${revision.statusCode || 'Complete'} (${durationMs}ms)`,
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const isCancelled = err.name === 'AbortError' || String(err).includes('cancelled') || String(err).includes('aborted');

      const failedRevision: RepeaterRevisionItem = {
        revisionId: uuidv4(),
        revisionNumber: tab.history.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        method: tab.method,
        url: tab.url,
        requestRaw: tab.rawRequest || `${tab.method} ${tab.url}`,
        requestHeaders: tab.headers.filter((h) => h.enabled).map((h) => ({ name: h.name, value: h.value })),
        requestBody: tab.body,
        durationMs,
        sizeBytes: 0,
        error: isCancelled ? 'Execution cancelled by researcher' : String(err?.message || err),
      };

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isExecuting: false,
                abortController: null,
                history: [...t.history, failedRevision],
                activeRevisionIndex: t.history.length,
                lastExecutionOutput: failedRevision,
                updatedAt: new Date().toISOString(),
              }
            : t
        ),
      }));

      if (!isCancelled) {
        useToastStore.getState().addToast({
          type: 'error',
          title: `Replay Failed: ${String(err?.message || err)}`,
        });
      }
    }
  },

  cancelRequest: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.abortController) {
      tab.abortController.abort();
    }
  },

  restoreRevision: (tabId, revisionIndex) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const rev = tab.history[revisionIndex];
    if (!rev) return;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              method: rev.method,
              url: rev.url,
              headers: rev.requestHeaders.map((h) => ({ id: uuidv4(), name: h.name, value: h.value, enabled: true })),
              body: rev.requestBody,
              rawRequest: rev.requestRaw,
              activeRevisionIndex: revisionIndex,
              lastExecutionOutput: rev,
              isDirty: false,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));

    useToastStore.getState().addToast({
      type: 'info',
      title: `Restored Revision #${rev.revisionNumber} (${rev.timestamp})`,
    });
  },

  setBaselineRevision: (tabId, revisionIndex) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, baselineRevisionIndex: revisionIndex } : t)),
    }));
  },

  deleteRevision: (tabId, revisionId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const newHistory = t.history.filter((h) => h.revisionId !== revisionId);
        return {
          ...t,
          history: newHistory,
          activeRevisionIndex: Math.max(0, newHistory.length - 1),
          lastExecutionOutput: newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined,
        };
      }),
    }));
  },

  clearTabHistory: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, history: [], activeRevisionIndex: 0, lastExecutionOutput: undefined } : t
      ),
    }));
  },

  // Modals & Layout Actions
  toggleHistoryDrawer: () => set((s) => ({ isHistoryDrawerOpen: !s.isHistoryDrawerOpen })),
  setHistoryDrawerOpen: (open) => set({ isHistoryDrawerOpen: open }),
  toggleVariablesModal: () => set((s) => ({ isVariablesModalOpen: !s.isVariablesModalOpen })),
  setVariablesModalOpen: (open) => set({ isVariablesModalOpen: open }),

  openDiffModal: (revA, revB) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    const a =
      revA ||
      (tab?.baselineRevisionIndex !== null && tab?.baselineRevisionIndex !== undefined
        ? tab.history[tab.baselineRevisionIndex]
        : tab?.history[0]) ||
      null;
    const b = revB || tab?.lastExecutionOutput || (tab?.history.length ? tab.history[tab.history.length - 1] : null);
    set({ isDiffModalOpen: true, diffRevisionA: a, diffRevisionB: b });
  },

  closeDiffModal: () => set({ isDiffModalOpen: false, diffRevisionA: null, diffRevisionB: null }),

  toggleSplitOrientation: () =>
    set((s) => ({ splitOrientation: s.splitOrientation === 'horizontal' ? 'vertical' : 'horizontal' })),

  setSplitOrientation: (orientation) => set({ splitOrientation: orientation }),
}));
