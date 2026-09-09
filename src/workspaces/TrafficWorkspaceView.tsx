import React, { useCallback, useState } from 'react';
import { useTrafficStore } from '../stores/trafficStore';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { useInterceptStore } from '../stores/interceptStore';
import {
  TrafficQuickFilters,
  VirtualTrafficTable,
  TransactionInspectorPanel,
  TransactionDiffModal,
  HttpHistoryFilterModal,
  HttpHistoryFilterConfig,
  DEFAULT_FILTER_CONFIG,
  ProxyInterceptView,
  WebSocketHistoryView,
  MatchReplaceView,
} from '../components/traffic';
import { SplitPane } from '../design-system/SplitPane';
import {
  Search,
  Play,
  Pause,
  ArrowDownCircle,
  GitCompare,
  Trash2,
  CornerDownLeft,
  Settings,
  X,
} from 'lucide-react';

import { TrafficSummary } from '../types/traffic';

export function generateBenchmarkTraffic(count = 200): TrafficSummary[] {
  const googleItems: Array<{
    seq: number;
    host: string;
    method: string;
    path: string;
    status: number;
    sizeBytes: number;
    mimeType: string;
  }> = [
    { seq: 1, host: 'https://www.google.com', method: 'GET', path: '/search?q=hi&oq=hi&gs_lcrp=EgZ...', status: 200, sizeBytes: 94130, mimeType: 'HTML' },
    { seq: 2, host: 'https://www.google.com', method: 'GET', path: '/search?q=hi&oq=hi&gs_lcrp=EgZ...', status: 302, sizeBytes: 2232, mimeType: 'HTML' },
    { seq: 3, host: 'https://www.google.com', method: 'GET', path: '/sorry/index?continue=https://ww...', status: 429, sizeBytes: 4024, mimeType: 'HTML' },
    { seq: 6, host: 'https://www.google.com', method: 'GET', path: '/recaptcha/enterprise/anchor?ar=1...', status: 200, sizeBytes: 56453, mimeType: 'HTML' },
    { seq: 12, host: 'https://www.google.com', method: 'GET', path: '/recaptcha/enterprise/bframe?hl=e...', status: 200, sizeBytes: 18109, mimeType: 'HTML' },
    { seq: 14, host: 'http://clients2.google.com', method: 'GET', path: '/time/1/current?cup2key=10:qTfgG...', status: 200, sizeBytes: 1090, mimeType: 'JSON' },
    { seq: 15, host: 'https://www.gstatic.com', method: 'GET', path: '/oghttp_gateway/hpke_public_keys/s...', status: 200, sizeBytes: 799, mimeType: 'app' },
    { seq: 16, host: 'https://www.google.com', method: 'GET', path: '/async/folae?async=_fmt:pb&udm=50&client_locale=en-US&client_country=us', status: 200, sizeBytes: 1379, mimeType: 'app' },
    { seq: 17, host: 'https://clients2.google.com', method: 'GET', path: '/service/update2/crx?os=win&arch...', status: 200, sizeBytes: 2526, mimeType: 'XML' },
    { seq: 18, host: 'https://clientservices.googleapis.com', method: 'GET', path: '/chrome-variations/seed?osname=...', status: 200, sizeBytes: 51537, mimeType: 'app' },
    { seq: 19, host: 'https://accounts.google.com', method: 'POST', path: '/ListAccounts?origin=1&source=Ch...', status: 200, sizeBytes: 1026, mimeType: 'app' },
  ];

  const results: TrafficSummary[] = [];
  const baseTime = Date.now();

  googleItems.forEach((g) => {
    results.push({
      id: `tx-${g.seq.toString().padStart(6, '0')}`,
      seqNumber: g.seq,
      timestamp: new Date(baseTime - (count - g.seq) * 1000).toLocaleTimeString(),
      timestampMs: baseTime - (count - g.seq) * 1000,
      method: g.method,
      url: `${g.host}${g.path}`,
      host: g.host,
      path: g.path,
      status: g.status,
      durationMs: 42,
      sizeBytes: g.sizeBytes,
      inScope: true,
      mimeType: g.mimeType,
      tags: ['scope:target'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      reqBlobId: `blob-req-${g.seq}`,
      resBlobId: `blob-res-${g.seq}`,
    });
  });

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const paths = [
    '/api/v1/auth/login',
    '/api/v1/users/profile',
    '/api/v1/orders/checkout',
    '/graphql?query=getCart',
    '/oauth/v2/token',
    '/static/assets/app.js',
    '/api/v2/admin/roles',
    '/api/v1/invoices/export',
    '/healthz',
    '/metrics',
    '/ws/notifications',
    '/ws/chat',
    '/ws/telemetry',
  ];
  const statuses = [200, 201, 204, 302, 400, 401, 403, 404, 500];

  for (let i = 20; i <= count; i++) {
    const method = methods[i % methods.length];
    const path = paths[i % paths.length];
    const status = statuses[i % statuses.length];
    const durationMs = 15 + ((i * 31) % 450);
    const sizeBytes = 256 + ((i * 128) % 32768);
    const inScope = i % 8 !== 0;
    const isWs = path.startsWith('/ws');

    results.push({
      id: `tx-${i.toString().padStart(6, '0')}`,
      seqNumber: i,
      timestamp: new Date(baseTime - (count - i) * 1000).toLocaleTimeString(),
      timestampMs: baseTime - (count - i) * 1000,
      method: isWs ? 'GET' : method,
      url: `${isWs ? 'wss' : 'https'}://target.local${path}`,
      host: 'https://target.local',
      path,
      status: isWs ? 101 : status,
      durationMs,
      sizeBytes,
      inScope,
      mimeType: isWs ? 'websocket' : path.includes('graphql') || path.includes('api') ? 'application/json' : 'text/html',
      tags: inScope ? ['scope:target'] : ['scope:out-of-scope'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      reqBlobId: `blob-req-${i}`,
      resBlobId: `blob-res-${i}`,
    });
  }

  return results;
}

export const TrafficWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();

  const {
    transactions,
    filteredIndices,
    isPaused,
    autoScroll,
    httpqlQuery,
    filterScopeOnly,
    filterMethods,
    filterStatuses,
    filterMimes,
    activePreset,
    selectedId,
    selectedIds,
    diffModal,
    setHttpqlQuery,
    setScopeOnly,
    toggleMethodFilter,
    toggleStatusFilter,
    toggleMimeFilter,
    setQuickPreset,
    resetFilters,
    setSelectedId,
    setAutoScroll,
    toggleStreaming,
    clearTraffic,
    openDiffModal,
    closeDiffModal,
  } = useTrafficStore();

  const { createTabFromTransaction } = useRepeaterStore();

  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [filterConfig, setFilterConfig] = React.useState<HttpHistoryFilterConfig>(DEFAULT_FILTER_CONFIG);

  const filterSummaryText = React.useMemo(() => {
    if (httpqlQuery) return `Filter query: ${httpqlQuery}`;
    const parts: string[] = [];
    if (filterConfig.showOnlyInScope) parts.push('Show only in-scope');
    if (filterConfig.showOnlyParameterized) parts.push('Parameterized only');

    const hiddenMimes: string[] = [];
    if (!filterConfig.mimeCss) hiddenMimes.push('CSS');
    if (!filterConfig.mimeImages) hiddenMimes.push('image');
    if (hiddenMimes.length > 0) parts.push(`Hiding ${hiddenMimes.join(' and ')} content`);

    if (filterConfig.filterHideExt) parts.push('hiding specific extensions');
    if (filterConfig.filterShowOnlyExt) parts.push(`showing only ${filterConfig.showOnlyExtList}`);
    if (filterConfig.searchTerm) parts.push(`matching "${filterConfig.searchTerm}"`);

    return parts.length > 0
      ? `Filter settings: ${parts.join('; ')}`
      : 'Filter settings: Showing all traffic';
  }, [httpqlQuery, filterConfig]);

  const visibleTransactions = React.useMemo(() => {
    let list = transactions;

    if (filteredIndices) {
      list = filteredIndices.map((idx) => transactions[idx]).filter(Boolean);
    }

    return list.filter((tx) => {
      // 1. Request type
      if (filterConfig.showOnlyInScope && !tx.inScope) return false;
      if (filterConfig.showOnlyParameterized && !tx.url.includes('?') && tx.method !== 'POST') return false;

      // 2. Status code
      const s = tx.status;
      if (s >= 200 && s < 300 && !filterConfig.status2xx) return false;
      if (s >= 300 && s < 400 && !filterConfig.status3xx) return false;
      if (s >= 400 && s < 500 && !filterConfig.status4xx) return false;
      if (s >= 500 && !filterConfig.status5xx) return false;

      // 3. MIME types
      const mime = (tx.mimeType || '').toLowerCase();
      if (!filterConfig.mimeHtml && mime.includes('html')) return false;
      if (!filterConfig.mimeCss && mime.includes('css')) return false;
      if (!filterConfig.mimeScript && (mime.includes('javascript') || mime.includes('script'))) return false;
      if (!filterConfig.mimeXml && mime.includes('xml')) return false;
      if (!filterConfig.mimeImages && (mime.includes('image') || mime.includes('png') || mime.includes('jpg') || mime.includes('gif') || mime.includes('ico'))) return false;

      // 4. File extension
      const urlPath = tx.url.split('?')[0];
      const ext = (urlPath.split('.').pop() || '').toLowerCase();
      if (filterConfig.filterHideExt && filterConfig.hideExtList) {
        const hiddenExts = filterConfig.hideExtList.split(',').map((e) => e.trim().toLowerCase());
        if (hiddenExts.includes(ext)) return false;
      }
      if (filterConfig.filterShowOnlyExt && filterConfig.showOnlyExtList) {
        const allowedExts = filterConfig.showOnlyExtList.split(',').map((e) => e.trim().toLowerCase());
        if (!allowedExts.includes(ext)) return false;
      }

      // 5. Search term
      if (filterConfig.searchTerm) {
        const target = `${tx.method} ${tx.url} ${tx.host} ${tx.status}`;
        let matched = false;
        if (filterConfig.searchRegex) {
          try {
            const re = new RegExp(filterConfig.searchTerm, filterConfig.searchCaseSensitive ? '' : 'i');
            matched = re.test(target);
          } catch {
            matched = target.toLowerCase().includes(filterConfig.searchTerm.toLowerCase());
          }
        } else {
          matched = filterConfig.searchCaseSensitive
            ? target.includes(filterConfig.searchTerm)
            : target.toLowerCase().includes(filterConfig.searchTerm.toLowerCase());
        }
        if (filterConfig.searchNegative ? matched : !matched) return false;
      }

      return true;
    });
  }, [transactions, filteredIndices, filterConfig]);

  const activeTransaction = React.useMemo(() => {
    if (!selectedId) return visibleTransactions[0] || null;
    return transactions.find((t) => t.id === selectedId) || visibleTransactions[0] || null;
  }, [transactions, visibleTransactions, selectedId]);

  const handleSelectTx = useCallback(
    (tx: TrafficSummary) => {
      setSelectedId(tx.id);
    },
    [setSelectedId]
  );

  const handleSendToRepeater = useCallback(
    (tx: TrafficSummary) => {
      createTabFromTransaction(tx);
      addToast({
        type: 'success',
        title: `Sent ${tx.id} to Repeater`,
      });
    },
    [createTabFromTransaction, addToast]
  );

  const { isInterceptOn, interceptedQueue } = useInterceptStore();
  const [proxySubTab, setProxySubTab] = useState<'history' | 'intercept' | 'websockets' | 'options'>('history');
  const [isProxySettingsOpen, setIsProxySettingsOpen] = useState(false);

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] overflow-hidden">
      {/* 1. Burp Suite Proxy Sub-Tab Bar */}
      <div className="h-7 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center px-2 gap-1 select-none flex-shrink-0 text-xs font-sans">
        <button
          onClick={() => setProxySubTab('intercept')}
          className={`px-3 py-1 font-medium rounded-t transition-colors flex items-center gap-1.5 ${
            proxySubTab === 'intercept'
              ? 'bg-[#1e1f22] text-[#f37021] border-b-2 border-[#f37021] font-semibold'
              : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
          }`}
        >
          <span>Intercept</span>
          {(isInterceptOn || interceptedQueue.length > 0) && (
            <span className="w-2 h-2 rounded-full bg-[#f37021] animate-pulse" title="Intercept active" />
          )}
        </button>
        <button
          onClick={() => setProxySubTab('history')}
          className={`px-3 py-1 font-medium rounded-t transition-colors ${
            proxySubTab === 'history'
              ? 'bg-[#1e1f22] text-[#f37021] border-b-2 border-[#f37021] font-semibold'
              : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
          }`}
        >
          HTTP history
        </button>
        <button
          onClick={() => setProxySubTab('websockets')}
          className={`px-3 py-1 font-medium rounded-t transition-colors ${
            proxySubTab === 'websockets'
              ? 'bg-[#1e1f22] text-[#f37021] border-b-2 border-[#f37021] font-semibold'
              : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
          }`}
        >
          WebSockets history
        </button>
        <button
          onClick={() => setProxySubTab('options')}
          className={`px-3 py-1 font-medium rounded-t transition-colors ${
            proxySubTab === 'options'
              ? 'bg-[#1e1f22] text-[#f37021] border-b-2 border-[#f37021] font-semibold'
              : 'text-[#9da5b4] hover:text-white hover:bg-[#35383f]'
          }`}
        >
          Match and replace
        </button>
        <button
          onClick={() => setIsProxySettingsOpen(true)}
          className="px-3 py-1 font-medium rounded-t transition-colors ml-auto text-[#9da5b4] hover:text-white flex items-center gap-1"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Proxy settings</span>
        </button>
      </div>

      {/* 2. Subtab Content Views */}
      {proxySubTab === 'intercept' ? (
        <ProxyInterceptView />
      ) : proxySubTab === 'websockets' ? (
        <WebSocketHistoryView />
      ) : proxySubTab === 'options' ? (
        <MatchReplaceView />
      ) : (
        <>
          {/* HTTP History Filter Bar */}
          <div className="h-9 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-2 gap-2 select-none flex-shrink-0 text-xs font-sans">
            {/* Filter Summary Pill */}
            <div
              onClick={() => setIsFilterModalOpen(true)}
              className="flex-1 flex items-center bg-[#1e1f22] border border-[#3e4249] rounded px-2.5 py-1 text-[#c4c7c5] hover:border-[#f37021] cursor-pointer transition-colors group"
            >
              <span className="text-[#f37021] font-bold mr-2 text-[12px]">Y</span>
              <span className="truncate text-[11px]">
                {filterSummaryText}
              </span>
              <Search className="w-3 h-3 text-[#6f737a] ml-auto flex-shrink-0 group-hover:text-white" />
            </div>

            {/* Quick Search Field */}
            <div className="w-80 relative flex items-center">
              <input
                type="text"
                value={httpqlQuery}
                onChange={(e) => setHttpqlQuery(e.target.value)}
                placeholder="Filter traffic with HTTPQL / Pro query..."
                className="w-full bg-[#1e1f22] border border-[#3e4249] rounded px-2 py-0.5 text-[11px] text-[#dfdfdf] placeholder-[#6f737a] focus:border-[#f37021] focus:outline-none pr-12"
              />
              <button
                onClick={() => setHttpqlQuery(httpqlQuery)}
                title="Execute Query (Enter)"
                className="absolute right-6 text-[#9da5b4] hover:text-[#f37021] p-0.5"
              >
                <CornerDownLeft className="w-3 h-3" />
              </button>
              <Search className="w-3.5 h-3.5 text-[#6f737a] absolute right-2 pointer-events-none" />
            </div>

            {/* Toolbar Buttons */}
            <div className="flex items-center gap-1 text-[11px] text-[#c4c7c5]">
              <div
                onClick={() => setScopeOnly(!filterScopeOnly)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer select-none border border-[#3e4249] text-[#c4c7c5]"
              >
                <div
                  className={`w-6 h-3 flex items-center rounded-full p-0.5 transition-colors ${
                    filterScopeOnly ? 'bg-[#38bdf8]' : 'bg-[#3e4249]'
                  }`}
                >
                  <div
                    className={`bg-white w-2 h-2 rounded-full shadow-md transform transition-transform ${
                      filterScopeOnly ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span>Filter on</span>
              </div>

              <button
                onClick={toggleStreaming}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                  isPaused
                    ? 'bg-amber-900/30 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-900/30 text-emerald-300 border-emerald-500/40'
                }`}
                title={isPaused ? 'Resume live traffic ingestion' : 'Pause traffic stream'}
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                <span>{isPaused ? 'Paused' : 'Capturing'}</span>
              </button>

              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded border transition-colors ${
                  autoScroll
                    ? 'bg-[#f37021]/20 text-[#f37021] border-[#f37021]/40'
                    : 'bg-[#1e1f22] text-[#6f737a] border-[#3e4249] hover:text-white'
                }`}
                title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => openDiffModal()}
                className="p-1 text-[#9da5b4] hover:text-[#38bdf8] border border-[#3e4249] rounded bg-[#1e1f22]"
                title="Open Transaction Diff Modal (Ctrl+D)"
              >
                <GitCompare className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => clearTraffic()}
                className="p-1 text-[#9da5b4] hover:text-[#ef4444] border border-[#3e4249] rounded bg-[#1e1f22]"
                title="Clear all transaction history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Filter Presets */}
          <div className="hidden">
            <TrafficQuickFilters
              scopeOnly={filterScopeOnly}
              onToggleScopeOnly={setScopeOnly}
              selectedMethods={filterMethods}
              onToggleMethod={toggleMethodFilter}
              selectedStatuses={filterStatuses}
              onToggleStatus={toggleStatusFilter}
              selectedMimes={filterMimes}
              onToggleMime={toggleMimeFilter}
              activePreset={activePreset}
              onSelectPreset={setQuickPreset}
              totalCount={transactions.length}
              filteredCount={visibleTransactions.length}
              onResetAll={resetFilters}
            />
          </div>

          {/* Main Split Layout: 13-Column Table (Top) & Request-Response-Inspector (Bottom) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <SplitPane
              direction="vertical"
              initialSize={280}
              minSize={120}
              maxSize={700}
              storageKey="burp_proxy_traffic_split"
              primary={
                <VirtualTrafficTable
                  transactions={visibleTransactions}
                  selectedTxId={activeTransaction?.id || null}
                  selectedTxIds={selectedIds}
                  onSelectTx={handleSelectTx}
                  onOpenDiff={(txA, txB) => openDiffModal(txA, txB)}
                />
              }
              secondary={
                <TransactionInspectorPanel
                  transaction={activeTransaction}
                  onSendToRepeater={handleSendToRepeater as any}
                  onOpenDiff={(tx) => openDiffModal(tx as any)}
                />
              }
            />
          </div>
        </>
      )}

      {/* Transaction Diff Modal */}
      {diffModal.isOpen && (
        <TransactionDiffModal
          isOpen={diffModal.isOpen}
          onClose={closeDiffModal}
          transactionA={diffModal.txA}
          transactionB={diffModal.txB}
          allTransactions={transactions}
        />
      )}

      {/* Burp Suite Exact HTTP History Filter Modal */}
      <HttpHistoryFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        config={filterConfig}
        onApply={(newCfg) => setFilterConfig(newCfg)}
      />

      {/* Proxy Settings Modal */}
      {isProxySettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f22] border border-[#3e4249] rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#313438] pb-2">
              <span className="font-bold text-white text-sm">Proxy Settings & Listeners</span>
              <button onClick={() => setIsProxySettingsOpen(false)} className="text-[#9da5b4] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#9da5b4] font-medium block mb-1">Proxy Listeners</label>
                <div className="bg-[#141517] p-2.5 rounded border border-[#313438] space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-white">127.0.0.1:8085 (HTTP/S)</span>
                    <span className="text-[#34d399] font-bold">RUNNING</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white">127.0.0.1:8080 (WS)</span>
                    <span className="text-[#34d399] font-bold">RUNNING</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9da5b4] font-medium block mb-1">CA Certificate</label>
                <div className="bg-[#141517] p-2.5 rounded border border-[#313438] flex items-center justify-between">
                  <span className="text-[#c4c7c5]">PortSwigger / Sentinel CA</span>
                  <span className="text-[#38bdf8] font-bold">INSTALLED</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9da5b4] font-medium block mb-1">Intercept Client Requests</label>
                <div className="text-[#8c9099] leading-relaxed">
                  Automatically pause client requests for inspection and tamper before forwarding upstream.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#313438]">
              <button
                onClick={() => setIsProxySettingsOpen(false)}
                className="px-4 py-1.5 rounded bg-[#f37021] hover:bg-[#e05d06] text-white font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
