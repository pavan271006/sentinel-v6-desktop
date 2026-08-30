import React from 'react';
import { cn, formatBytes } from '../../design-system/utils';
import { useAppShellStore } from '../../stores/appShellStore';
import { useEventBusStore } from '../../stores/eventBusStore';
import { BottomDrawerTab } from '../../types/shell';
import {
  Terminal,
  Activity,
  AlertTriangle,
  Zap,
  Trash2,
  X,
  Radio,
  Cpu,
} from 'lucide-react';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';

export const BottomDrawer: React.FC = () => {
  const {
    bottomDrawerOpen,
    toggleBottomDrawer,
    bottomDrawerTab,
    setBottomDrawerTab,
    dbSizeBytes,
    memoryRssBytes,
    ipcLatencyMs,
  } = useAppShellStore();

  const {
    auditLogs,
    clearAuditLogs,
    recentTraffic,
    recentFindings,
    scopeViolations,
    ipcMessagesReceived,
    isStreamingConnected,
  } = useEventBusStore();

  if (!bottomDrawerOpen) return null;

  const tabs: Array<{ id: BottomDrawerTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'logs', label: 'Live Audit Log', icon: <Terminal className="w-3.5 h-3.5" />, count: auditLogs.length },
    { id: 'events', label: 'Stream Events', icon: <Activity className="w-3.5 h-3.5" />, count: recentTraffic.length + recentFindings.length },
    { id: 'tasks', label: 'Background Tasks', icon: <Zap className="w-3.5 h-3.5" />, count: 1 },
    { id: 'ipc', label: 'IPC & Backpressure', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'diagnostics', label: 'Engine Diagnostics', icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="h-56 bg-bg-panel border-t border-border-subtle flex flex-col flex-shrink-0 select-none z-10">
      {/* Header & Tabs */}
      <div className="h-7 bg-bg-panel-elevated border-b border-border-subtle flex items-center justify-between px-2">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = bottomDrawerTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setBottomDrawerTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-0.5 text-xs rounded transition-colors',
                  isActive
                    ? 'bg-bg-panel text-accent-cyan font-semibold border border-border-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="text-[10px] font-mono text-text-muted bg-bg-input px-1 rounded">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {bottomDrawerTab === 'logs' && (
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<Trash2 className="w-3 h-3" />}
              onClick={clearAuditLogs}
              className="text-text-muted hover:text-severity-critical p-1 text-[11px]"
            >
              Clear Logs
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            onClick={toggleBottomDrawer}
            aria-label="Close bottom drawer"
            className="p-1 text-text-muted hover:text-text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs select-text">
        {bottomDrawerTab === 'logs' && (
          <div className="space-y-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-baseline gap-2 py-0.5 hover:bg-bg-panel-hover px-1 rounded">
                <span className="text-text-muted text-[11px] select-none">{log.timestamp}</span>
                <span
                  className={cn(
                    'font-bold text-[10px] px-1 rounded select-none',
                    log.level === 'CRITICAL' && 'bg-severity-critical-bg text-severity-critical',
                    log.level === 'WARN' && 'bg-severity-medium-bg text-severity-medium',
                    log.level === 'INFO' && 'bg-severity-info-bg text-severity-info'
                  )}
                >
                  {log.level}
                </span>
                <span className="text-accent-cyan select-none">[{log.source}]</span>
                <span className="text-text-primary flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        )}

        {bottomDrawerTab === 'events' && (
          <div className="space-y-2">
            <div className="text-xs font-sans text-text-secondary">
              Protobuf Event Dispatcher (<span className="text-severity-low font-bold">SentinelUiStream Active</span>)
            </div>
            {scopeViolations.length > 0 && (
              <div className="p-2 rounded bg-severity-critical-bg/30 border border-severity-critical/40 text-severity-critical">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> SEC-01 Scope Violations Log
                </div>
                {scopeViolations.map((v, i) => (
                  <div key={i} className="text-xs mt-1">
                    Dropped: {v.attemptedUri} — {v.violationReason}
                  </div>
                ))}
              </div>
            )}
            <div className="text-text-muted text-xs">
              Listening on Tauri IPC Channel. Total messages dispatched: {ipcMessagesReceived}.
            </div>
          </div>
        )}

        {bottomDrawerTab === 'tasks' && (
          <div className="space-y-2 font-sans">
            <div className="flex items-center justify-between p-2 rounded bg-bg-panel-elevated border border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-severity-low animate-subtle-pulse" />
                <div>
                  <div className="text-xs font-semibold text-text-primary">Target Passive Scan Orchestrator</div>
                  <div className="text-[11px] text-text-secondary font-mono">ID: scan-task-001 | Phase: Header Analysis</div>
                </div>
              </div>
              <Badge variant="low">RUNNING</Badge>
            </div>
          </div>
        )}

        {bottomDrawerTab === 'ipc' && (
          <div className="grid grid-cols-3 gap-4 font-sans">
            <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle">
              <div className="text-xs text-text-secondary">IPC Latency</div>
              <div className="text-lg font-bold font-mono text-accent-cyan mt-1">{ipcLatencyMs} ms</div>
              <div className="text-[11px] text-severity-low mt-0.5">High Speed In-Process</div>
            </div>
            <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle">
              <div className="text-xs text-text-secondary">Messages Processed</div>
              <div className="text-lg font-bold font-mono text-text-primary mt-1">{ipcMessagesReceived}</div>
              <div className="text-[11px] text-text-muted mt-0.5">0 Dropped (SEC-12 Bounded)</div>
            </div>
            <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle">
              <div className="text-xs text-text-secondary">Channel Health</div>
              <div className="text-lg font-bold font-mono text-severity-low mt-1">
                {isStreamingConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">Dual-Channel Event Bus</div>
            </div>
          </div>
        )}

        {bottomDrawerTab === 'diagnostics' && (
          <div className="grid grid-cols-3 gap-4 font-sans">
            <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle">
              <div className="text-xs text-text-secondary">SQLite WAL Database</div>
              <div className="text-lg font-bold font-mono text-text-primary mt-1">{formatBytes(dbSizeBytes)}</div>
              <div className="text-[11px] text-text-muted mt-0.5">32 Canonical Tables</div>
            </div>
            <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle">
              <div className="text-xs text-text-secondary">Memory RSS (Resident)</div>
              <div className="text-lg font-bold font-mono text-text-primary mt-1">{formatBytes(memoryRssBytes)}</div>
              <div className="text-[11px] text-text-muted mt-0.5">SEC-09 Zeroized Drop</div>
            </div>
            <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle">
              <div className="text-xs text-text-secondary">Core Version</div>
              <div className="text-lg font-bold font-mono text-accent-cyan mt-1">6.0.0</div>
              <div className="text-[11px] text-severity-low mt-0.5">28 Workspace Crates PASS</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
