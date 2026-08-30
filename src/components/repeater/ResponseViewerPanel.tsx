import React, { useState, useMemo } from 'react';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { StatusBadge, Badge } from '../../design-system/Badge';
import { Tabs, TabItem } from '../../design-system/Tabs';
import { RawByteInspector } from '../../design-system/RawByteInspector';
import { StructuredInspector } from '../../design-system/StructuredInspector';
import { DiffViewer } from '../../design-system/DiffViewer';
import { Button } from '../../design-system/Button';
import { ResponseViewerMode } from '../../types/repeater';
import { useToastStore } from '../../stores/toastStore';
import {
  Clock,
  ShieldCheck,
  Lock,
  Search,
  Copy,
  AlertTriangle,
  FileCode,
  Layers,
  Binary,
  Globe,
  GitCompare,
  Pin,
  Eye,
} from 'lucide-react';
import { ContextMenu } from '../../design-system/ContextMenu';
import { buildTrafficContextMenu } from '../../utils/contextMenuUtils';
import { generateRenderablePreviewHtml } from '../../utils/repeaterUtils';
import { HttpSyntaxHighlighter } from '../common/HttpSyntaxHighlighter';
import { BurpSearchBar, countSearchMatches } from '../common/BurpSearchBar';

export const ResponseViewerPanel: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setResponseViewMode,
    setBaselineRevision,
    openDiffModal,
  } = useRepeaterStore();

  const { addToast } = useToastStore();
  const [headerFilter, setHeaderFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
  });

  const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeRev = tab ? (tab.history[tab.activeRevisionIndex] || tab.lastExecutionOutput) : null;
  const isBaseline = tab && tab.baselineRevisionIndex === tab.activeRevisionIndex && tab.baselineRevisionIndex !== null;

  // Normal Response Presentation derivations (calculated unconditionally)
  const statusCode = activeRev?.statusCode || 200;
  const statusText = activeRev?.statusText || 'OK';
  const responseBody = activeRev?.responseBody || '';
  const rawResponse = activeRev ? (activeRev.responseRaw || `HTTP/1.1 ${statusCode} ${statusText}\r\n\r\n${responseBody}`) : '';
  const headers = activeRev?.responseHeaders || [];
  const filteredHeaders = headers.filter(
    (h) => h.name.toLowerCase().includes(headerFilter.toLowerCase()) || h.value.toLowerCase().includes(headerFilter.toLowerCase())
  );

  const totalMatches = useMemo(() => countSearchMatches(rawResponse, searchQuery), [rawResponse, searchQuery]);

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev > 0 ? prev - 1 : totalMatches - 1));
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev < totalMatches - 1 ? prev + 1 : 0));
  };

  const handleCopy = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: 'success', title: `Copied ${title} to clipboard` });
  };

  // View sub-tabs definition (Exact Burp Suite Pro order: Pretty, Raw, Hex, Render, Headers, TLS & Timing, Diff)
  const responseTabs: TabItem[] = [
    { id: 'pretty', label: 'Pretty', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'raw', label: 'Raw', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'hex', label: 'Hex', icon: <Binary className="w-3.5 h-3.5" /> },
    { id: 'preview', label: 'Render', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'parsed', label: 'Headers', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'tls', label: 'TLS & Timing', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'diff', label: 'Diff', icon: <GitCompare className="w-3.5 h-3.5" /> },
  ];

  if (!tab) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">No active tab</div>;
  }

  // If no execution history and no response yet
  if (!activeRev) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg-canvas select-none">
        <div className="w-14 h-14 rounded-2xl bg-bg-panel-elevated border border-border-subtle flex items-center justify-center mb-4 text-text-muted shadow-sm">
          <Globe className="w-7 h-7 text-text-muted/60" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary mb-1 font-mono">No Response Captured</h3>
        <p className="text-xs text-text-muted max-w-sm mb-4">
          Click <span className="text-accent-cyan font-bold">Send</span> or press <kbd className="px-1.5 py-0.5 bg-bg-panel border border-border-subtle rounded font-mono text-[10px]">Ctrl+Enter</kbd> to execute this request.
        </p>
      </div>
    );
  }

  // If execution error (e.g. Scope violation SEC-01 or network error)
  if (activeRev.error && !activeRev.responseRaw && !activeRev.statusCode) {
    const isScopeViolation = activeRev.error.includes('Scope Violation') || activeRev.error.includes('SEC-01');
    return (
      <div className="flex-1 flex flex-col p-6 bg-bg-canvas overflow-auto">
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/80 mb-4 max-w-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs font-mono">
              <h4 className="font-bold text-red-300">
                {isScopeViolation ? 'SEC-01 Scope Enforcement Violation' : 'Execution Failed'}
              </h4>
              <p className="text-red-200/90 leading-relaxed">{activeRev.error}</p>
              {isScopeViolation && (
                <p className="text-text-muted text-[11px] mt-2">
                  The Sentinel scope safety gate blocked socket dispatch to this target to prevent unauthorized traffic generation.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-text-muted space-y-1">
          <div>Target: <span className="text-text-primary">{activeRev.url}</span></div>
          <div>Method: <span className="text-text-primary">{activeRev.method}</span></div>
          <div>Elapsed: <span className="text-text-primary">{activeRev.durationMs}ms</span></div>
        </div>
      </div>
    );
  }

  // Baseline comparison data
  const baselineRev =
    tab.baselineRevisionIndex !== null && tab.history[tab.baselineRevisionIndex]
      ? tab.history[tab.baselineRevisionIndex]
      : tab.history[0];

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, isOpen: true });
      }}
      className="flex flex-col h-full bg-bg-panel overflow-hidden"
    >
      {/* Response Status Header */}
      <div className="flex items-center justify-between p-2 bg-bg-panel-elevated border-b border-border-subtle select-none flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={statusCode} label={`${statusCode} ${statusText}`} />

          {/* Duration Badge */}
          <div className="flex items-center gap-1 text-xs font-mono text-text-secondary px-2 py-0.5 bg-bg-canvas rounded border border-border-subtle" title="Roundtrip Duration">
            <Clock className="w-3 h-3 text-accent-cyan" />
            <span>{activeRev.durationMs}ms</span>
          </div>

          {/* Size Badge */}
          <div className="text-xs font-mono text-text-muted px-2 py-0.5 bg-bg-canvas rounded border border-border-subtle" title="Response Body Size">
            <span>{activeRev.sizeBytes || responseBody.length} B</span>
          </div>

          {/* TLS Badge */}
          {activeRev.tlsInfo && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-emerald-400 px-2 py-0.5 bg-emerald-950/40 rounded border border-emerald-800/60" title={`TLS Connection: ${activeRev.tlsInfo.version} (${activeRev.tlsInfo.cipherSuite})`}>
              <Lock className="w-3 h-3" />
              <span>{activeRev.tlsInfo.version}</span>
            </div>
          )}

          {/* CAS Evidence Badge */}
          {activeRev.casEvidence && (
            <div
              onClick={() => handleCopy(activeRev.casEvidence?.sha256Hex || '', 'CAS SHA-256')}
              className="hidden md:flex items-center gap-1 text-[11px] font-mono text-accent-cyan px-2 py-0.5 bg-accent-cyan/10 rounded border border-accent-cyan/30 cursor-pointer hover:bg-accent-cyan/20 transition-colors"
              title={`SEC-07 CAS Proof Verified: ${activeRev.casEvidence.sha256Hex}\nClick to copy hash`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>CAS: {activeRev.casEvidence.sha256Hex.substring(0, 8)}...</span>
            </div>
          )}

          {/* Baseline Pin Indicator */}
          {isBaseline && (
            <Badge variant="warning" size="xs">
              Baseline Pin
            </Badge>
          )}
        </div>

        {/* Right-side quick tools */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant={isBaseline ? 'secondary' : 'ghost'}
            size="xs"
            leftIcon={<Pin className="w-3 h-3" />}
            onClick={() => setBaselineRevision(tab.id, isBaseline ? null : tab.activeRevisionIndex)}
            title={isBaseline ? 'Unpin Baseline' : 'Pin as Baseline Diff Target'}
          >
            {isBaseline ? 'Pinned' : 'Pin'}
          </Button>

          <Button
            variant="ghost"
            size="xs"
            leftIcon={<Copy className="w-3 h-3" />}
            onClick={() => handleCopy(responseBody, 'Response Body')}
            title="Copy Response Body"
          >
            Copy
          </Button>
        </div>
      </div>

      {/* Sub-View Mode Selector Tabs */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-canvas/40 px-2 flex-shrink-0">
        <Tabs
          tabs={responseTabs}
          activeTab={tab.responseViewMode}
          onChange={(mode) => setResponseViewMode(tab.id, mode as ResponseViewerMode)}
        />
      </div>

      {/* Sub-View Content Body */}
      <div className="flex-1 overflow-auto bg-bg-canvas p-2">
        {/* 1. PARSED HEADERS VIEW */}
        {tab.responseViewMode === 'parsed' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2 top-2.5" />
                <input
                  type="text"
                  value={headerFilter}
                  onChange={(e) => setHeaderFilter(e.target.value)}
                  placeholder="Filter headers..."
                  className="w-full bg-bg-panel border border-border-subtle rounded text-xs font-mono pl-7 pr-2 py-1 outline-none focus:border-accent-cyan"
                />
              </div>
              <span className="text-[11px] font-mono text-text-muted">{filteredHeaders.length} headers</span>
            </div>

            <div className="flex-1 overflow-auto border border-border-subtle rounded bg-bg-panel">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-panel-elevated text-text-muted">
                    <th className="py-1.5 px-3 w-1/3">Header</th>
                    <th className="py-1.5 px-3">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHeaders.map((header, idx) => (
                    <tr key={idx} className="border-b border-border-subtle/50 hover:bg-bg-canvas/30 group">
                      <td className="py-1.5 px-3 font-semibold text-text-secondary select-all">{header.name}</td>
                      <td className="py-1.5 px-3 text-text-primary select-all break-all">{header.value}</td>
                    </tr>
                  ))}
                  {filteredHeaders.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-text-muted text-xs">
                        No headers matching "{headerFilter}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 1. PRETTY VIEW */}
        {tab.responseViewMode === 'pretty' && (
          <div className="flex flex-col h-full bg-[#1e1f22] border border-border-subtle rounded p-2.5 overflow-auto select-text">
            <HttpSyntaxHighlighter
              content={rawResponse}
              isResponse={true}
              autoFormatJson={true}
              searchQuery={searchQuery}
              activeMatchIndex={activeMatchIndex}
            />
          </div>
        )}

        {/* 2. RAW HTTP VIEW */}
        {tab.responseViewMode === 'raw' && (
          <div className="flex flex-col h-full bg-[#1e1f22] border border-border-subtle rounded p-2.5 overflow-auto select-text">
            <HttpSyntaxHighlighter
              content={rawResponse}
              isResponse={true}
              autoFormatJson={false}
              searchQuery={searchQuery}
              activeMatchIndex={activeMatchIndex}
            />
          </div>
        )}

        {/* 3. HEX DUMP VIEW */}
        {tab.responseViewMode === 'hex' && (
          <div className="h-full border border-border-subtle rounded bg-bg-panel overflow-hidden">
            <RawByteInspector
              data={responseBody || rawResponse}
            />
          </div>
        )}

        {/* 4. JSON TREE VIEW */}
        {tab.responseViewMode === 'tree' && (
          <div className="h-full border border-border-subtle rounded bg-bg-panel overflow-auto p-2">
            <StructuredInspector data={responseBody} />
          </div>
        )}

        {/* 5. AUTHENTIC REAL HTML WEBSITE / JSON PREVIEW */}
        {tab.responseViewMode === 'preview' && (
          <div className="flex flex-col h-full space-y-2">
            <div className="flex items-center justify-between px-2 py-1.5 bg-bg-panel-elevated border border-border-subtle rounded text-[11px] font-mono select-none">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-cyan" />
                <span>SEC-11 Sandboxed Preview: Real render with relative assets mapped to <span className="text-accent-cyan font-bold">{activeRev.url || tab.url}</span></span>
              </span>

              <button
                onClick={() => {
                  const blob = new Blob([generateRenderablePreviewHtml(responseBody || rawResponse, undefined, activeRev.url || tab.url)], { type: 'text/html' });
                  const blobUrl = URL.createObjectURL(blob);
                  window.open(blobUrl, '_blank');
                }}
                className="px-2 py-0.5 rounded bg-bg-canvas border border-border-subtle hover:border-accent-cyan text-text-muted hover:text-accent-cyan transition-colors"
                title="Open real rendered website preview in new browser window"
              >
                Open in Full Window ↗
              </button>
            </div>
            <div className="flex-1 border border-border-subtle rounded bg-white overflow-hidden relative">
              <iframe
                title="Response HTML Preview"
                srcDoc={generateRenderablePreviewHtml(responseBody || rawResponse, undefined, activeRev.url || tab.url)}
                sandbox="allow-same-origin"
                className="w-full h-full border-0 bg-white"
              />
            </div>
          </div>
        )}


        {/* 6. TLS & TIMING WATERFALL */}
        {tab.responseViewMode === 'tls' && (
          <div className="flex flex-col h-full space-y-4 max-w-2xl">
            {/* Timing Breakdown Card */}
            <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg space-y-2 text-xs font-mono">
              <h4 className="font-semibold text-text-primary flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Roundtrip Timing Waterfall</span>
              </h4>

              <div className="space-y-1.5 pt-1">
                {activeRev.timingBreakdown?.dnsMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">DNS Lookup:</span>
                    <span className="text-text-primary">{activeRev.timingBreakdown.dnsMs} ms</span>
                  </div>
                )}
                {activeRev.timingBreakdown?.tcpConnectMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">TCP Handshake:</span>
                    <span className="text-text-primary">{activeRev.timingBreakdown.tcpConnectMs} ms</span>
                  </div>
                )}
                {activeRev.timingBreakdown?.tlsHandshakeMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">TLS Handshake:</span>
                    <span className="text-text-primary">{activeRev.timingBreakdown.tlsHandshakeMs} ms</span>
                  </div>
                )}
                {activeRev.timingBreakdown?.ttfbMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Time-To-First-Byte (TTFB):</span>
                    <span className="text-text-primary">{activeRev.timingBreakdown.ttfbMs} ms</span>
                  </div>
                )}
                {activeRev.timingBreakdown?.contentDownloadMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Content Download:</span>
                    <span className="text-text-primary">{activeRev.timingBreakdown.contentDownloadMs} ms</span>
                  </div>
                )}
                <div className="h-px bg-border-subtle my-1" />
                <div className="flex items-center justify-between font-bold">
                  <span className="text-text-primary">Total Elapsed Time:</span>
                  <span className="text-accent-cyan">{activeRev.durationMs} ms</span>
                </div>
              </div>
            </div>

            {/* TLS Certificate Audit Details */}
            {activeRev.tlsInfo && (
              <div className="p-3 bg-bg-panel border border-border-subtle rounded-lg space-y-2 text-xs font-mono">
                <h4 className="font-semibold text-text-primary flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>TLS Connection & Certificate</span>
                </h4>

                <div className="space-y-1.5 pt-1 text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Protocol:</span>
                    <span className="text-text-primary">{activeRev.tlsInfo.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Cipher Suite:</span>
                    <span className="text-text-primary">{activeRev.tlsInfo.cipherSuite}</span>
                  </div>
                  {activeRev.tlsInfo.serverName && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Server Name (SNI):</span>
                      <span className="text-text-primary">{activeRev.tlsInfo.serverName}</span>
                    </div>
                  )}
                  {activeRev.tlsInfo.issuer && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Issuer:</span>
                      <span className="text-text-primary">{activeRev.tlsInfo.issuer}</span>
                    </div>
                  )}
                  {activeRev.tlsInfo.fingerprintSha256 && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">SHA-256 Fingerprint:</span>
                      <span className="text-text-primary truncate max-w-xs">{activeRev.tlsInfo.fingerprintSha256}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. DIFF VIEW */}
        {tab.responseViewMode === 'diff' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-text-muted">
                Comparing Current (Rev #{activeRev.revisionNumber}) vs Baseline (Rev #{baselineRev?.revisionNumber || 1})
              </span>
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<GitCompare className="w-3 h-3" />}
                onClick={() => openDiffModal(baselineRev, activeRev)}
              >
                Open Fullscreen Diff Modal
              </Button>
            </div>

            <div className="flex-1 border border-border-subtle rounded bg-bg-panel overflow-hidden">
              <DiffViewer
                originalText={baselineRev?.responseBody || ''}
                modifiedText={responseBody}
                originalTitle={`Baseline (Rev #${baselineRev?.revisionNumber || 1})`}
                modifiedTitle={`Current (Rev #${activeRev.revisionNumber})`}
              />
            </div>
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
            response: activeRev
              ? {
                  statusCode: activeRev.statusCode,
                  statusText: activeRev.statusText,
                  headers: activeRev.responseHeaders,
                  bodyText: activeRev.responseBody,
                }
              : undefined,
          })}
        />
      )}
    </div>
  );
};
