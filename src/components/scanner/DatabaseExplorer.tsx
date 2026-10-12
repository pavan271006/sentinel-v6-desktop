import React, { useState } from 'react';
import {
  Database,
  Table,
  Columns,
  Key,
  Lock,
  Mail,
  Star,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Server,
  Layers,
  Sparkles,
  CheckCircle2,
  Circle,
  Hash,
} from 'lucide-react';

export interface ExtractedColumn {
  name: string;
  dataType?: string;
  isSensitive: boolean;
  values: string[];
}

export interface ExtractedTable {
  name: string;
  columns: ExtractedColumn[];
  rowCount?: number;
  isSensitive: boolean;
}

export interface DatabaseDiscovery {
  dbmsType: string;
  dbmsVersion?: string;
  columnCount?: number;
  renderColumn?: number;
  tables: ExtractedTable[];
  status: 'detecting' | 'fingerprinting' | 'enumerating' | 'extracting' | 'complete' | 'idle';
}

export interface DatabaseExplorerProps {
  discovery: DatabaseDiscovery;
}

const THEME = {
  bg: '#0a0d16',
  surface: '#111827',
  surfaceAlt: '#1a2234',
  border: '#1e293b',
  borderLight: '#334155',
  text: '#e2e8f0',
  textMuted: '#64748b',
  accent: '#00ffff',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  purple: '#a855f7',
};

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({ discovery }) => {
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  // Status configuration mapping
  const getStatusConfig = (status: DatabaseDiscovery['status']) => {
    switch (status) {
      case 'detecting':
        return {
          label: 'Detecting DBMS',
          color: THEME.accent,
          icon: <Loader2 size={13} style={{ animation: 'dbSpin 1s linear infinite' }} />,
          isPulsing: true,
        };
      case 'fingerprinting':
        return {
          label: 'Fingerprinting Version',
          color: THEME.accent,
          icon: <Sparkles size={13} style={{ animation: 'dbSpin 2s linear infinite' }} />,
          isPulsing: true,
        };
      case 'enumerating':
        return {
          label: 'Enumerating Schema',
          color: THEME.warning,
          icon: <Loader2 size={13} style={{ animation: 'dbSpin 1s linear infinite' }} />,
          isPulsing: true,
        };
      case 'extracting':
        return {
          label: 'Extracting Data',
          color: THEME.purple,
          icon: <Loader2 size={13} style={{ animation: 'dbSpin 1s linear infinite' }} />,
          isPulsing: true,
        };
      case 'complete':
        return {
          label: 'Scan Complete',
          color: THEME.success,
          icon: <CheckCircle2 size={13} />,
          isPulsing: false,
        };
      case 'idle':
      default:
        return {
          label: 'Idle',
          color: THEME.textMuted,
          icon: <Circle size={9} fill={THEME.textMuted} />,
          isPulsing: false,
        };
    }
  };

  const statusConfig = getStatusConfig(discovery?.status || 'idle');

  // Table expansion toggles
  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: prev[tableName] === undefined ? false : !prev[tableName],
    }));
  };

  const isTableExpanded = (tableName: string) => {
    // Default open on initial discovery
    return expandedTables[tableName] !== false;
  };

  // Sensitivity heuristics
  const isTableSensitive = (table: ExtractedTable) => {
    if (table.isSensitive) return true;
    return /user|account|admin|credential|auth|secret|login|member/i.test(table.name);
  };

  const isColumnSensitive = (col: ExtractedColumn) => {
    if (col.isSensitive) return true;
    return /password|pass|secret|token|api_key|apikey|hash|auth|credit|ssn|priv/i.test(col.name);
  };

  // Column icon determination
  const getColumnIcon = (col: ExtractedColumn) => {
    const nameLower = col.name.toLowerCase();
    if (isColumnSensitive(col)) {
      return <Lock size={12} color={THEME.error} style={{ flexShrink: 0 }} />;
    }
    if (nameLower.includes('mail')) {
      return <Mail size={12} color={THEME.textMuted} style={{ flexShrink: 0 }} />;
    }
    if (nameLower.includes('user') || nameLower.includes('name') || nameLower.includes('key') || nameLower.includes('id')) {
      return <Key size={12} color={THEME.warning} style={{ flexShrink: 0 }} />;
    }
    if (nameLower.includes('num') || nameLower.includes('count') || nameLower.includes('amount')) {
      return <Hash size={12} color={THEME.textMuted} style={{ flexShrink: 0 }} />;
    }
    return <Columns size={12} color={THEME.textMuted} style={{ flexShrink: 0 }} />;
  };

  // Export JSON handler
  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(discovery, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(dataStr);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = dataStr;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback prevention
    }
  };

  const tables = discovery?.tables || [];
  const isEmpty = (discovery?.status === 'idle' || !discovery?.status) && tables.length === 0;

  return (
    <div style={{ backgroundColor: THEME.bg, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: '8px', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', fontSize: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes dbPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.75); } }
        @keyframes dbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* 1. Header Section */}
      <div style={{ padding: '10px 14px', backgroundColor: THEME.surface, borderBottom: `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} color={THEME.accent} />
          <span style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: THEME.text, textTransform: 'uppercase' }}>
            Database Explorer
          </span>
        </div>

        {/* Status indicator with pulsing animation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0, 0, 0, 0.35)', border: `1px solid ${statusConfig.color}40`, borderRadius: '12px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: statusConfig.color }}>
          {statusConfig.isPulsing && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusConfig.color, boxShadow: `0 0 6px ${statusConfig.color}`, animation: 'dbPulse 1.4s ease-in-out infinite' }} />
          )}
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Metadata Bar (DBMS Type, Version, Columns, Render Column) */}
      <div style={{ padding: '8px 14px', backgroundColor: THEME.surfaceAlt, borderBottom: `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: THEME.textMuted, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Server size={13} color={THEME.accent} />
          <span>DBMS:</span>
          <strong style={{ color: discovery?.dbmsType ? THEME.text : THEME.textMuted }}>
            {discovery?.dbmsType || 'Undetected'}
            {discovery?.dbmsVersion ? ` ${discovery.dbmsVersion}` : ''}
          </strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={13} color={THEME.warning} />
          <span>Columns:</span>
          <strong style={{ color: THEME.text }}>
            {discovery?.columnCount !== undefined ? discovery.columnCount : 'N/A'}
          </strong>
          <span style={{ color: THEME.borderLight }}>|</span>
          <span>Render Column:</span>
          <strong style={{ color: discovery?.renderColumn !== undefined ? THEME.accent : THEME.textMuted }}>
            {discovery?.renderColumn !== undefined ? discovery.renderColumn : 'N/A'}
          </strong>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 5. Empty State */}
        {isEmpty ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', backgroundColor: 'rgba(17, 24, 39, 0.4)', borderRadius: '6px', border: `1px dashed ${THEME.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Database size={28} color={THEME.textMuted} />
            <p style={{ margin: 0, color: THEME.textMuted, maxWidth: '420px', lineHeight: 1.5, fontSize: '12px' }}>
              Database schema will appear here as the scanner discovers tables, columns, and data.
            </p>
          </div>
        ) : (
          /* 2. Tables Section */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: `1px solid ${THEME.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: THEME.text }}>
                <Table size={14} color={THEME.accent} />
                <span>Tables ({tables.length} found)</span>
              </div>
            </div>

            {/* Tree View of Discovered Tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tables.map((table) => {
                const isExpanded = isTableExpanded(table.name);
                const sensitiveTable = isTableSensitive(table);

                return (
                  <div key={table.name} style={{ border: `1px solid ${sensitiveTable ? 'rgba(245, 158, 11, 0.4)' : THEME.border}`, backgroundColor: sensitiveTable ? 'rgba(245, 158, 11, 0.05)' : THEME.surface, borderRadius: '6px', overflow: 'hidden' }}>
                    {/* Table Row Header */}
                    <div onClick={() => toggleTable(table.name)} style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', backgroundColor: sensitiveTable ? 'rgba(245, 158, 11, 0.08)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: THEME.textMuted, display: 'flex', alignItems: 'center' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <Table size={14} color={sensitiveTable ? THEME.warning : THEME.accent} />
                        <span style={{ fontWeight: 600, color: sensitiveTable ? THEME.warning : THEME.text, fontFamily: 'monospace', fontSize: '12px' }}>
                          {table.name}
                        </span>

                        {sensitiveTable && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(245, 158, 11, 0.18)', color: THEME.warning, border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', fontWeight: 700 }}>
                            <Star size={10} fill={THEME.warning} color={THEME.warning} />
                            SENSITIVE
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: THEME.textMuted }}>
                        {table.rowCount !== undefined && <span>{table.rowCount} rows</span>}
                        <span>({table.columns?.length || 0} columns)</span>
                      </div>
                    </div>

                    {/* Columns Tree (Expandable) */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${sensitiveTable ? 'rgba(245, 158, 11, 0.2)' : THEME.border}`, backgroundColor: THEME.bg, padding: '6px 10px 8px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {table.columns && table.columns.length > 0 ? (
                          table.columns.map((col) => {
                            const sensitiveCol = isColumnSensitive(col);
                            const hasValues = col.values && col.values.length > 0;
                            const displayedValues = col.values?.slice(0, 10) || [];
                            const extraCount = (col.values?.length || 0) - 10;

                            return (
                              <div key={col.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 6px', borderRadius: '4px', backgroundColor: sensitiveCol ? 'rgba(239, 68, 68, 0.05)' : 'transparent', borderLeft: sensitiveCol ? `2px solid ${THEME.error}` : '2px solid transparent' }}>
                                {/* 3. Column Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {getColumnIcon(col)}
                                  <span style={{ fontFamily: 'monospace', fontWeight: sensitiveCol ? 600 : 500, color: sensitiveCol ? '#fca5a5' : THEME.text, fontSize: '11.5px' }}>
                                    {col.name}
                                  </span>

                                  {col.dataType && (
                                    <span style={{ color: THEME.textMuted, fontSize: '11px' }}>
                                      ({col.dataType})
                                    </span>
                                  )}

                                  {sensitiveCol && (
                                    <span style={{ color: THEME.error, fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                                      ★
                                    </span>
                                  )}
                                </div>

                                {/* 4. Value Rows */}
                                {hasValues && (
                                  <div style={{ paddingLeft: '18px', display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ color: THEME.textMuted, fontSize: '10.5px', fontFamily: 'monospace', whiteSpace: 'nowrap', lineHeight: '18px' }}>
                                      Values:
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                      {displayedValues.map((val, idx) => (
                                        <span key={idx} style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: '10.5px', padding: '1px 5px', borderRadius: '3px', backgroundColor: sensitiveCol ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: sensitiveCol ? '#fca5a5' : THEME.text, border: `1px solid ${sensitiveCol ? 'rgba(239, 68, 68, 0.3)' : THEME.border}` }}>
                                          {val}
                                        </span>
                                      ))}

                                      {extraCount > 0 && (
                                        <span style={{ fontSize: '10px', color: THEME.textMuted, fontStyle: 'italic', padding: '1px 4px' }}>
                                          +{extraCount} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ color: THEME.textMuted, fontStyle: 'italic', fontSize: '11px' }}>
                            No columns discovered yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 6. Export Button Section */}
      <div style={{ padding: '8px 14px', backgroundColor: THEME.surface, borderTop: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          onClick={handleExport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: copied ? 'rgba(16, 185, 129, 0.15)' : THEME.surfaceAlt, color: copied ? THEME.success : THEME.text, border: `1px solid ${copied ? THEME.success : THEME.borderLight}`, borderRadius: '4px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
          title="Copy discovered database schema to clipboard as JSON"
        >
          {copied ? <Check size={12} color={THEME.success} /> : <Copy size={12} />}
          <span>{copied ? 'Copied JSON!' : 'Export JSON'}</span>
        </button>
      </div>
    </div>
  );
};
