import React from 'react';
import { useAppShellStore } from '../../stores/appShellStore';
import { useTrafficStore } from '../../stores/trafficStore';
import { useToastStore } from '../../stores/toastStore';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { WORKSPACES } from './ActivityBar';
import {
  ChevronLeft,
  FolderTree,
} from 'lucide-react';
import { Button } from '../../design-system/Button';

export const WorkspaceSidebar: React.FC = () => {
  const { activeWorkspace, toggleSidebar, sidebarCollapsed } = useAppShellStore();
  const {
    setScopeOnly,
    setQuickPreset,
    setHttpqlQuery,
    transactions,
    activePreset,
    filterScopeOnly,
  } = useTrafficStore();
  const { addToast } = useToastStore();
  const { tabs, activeTabId, setActiveTabId } = useRepeaterStore();

  const activeWsConfig = WORKSPACES.find((w) => w.id === activeWorkspace);

  // Real Target Hosts dynamically discovered from transactions
  const targetHosts = React.useMemo(() => {
    const map = new Map<string, { port: string; paths: Set<string>; count: number }>();
    for (const t of transactions) {
      if (!t.host) continue;
      let hostClean = t.host.replace(/^https?:\/\//i, '');
      let port = '443';
      if (hostClean.includes(':')) {
        const parts = hostClean.split(':');
        hostClean = parts[0];
        port = parts[1];
      }
      if (!map.has(hostClean)) {
        map.set(hostClean, { port, paths: new Set<string>(), count: 0 });
      }
      const entry = map.get(hostClean)!;
      entry.count++;
      if (t.path) {
        const cleanPath = t.path.split('?')[0];
        if (entry.paths.size < 10) {
          entry.paths.add(cleanPath);
        }
      }
    }
    return Array.from(map.entries()).map(([host, info]) => ({
      host,
      port: info.port,
      paths: Array.from(info.paths),
      count: info.count,
    }));
  }, [transactions]);

  if (sidebarCollapsed) {
    return null;
  }

  // Count live counts for sidebar
  const inScopeCount = transactions.filter((t) => t.inScope).length;
  const errorsCount = transactions.filter((t) => t.status >= 400).length;
  const apiCount = transactions.filter((t) => t.mimeType?.includes('json') || t.path?.includes('/api')).length;
  const wsCount = transactions.filter((t) => t.mimeType === 'websocket' || t.mimeType?.includes('websocket')).length;

  const renderSidebarContent = () => {
    switch (activeWorkspace) {
      case 'traffic':
        return (
          <div className="p-3 space-y-4 text-xs select-none">
            {/* Quick Filter Presets */}
            <div className="space-y-1.5">
              <label className="text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                Quick Filter Presets
              </label>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setHttpqlQuery('');
                    setScopeOnly(true);
                    setQuickPreset('in_scope');
                    addToast({ type: 'info', title: 'Filtered: All In-Scope Traffic' });
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    filterScopeOnly || activePreset === 'in_scope'
                      ? 'bg-bg-panel-elevated text-[#f37021] font-semibold border border-[#f37021]/30'
                      : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary'
                  }`}
                >
                  <span>All In-Scope Traffic</span>
                  <span className="font-mono text-text-muted text-[10px]">
                    {inScopeCount.toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setScopeOnly(false);
                    setQuickPreset('errors_only');
                    setHttpqlQuery('status:>=400');
                    addToast({ type: 'warning', title: 'Filtered: Errors (4xx / 5xx)' });
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    activePreset === 'errors_only'
                      ? 'bg-bg-panel-elevated text-[#ef4444] font-semibold border border-[#ef4444]/30'
                      : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary'
                  }`}
                >
                  <span>Errors (4xx / 5xx)</span>
                  <span className={`font-mono font-bold text-[10px] ${errorsCount > 0 ? 'text-[#f97316]' : 'text-text-muted'}`}>
                    {errorsCount.toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setScopeOnly(false);
                    setQuickPreset('media_json');
                    setHttpqlQuery('mime:json or path:/api');
                    addToast({ type: 'info', title: 'Filtered: API JSON Payloads' });
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    activePreset === 'media_json'
                      ? 'bg-bg-panel-elevated text-[#38bdf8] font-semibold border border-[#38bdf8]/30'
                      : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary'
                  }`}
                >
                  <span>API JSON Payloads</span>
                  <span className="font-mono text-text-muted text-[10px]">
                    {apiCount.toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setScopeOnly(false);
                    setHttpqlQuery('mime:websocket or path:/ws');
                    addToast({ type: 'info', title: 'Filtered: WebSocket Streams' });
                  }}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-text-secondary text-xs text-left hover:bg-bg-panel-hover hover:text-text-primary transition-colors"
                >
                  <span>WebSocket Streams</span>
                  <span className="font-mono text-text-muted text-[10px]">
                    {wsCount.toLocaleString()}
                  </span>
                </button>
              </div>
            </div>

            {/* Target Host Tree */}
            <div className="space-y-1.5">
              <label className="text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                Target Host Tree
              </label>
              {targetHosts.length === 0 ? (
                <div className="text-text-muted italic text-[11px] px-1 py-1">
                  No captured hosts yet
                </div>
              ) : (
                <div className="flex flex-col gap-2 font-mono text-xs text-text-secondary pl-1">
                  {targetHosts.map((th) => (
                    <div key={th.host} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => {
                          setHttpqlQuery(`host:${th.host}`);
                          addToast({ type: 'info', title: `Filtered by Host: ${th.host}` });
                        }}
                        className="flex items-center gap-1.5 py-0.5 text-text-primary font-medium hover:text-[#f37021] text-left truncate"
                      >
                        <FolderTree className="w-3.5 h-3.5 text-[#38bdf8] flex-shrink-0" />
                        <span className="truncate">{th.host} ({th.count})</span>
                      </button>

                      {th.paths.length > 0 && (
                        <div className="pl-4 flex flex-col gap-0.5 text-[11px]">
                          {th.paths.map((p) => (
                            <button
                              key={p}
                              onClick={() => {
                                setHttpqlQuery(`host:${th.host} and path:${p}`);
                                addToast({ type: 'info', title: `Filtered by Path: ${p}` });
                              }}
                              className="hover:text-[#f37021] text-left cursor-pointer transition-colors text-text-secondary truncate py-0.2"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'repeater':
        return (
          <div className="p-3 space-y-3 text-xs select-none">
            <label className="text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
              Saved Replay Tabs ({tabs.length})
            </label>
            <div className="space-y-1">
              {tabs.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTabId(t.id);
                    addToast({ type: 'info', title: `Switched to ${t.title}` });
                  }}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    activeTabId === t.id
                      ? 'bg-bg-panel-elevated border-[#f37021] text-white'
                      : 'bg-bg-panel hover:bg-bg-panel-hover border-border-subtle text-[#a6acb8]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#34d399] font-mono text-[10px]">{t.method}</span>
                    <span className="text-[10px] text-text-muted">Tab #{idx + 1}</span>
                  </div>
                  <div className="font-mono text-xs text-text-primary truncate mt-0.5">{t.title}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'sql':
        return (
          <div className="p-3 space-y-3 text-xs select-none">
            <div className="space-y-1.5">
              <label className="text-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                SQL Security Scanner
              </label>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Automated non-destructive differential testing across Error-based, Boolean, Time-based, and UNION vectors.
              </p>
            </div>

            <div className="p-2.5 rounded bg-bg-panel-elevated border border-border-subtle space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Safety Policy:</span>
                <span className="text-emerald-400 font-bold">Non-Destructive</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Row Harvesting:</span>
                <span className="text-emerald-400 font-bold">BLOCKED</span>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-3 text-xs text-text-muted italic select-none">
            Sub-navigation and workspace context for {activeWsConfig?.label}.
          </div>
        );
    }
  };

  return (
    <div className="w-60 bg-bg-panel border-r border-border-subtle flex flex-col h-full flex-shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-border-subtle bg-bg-panel-elevated">
        <span className="text-xs font-semibold text-text-primary truncate">
          {activeWsConfig?.label}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar (Ctrl+B)"
          className="p-0.5 text-text-muted hover:text-text-primary"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto">{renderSidebarContent()}</div>
    </div>
  );
};
