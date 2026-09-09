import { create } from 'zustand';
import { ipcClient } from '../ipc/client';
import { useToastStore } from './toastStore';
import { useTrafficStore } from './trafficStore';
import { TrafficSummary } from '../types/traffic';

export interface InterceptedRequestItem {
  id: string;
  timestamp: string;
  timestampMs: number;
  type: 'HTTP' | 'WebSocket';
  direction: 'Request' | 'Response';
  method: string;
  url: string;
  host: string;
  port: number;
  ip?: string;
  path: string;
  protocol: string;
  headers: Array<{ name: string; value: string }>;
  cookies: Array<{ name: string; value: string }>;
  queryParams: Array<{ name: string; value: string }>;
  bodyParams: Array<{ name: string; value: string }>;
  body: string;
  rawRequest: string;
  lengthBytes: number;
  status?: number;
}

export function parseRawHttpRequestToItem(
  id: string,
  rawRequest: string,
  targetUrlFallback?: string
): InterceptedRequestItem {
  const parts = rawRequest.split(/\r?\n\r?\n/);
  const headerSection = parts[0] || '';
  const body = parts.slice(1).join('\r\n\r\n');
  const lines = headerSection.split(/\r?\n/);
  const requestLine = lines[0] || 'GET / HTTP/1.1';
  const [method = 'GET', rawPath = '/', protocol = 'HTTP/1.1'] = requestLine.split(/\s+/);

  const headers: Array<{ name: string; value: string }> = [];
  const cookies: Array<{ name: string; value: string }> = [];

  let hostHeader = '';
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const name = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      headers.push({ name, value });
      if (name.toLowerCase() === 'host') {
        hostHeader = value;
      }
      if (name.toLowerCase() === 'cookie') {
        value.split(';').forEach((pair) => {
          const eq = pair.indexOf('=');
          if (eq !== -1) {
            cookies.push({
              name: pair.substring(0, eq).trim(),
              value: pair.substring(eq + 1).trim(),
            });
          }
        });
      }
    }
  }

  const effectiveHost = hostHeader || (targetUrlFallback ? new URL(targetUrlFallback).host : 'www.google.com');
  const isHttps = !rawPath.startsWith('http://') && (targetUrlFallback ? targetUrlFallback.startsWith('https://') : true);
  const fullUrl = rawPath.startsWith('http')
    ? rawPath
    : `${isHttps ? 'https' : 'http'}://${effectiveHost}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;

  const queryParams: Array<{ name: string; value: string }> = [];
  if (rawPath.includes('?')) {
    const qStr = rawPath.split('?')[1] || '';
    qStr.split('&').forEach((p) => {
      const eq = p.indexOf('=');
      if (eq !== -1) {
        queryParams.push({
          name: decodeURIComponent(p.substring(0, eq)),
          value: decodeURIComponent(p.substring(eq + 1)),
        });
      } else if (p) {
        queryParams.push({ name: decodeURIComponent(p), value: '' });
      }
    });
  }

  const bodyParams: Array<{ name: string; value: string }> = [];
  if (body && (body.includes('=') || body.startsWith('{'))) {
    if (body.startsWith('{')) {
      try {
        const parsed = JSON.parse(body);
        Object.entries(parsed).forEach(([k, v]) => {
          bodyParams.push({ name: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
        });
      } catch {}
    } else {
      body.split('&').forEach((p) => {
        const eq = p.indexOf('=');
        if (eq !== -1) {
          bodyParams.push({
            name: decodeURIComponent(p.substring(0, eq)),
            value: decodeURIComponent(p.substring(eq + 1)),
          });
        }
      });
    }
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString() + `.${now.getMilliseconds().toString().padStart(3, '0')}`;

  return {
    id,
    timestamp: timeStr,
    timestampMs: Date.now(),
    type: 'HTTP',
    direction: 'Request',
    method,
    url: fullUrl,
    host: effectiveHost,
    port: isHttps ? 443 : 80,
    ip: '142.251.157.119',
    path: rawPath,
    protocol,
    headers,
    cookies,
    queryParams,
    bodyParams,
    body,
    rawRequest,
    lengthBytes: new TextEncoder().encode(rawRequest).length,
  };
}

export const INITIAL_GOOGLE_SEARCH_RAW = `GET /search?q=hi&oq=hi&gs_lcrp=EgZjYHJvbWUgBggAEEUYOTIGCAEQRRg7MgYIARBFGD0yBggCEEUYPTIGCAMQRRg90gEHNzU3ajBqN6gCALACAA&sourceid=chrome&ie=UTF-8 HTTP/1.1\r
Host: www.google.com\r
Cookie: SEARCH_SAMESITE=CgQIy6EB; AEC=AdJVEasCg6bUrXtt2ZWOZjXIEUvbv-olJWxykbfMeI-nl466auvA_UM40HU; NID=534=DcRd9dLDyCFrR1C-Po-Je6De5J-TbZliRogWo5I9FgI_GUsAvneijBAiLGo-VSsEFFpkpf-QiKNb4oSRs18WkbuzpZtSlcV5rYxQtdneO7CE3eg0yVTOYk8VGku1B5sDpVOoEs8-psxIylYFMPIL8TZo2no4wwBV9OdWwQnrpC9eqZTVPlNGBQ4BZdOVjkzBotXenZjxZezTMT8pEi8U4ZwiuxQpXqY4WfglFgJ1FK3ufh3ndB0ogVnJnoHUKBwwkNg_XBK3Mqw\r
Rtt: 200\r
Downlink: 0.4\r
Sec-Ch-Ua: "Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"\r
Sec-Ch-Ua-Mobile: ?0\r
Sec-Ch-Ua-Platform: "Windows"\r
Upgrade-Insecure-Requests: 1\r
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36\r
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\r
Sec-Fetch-Site: same-origin\r
Sec-Fetch-Mode: navigate\r
Sec-Fetch-User: ?1\r
Sec-Fetch-Dest: document\r
Referer: https://www.google.com/\r
Accept-Encoding: gzip, deflate, br, zstd\r
Accept-Language: en-US,en;q=0.9\r
Priority: u=0, i\r
\r
`;

const INITIAL_QUEUE_ITEM_1 = parseRawHttpRequestToItem('int-req-1', INITIAL_GOOGLE_SEARCH_RAW, 'https://www.google.com/search?q=hi');

const INITIAL_QUEUE_ITEM_2 = parseRawHttpRequestToItem(
  'int-req-2',
  `GET /xjs/_/ss/k=xjs.s.zTIQhDTr3zA.L.B1.O/am=CAAAAAAAABAAAAAAAAAAAAAAAAAACBAABEAAAAAAAAAAAAAAAAAAAAAAhABAAAAAAAAAAAEAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKPAAAC4AQAQAAAB7AAMAhAAAAAAAAAAAAAAAAAACAAAAAGAAABoAAAAAD4AAAQBAAAAAAAAAABAAAAAAAAACAAGABQAAAAAAAigAIAAAAAAAAGCQCAABAAACAAAAAAAAAAAAAAAAAaaOAAhAAAAAAAAAAAAAAAAAEAgAAAAAAAAAAAAAEBwaAAAgQJAAAAAAAAAAAMAAAACAAMAAAAAgAQAAMAAAAAAAAACAAAAAAAAAcGAQAQAAAAAAAAAAAACCAUAgAEAAMAEAAgAAAAAAAAAAAAAAAAAAECBAAABAAgCAIAAAAAAAAABAgAaAgAAAAAAAAAACAAACBAAAAAAAgKAAAAABAAFAAAQAAAAAAAcBACBAgBQAQAAgAACAIBgAAgAAEAACAAAUAAAAAAAAAAABA/d=1/ed=1/br=1/cb=loaded_h_0/rs=ACT90gBEpNYQnIWJQqDeC9XRICM3C5tqzA/m=X3nOBf,attn,cdos,gwc,hsm,jsa,mb4ZUb,cET9Ob,SNUn3,qddgKe,sTsDMc,dtlOhd,eHdf1,YV5bee,d,csi?cb=121509378 HTTP/1.1\r
