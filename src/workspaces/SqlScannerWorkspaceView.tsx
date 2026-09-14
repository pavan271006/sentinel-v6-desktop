import React, { useState, useEffect } from 'react';
import { useSqlScannerStore, extractRedirectLocation } from '../stores/sqlScannerStore';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { RequestParser } from '../services/sqlScanner/RequestParser';
import { MetadataExtractor } from '../services/sqlScanner/MetadataExtractor';
import { OrmRemediationEngine } from '../services/sqlScanner/engine/OrmRemediationEngine';
import { BountyTemplateExporter } from '../services/sqlScanner/engine/BountyTemplateExporter';
import { SarifExporter } from '../services/sqlScanner/SarifExporter';
import { HttpMethod, HttpProtocol } from '../types/repeater';
import { DiscoveredTable, ColumnMetadata } from '../types/sqlScanner';
import { ContextMenu, ContextMenuItem } from '../design-system/ContextMenu';
import { ProxyTargetSiteMap } from '../components/sqlScanner/ProxyTargetSiteMap';
import { generateRenderablePreviewHtml } from '../utils/repeaterUtils';
import { ipcClient } from '../ipc/client';
import { useTrafficStore } from '../stores/trafficStore';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Globe,
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  ChevronDown,
  Lock,
  Table as TableIcon,
  Columns,
  Eye,
  Zap,
  RefreshCw,
  Send,
  Copy,
  Search,
  X,
  Cpu,
  Sliders,
  Download,
  Terminal,
  ExternalLink,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { Button } from '../design-system/Button';

