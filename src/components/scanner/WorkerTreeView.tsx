import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Check,
  X,
  Loader,
  Clock,
  Database,
  Shield,
  Search,
  Columns,
  Table2,
  Key,
} from 'lucide-react';

export interface WorkerRequestEntry {
  id: string;
  url: string;
  method: string;
  status: number;
  durationMs: number;
  payload: string;
  phase: string;
  step: string;
  result: 'success' | 'fail' | 'info' | 'pending';
  responseSnippet?: string;
  timestamp: number;
}

export interface WorkerPhaseData {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'skipped';
  detail?: string;
  requests: WorkerRequestEntry[];
}

export interface WorkerData {
  id: string;
  label: string;
  endpoint: string;
  currentPhase: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  phases: {
    detection: WorkerPhaseData;
    fingerprint: WorkerPhaseData;
    columnCount: WorkerPhaseData;
    tableEnum: WorkerPhaseData;
    columnEnum: WorkerPhaseData;
    dataExtract: WorkerPhaseData;
  };
}

export interface WorkerTreeViewProps {
  workers: WorkerData[];
  onRequestClick?: (request: WorkerRequestEntry) => void;
}

const PHASE_CONFIG: Array<{
  key: keyof WorkerData['phases'];
  num: number;
  label: string;
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
}> = [
  { key: 'detection', num: 1, label: 'Detection', icon: Shield },
  { key: 'fingerprint', num: 2, label: 'DBMS Fingerprint', icon: Database },
  { key: 'columnCount', num: 3, label: 'Column Count', icon: Columns },
  { key: 'tableEnum', num: 4, label: 'Tables Found', icon: Table2 },
  { key: 'columnEnum', num: 5, label: 'Columns Found', icon: Key },
  { key: 'dataExtract', num: 6, label: 'Data Extracted', icon: Search },
];

const THEME = {
  bg: '#0a0d16',
  surface: '#111827',
  border: '#1e293b',
  text: '#e2e8f0',
  accent: '#00ffff',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  muted: '#64748b',
};

const CSS_ANIMATIONS = `
@keyframes treeLoaderSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes treePulseDot {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #00ffff; }
  50% { opacity: 0.35; transform: scale(0.8); box-shadow: 0 0 2px #00ffff; }
}
.wt-worker-row:hover { background-color: rgba(30, 41, 59, 0.45) !important; }
.wt-phase-row:hover { background-color: rgba(30, 41, 59, 0.35) !important; }
.wt-req-row:hover { background-color: rgba(30, 41, 59, 0.6) !important; }
.wt-toolbar-btn {
  background: #111827; color: #94a3b8; border: 1px solid #1e293b;
  padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;
  transition: all 0.15s ease;
}
.wt-toolbar-btn:hover { background: #1e293b; color: #00ffff; border-color: rgba(0, 255, 255, 0.4); }
`;

