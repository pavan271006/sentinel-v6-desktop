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
      className="h-6 bg-[#2b2d30] border-t border-[#1e1f22] flex items-center justify-between px-2 text-[11px] font-sans text-[#9da5b4] select-none flex-shrink-0 z-30"
    >
      {/* Left: Burp Event Log, Console & Issues */}
      <div className="flex items-center gap-3">
        {/* Event Log Trigger */}
        <button
          onClick={toggleBottomDrawer}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
          <span className="font-medium">Event log (1)</span>
        </button>

        {/* Console Drawer Button */}
        <button
          onClick={toggleBottomDrawer}
          className="flex items-center gap-1 hover:text-white transition-colors text-text-primary"
        >
          <Terminal className="w-3.5 h-3.5 text-[#f37021]" />
          <span>Console</span>
        </button>

        {/* All Issues Trigger */}
        <button
          onClick={() => setActiveWorkspace('findings')}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <span className="font-medium">All issues ({criticalFindingCount})</span>
        </button>

        {/* Scope Status Badge */}
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <Shield className="w-3 h-3 text-[#34d399]" />
          <span>Scope: {scopeActive ? 'Enforced' : 'Bypass'}</span>
          <span className="text-[#34d399] bg-[#141517] px-1 py-0.2 rounded border border-[#3e4249]">
            FAIL-CLOSED
          </span>
        </div>

        {/* DB Size */}
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <Database className="w-3 h-3 text-[#38bdf8]" />
          <span>DB: {formatBytes(dbSizeBytes)}</span>
        </div>

        {/* Version label */}
        <span className="font-mono text-[10px] text-[#6f737a]">Sentinel V6.0.0</span>
      </div>

      {/* Right: Memory Monitor, IPC Latency & Proxy Target */}
      <div className="flex items-center gap-3">
        {/* Memory Gauge */}
        <Tooltip content="Java / Native Runtime Heap Memory Utilization">
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-white">
            <Clock className="w-3 h-3 text-[#6f737a]" />
            <span className="font-mono text-[10px]">Memory: 285.3MB of 7.60GB</span>
            <div className="w-12 h-1.5 bg-[#141517] rounded-full overflow-hidden border border-[#3e4249]">
              <div className="w-1/4 h-full bg-[#34d399] rounded-full" />
            </div>
          </div>
        </Tooltip>

        <div className="h-3 w-px bg-[#3e4249]" />

        {/* IPC Latency */}
        <span className="font-mono text-[10px] text-[#9da5b4]">
          IPC: {ipcLatencyMs}ms
        </span>

        <div className="h-3 w-px bg-[#3e4249]" />

        {/* Target & Proxy Intercept Status */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <Radio className="w-3 h-3 text-[#34d399]" />
          <span className="text-[#9da5b4]">Proxy:</span>
          <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
          <span className="text-[#c4c7c5] font-medium">127.0.0.1:{proxyPort || 8080}</span>
          <span className="text-[#34d399] font-semibold ml-1">
            {proxyRunning ? 'Active' : 'Off'}
          </span>
        </div>
      </div>
    </footer>
  );
};
