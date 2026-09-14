import React, { useEffect } from 'react';
import { useAppShellStore } from '../../stores/appShellStore';
import { useEventBusStore } from '../../stores/eventBusStore';
import { Tooltip } from '../../design-system/Tooltip';
import { Clock, Terminal, Database, Shield, Radio } from 'lucide-react';
import { formatBytes } from '../../design-system/utils';

export const StatusBar: React.FC = () => {
  const {
    toggleBottomDrawer,
    setActiveWorkspace,
    ipcLatencyMs,
    dbSizeBytes,
    proxyRunning,
    proxyPort,
    scopeActive,
  } = useAppShellStore();

  const { criticalFindingCount } = useEventBusStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleBottomDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBottomDrawer]);

  return (
    <footer
      aria-label="Status Bar"
      className="h-6 bg-bg-panel border-t border-border-subtle flex items-center justify-between px-3 text-[11px] font-sans text-text-secondary select-none flex-shrink-0 z-30"
    >
      {/* Left: Event Log, Console & Issues */}
      <div className="flex items-center gap-3">
        {/* Event Log Trigger */}
        <button
          onClick={toggleBottomDrawer}
          className="flex items-center gap-1.5 hover:text-white transition-colors group"
        >
          <span className="w-2 h-2 rounded-full bg-accent-blue group-hover:shadow-[0_0_6px_rgba(56,189,248,0.8)] transition-shadow" />
          <span className="font-medium text-text-secondary group-hover:text-text-primary">Event log (1)</span>
        </button>

        {/* Console Drawer Button */}
        <button
          onClick={toggleBottomDrawer}
          className="flex items-center gap-1.5 hover:text-white transition-colors text-text-primary"
        >
          <Terminal className="w-3.5 h-3.5 text-accent-cyan" />
          <span className="font-medium">Console</span>
        </button>

        {/* All Issues Trigger */}
        <button
          onClick={() => setActiveWorkspace('findings')}
          className="flex items-center gap-1.5 hover:text-white transition-colors group"
        >
          <span className="font-medium text-text-secondary group-hover:text-text-primary">All issues</span>
          <span className="px-1.5 py-0.2 rounded-full bg-severity-critical/20 text-severity-critical border border-severity-critical/30 font-mono text-[10px] font-bold">
            {criticalFindingCount}
          </span>
        </button>

        <div className="h-3 w-px bg-border-subtle" />

        {/* Scope Status Badge */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <Shield className="w-3 h-3 text-accent-green" />
          <span className="text-text-muted">Scope:</span>
          <span className="text-accent-green font-semibold">{scopeActive ? 'Enforced' : 'Bypass'}</span>
          <span className="text-accent-green bg-accent-green/10 px-1.5 py-0.2 rounded border border-accent-green/30">
            FAIL-CLOSED
          </span>
        </div>

        {/* DB Size */}
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <Database className="w-3 h-3 text-accent-blue" />
          <span className="text-text-muted">DB:</span>
          <span className="text-text-secondary">{formatBytes(dbSizeBytes)}</span>
        </div>

        {/* Version label */}
        <span className="font-mono text-[10px] text-text-muted">Sentinel v6.0.0</span>
      </div>

      {/* Right: Memory Monitor, IPC Latency & Proxy Target */}
      <div className="flex items-center gap-3">
        {/* Memory Gauge */}
        <Tooltip content="Runtime Heap Memory Utilization">
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
            <Clock className="w-3 h-3 text-text-muted" />
            <span className="font-mono text-[10px] text-text-muted">Heap: 285MB / 7.6GB</span>
            <div className="w-14 h-1.5 bg-bg-app rounded-full overflow-hidden border border-border-strong">
              <div className="w-1/4 h-full bg-gradient-to-r from-accent-cyan to-accent-green rounded-full shadow-[0_0_6px_rgba(0,240,255,0.4)]" />
            </div>
          </div>
        </Tooltip>

        <div className="h-3 w-px bg-border-subtle" />

        {/* IPC Latency */}
        <span className="font-mono text-[10px] text-text-muted flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
          IPC: <span className="text-text-secondary">{ipcLatencyMs}ms</span>
        </span>

        <div className="h-3 w-px bg-border-subtle" />

        {/* Target & Proxy Intercept Status */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <Radio className="w-3 h-3 text-accent-green" />
          <span className="text-text-muted">Proxy:</span>
          <span className="w-2 h-2 rounded-full bg-accent-green animate-live-pulse" />
          <span className="text-text-primary font-medium">127.0.0.1:{proxyPort || 8085}</span>
          <span className="text-accent-green font-semibold ml-0.5">
            {proxyRunning ? 'Active' : 'Off'}
          </span>
        </div>
      </div>
    </footer>
  );
};