export const WorkerTreeView: React.FC<WorkerTreeViewProps> = ({ workers = [], onRequestClick }) => {
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(() => {
    const set = new Set<string>();
    workers.forEach((w) => {
      if (w.status === 'running') set.add(w.id);
    });
    return set;
  });

  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => {
    const set = new Set<string>();
    workers.forEach((w) => {
      if (w.phases) {
        PHASE_CONFIG.forEach((p) => {
          if (w.phases[p.key]?.status === 'running') {
            set.add(`${w.id}-${p.key}`);
          }
        });
      }
    });
    return set;
  });

  const [searchQuery, setSearchQuery] = useState('');

  const toggleWorker = (id: string) => {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePhase = (compositeKey: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) next.delete(compositeKey);
      else next.add(compositeKey);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allWorkers = new Set<string>();
    const allPhases = new Set<string>();
    workers.forEach((w) => {
      allWorkers.add(w.id);
      PHASE_CONFIG.forEach((p) => allPhases.add(`${w.id}-${p.key}`));
    });
    setExpandedWorkers(allWorkers);
    setExpandedPhases(allPhases);
  };

  const handleCollapseAll = () => {
    setExpandedWorkers(new Set());
    setExpandedPhases(new Set());
  };

  const truncateUrl = (raw: string, maxLen = 38): string => {
    if (!raw) return '';
    let path = raw;
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const u = new URL(raw);
        path = u.pathname + u.search;
      }
    } catch {
      path = raw;
    }
    return path.length > maxLen ? `${path.slice(0, maxLen - 3)}...` : path;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return THEME.success;
    if (status >= 300 && status < 400) return THEME.warning;
    if (status >= 400 && status < 600) return THEME.error;
    return THEME.muted;
  };

  const getMethodStyle = (method: string) => {
    const m = (method || 'GET').toUpperCase();
    if (m === 'GET') return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' };
    if (m === 'POST') return { color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.3)' };
    if (m === 'PUT') return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' };
    if (m === 'DELETE') return { color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.3)' };
    return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
  };

  const renderWorkerStatus = (status: WorkerData['status']) => {
    if (status === 'running') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: THEME.accent, animation: 'treePulseDot 1.5s infinite' }} />
          <span style={{ color: THEME.accent, fontSize: '11px', fontWeight: 600 }}>(running)</span>
        </span>
      );
    }
    if (status === 'complete') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Check size={14} style={{ color: THEME.success, strokeWidth: 2.5 }} />
          <span style={{ color: THEME.success, fontSize: '11px', fontWeight: 600 }}>(complete)</span>
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <X size={14} style={{ color: THEME.error, strokeWidth: 2.5 }} />
          <span style={{ color: THEME.error, fontSize: '11px', fontWeight: 600 }}>(error)</span>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: THEME.muted }} />
        <span style={{ color: THEME.muted, fontSize: '11px' }}>(idle)</span>
      </span>
    );
  };

  const renderPhaseStatus = (status: WorkerPhaseData['status']) => {
    if (status === 'running') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Loader size={13} style={{ color: THEME.accent, animation: 'treeLoaderSpin 1s linear infinite' }} />
          <span style={{ color: THEME.accent, fontSize: '11px', fontWeight: 500 }}>running</span>
        </span>
      );
    }
    if (status === 'complete') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Check size={13} style={{ color: THEME.success, strokeWidth: 2.5 }} />
          <span style={{ color: THEME.success, fontSize: '11px', fontWeight: 500 }}>complete</span>
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} style={{ color: THEME.muted }} />
          <span style={{ color: THEME.muted, fontSize: '11px' }}>pending</span>
        </span>
      );
    }
    return <span style={{ color: THEME.muted, fontSize: '11px', fontStyle: 'italic' }}>skipped</span>;
  };

  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    const q = searchQuery.toLowerCase();
    return workers.filter((w) => {
      if (w.label?.toLowerCase().includes(q) || w.endpoint?.toLowerCase().includes(q) || w.currentPhase?.toLowerCase().includes(q)) return true;
      if (!w.phases) return false;
      return Object.values(w.phases).some((p) =>
        p?.requests?.some((r) => r.url?.toLowerCase().includes(q) || r.payload?.toLowerCase().includes(q) || r.step?.toLowerCase().includes(q))
      );
    });
  }, [workers, searchQuery]);

  // Empty State
  if (!workers || workers.length === 0) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '260px', padding: '32px 16px', backgroundColor: THEME.bg,
          border: `1px dashed ${THEME.border}`, borderRadius: '8px', color: THEME.muted, textAlign: 'center',
        }}
      >
        <style>{CSS_ANIMATIONS}</style>
        <div
          style={{
            width: '46px', height: '46px', borderRadius: '50%', background: THEME.surface,
            border: `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '12px', color: THEME.accent,
          }}
        >
          <Shield size={22} style={{ opacity: 0.85 }} />
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: THEME.text, marginBottom: '6px' }}>
          Launch a scan to see worker activity
        </div>
        <div style={{ fontSize: '12px', color: THEME.muted, maxWidth: '360px', lineHeight: 1.5 }}>
          Real-time thread activity, multi-phase SQL audit trees, and live HTTP requests will appear here once initiated.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', backgroundColor: THEME.bg,
        border: `1px solid ${THEME.border}`, borderRadius: '8px', overflow: 'hidden',
        color: THEME.text, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{CSS_ANIMATIONS}</style>

      {/* Toolbar Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: '8px', padding: '8px 12px', background: THEME.surface, borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', color: THEME.text }}>
            WORKER TREE
          </span>
          <span
            style={{
              fontSize: '11px', padding: '1px 6px', borderRadius: '10px',
              background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: `1px solid ${THEME.border}`,
            }}
          >
            {workers.length} {workers.length === 1 ? 'Worker' : 'Workers'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} style={{ position: 'absolute', left: '7px', color: THEME.muted, pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search tree..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '3px 6px 3px 24px', fontSize: '11px', background: THEME.bg,
                color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: '4px',
                outline: 'none', width: '120px',
              }}
            />
          </div>
          <button type="button" className="wt-toolbar-btn" onClick={handleExpandAll}>Expand All</button>
          <button type="button" className="wt-toolbar-btn" onClick={handleCollapseAll}>Collapse All</button>
        </div>
      </div>

      {/* Tree Content */}
      <div style={{ padding: '6px 8px' }}>
        {filteredWorkers.map((worker) => {
          const isWorkerExpanded = expandedWorkers.has(worker.id);
          const workerLabel = worker.label || `Worker ${worker.id}`;

          return (
            <div
              key={worker.id}
              style={{
                marginBottom: '4px', borderRadius: '6px',
                backgroundColor: isWorkerExpanded ? 'rgba(17, 24, 39, 0.4)' : 'transparent',
                border: `1px solid ${isWorkerExpanded ? THEME.border : 'transparent'}`,
                overflow: 'hidden',
              }}
            >
              {/* 1. Worker Row */}
              <div
                className="wt-worker-row"
                onClick={() => toggleWorker(worker.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', cursor: 'pointer', borderRadius: '4px', userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: THEME.muted }}>
                    {isWorkerExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', color: THEME.accent }}>
                    {isWorkerExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: THEME.text, whiteSpace: 'nowrap' }}>
                    {workerLabel}
                  </span>
                  <span style={{ color: THEME.muted, fontSize: '13px' }}>—</span>
                  <span
                    title={worker.endpoint}
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '12px', color: '#38bdf8', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px',
                    }}
                  >
                    {worker.endpoint}
                  </span>
                  {worker.currentPhase && (
                    <span
                      style={{
                        fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                        backgroundColor: 'rgba(0, 255, 255, 0.08)', color: THEME.accent,
                        border: '1px solid rgba(0, 255, 255, 0.25)', whiteSpace: 'nowrap',
                      }}
                    >
                      [PHASE: {worker.currentPhase}]
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                  {renderWorkerStatus(worker.status)}
                </div>
              </div>

              {/* Worker Children: Phases */}
              {isWorkerExpanded && (
                <div style={{ marginLeft: '16px', paddingLeft: '12px', borderLeft: `1px solid ${THEME.border}`, marginTop: '2px', marginBottom: '4px' }}>
                  {PHASE_CONFIG.map((pConfig) => {
                    const compositeKey = `${worker.id}-${pConfig.key}`;
                    const isPhaseExpanded = expandedPhases.has(compositeKey);
                    const phaseData: WorkerPhaseData = worker.phases?.[pConfig.key] || {
                      name: pConfig.label,
                      status: 'pending',
                      requests: [],
                    };
                    const PhaseIcon = pConfig.icon;
                    const requests = phaseData.requests || [];
                    const phaseTitle = phaseData.name
                      ? (phaseData.name.toLowerCase().startsWith('phase') ? phaseData.name : `Phase ${pConfig.num}: ${phaseData.name}`)
                      : `Phase ${pConfig.num}: ${pConfig.label}`;

                    return (
                      <div key={pConfig.key} style={{ marginBottom: '2px' }}>
                        {/* 2. Phase Row */}
                        <div
                          className="wt-phase-row"
                          onClick={() => togglePhase(compositeKey)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ display: 'flex', alignItems: 'center', color: THEME.muted }}>
                              {isPhaseExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', color: phaseData.status === 'running' ? THEME.accent : '#94a3b8' }}>
                              <PhaseIcon size={14} />
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: THEME.text, whiteSpace: 'nowrap' }}>
                              {phaseTitle}
                            </span>
                            <span style={{ fontSize: '11px', color: THEME.muted, whiteSpace: 'nowrap' }}>
                              ({requests.length} {requests.length === 1 ? 'request' : 'requests'})
                            </span>
                            {phaseData.detail && (
                              <span
                                title={phaseData.detail}
                                style={{
                                  fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap',
                                  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px',
                                }}
                              >
                                — {phaseData.detail}
                              </span>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                            {renderPhaseStatus(phaseData.status)}
                          </div>
                        </div>

                        {/* 3. Requests List */}
                        {isPhaseExpanded && (
                          <div style={{ marginLeft: '18px', paddingLeft: '10px', borderLeft: `1px dashed ${THEME.border}`, marginTop: '2px', marginBottom: '6px' }}>
                            {requests.length === 0 ? (
                              <div style={{ padding: '4px 8px', fontSize: '11px', color: THEME.muted, fontStyle: 'italic' }}>
                                No requests recorded for this phase
                              </div>
                            ) : (
                              requests.map((req) => {
                                const mStyle = getMethodStyle(req.method);
                                const sColor = getStatusColor(req.status);
                                const truncatedPath = truncateUrl(req.url, 40);

                                return (
                                  <div
                                    key={req.id}
                                    className="wt-req-row"
                                    onClick={() => onRequestClick?.(req)}
                                    title={`Click to inspect #${req.id}: ${req.method} ${req.url}`}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      padding: '4px 8px', borderRadius: '4px', cursor: onRequestClick ? 'pointer' : 'default',
                                      gap: '8px', userSelect: 'none',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                                      <FileText size={12} style={{ color: THEME.muted, flexShrink: 0 }} />
                                      {/* Method */}
                                      <span
                                        style={{
                                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                          fontSize: '10px', fontWeight: 700, color: mStyle.color,
                                          backgroundColor: mStyle.bg, border: `1px solid ${mStyle.border}`,
                                          padding: '1px 4px', borderRadius: '3px', flexShrink: 0,
                                        }}
                                      >
                                        {req.method}
                                      </span>

                                      {/* URL */}
                                      <span
                                        title={req.url}
                                        style={{
                                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                          fontSize: '11px', color: THEME.text, whiteSpace: 'nowrap',
                                          overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px',
                                        }}
                                      >
                                        {truncatedPath}
                                      </span>

                                      <span style={{ color: THEME.muted, fontSize: '11px', flexShrink: 0 }}>→</span>

                                      {/* Status Code */}
                                      <span
                                        style={{
                                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                          fontSize: '11px', fontWeight: 600, color: sColor, flexShrink: 0,
                                        }}
                                      >
                                        {req.status}
                                      </span>

                                      {/* Duration */}
                                      <span
                                        style={{
                                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                          fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0,
                                        }}
                                      >
                                        ({req.durationMs}ms)
                                      </span>

                                      {/* Step / Payload description */}
                                      {(req.step || req.payload) && (
                                        <span
                                          title={req.step || req.payload}
                                          style={{
                                            fontSize: '11px', color: '#cbd5e1', whiteSpace: 'nowrap',
                                            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px',
                                          }}
                                        >
                                          — {req.step || req.payload}
                                        </span>
                                      )}
                                    </div>

                                    {/* Result Badge */}
                                    <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                                      {req.result === 'success' && (
                                        <span
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            fontSize: '10px', fontWeight: 700, color: THEME.success,
                                            backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                            padding: '1px 6px', borderRadius: '3px',
                                          }}
                                        >
                                          <Check size={11} strokeWidth={3} />
                                          {req.step?.toLowerCase().includes('injectable') ? '' : 'INJECTABLE'}
                                        </span>
                                      )}
                                      {req.result === 'fail' && (
                                        <span
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            fontSize: '10px', fontWeight: 600, color: THEME.error,
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                                            padding: '1px 5px', borderRadius: '3px',
                                          }}
                                        >
                                          <X size={10} strokeWidth={2.5} />
                                          FAIL
                                        </span>
                                      )}
                                      {req.result === 'info' && (
                                        <span
                                          style={{
                                            fontSize: '10px', fontWeight: 600, color: THEME.accent,
                                            backgroundColor: 'rgba(0, 255, 255, 0.1)', border: '1px solid rgba(0, 255, 255, 0.25)',
                                            padding: '1px 5px', borderRadius: '3px',
                                          }}
                                        >
                                          INFO
                                        </span>
                                      )}
                                      {req.result === 'pending' && (
                                        <span
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            fontSize: '10px', color: THEME.warning,
                                            backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)',
                                            padding: '1px 5px', borderRadius: '3px',
                                          }}
                                        >
                                          <Clock size={10} />
                                          PENDING
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkerTreeView;
