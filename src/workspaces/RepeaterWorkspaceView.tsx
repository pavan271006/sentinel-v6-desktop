import React, { useEffect } from 'react';
import { useRepeaterStore } from '../stores/repeaterStore';
import { RepeaterTabBar } from '../components/repeater/RepeaterTabBar';
import { RequestEditorPanel } from '../components/repeater/RequestEditorPanel';
import { ResponseViewerPanel } from '../components/repeater/ResponseViewerPanel';
import { RepeaterHistoryDrawer } from '../components/repeater/RepeaterHistoryDrawer';
import { RepeaterVariablesModal } from '../components/repeater/RepeaterVariablesModal';
import { RepeaterDiffModal } from '../components/repeater/RepeaterDiffModal';
import { SplitPane } from '../design-system/SplitPane';
import { BurpInspectorPanel } from '../components/traffic/BurpInspectorPanel';
import { Sliders, FileText, Settings } from 'lucide-react';

export const RepeaterWorkspaceView: React.FC = () => {
  const {
    tabs,
    activeTabId,
    splitOrientation,
    sendRequest,
    createTab,
    closeTab,
    reopenClosedTab,
    toggleHistoryDrawer,
    openDiffModal,
    toggleVariablesModal,
    toggleSplitOrientation,
    isInspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    tabNotes,
    setTabNote,
    selectionData,
    updateTabRawRequest,
    applySelectionReplacement,
  } = useRepeaterStore();

  const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeRev = tab ? (tab.history[tab.activeRevisionIndex] || tab.lastExecutionOutput) : null;
  const rawResponse = activeRev
    ? (activeRev.responseRaw || `HTTP/1.1 ${activeRev.statusCode} ${activeRev.statusText}\r\n\r\n${activeRev.responseBody}`)
    : '';

  // Global Keyboard Shortcuts for Repeater Workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Enter: Send request
      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        if (activeTabId) {
          sendRequest(activeTabId);
        }
        return;
      }

      // Ctrl+Shift+T: Reopen closed tab
      if (isCmdOrCtrl && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        reopenClosedTab();
        return;
      }

      // Ctrl+T: New tab
      if (isCmdOrCtrl && !e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        createTab();
        return;
      }

      // Ctrl+W: Close active tab
      if (isCmdOrCtrl && !e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (tabs.length > 1 && activeTabId) {
          closeTab(activeTabId);
        }
        return;
      }

      // Ctrl+H: History drawer
      if (isCmdOrCtrl && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        toggleHistoryDrawer();
        return;
      }

      // Ctrl+D: Diff modal
      if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        openDiffModal();
        return;
      }

      // Ctrl+Alt+V: Variables modal
      if (isCmdOrCtrl && e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        toggleVariablesModal();
        return;
      }

      // Ctrl+\: Split orientation toggle
      if (isCmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        toggleSplitOrientation();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTabId,
    tabs.length,
    sendRequest,
    createTab,
    closeTab,
    reopenClosedTab,
    toggleHistoryDrawer,
    openDiffModal,
    toggleVariablesModal,
    toggleSplitOrientation,
  ]);

  return (
    <div className="flex flex-col h-full w-full bg-bg-canvas overflow-hidden select-none">
      {/* Top Tab Strip & Workspace Toolbar */}
      <RepeaterTabBar />

      {/* Main Work Area: Request/Response Split + Inspector/Notes Panel + Far Right Dock Strip */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center: Split View (Request & Response) */}
        <div className="flex-1 overflow-hidden relative min-w-0">
          <SplitPane
            direction={splitOrientation}
            initialSize={550}
            minSize={250}
            maxSize={1200}
            storageKey="sentinel_repeater_split"
            primary={<RequestEditorPanel />}
            secondary={<ResponseViewerPanel />}
          />

          {/* History Slide-Out Drawer */}
          <RepeaterHistoryDrawer />
        </div>

        {/* Right Collapsible Inspector / Notes Panel */}
        {isInspectorOpen && (
          <div className="w-80 md:w-96 flex-shrink-0 border-l border-[#2b2d30] bg-[#1e1f22] flex flex-col h-full overflow-hidden">
            {inspectorTab === 'inspector' ? (
              <BurpInspectorPanel
                rawRequest={tab?.rawRequest || ''}
                rawResponse={rawResponse}
                onUpdateRawRequest={(newRaw) => {
                  if (tab) updateTabRawRequest(tab.id, newRaw);
                }}
                selectionText={selectionData.text}
                onApplySelectionReplacement={(newText) => {
                  if (tab) applySelectionReplacement(tab.id, newText);
                }}
                onClose={() => setInspectorOpen(false)}
              />
            ) : (
              /* Notes Panel */
              <div className="flex-1 flex flex-col p-3 bg-[#1e1f22] text-[#dfdfdf]">
                <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2 mb-3">
                  <span className="font-bold text-white text-xs">Request Notes</span>
                  <button
                    onClick={() => setInspectorOpen(false)}
                    className="p-1 text-[#8c9099] hover:text-white rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={(tab && tabNotes[tab.id]) || ''}
                  onChange={(e) => tab && setTabNote(tab.id, e.target.value)}
                  placeholder="Type notes or observations for this repeater request..."
                  className="flex-1 w-full bg-[#141517] text-white p-2.5 rounded border border-[#2b2d30] focus:border-[#f37021] focus:outline-none font-sans text-xs resize-none leading-relaxed"
                  spellCheck={false}
                />
                <span className="text-[10px] text-[#6f737a] pt-2">Notes are automatically stored for this tab.</span>
              </div>
            )}
          </div>
        )}

        {/* Far Right Vertical Dock Tabs Strip (matching media_1788639123892.png) */}
        <div className="w-7 bg-[#1e1f22] border-l border-[#2b2d30] flex flex-col items-center flex-shrink-0 select-none py-1">
          {/* Inspector Tab */}
          <button
            onClick={() => {
              if (isInspectorOpen && inspectorTab === 'inspector') {
                setInspectorOpen(false);
              } else {
                setInspectorOpen(true);
                setInspectorTab('inspector');
              }
            }}
            className={`w-full py-3.5 flex flex-col items-center gap-1.5 transition-colors border-b border-[#2b2d30] ${
              isInspectorOpen && inspectorTab === 'inspector'
                ? 'bg-[#0284c7] text-white font-bold'
                : 'text-[#9da5b4] hover:text-white hover:bg-[#282b30]'
            }`}
            title="Toggle Inspector"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span style={{ writingMode: 'vertical-rl' }} className="text-[10px] tracking-wider font-medium">
              Inspector
            </span>
          </button>

          {/* Notes Tab */}
          <button
            onClick={() => {
              if (isInspectorOpen && inspectorTab === 'notes') {
                setInspectorOpen(false);
              } else {
                setInspectorOpen(true);
                setInspectorTab('notes');
              }
            }}
            className={`w-full py-3.5 flex flex-col items-center gap-1.5 transition-colors border-b border-[#2b2d30] ${
              isInspectorOpen && inspectorTab === 'notes'
                ? 'bg-[#0284c7] text-white font-bold'
                : 'text-[#9da5b4] hover:text-white hover:bg-[#282b30]'
            }`}
            title="Toggle Notes"
          >
            <FileText className="w-3.5 h-3.5" />
            <span style={{ writingMode: 'vertical-rl' }} className="text-[10px] tracking-wider font-medium">
              Notes
            </span>
          </button>

          {/* Bottom Settings Gear */}
          <div className="mt-auto pb-2 flex flex-col items-center">
            <button
              className="p-1.5 text-[#9da5b4] hover:text-white hover:bg-[#282b30] rounded transition-colors"
              title="Workspace Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RepeaterVariablesModal />
      <RepeaterDiffModal />
    </div>
  );
};