Host: www.google.com\r
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36\r
Accept: */*\r
Referer: https://www.google.com/search?q=hi\r
\r
`,
  'https://www.google.com/'
);

const INITIAL_QUEUE_ITEM_3 = parseRawHttpRequestToItem(
  'int-req-3',
  `POST /gen_204?s=web&t=cap&atyp=csi&ei=EXScaqX-BbDfseMPyurCkQM HTTP/1.1\r
Host: www.google.com\r
Content-Type: application/x-www-form-urlencoded\r
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36\r
\r
`,
  'https://www.google.com/'
);

export interface InterceptStoreState {
  isInterceptOn: boolean;
  interceptedQueue: InterceptedRequestItem[];
  selectedQueueId: string | null;
  editedRawRequest: string;
  viewMode: 'Pretty' | 'Raw' | 'Hex';
  inspectorOpen: boolean;

  // Actions
  toggleIntercept: () => void;
  setInterceptOn: (on: boolean) => void;
  enqueueRequest: (rawOrItem: string | Partial<InterceptedRequestItem>, targetUrl?: string) => string;
  selectRequest: (id: string | null) => void;
  updateEditedRawRequest: (raw: string) => void;
  forwardRequest: (id?: string) => Promise<void>;
  forwardAll: () => Promise<void>;
  dropRequest: (id?: string) => void;
  dropAll: () => void;
  setViewMode: (mode: 'Pretty' | 'Raw' | 'Hex') => void;
  setInspectorOpen: (open: boolean) => void;
  updateQueryParam: (name: string, value: string) => void;
  addQueryParam: (name: string, value: string) => void;
  deleteQueryParam: (name: string) => void;
  updateHeader: (name: string, value: string) => void;
  addHeader: (name: string, value: string) => void;
  deleteHeader: (name: string) => void;
  updateCookie: (name: string, value: string) => void;
  addCookie: (name: string, value: string) => void;
  deleteCookie: (name: string) => void;
}

export const useInterceptStore = create<InterceptStoreState>((set, get) => ({
  isInterceptOn: true,
  interceptedQueue: [INITIAL_QUEUE_ITEM_1, INITIAL_QUEUE_ITEM_2, INITIAL_QUEUE_ITEM_3],
  selectedQueueId: INITIAL_QUEUE_ITEM_1.id,
  editedRawRequest: INITIAL_GOOGLE_SEARCH_RAW,
  viewMode: 'Pretty',
  inspectorOpen: true,

  toggleIntercept: () => {
    const next = !get().isInterceptOn;
    set({ isInterceptOn: next });
    useToastStore.getState().addToast({
      type: next ? 'info' : 'warning',
      title: next ? 'Intercept is on' : 'Intercept is off',
      description: next ? 'Requests will be paused for inspection.' : 'Traffic flows through automatically.',
    });
  },

  setInterceptOn: (isInterceptOn) => set({ isInterceptOn }),

  enqueueRequest: (rawOrItem, targetUrl) => {
    const id = `int-req-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    let item: InterceptedRequestItem;

    if (typeof rawOrItem === 'string') {
      item = parseRawHttpRequestToItem(id, rawOrItem, targetUrl);
    } else {
      const raw = rawOrItem.rawRequest || 'GET / HTTP/1.1\r\nHost: target\r\n\r\n';
      item = {
        ...parseRawHttpRequestToItem(id, raw, targetUrl || rawOrItem.url),
        ...rawOrItem,
        id,
      };
    }

    set((state) => {
      const nextQueue = [...state.interceptedQueue, item];
      const nextSelected = state.selectedQueueId || id;
      const nextRaw = state.selectedQueueId ? state.editedRawRequest : item.rawRequest;
      return {
        interceptedQueue: nextQueue,
        selectedQueueId: nextSelected,
        editedRawRequest: nextRaw,
      };
    });

    return id;
  },

  selectRequest: (id) => {
    const { interceptedQueue } = get();
    const item = interceptedQueue.find((q) => q.id === id) || interceptedQueue[0] || null;
    set({
      selectedQueueId: item ? item.id : null,
      editedRawRequest: item ? item.rawRequest : '',
    });
  },

  updateEditedRawRequest: (editedRawRequest) => {
    const { selectedQueueId, interceptedQueue } = get();
    if (!selectedQueueId) {
      set({ editedRawRequest });
      return;
    }

    const currentItem = interceptedQueue.find((q) => q.id === selectedQueueId);
    const updatedItem = parseRawHttpRequestToItem(
      selectedQueueId,
      editedRawRequest,
      currentItem?.url
    );

    set((state) => ({
      editedRawRequest,
      interceptedQueue: state.interceptedQueue.map((q) => (q.id === selectedQueueId ? updatedItem : q)),
    }));
  },

  forwardRequest: async (targetId) => {
    const { selectedQueueId, interceptedQueue, editedRawRequest } = get();
    const forwardId = targetId || selectedQueueId;
    if (!forwardId) return;

    const itemToForward = interceptedQueue.find((q) => q.id === forwardId);
    if (!itemToForward) return;

    const wireRawRequest = forwardId === selectedQueueId ? editedRawRequest : itemToForward.rawRequest;
    const currentItem = parseRawHttpRequestToItem(forwardId, wireRawRequest, itemToForward.url);

    // 1. Dispatch upstream via IPC repeater executor
    let resStatus = 200;
    let resBody = 'OK';
    let durationMs = 45;
    try {
      const execResult = await ipcClient.sendRepeaterRequest({
        tabId: `intercept-${forwardId}`,
        targetUrl: currentItem.url,
        rawRequest: wireRawRequest,
      });
      resStatus = execResult.statusCode || 200;
      resBody = execResult.body || '';
      durationMs = execResult.durationMs || 45;
    } catch {
      resStatus = 200;
    }

    // 2. Ingest into HTTP history (trafficStore)
    const histItem: TrafficSummary = {
      id: `tx-${Date.now().toString().slice(-6)}`,
      seqNumber: useTrafficStore.getState().transactions.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      timestampMs: Date.now(),
      method: currentItem.method,
      url: currentItem.url,
      host: currentItem.host,
      path: currentItem.path,
      status: resStatus,
      durationMs,
      sizeBytes: new TextEncoder().encode(resBody).length || currentItem.lengthBytes,
      inScope: true,
      mimeType: currentItem.path.includes('.js') ? 'script' : currentItem.path.includes('.png') || currentItem.path.includes('.webp') ? 'image' : 'HTML',
      tags: ['intercepted', 'forwarded'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    };
    useTrafficStore.getState().addTransaction(histItem);

    // 3. Remove from queue and advance selection
    const nextQueue = interceptedQueue.filter((q) => q.id !== forwardId);
    const nextActive = nextQueue[0] || null;

    set({
      interceptedQueue: nextQueue,
      selectedQueueId: nextActive ? nextActive.id : null,
      editedRawRequest: nextActive ? nextActive.rawRequest : '',
    });

    useToastStore.getState().addToast({
      type: 'success',
      title: 'Forwarded Request',
      description: `${currentItem.method} ${currentItem.url.slice(0, 45)}...`,
    });
  },

  forwardAll: async () => {
    const { interceptedQueue } = get();
    for (const item of interceptedQueue) {
      await get().forwardRequest(item.id);
    }
  },

  dropRequest: (targetId) => {
    const { selectedQueueId, interceptedQueue } = get();
    const dropId = targetId || selectedQueueId;
    if (!dropId) return;

    const itemToDrop = interceptedQueue.find((q) => q.id === dropId);
    const nextQueue = interceptedQueue.filter((q) => q.id !== dropId);
    const nextActive = nextQueue[0] || null;

    set({
      interceptedQueue: nextQueue,
      selectedQueueId: nextActive ? nextActive.id : null,
      editedRawRequest: nextActive ? nextActive.rawRequest : '',
    });

    useToastStore.getState().addToast({
      type: 'warning',
      title: 'Dropped Request',
      description: itemToDrop ? `${itemToDrop.method} ${itemToDrop.url.slice(0, 40)}` : 'Request cancelled',
    });
  },

  dropAll: () => {
    set({
      interceptedQueue: [],
      selectedQueueId: null,
      editedRawRequest: '',
    });
    useToastStore.getState().addToast({
      type: 'warning',
      title: 'Dropped All Requests',
    });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),

  updateQueryParam: (name, value) => {
    const { editedRawRequest, updateEditedRawRequest } = get();
    const parts = editedRawRequest.split(/\r?\n\r?\n/);
    const headLines = (parts[0] || '').split(/\r?\n/);
    const reqLine = headLines[0] || '';
    const [method = 'GET', fullPath = '/', proto = 'HTTP/1.1'] = reqLine.split(/\s+/);

    const [basePath, qStr = ''] = fullPath.split('?');
    const params = new URLSearchParams(qStr);
    params.set(name, value);
    const nextPath = `${basePath}?${params.toString()}`;

    headLines[0] = `${method} ${nextPath} ${proto}`;
    const nextRaw = [headLines.join('\r\n'), ...parts.slice(1)].join('\r\n\r\n');
    updateEditedRawRequest(nextRaw);
  },

  addQueryParam: (name, value) => {
    get().updateQueryParam(name, value);
  },

  deleteQueryParam: (name) => {
    const { editedRawRequest, updateEditedRawRequest } = get();
    const parts = editedRawRequest.split(/\r?\n\r?\n/);
    const headLines = (parts[0] || '').split(/\r?\n/);
    const reqLine = headLines[0] || '';
    const [method = 'GET', fullPath = '/', proto = 'HTTP/1.1'] = reqLine.split(/\s+/);

    const [basePath, qStr = ''] = fullPath.split('?');
    const params = new URLSearchParams(qStr);
    params.delete(name);
    const paramStr = params.toString();
    const nextPath = paramStr ? `${basePath}?${paramStr}` : basePath;

    headLines[0] = `${method} ${nextPath} ${proto}`;
    const nextRaw = [headLines.join('\r\n'), ...parts.slice(1)].join('\r\n\r\n');
    updateEditedRawRequest(nextRaw);
  },

  updateHeader: (name, value) => {
    const { editedRawRequest, updateEditedRawRequest } = get();
    const parts = editedRawRequest.split(/\r?\n\r?\n/);
    const headLines = (parts[0] || '').split(/\r?\n/);

    let found = false;
    for (let i = 1; i < headLines.length; i++) {
      const line = headLines[i];
      const colon = line.indexOf(':');
      if (colon !== -1) {
        const headerName = line.substring(0, colon).trim();
        if (headerName.toLowerCase() === name.toLowerCase()) {
          headLines[i] = `${headerName}: ${value}`;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      headLines.push(`${name}: ${value}`);
    }

    const nextRaw = [headLines.join('\r\n'), ...parts.slice(1)].join('\r\n\r\n');
    updateEditedRawRequest(nextRaw);
  },

  addHeader: (name, value) => {
    get().updateHeader(name, value);
  },

  deleteHeader: (name) => {
    const { editedRawRequest, updateEditedRawRequest } = get();
    const parts = editedRawRequest.split(/\r?\n\r?\n/);
    const headLines = (parts[0] || '').split(/\r?\n/);

    const filtered = [
      headLines[0],
      ...headLines.slice(1).filter((l) => {
        const colon = l.indexOf(':');
        if (colon === -1) return true;
        const hName = l.substring(0, colon).trim();
        return hName.toLowerCase() !== name.toLowerCase();
      }),
    ];

    const nextRaw = [filtered.join('\r\n'), ...parts.slice(1)].join('\r\n\r\n');
    updateEditedRawRequest(nextRaw);
  },

  updateCookie: (name, value) => {
    const { editedRawRequest, updateHeader } = get();
    const parts = editedRawRequest.split(/\r?\n\r?\n/);
    const headLines = (parts[0] || '').split(/\r?\n/);

    let cookieLine = '';
    for (let i = 1; i < headLines.length; i++) {
      const line = headLines[i];
      if (line.toLowerCase().startsWith('cookie:')) {
        cookieLine = line.substring(7).trim();
        break;
      }
    }

    const cookiePairs: Array<{ k: string; v: string }> = [];
    if (cookieLine) {
      cookieLine.split(';').forEach((pair) => {
        const eq = pair.indexOf('=');
        if (eq !== -1) {
          cookiePairs.push({ k: pair.substring(0, eq).trim(), v: pair.substring(eq + 1).trim() });
        }
      });
    }

    const existing = cookiePairs.find((c) => c.k === name);
    if (existing) {
      existing.v = value;
    } else {
      cookiePairs.push({ k: name, v: value });
    }

    const newCookieStr = cookiePairs.map((c) => `${c.k}=${c.v}`).join('; ');
    updateHeader('Cookie', newCookieStr);
  },

  addCookie: (name, value) => {
    get().updateCookie(name, value);
  },

  deleteCookie: (name) => {
    const { editedRawRequest, updateHeader, deleteHeader } = get();
    const parts = editedRawRequest.split(/\r?\n\r?\n/);
    const headLines = (parts[0] || '').split(/\r?\n/);

    let cookieLine = '';
    for (let i = 1; i < headLines.length; i++) {
      const line = headLines[i];
      if (line.toLowerCase().startsWith('cookie:')) {
        cookieLine = line.substring(7).trim();
        break;
      }
    }

    if (!cookieLine) return;

    const cookiePairs = cookieLine
      .split(';')
      .map((pair) => {
        const eq = pair.indexOf('=');
        return eq !== -1 ? { k: pair.substring(0, eq).trim(), v: pair.substring(eq + 1).trim() } : null;
      })
      .filter((c): c is { k: string; v: string } => Boolean(c && c.k !== name));

    if (cookiePairs.length === 0) {
      deleteHeader('Cookie');
    } else {
      updateHeader('Cookie', cookiePairs.map((c) => `${c.k}=${c.v}`).join('; '));
    }
  },
}));
