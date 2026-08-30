import React, { useEffect } from 'react';
import { useRepeaterStore } from '../stores/repeaterStore';
import { RepeaterTabBar } from '../components/repeater/RepeaterTabBar';
import { RequestEditorPanel } from '../components/repeater/RequestEditorPanel';
import { ResponseViewerPanel } from '../components/repeater/ResponseViewerPanel';
import { RepeaterHistoryDrawer } from '../components/repeater/RepeaterHistoryDrawer';
import { RepeaterVariablesModal } from '../components/repeater/RepeaterVariablesModal';
import { RepeaterDiffModal } from '../components/repeater/RepeaterDiffModal';
import { SplitPane } from '../design-system/SplitPane';

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
  } = useRepeaterStore();

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

      {/* Main 2-Pane Split Work Area */}
      <div className="flex-1 overflow-hidden relative">
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

      {/* Modals */}
      <RepeaterVariablesModal />
      <RepeaterDiffModal />
    </div>
  );
};
