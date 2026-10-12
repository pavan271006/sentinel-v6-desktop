import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { useTrafficStore } from '../../stores/trafficStore';
import { useToastStore } from '../../stores/toastStore';
import { ipcClient } from '../../ipc/client';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Select } from '../../design-system/Select';
import { Tabs, TabItem } from '../../design-system/Tabs';
import { HttpMethod, RequestEditorMode, RequestBodyType } from '../../types/repeater';
import { generateUuid as uuidv4, findUsedVariables, getUtf8ByteLength, parseRawHttpRequest, serializeHttpRequest } from '../../utils/repeaterUtils';
import { revitalizeHttpRequest } from '../../utils/universalRequestRevitalizer';
import {
  Send,
  Square,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  RotateCw,
  Eye,
  Binary,
} from 'lucide-react';
import { ContextMenu } from '../../design-system/ContextMenu';
import { buildTrafficContextMenu } from '../../utils/contextMenuUtils';
import { SyntaxHighlightedEditor } from '../common/SyntaxHighlightedEditor';
import { RawByteInspector } from '../../design-system/RawByteInspector';
import { BurpSearchBar, countSearchMatches } from '../common/BurpSearchBar';
import { BurpEditorToolbar } from '../common/BurpEditorToolbar';


const HTTP_METHODS: { label: string; value: HttpMethod }[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'HEAD', value: 'HEAD' },
  { label: 'OPTIONS', value: 'OPTIONS' },
];

const STANDARD_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'Host',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Requested-With',
  'X-Forwarded-For',
  'X-API-Key',
  'X-CSRF-Token',
];

export interface RequestEditorPanelProps {
  tabId?: string;
}

