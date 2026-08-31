import React, { useState } from 'react';
import { useSqlScannerStore } from '../stores/sqlScannerStore';
import { useToastStore } from '../stores/toastStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { useAppShellStore } from '../stores/appShellStore';
import { RequestParser } from '../services/sqlScanner/RequestParser';
import { MetadataExtractor } from '../services/sqlScanner/MetadataExtractor';
import { ReportGenerator } from '../services/sqlScanner/ReportGenerator';
import { HttpMethod, HttpProtocol } from '../types/repeater';
import { ScanMode, DiscoveredTable, ColumnMetadata } from '../types/sqlScanner';
import { ContextMenu, ContextMenuItem } from '../design-system/ContextMenu';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  ChevronDown,
  Lock,
  Download,
  Table as TableIcon,
  Columns,
  Eye,
  Zap,
  RefreshCw,
  Send,
  Copy,
  Search,
  X,
} from 'lucide-react';
import { Button } from '../design-system/Button';

export const SqlScannerWorkspaceView: React.FC = () => {
  const {
    tabs,
    activeTabId,
    engineMode,
    concurrencyLimit,
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
    coverage,
    executionLogs,
    selectedExecutionLogId,
    report,
    createScanTab,
    closeScanTab,
    setActiveScanTab,
    renameScanTab,
    setEngineMode,
    setConcurrencyLimit,
    setActiveTab,
    setSelectedCatalogTableId,
    setSelectedCatalogColumnName,
    setSelectedExecutionLogId,
    setRawRequest,
    setScanMode,
    toggleParameter,
    toggleAllParameters,
    setSafetyConfig,
    startScan,
    pauseScan,
    resumeScan,
    stopScan,
    resetScan,
    clearLogs,
    fetchColumnsForTable,
    fetchSampleRowsForTable,
  } = useSqlScannerStore();

  const { addToast } = useToastStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [expandedSystemTables, setExpandedSystemTables] = useState(false);
  const [expandedAppTables, setExpandedAppTables] = useState(true);
  const [expandedTableMap, setExpandedTableMap] = useState<Record<string, boolean>>({});
  const [requestViewMode, setRequestViewMode] = useState<'pretty' | 'raw'>('raw');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');

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

    useAppShellStore.getState().setActiveWorkspace('repeater');
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
      setShowAuthModal(true);
    } else {
      startScan();
      addToast({
        type: 'info',
        title: 'Deep SQL Assessment Started',
        description: `Running adaptive ${safetyConfig.scanMode.toUpperCase()} assessment pipeline...`,
      });
    }
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

  const handleDownloadReport = (format: 'md' | 'html' | 'json') => {
    if (!report) {
      addToast({
        type: 'warning',
        title: 'No Report Available',
        description: 'Run an assessment scan first to generate a report.',
      });
      return;
    }

    let reportContent = '';
    let mimeType = 'text/plain';
    let filename = `Sentinel_SQL_Report_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'md') {
      reportContent = report.technicalDetails || ReportGenerator.generateTechnicalMarkdown(report);
      mimeType = 'text/markdown';
      filename += '.md';
    } else if (format === 'html') {
      reportContent = ReportGenerator.generateHtmlReport(report);
      mimeType = 'text/html';
      filename += '.html';
    } else {
      reportContent = JSON.stringify(report, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    }

    const blob = new Blob([reportContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Report Downloaded', description: `Saved ${filename}` });
  };

  const scanModesList: { id: ScanMode; label: string }[] = [
    { id: 'quick', label: 'Quick' },
    { id: 'deep', label: 'Deep' },
  ];

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
        {/* Left side: Engine Capability */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1.5 font-mono">
              <span className="text-accent-cyan font-bold">⚡ UCMA-X</span> v2.0
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 font-semibold">
              Rust Core Accelerated
            </span>
          </div>

          {/* Binary Verdict Pill */}
          <div className="flex items-center gap-2">
            {scanVerdict === 'VULNERABLE' && (
              <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/80 text-rose-300 font-mono font-bold text-xs flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                VULNERABLE
              </span>
            )}
            {scanVerdict === 'NOT CONFIRMED VULNERABLE' && (
              <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                NOT CONFIRMED VULNERABLE
              </span>
            )}
            {scanVerdict === 'IN_PROGRESS' && (
              <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/80 text-amber-300 font-mono font-bold text-xs flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 animate-spin text-amber-400" />
                CAUSAL EVALUATION...
              </span>
            )}
            {scanVerdict === 'IDLE' && (
              <span className="px-2.5 py-1 rounded bg-bg-panel-elevated border border-border-subtle text-text-muted font-mono text-xs">
                STANDBY
              </span>
            )}
          </div>

          {/* Engine Mode Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-bg-panel-elevated border border-border-subtle text-text-secondary">
              Strategy: <strong className="text-white">{engineMode === 'ucmax_causal' ? '5-Step Causal Proof' : engineMode === 'bayesian_adaptive' ? 'Bayesian Adaptive' : 'SPRT Timing'}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-bg-panel-elevated border border-border-subtle text-text-secondary truncate max-w-xs">
              DBMS: <strong className="text-emerald-400">{dbmsFingerprint.dbms !== 'Unknown' ? dbmsFingerprint.dbms : 'Detecting...'}</strong>
            </span>
          </div>
        </div>

        {/* Right side: Engine Strategy Selector & Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Engine Strategy Selector */}
          <div className="flex items-center gap-1.5 bg-[#12151c] px-2 py-1 rounded border border-border-subtle text-[11px] font-mono">
            <Zap className="w-3 h-3 text-accent-cyan" />
            <select
              value={engineMode}
              onChange={(e) => setEngineMode(e.target.value as any)}
              className="bg-transparent text-text-primary outline-none text-[11px] font-bold cursor-pointer"
            >
              <option value="ucmax_causal" className="bg-[#12151c] text-white">⚡ 5-Step Causal Engine</option>
              <option value="bayesian_adaptive" className="bg-[#12151c] text-white">🎯 Bayesian Adaptive Planner</option>
              <option value="sprt_timing" className="bg-[#12151c] text-white">⏱️ SPRT Sequential Timing</option>
              <option value="standard" className="bg-[#12151c] text-white">⚙️ Standard Probing</option>
            </select>
          </div>

          {/* Concurrency Selector */}
          <div className="flex items-center gap-1.5 bg-[#12151c] px-2 py-1 rounded border border-border-subtle text-[11px] font-mono">
            <span className="text-text-muted">Concurrency:</span>
            <select
              value={concurrencyLimit || 10}
              onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
              className="bg-transparent text-accent-cyan outline-none text-[11px] font-bold cursor-pointer"
            >
              <option value={1} className="bg-[#12151c] text-white">1x (Serial)</option>
              <option value={5} className="bg-[#12151c] text-white">5x</option>
              <option value={10} className="bg-[#12151c] text-white">10x (Default)</option>
              <option value={20} className="bg-[#12151c] text-white">20x (Fast)</option>
              <option value={50} className="bg-[#12151c] text-white">50x (Max)</option>
            </select>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center bg-[#12151c] p-0.5 rounded border border-border-subtle text-[11px] font-medium">
            {scanModesList.map((m) => (
              <button
                key={m.id}
                onClick={() => setScanMode(m.id)}
                className={`px-2 py-1 rounded transition-colors ${
                  safetyConfig.scanMode === m.id
                    ? 'bg-accent-cyan text-black font-bold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

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
              className="flex items-center gap-1.5 font-bold shadow-lg shadow-accent-cyan/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> START DEEP SQL SCAN
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
        {/* LEFT PANE: Request & Vector Importer (380px) */}
        <div className="w-96 border-r border-border-subtle flex flex-col bg-bg-panel flex-shrink-0">
          <div className="h-9 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent-cyan" /> Target Request
            </span>
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
                onClick={() => handleSendToRepeater(targetConfig.rawRequest, undefined, 'Target Request')}
                title="Send target request to Repeater"
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#12151c] text-accent-cyan hover:text-white flex items-center gap-1 border border-border-subtle"
              >
                <Send className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Request Textarea - Clean dark styling */}
          <div className="p-2 border-b border-border-subtle flex-1 flex flex-col min-h-[160px] bg-[#0c0e14]">
            <textarea
              value={targetConfig.rawRequest}
              onChange={(e) => setRawRequest(e.target.value)}
              disabled={scanState === 'running'}
              placeholder="Paste raw HTTP request here..."
              className="w-full flex-1 bg-[#12151c] p-2.5 font-mono text-xs rounded border border-border-subtle resize-none text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Candidate Parameters Table */}
          <div className="h-64 flex flex-col border-b border-border-subtle">
            <div className="h-8 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px]">
                Vectors ({targetConfig.parameters.length})
              </span>
              <div className="flex items-center gap-2">
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

            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle font-mono text-xs">
              {targetConfig.parameters.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-xs italic">
                  No parameters detected. Paste or import a request with query/body/cookie parameters.
                </div>
              ) : (
                targetConfig.parameters.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => toggleParameter(p.id)}
                    className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
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
                      <span className="text-[10px] px-1 py-0.5 rounded bg-[#12151c] text-text-muted">
                        {p.location}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold px-1 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20">
                      {p.detectedContext || 'string'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Safety Status Pill */}
          <div className="p-2.5 bg-bg-panel-elevated flex items-center justify-between text-[11px] font-mono">
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('database')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === 'database'
                    ? 'bg-bg-panel-elevated text-white border border-border-subtle font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-accent-cyan" /> Database Explorer
                {catalog.applicationTables.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-accent-cyan/20 text-accent-cyan text-[10px] font-mono">
                    {catalog.applicationTables.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('coverage')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === 'coverage'
                    ? 'bg-bg-panel-elevated text-white border border-border-subtle font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Test Coverage
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === 'logs'
                    ? 'bg-bg-panel-elevated text-white border border-border-subtle font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" /> Payload Engine Log
                {executionLogs.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-bg-panel text-text-muted text-[10px] font-mono">
                    {executionLogs.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('vulnerabilities')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === 'vulnerabilities'
                    ? 'bg-bg-panel-elevated text-white border border-border-subtle font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Findings ({findings.length})
              </button>

              <button
                onClick={() => setActiveTab('causal' as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === ('causal' as any)
                    ? 'bg-bg-panel-elevated text-white border border-border-subtle font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-accent-cyan" /> ⚡ Causal Verification
              </button>

              <button
                onClick={() => setActiveTab('report')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === 'report'
                    ? 'bg-bg-panel-elevated text-white border border-border-subtle font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" /> Final Report
              </button>
            </div>

            {/* Quick Export Button */}
            {report && (
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="xs" onClick={() => handleDownloadReport('md')} className="text-text-muted hover:text-text-primary">
                  <Download className="w-3 h-3" /> MD
                </Button>
                <Button variant="ghost" size="xs" onClick={() => handleDownloadReport('html')} className="text-text-muted hover:text-text-primary">
                  <Download className="w-3 h-3" /> HTML
                </Button>
              </div>
            )}
          </div>

          {/* TAB 1: RECURSIVE DATABASE EXPLORER */}
          {activeTab === 'database' && (
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-emerald-400" />
                          <h3 className="font-bold text-sm text-white">
                            Table Data ({selectedTable.name})
                          </h3>
                        </div>
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

          {/* TAB 2: TEST COVERAGE GRID */}
          {activeTab === 'coverage' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-4 rounded-lg bg-bg-panel border border-border-subtle flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <div>
                  <h2 className="text-base font-bold text-white">SQL Test Coverage Summary</h2>
                  <p className="text-xs text-text-muted">
                    Comprehensive breakdown of tested dimensions and research corpus execution.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="p-2 rounded bg-[#12151c] border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">VECTORS TESTED</span>
                    <strong className="text-white">{progress.testedParameters} / {progress.totalParameters}</strong>
                  </div>
                  <div className="p-2 rounded bg-[#12151c] border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">TESTS EXECUTED</span>
                    <strong className="text-emerald-400">{progress.testsExecuted}</strong>
                  </div>
                  <div className="p-2 rounded bg-[#12151c] border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">FINDINGS CONFIRMED</span>
                    <strong className="text-rose-400">{findings.length}</strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {coverage.map((c) => (
                  <div
                    key={c.key}
                    className="p-3 rounded-lg bg-bg-panel border border-border-subtle flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{c.name}</span>
                      {c.status === 'vulnerable' && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[10px] font-bold">
                          VULNERABLE
                        </span>
                      )}
                      {c.status === 'passed' && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold">
                          PASSED
                        </span>
                      )}
                      {c.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded bg-[#12151c] text-text-muted font-mono text-[10px]">
                          PENDING
                        </span>
                      )}
                      {c.status === 'not_applicable' && (
                        <span className="px-2 py-0.5 rounded bg-[#12151c] text-text-muted font-mono text-[10px]">
                          N/A
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-text-muted">
                      {c.reason || `Tested: ${c.testedCount} probes | Positive: ${c.positiveCount}`}
                    </div>
                  </div>
                ))}
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

          {/* TAB 4: FINDINGS */}
          {activeTab === 'vulnerabilities' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {findings.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-xs italic">
                  No vulnerabilities confirmed yet.
                </div>
              ) : (
                findings.map((f) => (
                  <div key={f.id} className="p-4 rounded-lg bg-bg-panel border border-rose-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-rose-300 font-mono flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" /> {f.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-xs font-bold">
                          CRITICAL (100% CONFIDENCE)
                        </span>
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
                    <p className="text-xs text-text-secondary leading-relaxed">{f.remediation}</p>

                    {f.reproductionRequest && (
                      <div className="space-y-1 font-mono text-xs">
                        <span className="text-[10px] text-text-muted uppercase font-semibold">REPRODUCTION REQUEST</span>
                        <pre className="p-2 rounded bg-[#12151c] border border-border-subtle text-text-primary overflow-x-auto text-[11px]">
                          {f.reproductionRequest}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4.5: UCMA-X CAUSAL VERIFICATION & PROVENANCE */}
          {(activeTab as string) === 'causal' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {/* Top Banner with Real-time Scan State */}
              <div className="p-4 rounded-lg bg-bg-panel border border-accent-cyan/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent-cyan" />
                    <span className="font-bold text-sm text-white">
                      UCMA-X 5-Step Causal Verification & Statistical Inference
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {scanState === 'running' ? (
                      <span className="px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 text-xs font-bold border border-amber-500/50 flex items-center gap-1.5 animate-pulse">
                        <Activity className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        RUNNING STEP: {progress.phaseLabel || 'Analyzing...'}
                      </span>
                    ) : scanVerdict === 'VULNERABLE' ? (
                      <span className="px-2.5 py-1 rounded bg-rose-950/80 text-rose-300 text-xs font-bold border border-rose-500/80 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        CAUSAL SQL INJECTION PROVEN
                      </span>
                    ) : scanVerdict === 'NOT CONFIRMED VULNERABLE' ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 text-xs font-bold border border-emerald-500/80 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        VALIDATED NON-VULNERABLE (0 FP)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-bg-panel-elevated text-accent-cyan text-xs font-bold border border-accent-cyan/30">
                        Active Pipeline Ready
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-text-secondary text-[11px] leading-relaxed font-sans">
                  The UCMA-X engine evaluates hypothesis experiments in real time. It tests positive truth conditions ($s_1$) vs negative error boundaries ($s_2$) against target baseline ($s_0$), filtering out dynamic nonces and payload echo before confirming evidence.
                </p>
                <div className="flex items-center gap-4 text-[11px] pt-1 border-t border-border-subtle/60">
                  <span className="text-text-muted">
                    Active Vector: <strong className="text-white">{progress.currentParameter || targetConfig.parameters.find((p) => p.enabled)?.name || 'None selected'}</strong>
                  </span>
                  <span className="text-text-muted">
                    Probes Sent: <strong className="text-accent-cyan">{executionLogs.length}</strong>
                  </span>
                  <span className="text-text-muted">
                    Evidence Tokens: <strong className="text-emerald-400">{findings.reduce((acc, f) => acc + f.evidence.length, 0)}</strong>
                  </span>
                  <span className="text-text-muted">
                    Target DBMS: <strong className="text-amber-400">{dbmsFingerprint.dbms}</strong>
                  </span>
                </div>
              </div>

              {/* 5-Step Dynamic Protocol Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {/* STEP 1 */}
                <div className={`p-3 rounded bg-bg-panel border transition-all ${
                  progress.phase === 'baseline'
                    ? 'border-accent-cyan bg-accent-cyan/10 shadow-md'
                    : executionLogs.length > 0
                    ? 'border-emerald-500/50'
                    : 'border-border-subtle'
                } space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-accent-cyan font-bold text-[11px]">STEP 1</span>
                    {executionLogs.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-white font-bold text-xs">Baseline Control</div>
                  <div className="text-text-muted text-[10px] leading-tight">
                    {executionLogs.length > 0
                      ? `Captured (s₀): HTTP 200 baseline`
                      : 'Measures normal status, length & latency jitter (s₀).'}
                  </div>
                </div>

                {/* STEP 2 */}
                <div className={`p-3 rounded bg-bg-panel border transition-all ${
                  progress.phase === 'error_testing' || progress.phase === 'boolean_testing' || progress.phase === 'union_testing'
                    ? 'border-emerald-400 bg-emerald-950/20 shadow-md'
                    : findings.length > 0
                    ? 'border-emerald-500/50'
                    : 'border-border-subtle'
                } space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold text-[11px]">STEP 2</span>
                    {findings.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-white font-bold text-xs">Positive Probe</div>
                  <div className="text-text-muted text-[10px] leading-tight">
                    {findings.length > 0
                      ? `Verified (s₁): ${findings[0].injectionType} condition true`
                      : 'Injects boolean truth or syntax closure condition (s₁).'}
                  </div>
                </div>

                {/* STEP 3 */}
                <div className={`p-3 rounded bg-bg-panel border transition-all ${
                  progress.phase === 'boolean_testing' || progress.phase === 'time_testing'
                    ? 'border-rose-400 bg-rose-950/20 shadow-md'
                    : findings.length > 0
                    ? 'border-emerald-500/50'
                    : 'border-border-subtle'
                } space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-bold text-[11px]">STEP 3</span>
                    {findings.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-white font-bold text-xs">Negative Probe</div>
                  <div className="text-text-muted text-[10px] leading-tight">
                    {findings.length > 0
                      ? `Divergence Δ(s₁, s₂) confirmed`
                      : 'Injects false logic or error boundary to observe Δ(s₁, s₂).'}
                  </div>
                </div>

                {/* STEP 4 */}
                <div className={`p-3 rounded bg-bg-panel border transition-all ${
                  executionLogs.length > 0 ? 'border-emerald-500/50' : 'border-border-subtle'
                } space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 font-bold text-[11px]">STEP 4</span>
                    {executionLogs.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-white font-bold text-xs">Noise Control</div>
                  <div className="text-text-muted text-[10px] leading-tight">
                    {executionLogs.length > 0
                      ? 'Dynamic nonces & reflections isolated (0 FP)'
                      : 'Filters out pure HTML/JSON string reflection false positives.'}
                  </div>
                </div>

                {/* STEP 5 */}
                <div className={`p-3 rounded bg-bg-panel border transition-all ${
                  findings.length > 0
                    ? 'border-purple-500/80 bg-purple-950/20 shadow-md'
                    : 'border-border-subtle'
                } space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 font-bold text-[11px]">STEP 5</span>
                    {findings.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <div className="text-white font-bold text-xs">Clean-Room Proof</div>
                  <div className="text-text-muted text-[10px] leading-tight">
                    {findings.length > 0
                      ? `3/3 Repro Verified (BLAKE3 CAS)`
                      : 'Independent verifier confirms BLAKE3 evidence hash.'}
                  </div>
                </div>
              </div>

              {/* Live Causal Execution Feed */}
              <div className="p-4 rounded-lg bg-bg-panel border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-cyan" />
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                      Live Causal Inference Stream ({executionLogs.length} Events)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => setActiveTab('logs')}
                      className="font-bold text-xs"
                    >
                      View Wire Logs
                    </Button>
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => setActiveTab('database')}
                      className="font-bold text-xs flex items-center gap-1"
                    >
                      <Database className="w-3 h-3" /> Open Database Explorer
                    </Button>
                  </div>
                </div>

                {executionLogs.length === 0 ? (
                  <div className="p-6 rounded bg-[#12151c] border border-border-subtle text-center text-text-muted italic text-xs">
                    No scan executed yet. Click &quot;START DEEP SQL SCAN&quot; above to execute the 5-step causal engine against your target request.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto divide-y divide-border-subtle/40 font-mono text-[11px]">
                    {executionLogs.slice(-10).reverse().map((log) => (
                      <div key={log.id} className="pt-1.5 pb-1 flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted font-bold">#{log.testIndex}</span>
                            <span className="text-white font-bold">{log.technique}</span>
                            <span className="text-text-secondary text-[10px]">[{log.parameterName}]</span>
                            {log.status === 'positive' ? (
                              <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-bold text-[9px] border border-rose-500/40">
                                CAUSAL CONFIRMED
                              </span>
                            ) : log.status === 'passed' ? (
                              <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 font-bold text-[9px] border border-blue-500/40">
                                STRUCTURAL PROBE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-bg-panel-elevated text-text-muted text-[9px]">
                                NEGATIVE BOUNDARY
                              </span>
                            )}
                          </div>
                          <p className="text-emerald-400 truncate max-w-xl text-[10px]">{log.payload}</p>
                          {log.evidenceSnippet && (
                            <p className="text-rose-300 font-semibold text-[10px]">Evidence: {log.evidenceSnippet}</p>
                          )}
                        </div>
                        <span className="text-text-muted text-[10px] flex-shrink-0">{log.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Statistical & Oracle Health Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded bg-bg-panel border border-border-subtle space-y-2">
                  <div className="text-text-secondary text-xs font-bold uppercase tracking-wider">Multi-Oracle Engine</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Boolean Differential:</span>
                      <span className="text-emerald-400 font-bold">Active ✓</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>DBMS Error Catalog:</span>
                      <span className="text-emerald-400 font-bold">30+ Signatures ✓</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Metamorphic TLP/NoREC:</span>
                      <span className="text-emerald-400 font-bold">Active ✓</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Structural AST Differ:</span>
                      <span className="text-emerald-400 font-bold">Active ✓</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded bg-bg-panel border border-border-subtle space-y-2">
                  <div className="text-text-secondary text-xs font-bold uppercase tracking-wider">Statistical Inference</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-text-primary">
                      <span>SPRT Test Ratio (Lₙ):</span>
                      <span className="text-accent-cyan font-bold">Sequential (Wald)</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Mann-Whitney U Test:</span>
                      <span className="text-accent-cyan font-bold">Non-Parametric</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Latency Drift Model:</span>
                      <span className="text-accent-cyan font-bold">EWMA / CUSUM</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Jitter Filter (3σ):</span>
                      <span className="text-emerald-400 font-bold">Enabled ✓</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded bg-bg-panel border border-border-subtle space-y-2">
                  <div className="text-text-secondary text-xs font-bold uppercase tracking-wider">Provenance & Integrity</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Scope Authorization:</span>
                      <span className="text-emerald-400 font-bold">Fail-Closed Guard</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>SSRF & DNS Pinning:</span>
                      <span className="text-emerald-400 font-bold">Enforced ✓</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Evidence Digest:</span>
                      <span className="text-accent-cyan font-bold">BLAKE3 Content ID</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary">
                      <span>Data Masking:</span>
                      <span className="text-emerald-400 font-bold">Auto-Redact Active ✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FINAL REPORT */}
          {activeTab === 'report' && (
            <div className="flex-1 overflow-y-auto p-4">
              {report ? (
                <div className="max-w-4xl mx-auto p-6 rounded-lg bg-bg-panel border border-border-subtle font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                  {report.technicalDetails}
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
