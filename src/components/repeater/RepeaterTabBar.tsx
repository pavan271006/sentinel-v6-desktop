import React, { useState, useRef, useEffect } from 'react';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { HttpMethod } from '../../types/repeater';
import {
  Plus,
  X,
  History,
  Sliders,
  GitCompare,
  RotateCcw,
  Columns,
  Rows,
  Copy,
  Edit2,
  Trash2,
} from 'lucide-react';

export const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-700/60' },
  POST: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-700/60' },
  PUT: { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-700/60' },
  DELETE: { bg: 'bg-red-950/60', text: 'text-red-400', border: 'border-red-700/60' },
  PATCH: { bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-700/60' },
  HEAD: { bg: 'bg-teal-950/60', text: 'text-teal-400', border: 'border-teal-700/60' },
  OPTIONS: { bg: 'bg-zinc-900', text: 'text-zinc-400', border: 'border-zinc-700' },
  TRACE: { bg: 'bg-zinc-900', text: 'text-zinc-400', border: 'border-zinc-700' },
  CONNECT: { bg: 'bg-zinc-900', text: 'text-zinc-400', border: 'border-zinc-700' },
};

export const RepeaterTabBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    closedTabsStack,
    globalVariables,
    isHistoryDrawerOpen,
    splitOrientation,
    setActiveTabId,
    createTab,
    closeTab,
    reopenClosedTab,
    duplicateTab,
    renameTab,
    clearTabHistory,
    toggleHistoryDrawer,
    toggleVariablesModal,
    openDiffModal,
    toggleSplitOrientation,
  } = useRepeaterStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const varCount = Object.keys(globalVariables).length + (activeTab ? Object.keys(activeTab.localVariables).length : 0);
  const historyCount = activeTab?.history?.length || 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
        setContextMenuTabId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleStartRename = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditTitle(currentTitle);
    setContextMenuPos(null);
  };

  const handleFinishRename = () => {
    if (editingTabId && editTitle.trim()) {
      renameTab(editingTabId, editTitle.trim());
    }
    setEditingTabId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenuTabId(tabId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex items-center justify-between bg-bg-panel-elevated border-b border-border-subtle px-2 h-10 select-none overflow-x-auto">
      {/* Tab Strip */}
      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const methodStyle = METHOD_COLORS[tab.method] || METHOD_COLORS.GET;
          const isEditing = editingTabId === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group relative flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-all cursor-pointer flex-shrink-0 max-w-[220px] ${
                isActive
                  ? 'bg-bg-panel border-accent-cyan/50 text-text-primary shadow-sm'
                  : 'bg-bg-canvas/50 border-border-subtle hover:bg-bg-panel text-text-muted hover:text-text-primary'
              }`}
              title={`${tab.title} (${tab.method} ${tab.url})`}
            >
              {/* Method Pill */}
              <span
                className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
              >
                {tab.method}
              </span>

              {/* Dirty indicator */}
              {tab.isDirty && (
                <span
                  data-testid="dirty-indicator"
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"
                  title="Unsaved changes"
                />
              )}

              {/* Title or Edit Input */}
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  autoFocus
                  className="bg-bg-canvas text-text-primary text-xs px-1 py-0.5 rounded outline-none border border-accent-cyan w-28"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={() => handleStartRename(tab.id, tab.title)}
                  className="truncate font-mono text-xs"
                >
                  {tab.title}
                </span>
              )}

              {/* Close Button */}
              {tabs.length > 1 && (
                <button
                  aria-label={`Close tab ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded text-text-muted hover:text-red-400 hover:bg-red-950/40 opacity-70 group-hover:opacity-100 transition-opacity"
                  title="Close Tab (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Tab Button */}
        <button
          aria-label="Add Repeater Tab"
          onClick={() => createTab()}
          className="flex items-center justify-center p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-panel rounded border border-border-subtle transition-colors flex-shrink-0"
          title="New Tab (Ctrl+T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Reopen Closed Tab Button */}
        {closedTabsStack.length > 0 && (
          <button
            onClick={reopenClosedTab}
            className="flex items-center gap-1 text-[11px] px-2 py-1 text-text-muted hover:text-accent-cyan hover:bg-bg-panel rounded border border-dashed border-border-subtle transition-colors flex-shrink-0"
            title={`Reopen Closed Tab: ${closedTabsStack[0].title} (Ctrl+Shift+T)`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reopen</span>
          </button>
        )}
      </div>

      {/* Right-side Action Toolbar */}
      <div className="flex items-center gap-1 flex-shrink-0 pl-2">
        {/* Variables Workbench */}
        <Button
          variant="secondary"
          size="xs"
          leftIcon={<Sliders className="w-3 h-3 text-accent-cyan" />}
          onClick={toggleVariablesModal}
          title="Dynamic Variables Workbench (Ctrl+Alt+V)"
        >
          <span>Variables</span>
          {varCount > 0 && (
            <Badge variant="info" size="xs">
              {varCount}
            </Badge>
          )}
        </Button>

        {/* Revision History Drawer */}
        <Button
          variant={isHistoryDrawerOpen ? 'primary' : 'secondary'}
          size="xs"
          leftIcon={<History className="w-3 h-3 text-accent-amber" />}
          onClick={toggleHistoryDrawer}
          title="Chronological Revision History (Ctrl+H)"
        >
          <span>History</span>
          {historyCount > 0 && (
            <Badge variant="warning" size="xs">
              {historyCount}
            </Badge>
          )}
        </Button>

        {/* Response Diff */}
        <Button
          variant="secondary"
          size="xs"
          leftIcon={<GitCompare className="w-3 h-3 text-emerald-400" />}
          onClick={() => openDiffModal()}
          title="Compare Response Differential (Ctrl+D)"
        >
          <span>Diff</span>
        </Button>

        {/* Split Orientation Toggle */}
        <Button
          variant="ghost"
          size="xs"
          onClick={toggleSplitOrientation}
          title={`Switch to ${splitOrientation === 'horizontal' ? 'Vertical' : 'Horizontal'} Split (Ctrl+\\)`}
        >
          {splitOrientation === 'horizontal' ? (
            <Columns className="w-3.5 h-3.5 text-text-muted" />
          ) : (
            <Rows className="w-3.5 h-3.5 text-text-muted" />
          )}
        </Button>
      </div>

      {/* Right-click Context Menu */}
      {contextMenuPos && contextMenuTabId && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-bg-panel-elevated border border-border-subtle rounded-md shadow-2xl py-1 w-44 text-xs select-none"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const t = tabs.find((x) => x.id === contextMenuTabId);
              if (t) handleStartRename(t.id, t.title);
            }}
            className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-text-primary hover:bg-bg-panel hover:text-accent-cyan"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Rename Tab</span>
          </button>
          <button
            onClick={() => {
              duplicateTab(contextMenuTabId);
              setContextMenuPos(null);
            }}
            className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-text-primary hover:bg-bg-panel hover:text-accent-cyan"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate Tab</span>
          </button>
          <button
            onClick={() => {
              clearTabHistory(contextMenuTabId);
              setContextMenuPos(null);
            }}
            className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-text-primary hover:bg-bg-panel hover:text-accent-amber"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
          <div className="h-px bg-border-subtle my-1" />
          <button
            disabled={tabs.length <= 1}
            onClick={() => {
              closeTab(contextMenuTabId);
              setContextMenuPos(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 w-full text-left ${
              tabs.length <= 1 ? 'text-text-muted cursor-not-allowed' : 'text-red-400 hover:bg-red-950/40'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Tab</span>
          </button>
        </div>
      )}
    </div>
  );
};