export const SqlScannerWorkspaceView: React.FC = () => {
  const {
    tabs,
    activeTabId,
    targetConfig,
    safetyConfig,
    activeTab,
    scanState,
    scanVerdict,
    progress,
    findings,
    dbmsFingerprint,
    catalog,
    selectedCatalogTableId,
    selectedCatalogColumnName,
    executionLogs,
    selectedExecutionLogId,
    report,
    scanProfile,
    setScanProfile,
    concurrencyLimit,
    setConcurrencyLimit,
    createScanTab,
    closeScanTab,
    setActiveScanTab,
    renameScanTab,
    setActiveTab,
    setSelectedCatalogTableId,
    setSelectedCatalogColumnName,
    setSelectedExecutionLogId,
    setRawRequest,
    setScanMode,
    toggleParameter,
    toggleAllParameters,
    setSafetyConfig,
    setGrayBoxConfig,
    startScan,
    pauseScan,
    resumeScan,
    stopScan,
    resetScan,
    clearLogs,
    fetchColumnsForTable,
    fetchSampleRowsForTable,
    lastResponse,
    isProbing,
    probeTargetRequest,
    followRedirect,
    syncSessionFromProxy,
    navigateRenderPreview,
    submitRenderPreviewForm,
  } = useSqlScannerStore();

  const { addToast } = useToastStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGrayBoxConfig, setShowGrayBoxConfig] = useState(false);
  const [showVectorsSection, setShowVectorsSection] = useState(false);
  const [expandedSystemTables, setExpandedSystemTables] = useState(false);
  const [expandedAppTables, setExpandedAppTables] = useState(true);
  const [expandedTableMap, setExpandedTableMap] = useState<Record<string, boolean>>({});
  const [requestViewMode, setRequestViewMode] = useState<'pretty' | 'raw'>('raw');
  const [responseViewMode, setResponseViewMode] = useState<'pretty' | 'raw' | 'headers' | 'render'>('pretty');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');
  const [selectedRemediationFramework, setSelectedRemediationFramework] = useState<string>('all');
  const [showSiteMap, setShowSiteMap] = useState<boolean>(true);

  // Live interactive bridge: intercept links and form submissions from the rendered preview iframe
  useEffect(() => {
    const handleIframeMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'SENTINEL_IFRAME_NAVIGATE') {
        const targetUrl = event.data.url;
        if (targetUrl) {
          addToast({
            type: 'info',
            title: 'Navigating Preview',
            description: `Loading ${targetUrl} via Sentinel...`,
          });
          await navigateRenderPreview(targetUrl);
        }
      } else if (event.data.type === 'SENTINEL_IFRAME_SUBMIT') {
        const { action, method, body } = event.data;
        if (action) {
          addToast({
            type: 'info',
            title: 'Submitting Form',
            description: `${method || 'POST'} ${action} dispatching with captured inputs...`,
          });
          await submitRenderPreviewForm(action, method || 'POST', body || '');
        }
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [navigateRenderPreview, submitRenderPreviewForm, addToast]);

  const selectedTable =
    catalog.applicationTables.find((t) => t.id === selectedCatalogTableId) ||
    catalog.systemTables.find((t) => t.id === selectedCatalogTableId) ||
    catalog.applicationTables[0] ||
    catalog.systemTables[0];

  const selectedColumn = selectedTable?.columns.find(
    (c) => c.name === selectedCatalogColumnName
  ) || selectedTable?.columns[0];

  const selectedExecutionLog =
    executionLogs.find((l) => l.id === selectedExecutionLogId) || executionLogs[0];

  const activeFinding =
    findings.find((f) => f.parameterName === catalog.injectableParamName) ||
    findings[0];

  const copyRowsAsJson = (rows: Record<string, string>[]) => {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    addToast({ type: 'success', title: `Copied ${rows.length} rows as JSON!` });
  };

  const copyRowsAsCsv = (rows: Record<string, string>[]) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map((h) => `"${(r[h] || '').replace(/"/g, '""')}"`).join(','));
    }
    navigator.clipboard.writeText(lines.join('\n'));
    addToast({ type: 'success', title: `Copied ${rows.length} rows as CSV!` });
  };

  const copyCredentials = (rows: Record<string, string>[]) => {
    if (rows.length === 0) return;
    const userCol = Object.keys(rows[0]).find((k) => /user|login|account|name/i.test(k)) || Object.keys(rows[0])[0];
    const passCol = Object.keys(rows[0]).find((k) => /pass|pwd|secret|hash/i.test(k)) || Object.keys(rows[0])[1];
    const lines = rows.map((r) => `${r[userCol] || 'admin'}:${r[passCol] || ''}`);
    navigator.clipboard.writeText(lines.join('\n'));
    addToast({ type: 'success', title: `Copied ${lines.length} credential pairs (user:pass)!` });
  };

  const toggleTableExpand = (tableId: string) => {
    setExpandedTableMap((prev) => ({
      ...prev,
      [tableId]: !prev[tableId],
    }));
  };

  const handleSendToRepeater = (rawRequest?: string, _rawResponse?: string, title?: string) => {
    if (!rawRequest) {
      addToast({
        type: 'warning',
        title: 'Cannot Send to Repeater',
        description: 'No HTTP request wire data available to send.',
      });
      return;
    }

    const parsed = RequestParser.parse(rawRequest, targetConfig.url);
    const targetUrl = parsed.url || targetConfig.url;
    const method = (parsed.method || 'GET') as HttpMethod;
    const protocol = (parsed.protocol || 'HTTP/1.1') as HttpProtocol;
    const headers = parsed.headers.map((h) => ({
      id: `hdr_${Math.random().toString(36).substring(2, 8)}`,
      name: h.name,
      value: h.value,
      enabled: true,
    }));

    useRepeaterStore.getState().createTab({
      title: title || `${method} ${targetUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}`,
      method,
      url: targetUrl,
      protocol,
      headers,
      body: parsed.body || '',
      rawRequest,
      rawMode: false,
      requestViewMode: 'pretty',
      responseViewMode: 'pretty',
    });

    addToast({
      type: 'success',
      title: 'Sent to Repeater',
      description: `Opened "${title || method}" in Repeater workspace.`,
    });
  };

  const [treeSearchQuery, setTreeSearchQuery] = useState('');
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });

  const queryLower = treeSearchQuery.trim().toLowerCase();

  const filteredAppTables = catalog.applicationTables.filter((table) => {
    if (!queryLower) return true;
    if (table.name.toLowerCase().includes(queryLower)) return true;
    return table.columns?.some((c) => c.name.toLowerCase().includes(queryLower));
  });

  const filteredSysTables = catalog.systemTables.filter((table) => {
    if (!queryLower) return true;
    if (table.name.toLowerCase().includes(queryLower)) return true;
    return table.columns?.some((c) => c.name.toLowerCase().includes(queryLower));
  });

  const handleTableContextMenu = (e: React.MouseEvent, table: DiscoveredTable) => {
    e.preventDefault();
    e.stopPropagation();

    const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
    const injectableParam = targetConfig.parameters.find((p) => p.enabled) || parsed.parameters[0];
    if (!injectableParam) return;

    const renderCol = catalog.renderColumn || 1;
    const colCount = catalog.columnCount || 2;
    const dbms = dbmsFingerprint.dbms;
    const isSystem = table.classification === 'system' || table.schema === 'information_schema' || MetadataExtractor.classifyTable(table.name, undefined, dbms) === 'system';

    const colNames = table.columns?.map((c) => c.name) || ['*'];

    // Query 1: Extract all columns concatenated safely into the verified render column
    const sampleQuery = MetadataExtractor.getMultiColumnExtractionQuery(
      injectableParam,
      renderCol,
      colCount,
      table.name,
      colNames.length > 0 ? colNames : ['*'],
      dbms,
      isSystem
    );
    const dataReqData = RequestParser.injectPayload(parsed, injectableParam, sampleQuery, true);

    // Query 2: Extract column definitions from data dictionary
    const schemaQuery = MetadataExtractor.getCleanColumnEnumerationQuery(
      injectableParam,
      renderCol,
      colCount,
      table.name,
      dbms
    );
    const schemaReqData = RequestParser.injectPayload(parsed, injectableParam, schemaQuery, true);

    const items: ContextMenuItem[] = [
      {
        id: 'send_data_repeater',
        label: `Send to Repeater (Extract "${table.name}" Data)`,
        icon: <Send className="w-3.5 h-3.5 text-accent-cyan" />,
        shortcut: 'Ctrl+R',
        onClick: () => handleSendToRepeater(dataReqData.rawRequest, undefined, `SQL Data: ${table.name}`),
      },
      {
        id: 'send_schema_repeater',
        label: `Send Schema Query to Repeater`,
        icon: <Columns className="w-3.5 h-3.5 text-blue-400" />,
        onClick: () => handleSendToRepeater(schemaReqData.rawRequest, undefined, `SQL Schema: ${table.name}`),
      },
      { divider: true },
      {
        id: 'copy_table_name',
        label: 'Copy Table Name',
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => handleCopyToClipboard(table.name, 'Table Name Copied'),
      },
      {
        id: 'fetch_columns',
        label: 'Enumerate Columns',
        icon: <RefreshCw className="w-3.5 h-3.5" />,
        onClick: () => fetchColumnsForTable(table),
      },
      {
        id: 'fetch_rows',
        label: 'Fetch Sample Rows',
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => fetchSampleRowsForTable(table),
      },
    ];

    setContextMenuState({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  const handleColumnContextMenu = (e: React.MouseEvent, table: DiscoveredTable, col: ColumnMetadata) => {
    e.preventDefault();
    e.stopPropagation();

    const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
    const injectableParam = targetConfig.parameters.find((p) => p.enabled) || parsed.parameters[0];
    if (!injectableParam) return;

    const renderCol = catalog.renderColumn || 1;
    const colCount = catalog.columnCount || 2;
    const dbms = dbmsFingerprint.dbms;
    const isSystem = table.classification === 'system' || table.schema === 'information_schema' || MetadataExtractor.classifyTable(table.name, undefined, dbms) === 'system';

    // 1. Single Column query placed precisely in the verified render column position
    const colQuery = MetadataExtractor.getSingleColumnExtractionQuery(
      injectableParam,
      renderCol,
      colCount,
      table.name,
      col.name,
      dbms,
      isSystem
    );
    const reqData = RequestParser.injectPayload(parsed, injectableParam, colQuery, true);

    // 2. All Columns query
    const colNames = table.columns?.map((c) => c.name) || [col.name];
    const allColsQuery = MetadataExtractor.getMultiColumnExtractionQuery(
      injectableParam,
      renderCol,
      colCount,
      table.name,
      colNames,
      dbms,
      isSystem
    );
    const allColsReqData = RequestParser.injectPayload(parsed, injectableParam, allColsQuery, true);

    // 3. Column schema metadata query from data dictionary
    const metaQuery = MetadataExtractor.getCleanColumnEnumerationQuery(
      injectableParam,
      renderCol,
      colCount,
      table.name,
      dbms
    );
    const metaReqData = RequestParser.injectPayload(parsed, injectableParam, metaQuery, true);

    const items: ContextMenuItem[] = [
      {
        id: 'send_col_repeater',
        label: `Send to Repeater (Extract "${col.name}")`,
        icon: <Send className="w-3.5 h-3.5 text-accent-cyan" />,
        shortcut: 'Ctrl+R',
        onClick: () => handleSendToRepeater(reqData.rawRequest, undefined, `SQL Probe: ${table.name}.${col.name}`),
      },
      {
        id: 'send_all_cols_repeater',
        label: `Send Multi-Column Query (${colNames.join(' ~ ')})`,
        icon: <Layers className="w-3.5 h-3.5 text-emerald-400" />,
        onClick: () => handleSendToRepeater(allColsReqData.rawRequest, undefined, `SQL Data: ${table.name}`),
      },
      {
        id: 'send_col_meta_repeater',
        label: `Send Column Definition Query to Repeater`,
        icon: <Columns className="w-3.5 h-3.5 text-blue-400" />,
        onClick: () => handleSendToRepeater(metaReqData.rawRequest, undefined, `SQL Meta: ${table.name}.${col.name}`),
      },
      { divider: true },
      {
        id: 'copy_col_name',
        label: 'Copy Column Name',
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => handleCopyToClipboard(col.name, 'Column Name Copied'),
      },
      {
        id: 'copy_full_path',
        label: 'Copy Table.Column',
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => handleCopyToClipboard(`${table.name}.${col.name}`, 'Full Path Copied'),
      },
    ];

    setContextMenuState({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  const handleCopyToClipboard = (text?: string, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addToast({
      type: 'info',
      title: label,
      description: 'Content copied to clipboard.',
      duration: 1800,
    });
  };

  const handleStartScanClick = () => {
    if (!safetyConfig.authorizedTestingConfirmed) {
      setSafetyConfig({ authorizedTestingConfirmed: true });
    }
    startScan();
    addToast({
      type: 'info',
      title: 'Autonomous Deep SQL Assessment Started',
      description: `Executing fully automated multi-layer cognitive assessment...`,
    });
  };

  const handleConfirmAuthAndStart = () => {
    setSafetyConfig({ authorizedTestingConfirmed: true });
    setShowAuthModal(false);
    startScan();
    addToast({
      type: 'success',
      title: 'Authorized Testing Confirmed',
      description: 'Starting automated Deep SQL vulnerability scan...',
    });
  };


  return (
    <div className="flex flex-col h-full bg-[#0a0c10] text-text-primary select-none overflow-hidden font-sans">
      {/* 0. MULTI-TAB SCAN BAR */}
      <div className="h-9 bg-[#0e1117] border-b border-border-subtle flex items-center px-2 gap-1 overflow-x-auto select-none no-scrollbar">
        {tabs.map((t, idx) => {
          const isActive = t.id === activeTabId;
          const isScanning = t.scanState === 'running';
          const isVuln = t.scanVerdict === 'VULNERABLE';

          return (
            <div
              key={t.id}
              onClick={() => setActiveScanTab(t.id)}
              className={`h-7.5 px-3 rounded-t text-xs font-mono flex items-center gap-2 cursor-pointer transition-all border-t-2 ${
                isActive
                  ? 'bg-bg-panel text-white font-bold border-accent-cyan shadow-sm'
                  : 'bg-transparent text-text-muted hover:bg-[#151922] hover:text-text-secondary border-transparent'
              }`}
            >
              {isScanning ? (
                <Activity className="w-3 h-3 text-amber-400 animate-spin" />
              ) : isVuln ? (
                <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
              ) : (
                <Database className="w-3 h-3 text-accent-cyan" />
              )}

              {editingTabId === t.id ? (
                <input
                  type="text"
                  value={editingTabTitle}
                  autoFocus
                  onChange={(e) => setEditingTabTitle(e.target.value)}
                  onBlur={() => {
                    if (editingTabTitle.trim()) renameScanTab(t.id, editingTabTitle.trim());
                    setEditingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editingTabTitle.trim()) renameScanTab(t.id, editingTabTitle.trim());
                      setEditingTabId(null);
                    }
                  }}
                  className="bg-[#12151c] text-white px-1 py-0.5 rounded text-xs outline-none border border-accent-cyan w-28"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTabId(t.id);
                    setEditingTabTitle(t.title);
                  }}
                  className="truncate max-w-[140px]"
                >
                  {t.title || `Scan ${idx + 1}`}
                </span>
              )}

              {isScanning && (
                <span className="text-[10px] text-amber-400 font-mono">
                  {t.progress.percent}%
                </span>
              )}

              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeScanTab(t.id);
                  }}
                  className="w-4 h-4 rounded hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-text-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => createScanTab()}
          title="Open New Scan Tab"
          className="h-6 px-2 rounded bg-[#12151c] hover:bg-[#1c222e] text-accent-cyan hover:text-white text-xs font-mono font-bold flex items-center gap-1 border border-border-subtle transition-colors ml-1"
        >
          <span>+</span> New Scan
        </button>
      </div>

      {/* 1. TOP STATUS & ENGINE BANNER */}
      <div className="border-b border-border-subtle bg-bg-panel p-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left side: Engine Capability & Strategy */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1.5 font-mono">
              <span className="text-accent-cyan font-bold">⚡ SENTINEL</span> SQL
            </span>
          </div>

          {/* Binary Verdict Pill */}
          <div className="flex items-center gap-2">
            {scanState === 'aborted' && (
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Square className="w-3 h-3 fill-current text-zinc-400" />
                STOPPED
              </span>
            )}
            {scanVerdict === 'VULNERABLE' && (
              <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/80 text-rose-300 font-mono font-bold text-xs flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                VULNERABLE
              </span>
            )}
            {scanVerdict === 'NOT CONFIRMED VULNERABLE' && scanState !== 'aborted' && (
              <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                NOT CONFIRMED VULNERABLE
              </span>
            )}
            {scanVerdict === 'IN_PROGRESS' && scanState !== 'aborted' && (
              <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/80 text-amber-300 font-mono font-bold text-xs flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-spin text-amber-400" />
                INVESTIGATING...
              </span>
            )}
            {scanVerdict === 'IDLE' && scanState !== 'aborted' && (
              <span className="px-2.5 py-1 rounded bg-bg-panel-elevated border border-border-subtle text-text-muted font-mono text-xs">
                STANDBY
              </span>
            )}
          </div>

          {/* Single User-Facing Strategy Display */}
          <div
            className="flex items-center gap-2 px-3 py-1 rounded bg-[#12151c] border border-border-subtle text-xs"
            title="Automatically selects, combines, and adapts every applicable SQL security investigation technique."
          >
            <span className="font-bold text-white flex items-center gap-1.5 font-mono">
              🧠 Autonomous SQL Investigation
            </span>
            <span className="hidden xl:inline text-[11px] text-text-muted border-l border-border-subtle pl-2">
              Automatically selects, combines, and adapts every applicable SQL security investigation technique.
            </span>
          </div>

          {/* DBMS Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-bg-panel-elevated border border-border-subtle text-text-secondary truncate max-w-xs">
              DBMS: <strong className="text-emerald-400">{dbmsFingerprint.dbms !== 'Unknown' ? dbmsFingerprint.dbms : 'Detecting...'}</strong>
            </span>
          </div>
        </div>

        {/* Right side: Engine Mode + Mode [QUICK] [DEEP] & START SQL SCAN */}
        <div className="flex items-center gap-2.5">
          {/* Autonomous Multi-Stage Pipeline Badge */}
          <div 
            className="flex items-center gap-1.5 bg-[#12151c] px-2.5 py-1 rounded border border-accent-cyan/40 text-[11px] font-mono shadow-sm"
            title="Autonomous 9-Stage Sovereign Hybrid Pipeline: Baseline Profiling, Perimeter Shaping, Context Inference, Multi-Oracle Discovery, Causal Invariants, Gray-Box & IAST, Adaptive Schema, Vectorized Extraction, and Evidence Certification."
          >
            <Cpu className="w-3.5 h-3.5 text-accent-cyan animate-pulse" />
            <span className="text-accent-cyan font-bold">⚡ Autonomous Attack Pipeline</span>
            <span className="text-[9px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 font-semibold uppercase tracking-wider">ACTIVE</span>
          </div>

          {/* 1-Click Scan Profile Preset Selector */}
          <div className="flex items-center gap-1.5 bg-[#12151c] px-2 py-1 rounded border border-border-subtle text-[11px] font-mono">
            <span className="text-text-muted font-bold flex items-center gap-1">
              <Sliders className="w-3 h-3 text-purple-400" /> Profile:
            </span>
            <select
              value={scanProfile || 'deep_forensic'}
              onChange={(e) => {
                setScanProfile(e.target.value as any);
                addToast({ type: 'info', title: `Applied Scan Profile: ${e.target.value}` });
              }}
              style={{ colorScheme: 'dark' }}
              className="bg-[#0a0c10] text-purple-300 border border-border-subtle rounded px-2 py-0.5 text-[11px] font-bold outline-none cursor-pointer hover:border-purple-400/60"
            >
              <option value="deep_forensic" className="bg-[#2b2d30] text-[#dfdfdf]">🔬 Deep Forensic Audit (L1-L17 Full)</option>
              <option value="ultra_stealth" className="bg-[#2b2d30] text-[#dfdfdf]">🥷 Ultra-Stealth (Ghost Jitter μ=3.5s)</option>
              <option value="fast_triage" className="bg-[#2b2d30] text-[#dfdfdf]">⚡ Fast Triage (High-Value Vectors)</option>
              <option value="smt_strict" className="bg-[#2b2d30] text-[#dfdfdf]">📐 SMT Strict (Formal Proof Only)</option>
              <option value="hyper_turbo" className="bg-[#2b2d30] text-[#dfdfdf]">🚀 Hyper-Turbo (100 Workers, 0ms Delay)</option>
            </select>
          </div>

          {/* Parallel Concurrency Workers Control */}
          <div className="flex items-center gap-1.5 bg-[#12151c] px-2 py-1 rounded border border-border-subtle text-[11px] font-mono">
            <span className="text-text-muted font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Workers:
            </span>
            <select
              value={concurrencyLimit || 10}
              onChange={(e) => {
                const val = Number(e.target.value);
                setConcurrencyLimit(val);
                addToast({ type: 'info', title: `Scan Concurrency: ${val} Workers` });
              }}
              style={{ colorScheme: 'dark' }}
              className="bg-[#0a0c10] text-amber-300 border border-border-subtle rounded px-1.5 py-0.5 text-[11px] font-bold outline-none cursor-pointer hover:border-amber-400/60"
            >
              <option value="1" className="bg-[#2b2d30] text-[#dfdfdf]">1 (Stealth)</option>
              <option value="5" className="bg-[#2b2d30] text-[#dfdfdf]">5 (Conservative)</option>
              <option value="10" className="bg-[#2b2d30] text-[#dfdfdf]">10 (Balanced)</option>
              <option value="25" className="bg-[#2b2d30] text-[#dfdfdf]">25 (Fast Triage)</option>
              <option value="50" className="bg-[#2b2d30] text-[#dfdfdf]">50 (High-Yield)</option>
              <option value="100" className="bg-[#2b2d30] text-[#dfdfdf]">100 (Hyper-Max)</option>
            </select>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 bg-[#12151c] px-2 py-1 rounded border border-border-subtle text-[11px] font-mono">
            <span className="text-text-muted font-bold">Scope:</span>
            <div className="flex items-center bg-[#0a0c10] p-0.5 rounded border border-border-subtle font-medium">
              <button
                onClick={() => setScanMode('quick')}
                className={`px-2.5 py-0.5 rounded font-bold transition-all ${
                  safetyConfig.scanMode === 'quick'
                    ? 'bg-accent-cyan text-black shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                QUICK
              </button>
              <button
                onClick={() => setScanMode('deep')}
                className={`px-2.5 py-0.5 rounded font-bold transition-all ${
                  safetyConfig.scanMode === 'deep'
                    ? 'bg-accent-cyan text-black shadow-sm'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                DEEP
              </button>
            </div>
          </div>

          {/* Target Lab Matrix Dropdown */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 bg-[#12151c] px-2 py-1 rounded border border-emerald-500/40 text-[11px] font-mono text-emerald-400 hover:bg-emerald-950/30 transition-colors cursor-pointer"
              title="Quick-load local docker vulnerability testbed targets"
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Lab Targets</span>
              <ChevronDown className="w-3 h-3 text-emerald-400/70" />
            </button>
            <div className="absolute right-0 mt-1 w-64 bg-[#12151c] border border-border-subtle rounded shadow-2xl py-1 z-50 hidden group-hover:block">
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-text-muted border-b border-border-subtle/50 flex items-center justify-between">
                <span>Docker Lab Targets</span>
                <span className="text-emerald-400">6 Services</span>
              </div>
              {[
                { name: 'OWASP Juice Shop (SPA/Crypto)', url: 'http://localhost:3000/#/search?q=apple', method: 'GET' },
                { name: 'DVWA (Classic Archetypes)', url: 'http://localhost:8081/vulnerabilities/sqli/?id=1&Submit=Submit', method: 'GET' },
                { name: 'DVGA (Damn Vulnerable GraphQL)', url: 'http://localhost:5013/graphql', method: 'POST' },
                { name: 'ClickHouse Server (OLAP)', url: 'http://localhost:8123/?query=SELECT+1', method: 'GET' },
                { name: 'PostgreSQL 16 DB', url: 'http://localhost:5432', method: 'POST' },
                { name: 'MySQL 8.0 DB', url: 'http://localhost:3306', method: 'POST' },
              ].map((tgt) => (
                <button
                  key={tgt.name}
                  onClick={() => {
                    const host = tgt.url.replace(/^https?:\/\//, '').split('/')[0];
                    const path = tgt.url.replace(/^https?:\/\/[^/]+/, '') || '/';
                    setRawRequest(`${tgt.method} ${path} HTTP/1.1\r\nHost: ${host}\r\n\r\n`);
                    addToast({ type: 'success', title: `Loaded Lab Target: ${tgt.name}`, description: `Target URL set to ${tgt.url}` });
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-[#1a1f2c] flex flex-col text-[11px] transition-colors cursor-pointer"
                >
                  <span className="font-bold text-emerald-300">{tgt.name}</span>
                  <span className="text-[9px] text-text-muted font-mono truncate">{tgt.url}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Site Map Toggle */}
          <button
            onClick={() => setShowSiteMap(!showSiteMap)}
            className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
              showSiteMap
                ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 shadow-sm'
                : 'bg-[#12151c] text-text-muted border-border-subtle hover:text-white'
            }`}
            title="Toggle Target Site Map & Proxy Sink Sidebar"
          >
            <Globe className="w-3 h-3" />
            <span>Site Map</span>
          </button>

          {/* Controls */}
          {scanState === 'running' && (
            <>
              <Button variant="secondary" size="sm" onClick={pauseScan} className="flex items-center gap-1.5 font-bold">
                <Pause className="w-3.5 h-3.5 fill-current" /> Pause
              </Button>
              <Button variant="danger" size="sm" onClick={stopScan} className="flex items-center gap-1.5 font-bold">
                <Square className="w-3.5 h-3.5 fill-current" /> Stop
              </Button>
            </>
          )}

          {scanState === 'paused' && (
            <>
              <Button variant="primary" size="sm" onClick={resumeScan} className="flex items-center gap-1.5 font-bold">
                <Play className="w-3.5 h-3.5 fill-current" /> Resume
              </Button>
              <Button variant="danger" size="sm" onClick={stopScan} className="flex items-center gap-1.5 font-bold">
                <Square className="w-3.5 h-3.5 fill-current" /> Stop
              </Button>
            </>
          )}

          {scanState !== 'running' && scanState !== 'paused' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartScanClick}
              className="flex items-center gap-1.5 font-bold shadow-lg shadow-accent-cyan/20 px-3.5 py-1 text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> START SQL SCAN
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={resetScan} className="text-text-muted hover:text-text-primary">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Progress Bar (Visible while scanning) */}
      {scanState === 'running' && (
        <div className="h-1.5 w-full bg-bg-panel relative overflow-hidden border-b border-border-subtle">
          <div
            className="h-full bg-gradient-to-r from-accent-cyan to-emerald-400 transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      {/* 2. MAIN SPLIT VIEW */}
      <div className="flex-1 flex overflow-hidden">
        {/* SITE MAP & PROXY SINK EXPLORER SIDEBAR */}
        {showSiteMap && <ProxyTargetSiteMap />}

        {/* LEFT PANE: Request, Response & Vector Importer (400px) */}
        <div className="w-[420px] border-r border-border-subtle flex flex-col bg-bg-panel flex-shrink-0 overflow-hidden">
          {/* 1. Request Header */}
          <div className="h-9 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSiteMap(!showSiteMap)}
                title={showSiteMap ? 'Collapse Site Map' : 'Show Site Map'}
                className={`p-1 rounded hover:bg-[#12151c] transition-colors ${
                  showSiteMap ? 'text-accent-cyan' : 'text-text-muted hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-accent-cyan" /> Target Request
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRequestViewMode('raw')}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                  requestViewMode === 'raw' ? 'bg-[#12151c] text-white font-bold' : 'text-text-muted'
                }`}
              >
                Raw
              </button>
              <button
                onClick={() => setRequestViewMode('pretty')}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                  requestViewMode === 'pretty' ? 'bg-[#12151c] text-white font-bold' : 'text-text-muted'
                }`}
              >
                Pretty
              </button>
              <button
                onClick={() => {
                  let host = '';
                  try {
                    if (targetConfig.url) host = new URL(targetConfig.url).host;
                  } catch {}
                  if (!host) {
                    for (const l of targetConfig.rawRequest.split(/\r?\n/)) {
                      if (l.toLowerCase().startsWith('host:')) {
                        host = l.substring(5).trim();
                        break;
                      }
                    }
                  }
                  const txs = useTrafficStore.getState().transactions.filter((t: any) => !host || t.host === host);
                  const latestTx = txs[txs.length - 1];
                  if (latestTx) {
                    const method = latestTx.method || 'GET';
                    const path = latestTx.path || '/';
                    const txHost = latestTx.host || host || 'target.local';
                    const headersStr = latestTx.reqHeaders
                      ? latestTx.reqHeaders.map((h: any) => `${h.name}: ${h.value}`).join('\r\n')
                      : `Host: ${txHost}\r\nUser-Agent: Sentinel/6.0`;
                    const bodyStr = latestTx.reqBody || '';
                    const raw = `${method} ${path} HTTP/1.1\r\n${headersStr}\r\n\r\n${bodyStr}`;
                    setRawRequest(raw);
                    probeTargetRequest(raw);
                    addToast({
                      type: 'success',
                      title: 'Browser Session Synced',
                      description: `Loaded latest ${method} ${path} with your active browser cookies!`,
                    });
                  } else {
                    addToast({
                      type: 'info',
                      title: 'No Browser Traffic Captured',
                      description: 'Browse the site in the Sentinel browser to capture your session.',
                    });
                  }
                }}
                className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1 transition-all shadow-sm"
                title="Sync the latest authenticated request & cookies from your Sentinel browser session"
              >
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                <span>Sync Browser</span>
              </button>
              <button
                onClick={() => probeTargetRequest()}
                disabled={isProbing}
                title="Send live probe request to target"
                className="px-2 py-0.5 text-[10px] font-mono rounded bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 flex items-center gap-1 border border-accent-cyan/30 disabled:opacity-50 font-bold transition-colors"
              >
                <Zap className={`w-2.5 h-2.5 ${isProbing ? 'animate-spin' : 'fill-current'}`} />
                {isProbing ? 'Probing...' : 'Probe'}
              </button>
              <button
                onClick={() => handleSendToRepeater(targetConfig.rawRequest, undefined, 'Target Request')}
                title="Send target request to Repeater"
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#12151c] text-accent-cyan hover:text-white flex items-center gap-1 border border-border-subtle"
              >
                <Send className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Request Textarea */}
          <div className="p-2 border-b border-border-subtle flex flex-col h-44 flex-shrink-0 bg-[#0c0e14]">
            <textarea
              value={targetConfig.rawRequest}
              onChange={(e) => setRawRequest(e.target.value)}
              disabled={scanState === 'running'}
              placeholder="Paste raw HTTP request here..."
              className="w-full h-full bg-[#12151c] p-2.5 font-mono text-xs rounded border border-border-subtle resize-none text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* 2. HTTP Response Viewer - Displayed Directly Below Request */}
            {/* 2. HTTP Response Viewer - Displayed Directly Below Request */}
            {(() => {
              const redirectLoc = extractRedirectLocation(lastResponse, targetConfig.url);
              return (
                <div className="flex-1 flex flex-col min-h-[180px] border-b border-border-subtle bg-[#080a0f] overflow-hidden">
                  <div className="h-8 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-400" /> Response
                      </span>
                      {lastResponse && (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                            lastResponse.statusCode >= 200 && lastResponse.statusCode < 300
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : lastResponse.statusCode >= 300 && lastResponse.statusCode < 400
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                              : lastResponse.statusCode >= 400 && lastResponse.statusCode < 500
                              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                              : 'bg-rose-950 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {lastResponse.statusCode > 0 ? `${lastResponse.statusCode} ${lastResponse.statusText}` : 'Error'}
                        </span>
                      )}
                      {lastResponse && lastResponse.durationMs > 0 && (
                        <span className="text-[9px] text-text-muted font-mono">
                          {lastResponse.durationMs}ms
                        </span>
                      )}
                      {redirectLoc && (
                        <button
                          onClick={() => followRedirect(redirectLoc)}
                          className="px-2 py-0.5 text-[9px] font-mono rounded bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 border border-accent-cyan/50 flex items-center gap-1 font-bold transition-all shadow-sm cursor-pointer"
                          title={`Follow redirect to ${redirectLoc}`}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Follow ➔
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setResponseViewMode('pretty')}
                        className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
                          responseViewMode === 'pretty' ? 'bg-[#12151c] text-white font-bold' : 'text-text-muted hover:text-white'
                        }`}
                      >
                        Pretty
                      </button>
                      <button
                        onClick={() => setResponseViewMode('raw')}
                        className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
                          responseViewMode === 'raw' ? 'bg-[#12151c] text-white font-bold' : 'text-text-muted hover:text-white'
                        }`}
                      >
                        Raw
                      </button>
                      <button
                        onClick={() => setResponseViewMode('headers')}
                        className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
                          responseViewMode === 'headers' ? 'bg-[#12151c] text-white font-bold' : 'text-text-muted hover:text-white'
                        }`}
                      >
                        Headers ({lastResponse?.headers?.length || 0})
                      </button>
                      <button
                        onClick={() => setResponseViewMode('render')}
                        className={`px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors ${
                          responseViewMode === 'render'
                            ? 'bg-accent-cyan/20 text-accent-cyan font-bold border border-accent-cyan/40'
                            : 'text-text-muted hover:text-accent-cyan'
                        }`}
                        title="Render live HTML website preview"
                      >
                        Render
                      </button>
                    </div>
                  </div>

                  {/* Redirect & Authentication Banner */}
                  {redirectLoc && (
                    <div className="px-3 py-1.5 bg-[#0f1420] border-b border-accent-cyan/30 flex items-center justify-between text-xs font-mono select-none flex-shrink-0 gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-text-muted truncate min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                        <span className="truncate">Redirected to: <strong className="text-accent-cyan">{redirectLoc}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => followRedirect(redirectLoc)}
                          className="px-2.5 py-0.5 rounded bg-accent-cyan text-black font-bold text-[10px] hover:bg-accent-cyan/90 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer shadow-sm"
                          title="Fetch and display destination landing page"
                        >
                          Follow Redirect ➔
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await ipcClient.launchSystemBrowser(redirectLoc, 8085);
                              useToastStore.getState().addToast({
                                type: 'success',
                                title: 'Proxy Browser Launched',
                                description: `Browser opened to ${redirectLoc} via 127.0.0.1:8085. Log in with your credentials, then click "Sync Cookies".`,
                              });
                            } catch (e: any) {
                              useToastStore.getState().addToast({
                                type: 'error',
                                title: 'Launch Failed',
                                description: e?.message || 'Could not launch browser',
                              });
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Launch browser via Sentinel proxy (127.0.0.1:8085) to log into the portal and capture authenticated sessions"
                        >
                          <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Login via Browser</span>
                        </button>
                        <button
                          onClick={() => {
                            const count = syncSessionFromProxy();
                            if (count > 0) {
                              useToastStore.getState().addToast({
                                type: 'success',
                                title: 'Cookies Synced',
                                description: `Injected ${count} live session cookies from proxy into scanner request!`,
                              });
                            } else {
                              useToastStore.getState().addToast({
                                type: 'info',
                                title: 'No Proxy Cookies Found',
                                description: 'Log into the portal using "Login via Browser" first to capture session cookies.',
                              });
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Sync active session cookies captured by the proxy for this host"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                          <span>Sync Cookies</span>
                        </button>
                      </div>
                    </div>
                  )}

            {/* Response Body Area */}
            <div className="flex-1 overflow-y-auto bg-[#0a0c10] select-text">
              {isProbing ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <div className="w-5 h-5 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-text-muted font-mono">Probing target endpoint & capturing response...</span>
                </div>
              ) : lastResponse ? (
                responseViewMode === 'headers' ? (
                  <div className="p-2 space-y-1 font-mono text-[11px]">
                    {lastResponse.headers && lastResponse.headers.length > 0 ? (
                      lastResponse.headers.map((h, i) => (
                        <div key={i} className="flex gap-2 border-b border-border-subtle/30 pb-0.5">
                          <span className="text-cyan-400 font-bold flex-shrink-0">{h.name}:</span>
                          <span className="text-text-primary break-all">{h.value}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-text-muted italic p-2 text-xs">No response headers recorded</div>
                    )}
                  </div>
                ) : responseViewMode === 'raw' ? (
                  <pre className="p-2.5 font-mono text-xs text-text-primary whitespace-pre-wrap break-all leading-relaxed">
                    {lastResponse.rawResponse || `HTTP/1.1 ${lastResponse.statusCode} ${lastResponse.statusText}\n\n${lastResponse.body}`}
                  </pre>
                ) : responseViewMode === 'render' ? (
                  <div className="flex flex-col h-full bg-white overflow-hidden relative min-h-[220px]">
                    <div className="flex items-center justify-between px-2.5 py-1 bg-[#12151c] border-b border-border-subtle text-[10px] font-mono select-none flex-wrap gap-1">
                      <span className="text-text-muted flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                        Sandboxed HTML Render (Interactive)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const count = syncSessionFromProxy();
                            if (count > 0) {
                              useToastStore.getState().addToast({
                                type: 'success',
                                title: 'Cookies Synced',
                                description: `Injected ${count} live session cookies from proxy!`,
                              });
                            } else {
                              useToastStore.getState().addToast({
                                type: 'info',
                                title: 'No Proxy Cookies Found',
                                description: 'Log into the portal using "Login via Browser" first.',
                              });
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[9px] font-bold flex items-center gap-1 transition-all"
                          title="Sync cookies from Sentinel proxy"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                          <span>Sync Cookies</span>
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const dest = redirectLoc || targetConfig.url;
                              await ipcClient.launchSystemBrowser(dest, 8085);
                              useToastStore.getState().addToast({
                                type: 'success',
                                title: 'Proxy Browser Launched',
                                description: `Navigating to ${dest} via Sentinel Proxy (127.0.0.1:8085). Log in to harvest session.`,
                              });
                            } catch (e: any) {
                              useToastStore.getState().addToast({
                                type: 'error',
                                title: 'Launch Failed',
                                description: e?.message || 'Could not launch browser',
                              });
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold flex items-center gap-1 transition-all"
                          title="Open in system browser via Sentinel proxy to authenticate"
                        >
                          <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Browser Login</span>
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob(
                              [generateRenderablePreviewHtml(lastResponse.body || lastResponse.rawResponse || '', undefined, targetConfig.url)],
                              { type: 'text/html' }
                            );
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                          }}
                          className="px-2 py-0.5 rounded bg-[#1a1d24] border border-border-subtle hover:border-accent-cyan text-accent-cyan text-[10px] transition-colors flex items-center gap-1"
                          title="Open rendered page in new browser window"
                        >
                          Full Window ↗
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const isChallenge =
                        lastResponse.body &&
                        (/Please wait while your request is being verified|cf-turnstile|just a moment|checking your browser|attention required.*cloudflare/i.test(lastResponse.body) ||
                         (lastResponse.statusCode === 403 && /cloudflare|waf|imperva|challenge/i.test(lastResponse.body)));
                      if (!isChallenge) return null;
                      return (
                        <div className="bg-amber-950/70 border-b border-amber-500/50 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-amber-200 z-10 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                            <span><strong>Anti-Bot Challenge Active:</strong> Browser verification required to pass WAF.</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const dest = redirectLoc || targetConfig.url;
                                await ipcClient.launchSystemBrowser(dest, 8085);
                                useToastStore.getState().addToast({
                                  type: 'info',
                                  title: 'Proxy Browser Launched',
                                  description: 'Solve the verification check in Chrome/Edge, then click Sync Clearance.',
                                });
                              }}
                              className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-500/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Solve in Browser ➔</span>
                            </button>
                            <button
                              onClick={() => {
                                const count = syncSessionFromProxy();
                                if (count > 0) {
                                  useToastStore.getState().addToast({
                                    type: 'success',
                                    title: 'Clearance Token Synced',
                                    description: `Injected ${count} live cookies! Re-rendering target...`,
                                  });
                                  probeTargetRequest();
                                } else {
                                  useToastStore.getState().addToast({
                                    type: 'warning',
                                    title: 'No Token Found',
                                    description: 'Complete the verification in the browser window first.',
                                  });
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 border border-purple-500/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Sync Clearance</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="flex-1 w-full h-full bg-white relative">
                      <iframe
                        title="Response HTML Preview"
                        srcDoc={generateRenderablePreviewHtml(lastResponse.body || lastResponse.rawResponse || '', undefined, targetConfig.url)}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        className="w-full h-full border-0 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <pre className="p-2.5 font-mono text-xs text-text-primary whitespace-pre-wrap break-all leading-relaxed">
                    {lastResponse.body || '(Empty Response Body)'}
                  </pre>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 text-text-muted">
                  <Activity className="w-6 h-6 text-text-muted/40" />
                  <span className="text-xs font-mono">No live response recorded yet.</span>
                  <button
                    onClick={() => probeTargetRequest()}
                    className="px-2.5 py-1 text-[11px] font-mono rounded bg-[#161a24] hover:bg-[#1e2330] text-accent-cyan border border-border-subtle transition-colors flex items-center gap-1.5 mt-1"
                  >
                    <Zap className="w-3 h-3 fill-current" /> Probe Endpoint Now
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

          {/* 3. Collapsible Candidate Parameters Table */}
          <div className="border-b border-border-subtle flex-shrink-0">
            <div
              onClick={() => setShowVectorsSection(!showVectorsSection)}
              className="h-8 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated cursor-pointer hover:bg-bg-panel-elevated/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px]">
                  Vectors ({targetConfig.parameters.length})
                </span>
                <ChevronDown className={`w-3 h-3 text-text-muted transition-transform duration-200 ${showVectorsSection ? 'rotate-180' : ''}`} />
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleAllParameters(true)}
                  className="text-[10px] text-accent-cyan hover:underline"
                >
                  All
                </button>
                <button
                  onClick={() => toggleAllParameters(false)}
                  className="text-[10px] text-text-muted hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            {showVectorsSection && (
              <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle font-mono text-xs">
                {targetConfig.parameters.length === 0 ? (
                  <div className="p-3 text-center text-text-muted text-xs italic">
                    No parameters detected.
                  </div>
                ) : (
                  targetConfig.parameters.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => toggleParameter(p.id)}
                      className={`p-1.5 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                        p.enabled
                          ? 'bg-bg-panel hover:bg-bg-panel-hover text-text-primary'
                          : 'bg-[#0c0e14]/50 text-text-muted line-through'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={() => {}}
                          className="rounded border-border-subtle text-accent-cyan focus:ring-0"
                        />
                        <span className="font-bold text-white truncate">{p.name}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#12151c] text-text-muted">
                          {p.location}
                        </span>
                      </div>
                      <span className="text-[9px] text-emerald-400 font-semibold px-1 py-0.2 rounded bg-emerald-950/40 border border-emerald-500/20">
                        {p.detectedContext || 'string'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 4. Gray-Box & IAST Boundary Engine Panel */}
          <div className="border-t border-border-subtle bg-bg-panel-elevated/40 flex-shrink-0">
            <div
              onClick={() => setShowGrayBoxConfig(!showGrayBoxConfig)}
              className="p-2 px-3 flex items-center justify-between cursor-pointer hover:bg-bg-panel-elevated transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-fuchsia-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-fuchsia-400" /> Gray-Box & IAST
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                  targetConfig.grayBoxConfig?.enabled
                    ? 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/40'
                    : 'bg-[#12151c] text-text-muted'
                }`}>
                  {targetConfig.grayBoxConfig?.enabled ? 'Active' : 'Off'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${showGrayBoxConfig ? 'rotate-180' : ''}`} />
            </div>

            {showGrayBoxConfig && (
              <div className="p-3 pt-1 border-t border-border-subtle/50 space-y-2 text-[11px] font-mono">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-text-secondary font-bold">Enable Gray-Box:</span>
                  <input
                    type="checkbox"
                    checked={Boolean(targetConfig.grayBoxConfig?.enabled)}
                    onChange={(e) => setGrayBoxConfig({ enabled: e.target.checked })}
                    className="rounded border-border-subtle text-fuchsia-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                {targetConfig.grayBoxConfig?.enabled && (
                  <div className="space-y-1.5 pt-1.5 border-t border-border-subtle/40">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted text-[10px]">Mode:</span>
                      <select
                        value={targetConfig.grayBoxConfig?.mode || 'hybrid'}
                        onChange={(e) => setGrayBoxConfig({ mode: e.target.value as any })}
                        style={{ colorScheme: 'dark' }}
                        className="bg-[#0a0c10] text-fuchsia-300 border border-border-subtle rounded px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="hybrid" className="bg-[#2b2d30] text-[#dfdfdf]">Hybrid Full Spectrum</option>
                        <option value="iast_only" className="bg-[#2b2d30] text-[#dfdfdf]">IAST Air-Gap Only</option>
                        <option value="dom_only" className="bg-[#2b2d30] text-[#dfdfdf]">DOM WebCrypto Only</option>
                        <option value="macro_only" className="bg-[#2b2d30] text-[#dfdfdf]">Macro 2FA Only</option>
                      </select>
                    </div>

                    <label className="flex items-center justify-between cursor-pointer text-[10px]">
                      <span className="text-text-muted">IAST Runtime Sensor:</span>
                      <input
                        type="checkbox"
                        checked={Boolean(targetConfig.grayBoxConfig?.iastConfig?.enabled ?? true)}
                        onChange={(e) => setGrayBoxConfig({
                          iastConfig: {
                            ...targetConfig.grayBoxConfig?.iastConfig,
                            enabled: e.target.checked,
                            sensorPort: 5014,
                          }
                        })}
                        className="rounded text-fuchsia-500"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer text-[10px]">
                      <span className="text-text-muted">Bot / WAF Perimeter Bypass:</span>
                      <input
                        type="checkbox"
                        checked={Boolean(targetConfig.grayBoxConfig?.botBypassConfig?.enabled ?? true)}
                        onChange={(e) => setGrayBoxConfig({
                          botBypassConfig: {
                            ...targetConfig.grayBoxConfig?.botBypassConfig,
                            enabled: e.target.checked,
                            bypassHeaders: { 'X-Forwarded-For': '127.0.0.1' },
                          }
                        })}
                        className="rounded text-fuchsia-500"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer text-[10px]">
                      <span className="text-text-muted">DOM WebCrypto Pre-Encrypt:</span>
                      <input
                        type="checkbox"
                        checked={Boolean(targetConfig.grayBoxConfig?.headlessDomConfig?.enabled ?? false)}
                        onChange={(e) => setGrayBoxConfig({
                          headlessDomConfig: {
                            ...targetConfig.grayBoxConfig?.headlessDomConfig,
                            enabled: e.target.checked,
                          }
                        })}
                        className="rounded text-fuchsia-500"
                      />
                    </label>

                    <div className="text-[9px] text-text-muted/80 bg-[#0a0c10] p-1.5 rounded border border-border-subtle/30">
                      Local Sensor Socket: <span className="text-fuchsia-400">http://127.0.0.1:5014</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Safety Status Pill */}
          <div className="p-2.5 bg-bg-panel-elevated flex items-center justify-between text-[11px] font-mono flex-shrink-0">
            <span className="text-text-muted flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Non-Destructive
            </span>
            <span className="text-emerald-400 font-bold">Auto-Redaction Active</span>
          </div>
        </div>

        {/* RIGHT PANE: Tabs & Explorer Dashboard */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0c10] overflow-hidden">
          {/* Sub-navigation Tabs */}
          <div className="h-9 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel">
            <div className="flex items-center gap-1.5 py-1">
              <button
                onClick={() => setActiveTab('database')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-150 ${
                  activeTab === 'database'
                    ? 'bg-[#1e1f22] text-[#f37021] border border-[#3e4249] shadow-sm font-semibold'
                    : 'text-[#9da5b4] hover:text-white hover:bg-[#1e1f22]/60 border border-transparent'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" /> Database Explorer
                {catalog.applicationTables.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono">
                    {catalog.applicationTables.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-150 ${
                  activeTab === 'logs'
                    ? 'bg-[#1e1f22] text-[#f37021] border border-[#3e4249] shadow-sm font-semibold'
                    : 'text-[#9da5b4] hover:text-white hover:bg-[#1e1f22]/60 border border-transparent'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" /> Payload Engine Log
                {executionLogs.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#141517] text-[#9da5b4] text-[10px] font-mono border border-[#313438]">
                    {executionLogs.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('vulnerabilities')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-150 ${
                  activeTab === 'vulnerabilities' || activeTab === ('causal' as any)
                    ? 'bg-[#1e1f22] text-[#f37021] border border-[#3e4249] shadow-sm font-semibold'
                    : 'text-[#9da5b4] hover:text-white hover:bg-[#1e1f22]/60 border border-transparent'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Findings & Proofs
                {findings.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px] font-mono font-bold">
                    {findings.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('report')}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-150 ${
                  activeTab === 'report'
                    ? 'bg-[#1e1f22] text-[#f37021] border border-[#3e4249] shadow-sm font-semibold'
                    : 'text-[#9da5b4] hover:text-white hover:bg-[#1e1f22]/60 border border-transparent'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" /> Final Report
              </button>
            </div>
          </div>

          {/* TAB 1: RECURSIVE DATABASE EXPLORER */}
          {(activeTab === 'database' || (activeTab as string) === 'god_rail' || (activeTab as string) === 'dashboard') && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Recursive Tree (320px) */}
              <div className="w-80 border-r border-border-subtle flex flex-col bg-bg-panel overflow-hidden">
                <div className="p-2 border-b border-border-subtle bg-bg-panel-elevated text-[11px] font-mono text-text-muted flex items-center justify-between">
                  <span>DISCOVERED OBJECTS</span>
                  <span className="text-text-primary font-bold">
                    {treeSearchQuery
                      ? `${filteredAppTables.length + filteredSysTables.length} / ${catalog.applicationTables.length + catalog.systemTables.length}`
                      : `${catalog.applicationTables.length + catalog.systemTables.length}`} Objects
                  </span>
                </div>

                {/* Search Bar for Objects Tree */}
                <div className="p-2 border-b border-border-subtle bg-[#12151c]">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-2 pointer-events-none" />
                    <input
                      type="text"
                      value={treeSearchQuery}
                      onChange={(e) => setTreeSearchQuery(e.target.value)}
                      placeholder="Search tables & columns..."
                      className="w-full bg-[#1a1d24] text-white text-[11px] font-mono pl-7 pr-6 py-1 rounded border border-border-subtle focus:border-accent-cyan focus:outline-none placeholder:text-text-muted/60"
                      spellCheck={false}
                    />
                    {treeSearchQuery && (
                      <button
                        onClick={() => setTreeSearchQuery('')}
                        className="absolute right-1.5 text-text-muted hover:text-white p-0.5"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2 space-y-2 font-mono text-xs select-none overflow-y-auto flex-1">
                  {/* Root Database Node */}
                  <div className="flex items-center gap-1.5 text-white font-bold py-1">
                    <Database className="w-4 h-4 text-accent-cyan" />
                    <span>DATABASE ({dbmsFingerprint.dbms})</span>
                  </div>

                  {/* APPLICATION TABLES FOLDER */}
                  <div className="pl-2 space-y-1">
                    <div
                      onClick={() => setExpandedAppTables(!expandedAppTables)}
                      className="flex items-center gap-1.5 text-accent-cyan font-semibold cursor-pointer hover:bg-bg-panel-hover p-1 rounded"
                    >
                      {expandedAppTables ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>APPLICATION TABLES ({filteredAppTables.length})</span>
                    </div>

                    {expandedAppTables && (
                      <div className="pl-4 space-y-1">
                        {filteredAppTables.length === 0 ? (
                          <div className="text-[11px] text-text-muted italic py-1">
                            {treeSearchQuery
                              ? 'No matching application tables found.'
                              : scanState === 'running'
                              ? 'Enumerating application tables...'
                              : 'No application tables discovered yet. Start scan to enumerate.'}
                          </div>
                        ) : (
                          filteredAppTables.map((table) => {
                            const isExpanded = !!expandedTableMap[table.id] || !!treeSearchQuery;
                            const isSelected = selectedCatalogTableId === table.id && !selectedCatalogColumnName;

                            return (
                              <div key={table.id} className="space-y-0.5">
                                <div
                                  onClick={() => {
                                    setSelectedCatalogTableId(table.id);
                                    toggleTableExpand(table.id);
                                    if (!table.columns || table.columns.length === 0) {
                                      fetchColumnsForTable(table);
                                    }
                                    if (!table.sampleRows || table.sampleRows.length === 0) {
                                      fetchSampleRowsForTable(table);
                                    }
                                  }}
                                  onContextMenu={(e) => handleTableContextMenu(e, table)}
                                  className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-accent-cyan/20 text-white font-bold border border-accent-cyan/30'
                                      : 'hover:bg-bg-panel-hover text-text-primary'
                                  }`}
                                  title="Right-click for options (Send to Repeater, Copy Name)"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isExpanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
                                    <TableIcon className="w-3 h-3 text-amber-400" />
                                    <span className="truncate">{table.name}</span>
                                  </div>
                                  {table.isSensitive && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-500/30">
                                      SENSITIVE
                                    </span>
                                  )}
                                </div>

                                {/* Columns underneath Table */}
                                {isExpanded && (
                                  <div className="pl-4 space-y-0.5 border-l border-border-subtle ml-2">
                                    {table.status === 'enumerating_columns' ? (
                                      <div className="text-[10px] text-amber-400 py-1 flex items-center gap-1 animate-pulse">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Fetching columns...
                                      </div>
                                    ) : table.columns && table.columns.length > 0 ? (
                                      table.columns
                                        .filter((col) => !queryLower || col.name.toLowerCase().includes(queryLower) || table.name.toLowerCase().includes(queryLower))
                                        .map((col) => {
                                          const isColSelected = selectedCatalogTableId === table.id && selectedCatalogColumnName === col.name;

                                          return (
                                            <div
                                              key={col.name}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedCatalogTableId(table.id);
                                                setSelectedCatalogColumnName(col.name);
                                              }}
                                              onContextMenu={(e) => handleColumnContextMenu(e, table, col)}
                                              className={`flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer text-[11px] transition-colors ${
                                                isColSelected
                                                  ? 'bg-accent-cyan text-black font-bold'
                                                  : 'hover:bg-bg-panel-hover text-text-secondary'
                                              }`}
                                              title="Right-click for options (Send to Repeater, Copy Name)"
                                            >
                                              <div className="flex items-center gap-1.5 truncate">
                                                <Columns className="w-2.5 h-2.5 text-blue-400" />
                                                <span className="truncate">{col.name}</span>
                                              </div>
                                              <span className="text-[9px] text-text-muted font-mono">{col.dataType}</span>
                                            </div>
                                          );
                                        })
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          fetchColumnsForTable(table);
                                        }}
                                        className="text-[10px] text-accent-cyan hover:underline cursor-pointer py-1"
                                      >
                                        Click to load columns
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* SYSTEM / INTERNAL TABLES FOLDER */}
                  <div className="pl-2 space-y-1">
                    <div
                      onClick={() => setExpandedSystemTables(!expandedSystemTables)}
                      className="flex items-center gap-1.5 text-text-muted font-semibold cursor-pointer hover:bg-bg-panel-hover p-1 rounded"
                    >
                      {expandedSystemTables ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Shield className="w-3.5 h-3.5 text-text-muted" />
                      <span>SYSTEM / INTERNAL OBJECTS ({filteredSysTables.length})</span>
                    </div>

                    {expandedSystemTables && (
                      <div className="pl-4 space-y-0.5 max-h-72 overflow-y-auto">
                        {filteredSysTables.length === 0 ? (
                          <div className="text-[11px] text-text-muted italic py-1">
                            {treeSearchQuery
                              ? 'No matching system objects found.'
                              : safetyConfig.scanMode === 'quick'
                              ? 'Switch to Deep Scan to enumerate full system catalog.'
                              : scanState === 'running'
                              ? 'Enumerating system objects...'
                              : 'None enumerated.'}
                          </div>
                        ) : (
                          filteredSysTables.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedCatalogTableId(t.id);
                                setSelectedCatalogColumnName(null);
                                if (!t.columns || t.columns.length === 0) {
                                  fetchColumnsForTable(t);
                                }
                              }}
                              onContextMenu={(e) => handleTableContextMenu(e, t)}
                              className={`p-1 rounded cursor-pointer text-[11px] text-text-muted hover:bg-bg-panel-hover truncate ${
                                selectedCatalogTableId === t.id ? 'bg-bg-panel-elevated text-white font-bold' : ''
                              }`}
                              title="Right-click for options (Send to Repeater, Copy Name)"
                            >
                              {t.name}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Object Detail & Row Explorer */}
              <div className="flex-1 flex flex-col bg-[#0a0c10] overflow-y-auto p-4 space-y-4">
                {/* ─── VULNERABILITY TYPE & BUSINESS CONSEQUENCE BANNER ─── */}
                {activeFinding && (
                  <div className={`p-4 rounded-lg border space-y-3 font-mono ${
                    activeFinding.consequence?.threatClassification === 'OS_COMMAND_INJECTION'
                      ? 'border-rose-500/60 bg-[#160b0f]'
                      : activeFinding.consequence?.threatClassification === 'AUTHENTICATION_BYPASS'
                      ? 'border-amber-500/60 bg-[#18120a]'
                      : 'border-cyan-500/60 bg-[#0a141c]'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span className="font-bold text-xs text-white uppercase tracking-wider">
                          CONFIRMED VULNERABILITY TYPE & IMPACT ANALYSIS
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700">
                          {activeFinding.consequence?.threatBadge || '💥 CONFIRMED EXPLOITABLE'}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          Parameter: <strong className="text-accent-cyan">{activeFinding.parameterName}</strong> ({activeFinding.parameterLocation})
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-bold text-rose-300 flex items-center gap-2">
                        <span>{activeFinding.consequence?.consequenceTitle || activeFinding.title}</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed font-sans">
                        {activeFinding.consequence?.consequenceSummary || activeFinding.remediation}
                      </p>
                    </div>

                    {/* Technical Impact & Risk Pills */}
                    {activeFinding.consequence && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1 font-sans">
                        <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle space-y-1">
                          <span className="text-[10px] font-bold font-mono text-accent-cyan uppercase">⚡ Technical Exploit Impact:</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-text-secondary text-[11px]">
                            {activeFinding.consequence.technicalImpact.slice(0, 3).map((imp: string, i: number) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle space-y-1">
                          <span className="text-[10px] font-bold font-mono text-rose-400 uppercase">🚨 Real-World Business Risk:</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-text-secondary text-[11px]">
                            {activeFinding.consequence.businessRisk.slice(0, 3).map((risk: string, i: number) => (
                              <li key={i}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Live Invariant & Exfiltrated Data Proof Strip */}
                    <div className="p-3 rounded bg-[#0a0c10] border border-border-subtle space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent-cyan flex items-center gap-1.5 font-mono">
                          <Zap className="w-3.5 h-3.5 text-accent-cyan" /> ZERO-FALSE-POSITIVE INVARIANT PROOF:
                        </span>
                        {activeFinding.proofDetails?.cleanRoomVerificationToken && (
                          <span className="text-[9px] text-text-muted font-mono">
                            CAS Invariant Token: <code className="text-purple-300">{activeFinding.proofDetails.cleanRoomVerificationToken}</code>
                          </span>
                        )}
                      </div>

                      <div className="p-2 rounded bg-[#12151c] font-mono text-[10px] text-white flex items-center justify-between">
                        <span className="truncate">
                          <strong>Formula:</strong> <code>{activeFinding.proofDetails?.mathematicalInvariant || 'Δ(s₁, s₂) > 0 ∧ Noise(s₀) = Clean'}</code>
                        </span>
                        <span className="text-text-muted text-[9px] flex-shrink-0 ml-2">
                          Oracle: {activeFinding.detectionMethod}
                        </span>
                      </div>

                      {activeFinding.proofDetails?.extractedProofSnippet && (
                        <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[10px] flex items-center gap-2 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate font-semibold">
                            Live Exfiltrated Proof: {activeFinding.proofDetails.extractedProofSnippet}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border-subtle/50">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const curl = BountyTemplateExporter.generateCurlCommand(activeFinding);
                              navigator.clipboard.writeText(curl);
                              addToast({ type: 'success', title: 'Copied Minimal Reproduction cURL PoC!' });
                            }}
                            className="px-2.5 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono flex items-center gap-1"
                          >
                            <Terminal className="w-3 h-3" /> Copy Reproduction cURL
                          </button>
                          <button
                            onClick={() => handleSendToRepeater(activeFinding.reproductionRequest, activeFinding.reproductionResponse, activeFinding.title)}
                            className="px-2.5 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-accent-cyan border border-accent-cyan/30 text-[10px] font-bold font-mono flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Send Proof to Repeater
                          </button>
                        </div>
                        <button
                          onClick={() => setActiveTab('vulnerabilities')}
                          className="text-text-muted hover:text-white text-[10px] font-mono flex items-center gap-1"
                        >
                          View Invariant Audit Matrix <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTable ? (
                  <>
                    {/* Header Detail Card */}
                    <div className="p-4 rounded-lg bg-bg-panel border border-border-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-mono uppercase text-text-muted tracking-wider">
                            SELECTED {selectedColumn ? 'COLUMN' : 'TABLE'}
                          </div>
                          <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                            {selectedTable.name}
                            {selectedColumn && <span className="text-accent-cyan">.{selectedColumn.name}</span>}
                          </h2>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedTable.isSensitive && (
                            <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> SENSITIVE OBJECT
                            </span>
                          )}
                          <span className="px-2 py-1 rounded bg-bg-panel-elevated border border-border-subtle font-mono text-xs text-text-secondary">
                            DBMS: {dbmsFingerprint.dbms}
                          </span>
                        </div>
                      </div>

                      {/* Detailed Column Metadata Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                        <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle">
                          <span className="text-text-muted text-[10px] block">DATA TYPE</span>
                          <span className="text-emerald-400 font-bold">{selectedColumn?.dataType || 'VARCHAR2'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle">
                          <span className="text-text-muted text-[10px] block">NULLABLE</span>
                          <span className="text-white font-bold">{selectedColumn?.isNullable ? 'YES' : 'NO'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle">
                          <span className="text-text-muted text-[10px] block">PRIMARY KEY</span>
                          <span className="text-white font-bold">{selectedColumn?.isPrimaryKey ? 'YES' : 'NO'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle">
                          <span className="text-text-muted text-[10px] block">INDEXED</span>
                          <span className="text-white font-bold">{selectedColumn?.isIndexed ? 'YES' : 'NO'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Discovered Columns Table */}
                    <div className="p-4 rounded-lg bg-bg-panel border border-border-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                          <Columns className="w-4 h-4 text-accent-cyan" /> Discovered Columns ({selectedTable.columns?.length || 0})
                        </h3>
                        {(!selectedTable.columns || selectedTable.columns.length === 0) && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => fetchColumnsForTable(selectedTable)}
                            disabled={selectedTable.status === 'enumerating_columns'}
                            className="font-bold text-xs"
                          >
                            {selectedTable.status === 'enumerating_columns' ? 'Fetching...' : 'ENUMERATE COLUMNS'}
                          </Button>
                        )}
                      </div>

                      {selectedTable.columns && selectedTable.columns.length > 0 ? (
                        <div className="divide-y divide-border-subtle border border-border-subtle rounded bg-[#12151c] overflow-hidden">
                          {selectedTable.columns.map((c) => (
                            <div
                              key={c.name}
                              onClick={() => setSelectedCatalogColumnName(c.name)}
                              onContextMenu={(e) => handleColumnContextMenu(e, selectedTable, c)}
                              className={`p-2 flex items-center justify-between cursor-pointer text-xs font-mono transition-colors ${
                                selectedCatalogColumnName === c.name ? 'bg-accent-cyan/20 text-white font-bold' : 'hover:bg-bg-panel-hover text-text-primary'
                              }`}
                              title="Right-click to Send to Repeater or Copy"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Columns className="w-3 h-3 text-blue-400" />
                                <span className="font-bold text-white">{c.name}</span>
                                <span className="text-[10px] text-text-muted">({c.dataType})</span>
                              </div>
                              {c.isSensitive && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950 text-rose-300 font-bold border border-rose-500/30">
                                  SENSITIVE
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-text-muted text-xs italic bg-[#12151c] rounded border border-border-subtle">
                          {selectedTable.status === 'enumerating_columns'
                            ? 'Querying columns from database...'
                            : 'No columns loaded yet. Click Enumerate Columns above.'}
                        </div>
                      )}
                    </div>

                    {/* LAB DATA INSPECTION / SAMPLE ROWS */}
                    <div className="p-4 rounded-lg bg-bg-panel border border-border-subtle space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-emerald-400" />
                          <h3 className="font-bold text-sm text-white flex items-center gap-2">
                            Table Data ({selectedTable.name})
                            {selectedTable.sampleRows && selectedTable.sampleRows.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                {selectedTable.sampleRows.length} Row(s) Exfiltrated Proof
                              </span>
                            )}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {selectedTable.sampleRows && selectedTable.sampleRows.length > 0 && (
                            <>
                              <button
                                onClick={() => copyCredentials(selectedTable.sampleRows!)}
                                className="px-2 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-bold flex items-center gap-1"
                                title="Copy user:pass credentials"
                              >
                                <Copy className="w-3 h-3 text-emerald-300" /> Copy Credentials
                              </button>
                              <button
                                onClick={() => copyRowsAsJson(selectedTable.sampleRows!)}
                                className="px-2 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-cyan-300 border border-cyan-500/30 text-[11px] font-mono font-bold flex items-center gap-1"
                                title="Copy all rows as formatted JSON"
                              >
                                <FileCode className="w-3 h-3 text-cyan-300" /> Copy JSON
                              </button>
                              <button
                                onClick={() => copyRowsAsCsv(selectedTable.sampleRows!)}
                                className="px-2 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center gap-1"
                                title="Copy all rows as CSV"
                              >
                                <FileText className="w-3 h-3 text-amber-300" /> Copy CSV
                              </button>
                            </>
                          )}
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => fetchSampleRowsForTable(selectedTable)}
                            disabled={selectedTable.sampleRowsStatus === 'loading'}
                            className="font-bold text-xs"
                          >
                            {selectedTable.sampleRowsStatus === 'loading' ? (
                              <span className="flex items-center gap-1.5">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Querying Rows...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <RefreshCw className="w-3 h-3" /> Refresh Data
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>

                      {selectedTable.sampleRowsStatus === 'loading' ? (
                        <div className="p-6 rounded bg-[#12151c] border border-border-subtle text-center text-amber-400 font-mono text-xs flex items-center justify-center gap-2 animate-pulse">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Querying live table values from target database...
                        </div>
                      ) : selectedTable.sampleRows && selectedTable.sampleRows.length > 0 ? (
                        <div className="overflow-x-auto border border-border-subtle rounded bg-[#12151c]">
                          <table className="w-full text-left font-mono text-xs">
                            <thead className="bg-bg-panel-elevated border-b border-border-subtle text-text-secondary">
                              <tr>
                                {Object.keys(selectedTable.sampleRows[0]).map((k) => (
                                  <th
                                    key={k}
                                    className={`p-2 font-bold ${
                                      selectedCatalogColumnName === k
                                        ? 'text-accent-cyan bg-accent-cyan/10'
                                        : 'text-white'
                                    }`}
                                  >
                                    {k}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                              {selectedTable.sampleRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-bg-panel-hover transition-colors">
                                  {Object.entries(row).map(([k, val], cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`p-2 ${
                                        selectedCatalogColumnName === k ? 'bg-accent-cyan/5 text-white font-medium' : 'text-text-primary'
                                      }`}
                                    >
                                      {val === '[REDACTED]' ? (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 font-bold text-[10px]">
                                          [REDACTED]
                                        </span>
                                      ) : val === 'NULL' || val === '[NULL]' ? (
                                        <span className="text-text-muted italic">NULL</span>
                                      ) : (
                                        val
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 rounded bg-[#12151c] border border-border-subtle flex items-center justify-between text-xs text-text-muted font-mono">
                          <span>No live rows retrieved yet for <strong>{selectedTable.name}</strong>.</span>
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => fetchSampleRowsForTable(selectedTable)}
                            className="font-bold text-xs"
                          >
                            Query Table Rows
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
                    <Database className="w-12 h-12 text-border-subtle mb-3" />
                    <p className="text-sm font-semibold text-text-secondary">No Database Object Selected</p>
                    <p className="text-xs text-text-muted max-w-sm mt-1">
                      Start the Deep SQL scan to automatically discover the live database schema, tables, and column metadata.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYLOAD ENGINE LOG */}
          {activeTab === 'logs' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Log List */}
              <div className="w-1/2 border-r border-border-subtle flex flex-col bg-bg-panel overflow-y-auto">
                <div className="h-8 px-3 border-b border-border-subtle bg-bg-panel-elevated flex items-center justify-between text-xs font-mono text-text-muted">
                  <span>TEST EXECUTION STREAM ({executionLogs.length})</span>
                  <button onClick={clearLogs} className="text-text-muted hover:text-white">Clear</button>
                </div>

                <div className="divide-y divide-border-subtle font-mono text-xs">
                  {executionLogs.length === 0 ? (
                    <div className="p-4 text-center text-text-muted italic">
                      No payload tests logged yet. Run a scan to monitor real-time execution.
                    </div>
                  ) : (
                    executionLogs.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedExecutionLogId(item.id)}
                        className={`p-2.5 cursor-pointer transition-colors ${
                          selectedExecutionLogId === item.id
                            ? 'bg-accent-cyan/20 text-white font-bold border-l-2 border-accent-cyan'
                            : 'hover:bg-bg-panel-hover text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            {item.status === 'positive' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <span className="text-text-muted font-mono text-[10px]">#{item.testIndex}</span>
                            )}
                            {item.technique}
                          </span>
                          <span className="text-[10px] text-text-muted">{item.durationMs}ms</span>
                        </div>
                        <div className="text-[11px] text-text-muted truncate mt-0.5">
                          Param: <strong>{item.parameterName}</strong> | Payload: <code className="text-emerald-400">{item.payload}</code>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Log Detail Inspector */}
              <div className="w-1/2 flex flex-col bg-[#0a0c10] overflow-y-auto p-4 space-y-3">
                {selectedExecutionLog ? (
                  <div className="space-y-3 font-mono text-xs">
                    {/* Header Card */}
                    <div className="p-3 rounded bg-bg-panel border border-border-subtle flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted text-[10px] block">TEST #{selectedExecutionLog.testIndex}</span>
                          {selectedExecutionLog.status === 'positive' ? (
                            <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-bold text-[9px] border border-rose-500/40">
                              VULNERABLE / POSITIVE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold text-[9px] border border-emerald-500/40">
                              PASSED / NEGATIVE
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{selectedExecutionLog.technique}</h4>
                        <p className="text-text-secondary text-[11px]">
                          Parameter: <strong className="text-white">{selectedExecutionLog.parameterName}</strong> ({selectedExecutionLog.context})
                        </p>
                      </div>

                      {/* Action: Send to Repeater */}
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() =>
                          handleSendToRepeater(
                            selectedExecutionLog.rawRequest,
                            selectedExecutionLog.rawResponse,
                            `SQL Probe #${selectedExecutionLog.testIndex} (${selectedExecutionLog.parameterName})`
                          )
                        }
                        className="font-bold flex items-center gap-1.5 flex-shrink-0 shadow-sm"
                      >
                        <Send className="w-3 h-3" /> Send to Repeater
                      </Button>
                    </div>

                    {/* Injected Payload */}
                    <div className="p-3 rounded bg-bg-panel border border-border-subtle space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted text-[10px] block uppercase font-semibold">INJECTED PAYLOAD</span>
                        <button
                          onClick={() => handleCopyToClipboard(selectedExecutionLog.payload, 'Payload Copied')}
                          className="text-[10px] text-accent-cyan hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-2.5 h-2.5" /> Copy
                        </button>
                      </div>
                      <pre className="p-2 rounded bg-[#12151c] border border-border-subtle text-emerald-400 overflow-x-auto whitespace-pre-wrap select-text">
                        {selectedExecutionLog.payload}
                      </pre>
                    </div>

                    {/* Evidence Identifier */}
                    {selectedExecutionLog.evidenceSnippet && (
                      <div className="p-3 rounded bg-rose-950/30 border border-rose-500/40 space-y-1">
                        <span className="text-rose-400 text-[10px] block uppercase font-semibold">EVIDENCE IDENTIFIER</span>
                        <p className="text-rose-200 font-bold leading-relaxed">{selectedExecutionLog.evidenceSnippet}</p>
                      </div>
                    )}

                    {/* HTTP Request & Response Sections */}
                    <div className="p-3 rounded bg-bg-panel border border-border-subtle space-y-3">
                      {/* HTTP Request */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-bold text-[11px] flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-accent-cyan" /> HTTP Request (Probe Wire)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyToClipboard(selectedExecutionLog.rawRequest, 'Request Copied')}
                              className="text-[10px] text-text-muted hover:text-white flex items-center gap-1"
                            >
                              <Copy className="w-2.5 h-2.5" /> Copy Request
                            </button>
                            <button
                              onClick={() =>
                                handleSendToRepeater(
                                  selectedExecutionLog.rawRequest,
                                  selectedExecutionLog.rawResponse,
                                  `SQL Probe #${selectedExecutionLog.testIndex}`
                                )
                              }
                              className="text-[10px] text-accent-cyan hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Send className="w-2.5 h-2.5" /> Repeater
                            </button>
                          </div>
                        </div>
                        <pre className="p-2.5 rounded bg-[#12151c] border border-border-subtle text-text-primary text-[11px] overflow-x-auto max-h-56 select-text whitespace-pre leading-relaxed font-mono">
                          {selectedExecutionLog.rawRequest || 'No raw request captured.'}
                        </pre>
                      </div>

                      {/* HTTP Response */}
                      <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-[11px] flex items-center gap-1.5">
                              <Eye className="w-3 h-3 text-emerald-400" /> HTTP Response
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#12151c] text-text-muted">
                              {selectedExecutionLog.durationMs}ms
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopyToClipboard(selectedExecutionLog.rawResponse, 'Response Copied')}
                            className="text-[10px] text-text-muted hover:text-white flex items-center gap-1"
                          >
                            <Copy className="w-2.5 h-2.5" /> Copy Response
                          </button>
                        </div>
                        <pre className="p-2.5 rounded bg-[#12151c] border border-border-subtle text-text-primary text-[11px] overflow-x-auto max-h-64 select-text whitespace-pre leading-relaxed font-mono">
                          {selectedExecutionLog.rawResponse || 'No raw response captured.'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-text-muted text-xs italic">
                    Select a test from the left to inspect raw network evidence and send to Repeater.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FINDINGS & VERIFIED PROOFS */}
          {(activeTab === 'vulnerabilities' || (activeTab as string) === 'causal') && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {/* 5-Step Invariant Verification Header Strip */}
              <div className="p-3.5 rounded-lg bg-bg-panel border border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent-cyan" />
                    <span className="font-bold text-xs text-white uppercase tracking-wider">
                      Formal Causal Invariant Proofs & Noise Control
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    findings.length > 0
                      ? 'bg-rose-950 text-rose-300 border border-rose-600'
                      : scanState === 'running'
                      ? 'bg-amber-950 text-amber-300 border border-amber-600 animate-pulse'
                      : 'bg-[#12151c] text-text-muted border border-border-subtle'
                  }`}>
                    {findings.length > 0 ? `${findings.length} Finding(s) Formally Proved` : scanState === 'running' ? 'Verification In Progress' : 'Ready (Zero False-Positive SMT)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  <div className={`p-2.5 rounded bg-[#12151c] border transition-all ${
                    executionLogs.length > 0 ? 'border-emerald-500/50' : 'border-border-subtle'
                  } space-y-0.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-accent-cyan font-bold text-[10px]">STEP 1: BASELINE</span>
                      {executionLogs.length > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="text-white font-bold text-[11px]">Control State (s₀)</div>
                    <div className="text-text-muted text-[10px] leading-tight">
                      {executionLogs.length > 0 ? 'Captured HTTP baseline' : 'Normal jitter & length baseline'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded bg-[#12151c] border transition-all ${
                    findings.length > 0 ? 'border-emerald-500/50' : 'border-border-subtle'
                  } space-y-0.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold text-[10px]">STEP 2: POSITIVE</span>
                      {findings.length > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="text-white font-bold text-[11px]">Truth Probe (s₁)</div>
                    <div className="text-text-muted text-[10px] leading-tight">
                      {findings.length > 0 ? 'Boolean truth verified' : 'AST syntax closure satisfied'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded bg-[#12151c] border transition-all ${
                    findings.length > 0 ? 'border-emerald-500/50' : 'border-border-subtle'
                  } space-y-0.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 font-bold text-[10px]">STEP 3: NEGATIVE</span>
                      {findings.length > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="text-white font-bold text-[11px]">Boundary Divergence</div>
                    <div className="text-text-muted text-[10px] leading-tight">
                      {findings.length > 0 ? 'Δ(s₁, s₂) confirmed' : 'Observes error/negation boundary'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded bg-[#12151c] border transition-all ${
                    executionLogs.length > 0 ? 'border-emerald-500/50' : 'border-border-subtle'
                  } space-y-0.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-bold text-[10px]">STEP 4: NOISE</span>
                      {executionLogs.length > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="text-white font-bold text-[11px]">Reflection Filter</div>
                    <div className="text-text-muted text-[10px] leading-tight">
                      Nonces & echo isolated (0 FP)
                    </div>
                  </div>

                  <div className={`p-2.5 rounded bg-[#12151c] border transition-all ${
                    findings.length > 0 ? 'border-purple-500/80 bg-purple-950/20' : 'border-border-subtle'
                  } space-y-0.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 font-bold text-[10px]">STEP 5: INVARIANT</span>
                      {findings.length > 0 && <CheckCircle2 className="w-3 h-3 text-purple-400" />}
                    </div>
                    <div className="text-white font-bold text-[11px]">Clean-Room Proof</div>
                    <div className="text-text-muted text-[10px] leading-tight">
                      {findings.length > 0 ? 'BLAKE3 CAS verified' : 'Deterministic reproduction'}
                    </div>
                  </div>
                </div>
              </div>

              {findings.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-xs italic bg-bg-panel rounded-lg border border-border-subtle">
                  No confirmed SQL vulnerabilities detected yet. Configure your target parameters on the left and click &quot;START SQL SCAN&quot;.
                </div>
              ) : (
                findings.map((f) => (
                  <div key={f.id} className="p-4 rounded-lg bg-bg-panel border border-rose-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-rose-300 font-mono flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" /> {f.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-xs font-bold border border-rose-800">
                          CRITICAL (100% CONFIDENCE)
                        </span>
                        <button
                          onClick={() => {
                            const h1 = BountyTemplateExporter.exportHackerOne(f, report || undefined);
                            navigator.clipboard.writeText(h1);
                            addToast({ type: 'success', title: 'Copied HackerOne Markdown Report!' });
                          }}
                          className="px-2 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-accent-cyan hover:text-white text-[11px] font-mono font-bold flex items-center gap-1 border border-border-subtle"
                          title="Copy 1-Click HackerOne Markdown Submission"
                        >
                          <FileCode className="w-3 h-3 text-accent-cyan" /> HackerOne
                        </button>
                        <button
                          onClick={() => {
                            const bc = BountyTemplateExporter.exportBugcrowd(f, report || undefined);
                            navigator.clipboard.writeText(bc);
                            addToast({ type: 'success', title: 'Copied Bugcrowd Markdown Report!' });
                          }}
                          className="px-2 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-amber-300 hover:text-white text-[11px] font-mono font-bold flex items-center gap-1 border border-border-subtle"
                          title="Copy 1-Click Bugcrowd Markdown Submission"
                        >
                          <FileText className="w-3 h-3 text-amber-300" /> Bugcrowd
                        </button>
                        <button
                          onClick={() => {
                            const curlCmd = BountyTemplateExporter.generateCurlCommand(f);
                            navigator.clipboard.writeText(curlCmd);
                            addToast({ type: 'success', title: 'Copied Minimal Safe cURL PoC!' });
                          }}
                          className="px-2 py-1 rounded bg-[#12151c] hover:bg-bg-panel text-emerald-300 hover:text-white text-[11px] font-mono font-bold flex items-center gap-1 border border-border-subtle"
                          title="Copy Safe Minimal cURL PoC"
                        >
                          <Terminal className="w-3 h-3 text-emerald-300" /> Copy cURL
                        </button>
                        {f.reproductionRequest && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleSendToRepeater(f.reproductionRequest, f.reproductionResponse, f.title)}
                            className="font-bold text-xs flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Send to Repeater
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* ─── VULNERABILITY CLASSIFICATION & CONSEQUENCE ANALYSIS ─── */}
                    <div className="p-3.5 rounded-lg bg-[#0a0c10] border border-border-subtle space-y-2.5 font-mono">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                          <span className="font-bold text-xs text-white uppercase tracking-wider">
                            VULNERABILITY TYPE & IMPACT ANALYSIS
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700">
                            {f.consequence?.threatBadge || '💥 CONFIRMED EXPLOITABLE'}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            Parameter: <strong className="text-accent-cyan">{f.parameterName}</strong> ({f.parameterLocation})
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-bold text-rose-300">
                          {f.consequence?.consequenceTitle || f.title}
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed font-sans">
                          {f.consequence?.consequenceSummary || f.remediation}
                        </p>
                      </div>

                      {f.consequence && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1 font-sans">
                          <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle space-y-1">
                            <span className="text-[10px] font-bold font-mono text-accent-cyan uppercase">⚡ Technical Exploit Impact:</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-text-secondary text-[11px]">
                              {f.consequence.technicalImpact.map((imp, i) => (
                                <li key={i}>{imp}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle space-y-1">
                            <span className="text-[10px] font-bold font-mono text-rose-400 uppercase">🚨 Real-World Business Risk:</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-text-secondary text-[11px]">
                              {f.consequence.businessRisk.map((risk, i) => (
                                <li key={i}>{risk}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Live Invariant & Extracted Data Proof */}
                      <div className="p-2.5 rounded bg-[#12151c] border border-border-subtle space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-accent-cyan flex items-center gap-1">
                            <Zap className="w-3 h-3 text-accent-cyan" /> Mathematical Invariant Proof:
                          </span>
                          {f.proofDetails?.cleanRoomVerificationToken && (
                            <span className="text-text-muted">
                              Token: <code className="text-purple-300">{f.proofDetails.cleanRoomVerificationToken}</code>
                            </span>
                          )}
                        </div>
                        <div className="text-white truncate">
                          <code>{f.proofDetails?.mathematicalInvariant || 'Δ(s₁, s₂) > 0 ∧ Noise(s₀) = Clean'}</code>
                        </div>
                        {f.proofDetails?.positiveProbeObservation && (
                          <div className="text-emerald-400">
                            <strong>Truth Probe (s₁):</strong> {f.proofDetails.positiveProbeObservation}
                          </div>
                        )}
                        {f.proofDetails?.negativeProbeDivergence && (
                          <div className="text-rose-400">
                            <strong>Contradiction Divergence (s₂):</strong> {f.proofDetails.negativeProbeDivergence}
                          </div>
                        )}
                        {f.proofDetails?.extractedProofSnippet && (
                          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[10px] flex items-center justify-between font-mono mt-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className="truncate">
                                <strong>Live Exfiltrated Proof:</strong> {f.proofDetails.extractedProofSnippet}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setActiveTab('database');
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-white font-bold text-[9px] flex items-center gap-1 flex-shrink-0 ml-2"
                            >
                              <Database className="w-3 h-3" /> Inspect in Explorer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed">{f.remediation}</p>

                    {/* 1-Click Verified Multi-Language Remediation Engine */}
                    <div className="space-y-2.5 pt-2 border-t border-border-subtle/60">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-accent-cyan flex items-center gap-1.5 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent-cyan" /> 🛡️ 1-Click Parameterized Code Remediation
                        </span>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                          {['all', 'Node.js / TypeScript', 'Python', 'Java', 'Go', '.NET / C#', 'PHP', 'Rust'].map((eco) => (
                            <button
                              key={eco}
                              onClick={() => setSelectedRemediationFramework(eco)}
                              className={`px-2 py-0.5 rounded transition-all ${
                                selectedRemediationFramework === eco
                                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 font-bold'
                                  : 'bg-[#12151c] text-text-muted hover:text-white border border-border-subtle'
                              }`}
                            >
                              {eco === 'all' ? 'All Frameworks (18)' : eco}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {OrmRemediationEngine.getRemediation(f.parameterName || 'input', dbmsFingerprint.dbms)
                          .filter((patch) => selectedRemediationFramework === 'all' || patch.ecosystem.includes(selectedRemediationFramework) || patch.frameworkName.includes(selectedRemediationFramework))
                          .map((patch, pIdx) => (
                            <div key={pIdx} className="p-3 rounded-lg bg-[#0a0c10] border border-border-subtle space-y-2 font-mono text-[11px]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white text-xs">{patch.frameworkName}</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-bg-panel text-text-muted border border-border-subtle">
                                    {patch.ecosystem}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {patch.docsUrl && (
                                    <a
                                      href={patch.docsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-text-muted hover:text-accent-cyan p-0.5"
                                      title="Official Documentation"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(patch.remediatedCode);
                                      addToast({ type: 'success', title: `Copied ${patch.frameworkName} secure code fix!` });
                                    }}
                                    className="px-2 py-0.5 rounded bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan font-semibold flex items-center gap-1 text-[10px] border border-accent-cyan/30"
                                  >
                                    <Copy className="w-2.5 h-2.5" /> Copy Secure Fix
                                  </button>
                                </div>
                              </div>

                              {/* Side-by-Side Vulnerable vs Secure Diff */}
                              <div className="space-y-1 bg-[#12151c] p-2 rounded border border-border-subtle">
                                <div className="text-[10px] text-rose-400 flex items-start gap-1 select-text">
                                  <span className="text-rose-500 font-bold flex-shrink-0">- VULN:</span>
                                  <code className="text-rose-300 break-all">{patch.vulnerablePattern}</code>
                                </div>
                                <div className="text-[10px] text-emerald-400 flex items-start gap-1 select-text pt-1 border-t border-border-subtle/50">
                                  <span className="text-emerald-500 font-bold flex-shrink-0">+ FIX:</span>
                                  <code className="text-emerald-300 font-bold break-all whitespace-pre-wrap">{patch.remediatedCode}</code>
                                </div>
                              </div>

                              <p className="text-[10px] text-text-muted leading-tight">
                                {patch.diffExplanation}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Side-by-Side Reproduction Wire Evidence */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-border-subtle/60 font-mono text-xs">
                      {f.reproductionRequest && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-text-muted uppercase font-semibold">REPRODUCTION REQUEST</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(f.reproductionRequest);
                                addToast({ type: 'success', title: 'Copied Reproduction Request' });
                              }}
                              className="text-accent-cyan hover:underline flex items-center gap-1 text-[10px]"
                            >
                              <Copy className="w-2.5 h-2.5" /> Copy
                            </button>
                          </div>
                          <pre className="p-2.5 rounded bg-[#0a0c10] border border-border-subtle text-cyan-200 overflow-x-auto text-[11px] max-h-48 whitespace-pre-wrap select-text">
                            {f.reproductionRequest}
                          </pre>
                        </div>
                      )}

                      {f.reproductionResponse ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-text-muted uppercase font-semibold">LEAKED EVIDENCE RESPONSE</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(f.reproductionResponse || '');
                                addToast({ type: 'success', title: 'Copied Evidence Response' });
                              }}
                              className="text-emerald-400 hover:underline flex items-center gap-1 text-[10px]"
                            >
                              <Copy className="w-2.5 h-2.5" /> Copy
                            </button>
                          </div>
                          <pre className="p-2.5 rounded bg-[#0a0c10] border border-border-subtle text-emerald-300 overflow-x-auto text-[11px] max-h-48 whitespace-pre-wrap select-text">
                            {f.reproductionResponse}
                          </pre>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[10px] text-text-muted uppercase font-semibold">EVIDENCE TOKENS</span>
                          <div className="p-2.5 rounded bg-[#0a0c10] border border-border-subtle text-emerald-300 text-[11px] max-h-48 overflow-y-auto space-y-1">
                            {f.evidence && f.evidence.length > 0 ? (
                              f.evidence.map((ev, eIdx) => (
                                <div key={eIdx} className="text-[10px]">
                                  • <span className="font-bold">{ev.injectionType}:</span> {ev.payload}
                                </div>
                              ))
                            ) : (
                              <span className="text-text-muted italic">Causal timing & boolean differential verified</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: FINAL REPORT */}
          {activeTab === 'report' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {report ? (
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Top Action Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-bg-panel border border-border-subtle">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white font-mono">
                        SQL Security Assessment & Verification Report
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          const sarif = SarifExporter.generateSarif(findings, targetConfig, progress);
                          const jsonStr = JSON.stringify(sarif, null, 2);
                          const blob = new Blob([jsonStr], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `sentinel-sqli-report-${Date.now()}.sarif`;
                          a.click();
                          URL.revokeObjectURL(url);
                          addToast({ type: 'success', title: 'Exported SARIF v2.1.0 Security Report' });
                        }}
                        className="font-mono text-xs flex items-center gap-1 text-cyan-300 border-cyan-500/40"
                      >
                        <Download className="w-3 h-3" /> Export SARIF (v2.1.0)
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          const html = SarifExporter.generateStandaloneHtmlReport(findings, targetConfig, scanVerdict);
                          const blob = new Blob([html], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `sentinel-sqli-assessment-${Date.now()}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                          addToast({ type: 'success', title: 'Exported Standalone Dark-Mode HTML Report' });
                        }}
                        className="font-mono text-xs flex items-center gap-1 text-emerald-300 border-emerald-500/40"
                      >
                        <FileCode className="w-3 h-3" /> Export Dark HTML Report
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          navigator.clipboard.writeText(report.technicalDetails);
                          addToast({ type: 'success', title: 'Copied Markdown Technical Report' });
                        }}
                        className="font-mono text-xs flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy Markdown
                      </Button>
                      {findings.length > 0 && (
                        <>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              const h1Reports = findings.map((f) => BountyTemplateExporter.exportHackerOne(f, report)).join('\n\n---\n\n');
                              navigator.clipboard.writeText(h1Reports);
                              addToast({ type: 'success', title: 'Copied HackerOne Markdown Submissions!' });
                            }}
                            className="font-mono text-xs flex items-center gap-1 text-accent-cyan border-accent-cyan/40"
                          >
                            <FileCode className="w-3 h-3 text-accent-cyan" /> HackerOne MD
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              const bcReports = findings.map((f) => BountyTemplateExporter.exportBugcrowd(f, report)).join('\n\n---\n\n');
                              navigator.clipboard.writeText(bcReports);
                              addToast({ type: 'success', title: 'Copied Bugcrowd Markdown Submissions!' });
                            }}
                            className="font-mono text-xs flex items-center gap-1 text-amber-300 border-amber-500/40"
                          >
                            <FileText className="w-3 h-3 text-amber-300" /> Bugcrowd MD
                          </Button>
                        </>
                      )}
                      {report.safetyCertificate && report.safetyCertificate.isSafe && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(report.safetyCertificate, null, 2));
                            addToast({ type: 'success', title: 'Copied Cryptographic Safety Certificate' });
                          }}
                          className="font-mono text-xs text-emerald-400 flex items-center gap-1 border-emerald-500/40"
                        >
                          <Shield className="w-3 h-3 text-emerald-400" /> Copy Safety Certificate
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* FORMAL SAFETY CERTIFICATE CARD (Negative Evidence) */}
                  {report.safetyCertificate && report.safetyCertificate.isSafe && (
                    <div className="p-5 rounded-lg bg-emerald-950/20 border border-emerald-500/60 shadow-lg space-y-3 font-mono">
                      <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <Shield className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-emerald-300 flex items-center gap-2">
                              FORMAL SAFETY CERTIFICATE: TARGET IMMUNITY VERIFIED
                            </h4>
                            <p className="text-emerald-400/80 text-[11px]">
                              Mathematical proof of zero relational control & absolute AST boundary confinement
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-emerald-900/60 text-emerald-300 text-xs font-bold border border-emerald-500/50">
                          100% IMMUNE
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-text-secondary pt-1">
                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>Target: <strong className="text-white">{report.targetUrl}</strong></span>
                          <span>Verified Proofs: <strong className="text-emerald-400">{report.safetyCertificate.proofs.length} Invariants</strong></span>
                        </div>
                      </div>

                      {/* Proofs Table */}
                      <div className="overflow-x-auto border border-emerald-500/30 rounded bg-[#0a0c10]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-emerald-950/40 border-b border-emerald-500/30 text-emerald-300 font-semibold text-[11px]">
                            <tr>
                              <th className="p-2">Immunity Invariant Theorem</th>
                              <th className="p-2">Certainty</th>
                              <th className="p-2">Evidence Basis</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-900/30 text-[11px]">
                            {report.safetyCertificate.proofs.map((p: any, idx: number) => (
                              <tr key={idx} className="hover:bg-emerald-950/20">
                                <td className="p-2 text-white font-bold">{p.reason}</td>
                                <td className="p-2 text-emerald-400 font-bold">{(p.confidence * 100).toFixed(0)}%</td>
                                <td className="p-2 text-text-muted font-mono">{p.evidenceLogs ? p.evidenceLogs.join(' ') : 'Verified'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Technical Markdown View */}
                  <div className="p-6 rounded-lg bg-bg-panel border border-border-subtle font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                    {report.technicalDetails}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-text-muted text-xs italic">
                  Run a scan to generate a report.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. AUTHORIZATION MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full p-5 rounded-lg bg-bg-panel border border-accent-cyan shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Shield className="w-4 h-4" /> AUTHORIZED TESTING CONFIRMATION
            </div>
            <p className="text-text-secondary leading-relaxed">
              You are about to launch active SQL injection vulnerability testing against:
            </p>
            <div className="p-2 rounded bg-[#12151c] border border-border-subtle text-white font-bold truncate">
              {targetConfig.url}
            </div>
            <p className="text-text-muted text-[11px]">
              Confirm that you have explicit authorization or are testing inside an authorized educational lab (such as PortSwigger Web Security Academy).
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAuthModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmAuthAndStart} className="font-bold">
                I Am Authorized — Start Deep Scan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONTEXT MENU */}
      <ContextMenu
        isOpen={contextMenuState.isOpen}
        x={contextMenuState.x}
        y={contextMenuState.y}
        items={contextMenuState.items}
        onClose={() => setContextMenuState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