export const RequestEditorPanel: React.FC<RequestEditorPanelProps> = ({ tabId }) => {
  const {
    tabs,
    activeTabId,
    updateTabMethod,
    updateTabUrl,
    updateTabProtocol,
    updateTabHeaders,
    updateTabQueryParams,
    updateTabBody,
    updateTabBodyType,
    updateTabRawRequest,
    setAutoContentLength,
    setRequestViewMode,
    sendRequest,
    cancelRequest,
    toggleVariablesModal,
    interpolateRequest,
    isInspectorOpen,
    toggleInspector,
    setSelectionData,
  } = useRepeaterStore();

  const currentTabId = tabId || activeTabId;
  const tab = tabs.find((t) => t.id === currentTabId) || tabs[0];
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [hideBoringHeaders, setHideBoringHeaders] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [showNonPrintable, setShowNonPrintable] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
  });

  // Auth injector local state
  const [authType, setAuthType] = useState<'bearer' | 'basic' | 'apikey'>('bearer');
  const [bearerToken, setBearerToken] = useState('{{token}}');
  const [basicUser, setBasicUser] = useState('admin');
  const [basicPass, setBasicPass] = useState('password');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('{{api_key}}');

  const totalMatches = useMemo(() => countSearchMatches(tab?.rawRequest || '', searchQuery), [tab?.rawRequest, searchQuery]);

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
  };

  if (!tab) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">No active tab</div>;
  }

  const headerText = tab.headers.map((h) => `${h.name}: ${h.value}`).join('\n');
  const activeText = tab.rawMode ? tab.rawRequest : `${tab.method} ${tab.url}\n${headerText}\n${tab.body}`;
  const usedVars = findUsedVariables(`${tab.rawRequest}\n${activeText}`);
  const bodySizeBytes = getUtf8ByteLength(tab.body);
  const rawSizeBytes = getUtf8ByteLength(tab.rawRequest);

  // Editor View Tabs definition (Burp Suite Pro tabs: Pretty, Raw, Hex)
  const viewTabs: TabItem[] = [
    { id: 'pretty', label: 'Pretty', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'raw', label: 'Raw', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'hex', label: 'Hex', icon: <Binary className="w-3.5 h-3.5" /> },
  ];

  // Header helpers
  const handleAddHeader = () => {
    const newHeaders = [...tab.headers, { id: uuidv4(), name: '', value: '', enabled: true }];
    updateTabHeaders(tab.id, newHeaders);
  };

  const handleUpdateHeader = (id: string, updates: Partial<{ name: string; value: string; enabled: boolean }>) => {
    const newHeaders = tab.headers.map((h) => (h.id === id ? { ...h, ...updates } : h));
    updateTabHeaders(tab.id, newHeaders);
  };

  const handleDeleteHeader = (id: string) => {
    const newHeaders = tab.headers.filter((h) => h.id !== id);
    updateTabHeaders(tab.id, newHeaders);
  };

  // Query param helpers
  const handleAddParam = () => {
    const newParams = [...tab.queryParams, { id: uuidv4(), key: '', value: '', enabled: true }];
    updateTabQueryParams(tab.id, newParams);
  };

  const handleUpdateParam = (id: string, updates: Partial<{ key: string; value: string; enabled: boolean }>) => {
    const newParams = tab.queryParams.map((p) => (p.id === id ? { ...p, ...updates } : p));
    updateTabQueryParams(tab.id, newParams);
  };

  const handleDeleteParam = (id: string) => {
    const newParams = tab.queryParams.filter((p) => p.id !== id);
    updateTabQueryParams(tab.id, newParams);
  };

  // Prettify helpers
  const handlePrettifyRawRequest = () => {
    try {
      const parsed = parseRawHttpRequest(tab.rawRequest);
      if (parsed.body && parsed.body.trim()) {
        try {
          const jsonBody = JSON.parse(parsed.body);
          const prettyBody = JSON.stringify(jsonBody, null, 2);
          const newRaw = serializeHttpRequest(
            parsed.method,
            parsed.path,
            parsed.protocol,
            parsed.headers,
            prettyBody
          );
          updateTabRawRequest(tab.id, newRaw);
          updateTabBody(tab.id, prettyBody);
        } catch {}
      }
    } catch {}
  };

  // Body helpers
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(tab.body);
      updateTabBody(tab.id, JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
    }
  };

  const handleMinifyJson = () => {
    try {
      const parsed = JSON.parse(tab.body);
      updateTabBody(tab.id, JSON.stringify(parsed));
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
    }
  };


  // Auth injector apply
  const handleApplyAuth = () => {
    let headerName = 'Authorization';
    let headerValue = '';

    if (authType === 'bearer') {
      headerValue = `Bearer ${bearerToken.trim()}`;
    } else if (authType === 'basic') {
      const b64 = btoa(`${basicUser}:${basicPass}`);
      headerValue = `Basic ${b64}`;
    } else if (authType === 'apikey') {
      headerName = apiKeyHeader.trim() || 'X-API-Key';
      headerValue = apiKeyValue.trim();
    }

    const headers = [...tab.headers];
    const existingIdx = headers.findIndex((h) => h.name.toLowerCase() === headerName.toLowerCase());
    if (existingIdx !== -1) {
      headers[existingIdx] = { ...headers[existingIdx], value: headerValue, enabled: true };
    } else {
      headers.push({ id: uuidv4(), name: headerName, value: headerValue, enabled: true });
    }
    updateTabHeaders(tab.id, headers);
  };

  // Universal Request & Token Revitalizer:
  // Compatible with ALL websites & web frameworks (Laravel, Django, Rails, Spring, ASP.NET, Express, PHP, REST APIs).
  // Eliminates stale cache headers, renews unconsumed anti-CSRF tokens, refreshes session cookies,
  // making any request act like a brand-new, working browser request.
  const handleRefreshTokens = async () => {
    if (isRefreshingTokens) return;
    setIsRefreshingTokens(true);

    try {
      // 1. Parse current request
      const parsed = parseRawHttpRequest(tab.rawRequest);
      const targetPath = parsed.path || '/';

      // 2. Determine target host dynamically
      let host = '';
      if (tab.url) {
        try {
          host = new URL(tab.url).hostname;
        } catch {
          try {
            host = new URL('http://' + tab.url).hostname;
          } catch {}
        }
      }
      if (!host) {
        const hostHeader =
          parsed.headers.find((h) => h.name.toLowerCase() === 'host')?.value ||
          tab.headers.find((h) => h.name.toLowerCase() === 'host')?.value;
        if (hostHeader) host = hostHeader.split(':')[0].trim();
      }

      // 3. Find candidate transactions from proxy history for this host
      const allTxs = useTrafficStore.getState().transactions || [];
      const relevantTxs = host
        ? allTxs.filter((t) => t.host === host || (t.url && t.url.includes(host))).reverse()
        : [...allTxs].reverse();
      const candidateTxs = relevantTxs.length > 0 ? relevantTxs : [...allTxs].reverse();

      // 4. Determine intelligent probe URL
      // If Referer header exists and is from the same host, probe the referring page where forms originate
      let probePath = targetPath;
      const refererVal =
        parsed.headers.find((h) => h.name.toLowerCase() === 'referer')?.value ||
        tab.headers.find((h) => h.name.toLowerCase() === 'referer')?.value;
      if (refererVal) {
        try {
          const refUrl = new URL(refererVal);
          if (refUrl.hostname === host || !host) {
            probePath = refUrl.pathname + refUrl.search;
          }
        } catch {}
      }

      // 5. Existing cookies from editor to pass to probe (including gateway cookies)
      const existingCookieHdr =
        parsed.headers.find((h) => h.name.toLowerCase() === 'cookie')?.value ||
        tab.headers.find((h) => h.name.toLowerCase() === 'cookie')?.value ||
        '';

      const probeCookiePairs: string[] = [];
      if (existingCookieHdr) {
        for (const part of existingCookieHdr.split(';')) {
          const trimmed = part.trim();
          if (trimmed) {
            const lower = trimmed.toLowerCase();
            if (
              lower.startsWith('wssplashchk') ||
              lower.startsWith('cf_') ||
              lower.includes('splash') ||
              lower.includes('alb') ||
              lower.includes('incap')
            ) {
              probeCookiePairs.push(trimmed);
            }
          }
        }
      }

      const probeCookieStr = probeCookiePairs.length > 0 ? `Cookie: ${probeCookiePairs.join('; ')}\r\n` : '';

      const isHttps = tab.url.startsWith('https://') || !tab.url.startsWith('http://');
      const scheme = isHttps ? 'https://' : 'http://';
      const probeUrl = `${scheme}${host}${probePath.startsWith('/') ? probePath : '/' + probePath}`;

      const probeReq = `GET ${probePath.startsWith('/') ? probePath : '/' + probePath} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\nsec-ch-ua: "Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"\r\nsec-ch-ua-mobile: ?0\r\nsec-ch-ua-platform: "Windows"\r\nUpgrade-Insecure-Requests: 1\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\r\nSec-Fetch-Site: same-origin\r\nSec-Fetch-Mode: navigate\r\nSec-Fetch-User: ?1\r\nSec-Fetch-Dest: document\r\nReferer: ${probeUrl}\r\nAccept-Encoding: gzip, deflate, br, zstd\r\nAccept-Language: en-US,en;q=0.9\r\n${probeCookieStr}\r\n`;

      let probeRes: any = null;
      try {
        probeRes = await ipcClient.sendRepeaterRequest({
          tabId: `probe-${Date.now()}`,
          targetUrl: probeUrl,
          rawRequest: probeReq,
          envVars: {},
          interpolate: false,
        });
      } catch (pErr) {
        console.warn('Probe request error:', pErr);
      }

      // 6. Universal Revitalization across all platforms
      const result = revitalizeHttpRequest({
        rawRequest: tab.rawRequest,
        tabUrl: tab.url,
        probedHtml: probeRes?.body || '',
        probedHeaders: probeRes?.headers || [],
        probedRawResponse: probeRes?.rawResponse || '',
        candidateTransactions: candidateTxs,
      });

      // 7. Atomically update tab in store
      updateTabRawRequest(tab.id, result.updatedRawRequest);

      // Build descriptive summary
      const cookiesList = Object.keys(result.refreshedCookies);
      const tokensList = Object.keys(result.refreshedTokens);
      const parts: string[] = [];
      if (cookiesList.length > 0) {
        parts.push(`${cookiesList.length} cookies refreshed (${cookiesList.slice(0, 3).join(', ')}${cookiesList.length > 3 ? '...' : ''})`);
      }
      if (tokensList.length > 0) {
        parts.push(`anti-CSRF tokens renewed (${tokensList.join(', ')})`);
      }
      parts.push('stale cache headers cleared');

      useToastStore.getState().addToast({
        type: 'success',
        title: result.source === 'live' ? 'Brand-New Request Generated (Live Server)' : 'Brand-New Request Generated',
        description: parts.join('; ') + '.',
        duration: 3500,
      });
    } catch (err: any) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Request Refresh Failed',
        description: err?.message || 'Could not transform request',
      });
    } finally {
      setIsRefreshingTokens(false);
    }
  };

    const autoRefreshedTabs = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tab) return;
    const isLogin =
      tab.url.toLowerCase().includes('/login') ||
      tab.rawRequest.toLowerCase().includes('/login') ||
      tab.body.includes('_token=');
    if (isLogin && !autoRefreshedTabs.current.has(tab.id)) {
      autoRefreshedTabs.current.add(tab.id);
      handleRefreshTokens();
    }
  }, [tab?.id]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, isOpen: true });
      }}
      className="flex flex-col h-full bg-bg-panel border-r border-border-subtle overflow-hidden"
    >
      {/* Target & Execution Bar */}
      <div className="flex items-center gap-2 p-2 bg-bg-panel-elevated border-b border-border-subtle select-none flex-shrink-0">
        {/* Method Selector */}
        <div className="w-28 flex-shrink-0">
          <Select
            options={HTTP_METHODS}
            value={tab.method}
            onChange={(e) => updateTabMethod(tab.id, e.target.value as HttpMethod)}
            className="font-mono text-xs font-bold"
          />
        </div>

        {/* URL Input */}
        <div className="flex-1 min-w-0">
          <Input
            value={tab.url}
            onChange={(e) => updateTabUrl(tab.id, e.target.value)}
            placeholder="https://target.local/api/v1/resource"
            className="font-mono text-xs w-full"
          />
        </div>

        {/* Protocol Switcher */}
        <button
          onClick={() => updateTabProtocol(tab.id, tab.protocol === 'HTTP/1.1' ? 'HTTP/2' : 'HTTP/1.1')}
          className="px-2 py-1.5 text-xs font-mono font-semibold rounded bg-bg-canvas border border-border-subtle hover:border-accent-cyan text-text-muted hover:text-accent-cyan transition-colors flex-shrink-0"
          title="Toggle HTTP Protocol"
        >
          {tab.protocol}
        </button>

        {/* Send / Cancel Button */}
        {tab.isExecuting ? (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Square className="w-3.5 h-3.5 animate-pulse" />}
            onClick={() => cancelRequest(tab.id)}
            className="font-bold flex-shrink-0"
            title="Cancel Request in Flight"
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Send className="w-3.5 h-3.5" />}
            onClick={() => sendRequest(tab.id)}
            className="font-bold flex-shrink-0"
            title="Send Request (Ctrl+Enter)"
          >
            Send
          </Button>
        )}
      </div>

      {/* Sub-View Mode Selector Tabs & Toolbar */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-canvas/40 px-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Tabs
            tabs={viewTabs}
            activeTab={tab.requestViewMode}
            onChange={(tabId) => setRequestViewMode(tab.id, tabId as RequestEditorMode)}
          />

          <button
            onClick={handleRefreshTokens}
            disabled={isRefreshingTokens}
            className={`group flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded border transition-all duration-200 select-none min-w-[125px] ${
              isRefreshingTokens
                ? 'bg-[#18191c] border-[#f37021] text-white shadow-[0_0_10px_rgba(243,112,33,0.3)] cursor-wait'
                : 'bg-[#1e2024] hover:bg-[#282a2e] text-[#d4d4d8] hover:text-white border-[#3e4249] hover:border-[#f37021]/60 active:scale-[0.98]'
            }`}
            title="Intelligently transform into a brand new request by eliminating stale sessions, expired CSRF tokens & cache headers"
          >
            <RotateCw
              className={`w-3.5 h-3.5 shrink-0 text-[#f37021] transition-transform duration-300 ${
                isRefreshingTokens ? 'animate-spin' : 'group-hover:rotate-180'
              }`}
            />
            <span className="truncate">
              {isRefreshingTokens ? 'Revitalizing...' : 'Refresh Tokens'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 pr-1">
          {/* Auto Content-Length toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary text-xs text-text-muted select-none">
            <input
              type="checkbox"
              checked={tab.autoContentLength}
              onChange={(e) => setAutoContentLength(tab.id, e.target.checked)}
              className="rounded border-border-subtle text-accent-cyan focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 bg-bg-canvas"
            />
            <span className="text-[11px] font-mono">Auto Content-Length</span>
          </label>

          <BurpEditorToolbar
            hideBoringHeaders={hideBoringHeaders}
            onToggleHideBoringHeaders={() => setHideBoringHeaders((prev) => !prev)}
            wordWrap={wordWrap}
            onToggleWordWrap={() => setWordWrap((prev) => !prev)}
            showNonPrintable={showNonPrintable}
            onToggleShowNonPrintable={() => setShowNonPrintable((prev) => !prev)}
            inspectorOpen={isInspectorOpen}
            onToggleInspector={toggleInspector}
          />
        </div>
      </div>

      {/* Sub-View Content Area */}
      <div className="flex-1 overflow-auto bg-bg-canvas p-2">
        {/* 1. PRETTY EDITABLE HIGHLIGHT VIEW (Exact Burp Suite Colors + Live Editing) */}
        {tab.requestViewMode === 'pretty' && (
          <div className="h-full">
            <SyntaxHighlightedEditor
              value={tab.rawRequest}
              onChange={(val) => updateTabRawRequest(tab.id, val)}
              searchQuery={searchQuery}
              activeMatchIndex={activeMatchIndex}
              wordWrap={wordWrap}
              hideUninterestingHeaders={hideBoringHeaders}
              showNonPrintable={showNonPrintable}
              onSelectionChange={(sel) => setSelectionData(sel)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, isOpen: true });
              }}
            />
          </div>
        )}

        {/* 2. RAW HTTP MODE */}
        {tab.requestViewMode === 'raw' && (
          <div className="flex flex-col h-full space-y-2">
            <div className="flex items-center justify-between px-1 flex-shrink-0">
              <span className="text-[11px] font-mono text-text-muted">Direct Raw HTTP Editor</span>
              <Button
                variant="secondary"
                size="xs"
                onClick={handlePrettifyRawRequest}
                leftIcon={<Sparkles className="w-3 h-3 text-[#f37021]" />}
                title="Format JSON payload inside raw request"
              >
                Prettify JSON
              </Button>
            </div>

            <textarea
              value={tab.rawRequest}
              onChange={(e) => updateTabRawRequest(tab.id, e.target.value)}
              onSelect={(e) => {
                const el = e.currentTarget;
                setSelectionData({
                  text: el.value.substring(el.selectionStart, el.selectionEnd),
                  start: el.selectionStart,
                  end: el.selectionEnd,
                });
              }}
              onKeyUp={(e) => {
                const el = e.currentTarget;
                setSelectionData({
                  text: el.value.substring(el.selectionStart, el.selectionEnd),
                  start: el.selectionStart,
                  end: el.selectionEnd,
                });
              }}
              onMouseUp={(e) => {
                const el = e.currentTarget;
                setSelectionData({
                  text: el.value.substring(el.selectionStart, el.selectionEnd),
                  start: el.selectionStart,
                  end: el.selectionEnd,
                });
              }}
              placeholder="GET /api/v1/ HTTP/1.1&#10;Host: target.local&#10;User-Agent: Sentinel/6.0.0 Repeater&#10;&#10;"
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordBreak: wordWrap ? 'break-all' : 'normal',
              }}
              className="flex-1 w-full bg-[#1e1f22] border border-border-subtle rounded p-2.5 font-mono text-[11px] text-[#dfdfdf] resize-none outline-none focus:border-[#f37021] transition-colors leading-5 selection:bg-[#f37021]/30"
              spellCheck={false}
            />
          </div>
        )}

        {/* 3. HEX DUMP MODE */}
        {tab.requestViewMode === 'hex' && (
          <div className="h-full border border-border-subtle rounded bg-bg-panel overflow-hidden">
            <RawByteInspector data={tab.rawRequest} />
          </div>
        )}


        {/* 2. HEADERS TABLE MODE */}
        {tab.requestViewMode === 'headers' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted">Request Headers</span>
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={handleAddHeader}
              >
                Add Header
              </Button>
            </div>

            <div className="flex-1 overflow-auto border border-border-subtle rounded bg-bg-panel">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-panel-elevated text-text-muted">
                    <th className="py-1.5 px-2 w-8 text-center">✓</th>
                    <th className="py-1.5 px-2 w-1/3">Header Name</th>
                    <th className="py-1.5 px-2">Header Value</th>
                    <th className="py-1.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {tab.headers.map((header) => (
                    <tr key={header.id} className="border-b border-border-subtle/50 hover:bg-bg-canvas/30 group">
                      <td className="py-1 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={header.enabled}
                          onChange={(e) => handleUpdateHeader(header.id, { enabled: e.target.checked })}
                          className="rounded border-border-subtle text-accent-cyan focus:ring-0 w-3.5 h-3.5 bg-bg-canvas"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={header.name}
                          onChange={(e) => handleUpdateHeader(header.id, { name: e.target.value })}
                          list="std-headers"
                          placeholder="Header-Name"
                          className="w-full bg-transparent border-0 outline-none text-text-primary placeholder:text-text-muted/40 focus:bg-bg-canvas/50 px-1 rounded"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => handleUpdateHeader(header.id, { value: e.target.value })}
                          placeholder="value"
                          className="w-full bg-transparent border-0 outline-none text-text-primary placeholder:text-text-muted/40 focus:bg-bg-canvas/50 px-1 rounded"
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <button
                          onClick={() => handleDeleteHeader(header.id)}
                          className="p-1 rounded text-text-muted hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tab.headers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-text-muted text-xs">
                        No request headers defined. Click "Add Header" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <datalist id="std-headers">
                {STANDARD_HEADERS.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {/* 3. QUERY PARAMS MODE */}
        {tab.requestViewMode === 'params' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted">URL Query Parameters</span>
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={handleAddParam}
              >
                Add Parameter
              </Button>
            </div>

            <div className="flex-1 overflow-auto border border-border-subtle rounded bg-bg-panel">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-panel-elevated text-text-muted">
                    <th className="py-1.5 px-2 w-8 text-center">✓</th>
                    <th className="py-1.5 px-2 w-1/3">Parameter Key</th>
                    <th className="py-1.5 px-2">Parameter Value</th>
                    <th className="py-1.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {tab.queryParams.map((param) => (
                    <tr key={param.id} className="border-b border-border-subtle/50 hover:bg-bg-canvas/30 group">
                      <td className="py-1 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={param.enabled}
                          onChange={(e) => handleUpdateParam(param.id, { enabled: e.target.checked })}
                          className="rounded border-border-subtle text-accent-cyan focus:ring-0 w-3.5 h-3.5 bg-bg-canvas"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={param.key}
                          onChange={(e) => handleUpdateParam(param.id, { key: e.target.value })}
                          placeholder="key"
                          className="w-full bg-transparent border-0 outline-none text-text-primary placeholder:text-text-muted/40 focus:bg-bg-canvas/50 px-1 rounded"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="text"
                          value={param.value}
                          onChange={(e) => handleUpdateParam(param.id, { value: e.target.value })}
                          placeholder="value"
                          className="w-full bg-transparent border-0 outline-none text-text-primary placeholder:text-text-muted/40 focus:bg-bg-canvas/50 px-1 rounded"
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <button
                          onClick={() => handleDeleteParam(param.id)}
                          className="p-1 rounded text-text-muted hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tab.queryParams.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-text-muted text-xs">
                        No query parameters in URL. Click "Add Parameter" or edit the URL directly.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. BODY EDITOR MODE */}
        {tab.requestViewMode === 'body' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Select
                  options={[
                    { label: 'Raw Text', value: 'raw' },
                    { label: 'JSON', value: 'json' },
                    { label: 'x-www-form-urlencoded', value: 'x-www-form-urlencoded' },
                  ]}
                  value={tab.bodyType}
                  onChange={(e) => updateTabBodyType(tab.id, e.target.value as RequestBodyType)}
                  className="w-40 text-xs font-mono"
                />

                {tab.bodyType === 'json' && (
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="xs" onClick={handleFormatJson} leftIcon={<Sparkles className="w-3 h-3 text-accent-cyan" />}>
                      Prettify
                    </Button>
                    <Button variant="secondary" size="xs" onClick={handleMinifyJson}>
                      Minify
                    </Button>
                  </div>
                )}
              </div>

              <span className="text-[11px] font-mono text-text-muted">{bodySizeBytes} bytes</span>
            </div>

            {jsonError && (
              <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-xs font-mono">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <textarea
              value={tab.body}
              onChange={(e) => updateTabBody(tab.id, e.target.value)}
              placeholder='{\n  "key": "value"\n}'
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
              className="flex-1 w-full bg-[#1e1f22] border border-border-subtle rounded p-2.5 font-mono text-xs text-[#dfdfdf] resize-none outline-none focus:border-accent-cyan transition-colors leading-relaxed selection:bg-accent-cyan/30"
              spellCheck={false}
            />
          </div>
        )}

        {/* 5. AUTH INJECTOR MODE */}
        {tab.requestViewMode === 'auth' && (
          <div className="flex flex-col h-full max-w-lg space-y-4">
            <span className="text-xs font-semibold text-text-muted">Authentication Injector</span>

            <div className="flex items-center gap-4 text-xs select-none">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="authType"
                  checked={authType === 'bearer'}
                  onChange={() => setAuthType('bearer')}
                  className="text-accent-cyan"
                />
                <span>Bearer Token</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="authType"
                  checked={authType === 'basic'}
                  onChange={() => setAuthType('basic')}
                  className="text-accent-cyan"
                />
                <span>Basic Auth</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="authType"
                  checked={authType === 'apikey'}
                  onChange={() => setAuthType('apikey')}
                  className="text-accent-cyan"
                />
                <span>API Key Header</span>
              </label>
            </div>

            {authType === 'bearer' && (
              <div className="space-y-2">
                <label className="text-xs text-text-muted">Bearer Token (Supports variables like {'{{token}}'})</label>
                <Input
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="font-mono text-xs"
                />
              </div>
            )}

            {authType === 'basic' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">Username</label>
                  <Input value={basicUser} onChange={(e) => setBasicUser(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">Password</label>
                  <Input value={basicPass} onChange={(e) => setBasicPass(e.target.value)} type="password" className="font-mono text-xs" />
                </div>
              </div>
            )}

            {authType === 'apikey' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">Header Name</label>
                  <Input value={apiKeyHeader} onChange={(e) => setApiKeyHeader(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">Key Value</label>
                  <Input value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
            )}

            <Button variant="primary" size="sm" onClick={handleApplyAuth} leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              Inject into Request Headers
            </Button>
          </div>
        )}
      </div>

      {/* Burp Suite Exact Bottom Search Bar */}
      <BurpSearchBar
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setActiveMatchIndex(0);
        }}
        activeMatchIndex={activeMatchIndex}
        totalMatches={totalMatches}
        onPrevMatch={handlePrevMatch}
        onNextMatch={handleNextMatch}
      />

      {/* Dynamic Variable Chips Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-panel-elevated border-t border-border-subtle text-[11px] font-mono select-none flex-shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-text-muted flex items-center gap-1">
            <Sliders className="w-3 h-3 text-accent-cyan" />
            <span>Vars:</span>
          </span>

          {usedVars.map((v) => {
            const evaluated = interpolateRequest(tab.id, `{{${v}}}`);
            const isBuiltin = v.startsWith('$');
            return (
              <span
                key={v}
                onClick={toggleVariablesModal}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-canvas border border-border-subtle hover:border-accent-cyan text-text-secondary hover:text-accent-cyan cursor-pointer transition-colors"
                title={`Template: {{${v}}}\nEvaluated: ${evaluated}`}
              >
                <span className={isBuiltin ? 'text-accent-amber font-bold' : 'text-accent-cyan'}>
                  {`{{${v}}}`}
                </span>
              </span>
            );
          })}

          {usedVars.length === 0 && <span className="text-text-muted/60">None in request</span>}
        </div>

        <span className="text-text-muted flex-shrink-0">{rawSizeBytes} bytes</span>
      </div>

      {/* Burp Suite Right-Click Context Menu */}
      {contextMenu.isOpen && tab && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={buildTrafficContextMenu({
            url: tab.url,
            method: tab.method,
            rawRequest: tab.rawRequest,
            reqHeaders: tab.headers.filter((h) => h.enabled).map((h) => ({ name: h.name, value: h.value })),
            reqBody: tab.body,
            request: {
              method: tab.method,
              url: tab.url,
              headers: tab.headers.filter((h) => h.enabled).map((h) => ({ name: h.name, value: h.value })),
              bodyText: tab.body,
            },
            response: tab.history[tab.activeRevisionIndex]
              ? {
                  statusCode: tab.history[tab.activeRevisionIndex].statusCode,
                  statusText: tab.history[tab.activeRevisionIndex].statusText,
                  headers: tab.history[tab.activeRevisionIndex].responseHeaders,
                  bodyText: tab.history[tab.activeRevisionIndex].responseBody,
                }
              : undefined,
            resBody: tab.history[tab.activeRevisionIndex]?.responseBody,
            resHeaders: tab.history[tab.activeRevisionIndex]?.responseHeaders,
            status: tab.history[tab.activeRevisionIndex]?.statusCode,
          })}
        />
      )}
    </div>
  );
};
