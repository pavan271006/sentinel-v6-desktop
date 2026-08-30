import React from 'react';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { StatusBadge, Badge } from '../../design-system/Badge';
import { Button } from '../../design-system/Button';
import {
  X,
  History,
  RotateCcw,
  Pin,
  GitCompare,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { METHOD_COLORS } from './RepeaterTabBar';

export const RepeaterHistoryDrawer: React.FC = () => {
  const {
    tabs,
    activeTabId,
    isHistoryDrawerOpen,
    setHistoryDrawerOpen,
    restoreRevision,
    setBaselineRevision,
    deleteRevision,
    clearTabHistory,
    openDiffModal,
  } = useRepeaterStore();

  if (!isHistoryDrawerOpen) return null;

  const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  if (!tab) return null;

  const revisions = [...tab.history].reverse(); // newest first

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-bg-panel-elevated border-l border-border-subtle shadow-2xl flex flex-col select-none">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-panel flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent-amber" />
          <h3 className="text-sm font-semibold text-text-primary">Execution History</h3>
          <Badge variant="warning" size="xs">
            {tab.history.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {tab.history.length > 0 && (
            <button
              onClick={() => clearTabHistory(tab.id)}
              className="p-1 rounded text-text-muted hover:text-accent-amber hover:bg-bg-panel transition-colors"
              title="Clear all revisions"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setHistoryDrawerOpen(false)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-panel transition-colors"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Revisions Timeline List */}
      <div className="flex-1 overflow-auto p-3 space-y-2.5">
        {revisions.map((rev) => {
          const originalIdx = tab.history.findIndex((h) => h.revisionId === rev.revisionId);
          const isActive = originalIdx === tab.activeRevisionIndex;
          const isBaseline = originalIdx === tab.baselineRevisionIndex;
          const methodStyle = METHOD_COLORS[rev.method] || METHOD_COLORS.GET;

          return (
            <div
              key={rev.revisionId}
              className={`p-3 rounded-lg border text-xs font-mono transition-all space-y-2 ${
                isActive
                  ? 'bg-bg-panel border-accent-cyan/60 shadow-md'
                  : 'bg-bg-canvas/60 border-border-subtle hover:border-border-subtle/80 hover:bg-bg-panel/40'
              }`}
            >
              {/* Revision Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-text-secondary">#{rev.revisionNumber}</span>
                  <span
                    className={`text-[10px] font-bold px-1 py-0.2 rounded border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
                  >
                    {rev.method}
                  </span>

                  {rev.statusCode ? (
                    <StatusBadge status={rev.statusCode} />
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                      ERR
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Clock className="w-3 h-3" />
                  <span>{rev.timestamp}</span>
                </div>
              </div>

              {/* URL snippet */}
              <div className="truncate text-text-muted text-[11px]" title={rev.url}>
                {rev.url}
              </div>

              {/* Metrics & Badges */}
              <div className="flex items-center gap-2 text-[11px] text-text-muted">
                <span>{rev.durationMs}ms</span>
                <span>•</span>
                <span>{rev.sizeBytes} B</span>

                {isBaseline && (
                  <Badge variant="warning" size="xs">
                    Baseline
                  </Badge>
                )}

                {isActive && (
                  <Badge variant="info" size="xs">
                    Viewing
                  </Badge>
                )}
              </div>

              {/* Error message if any */}
              {rev.error && (
                <div className="flex items-center gap-1.5 p-1.5 rounded bg-red-950/40 border border-red-900/60 text-red-300 text-[10px]">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                  <span className="truncate">{rev.error}</span>
                </div>
              )}

              {/* Revision Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-border-subtle/40">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    leftIcon={<RotateCcw className="w-3 h-3 text-accent-cyan" />}
                    onClick={() => restoreRevision(tab.id, originalIdx)}
                    title="Restore this request to editor"
                  >
                    Restore
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    leftIcon={<Pin className="w-3 h-3 text-accent-amber" />}
                    onClick={() => setBaselineRevision(tab.id, isBaseline ? null : originalIdx)}
                    title={isBaseline ? 'Unpin baseline' : 'Pin as baseline diff comparison'}
                  >
                    {isBaseline ? 'Pinned' : 'Baseline'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    leftIcon={<GitCompare className="w-3 h-3 text-emerald-400" />}
                    onClick={() => openDiffModal(rev, tab.lastExecutionOutput)}
                    title="Compare with latest response"
                  >
                    Diff
                  </Button>
                </div>

                <button
                  onClick={() => deleteRevision(tab.id, rev.revisionId)}
                  className="p-1 rounded text-text-muted hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                  title="Delete this revision"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {revisions.length === 0 && (
          <div className="py-12 text-center text-text-muted text-xs">
            <History className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
            <p>No execution history recorded yet.</p>
            <p className="text-[11px] text-text-muted/60 mt-1">
              Every request dispatched via Send or Ctrl+Enter is captured here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
