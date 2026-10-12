import React, { useEffect } from 'react';
import { HeaderBar } from './HeaderBar';
import { MainCanvas } from './MainCanvas';
import { BottomDrawer } from './BottomDrawer';
import { StatusBar } from './StatusBar';
import { CommandPalette } from '../palette/CommandPalette';
import { ToastProvider } from '../../design-system/Toast';
import { useAppShellStore } from '../../stores/appShellStore';
import { streamDispatcher } from '../../ipc/events';

export const AppShell: React.FC = () => {
  const { toggleSidebar, toggleTheme, zoomIn, zoomOut, resetZoom, uiZoom } = useAppShellStore();

  // Apply saved zoom level on mount
  useEffect(() => {
    if (uiZoom && uiZoom !== 100) {
      document.documentElement.style.zoom = `${(uiZoom / 100).toFixed(2)}`;
    }
  }, [uiZoom]);

  // Initialize event stream listener & global shortcuts
  useEffect(() => {
    streamDispatcher.startListening();

    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl+B: Toggle Sidebar
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      // Ctrl+Shift+D: Toggle Theme
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
      }
      // Ctrl + Plus / Equal: Zoom In
      else if (e.ctrlKey && (e.key === '=' || e.key === '+' || e.key === 'Add')) {
        e.preventDefault();
        zoomIn();
      }
      // Ctrl + Minus: Zoom Out
      else if (e.ctrlKey && (e.key === '-' || e.key === '_' || e.key === 'Subtract')) {
        e.preventDefault();
        zoomOut();
      }
      // Ctrl + 0: Reset Zoom
      else if (e.ctrlKey && (e.key === '0' || e.key === 'Digit0')) {
        e.preventDefault();
        resetZoom();
      }
    };

    const handleWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else if (e.deltaY > 0) {
          zoomOut();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Suppress default browser context menu globally
      e.preventDefault();
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    window.addEventListener('wheel', handleWheelZoom, { passive: false });
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcuts);
      window.removeEventListener('wheel', handleWheelZoom);
      window.removeEventListener('contextmenu', handleContextMenu);
      streamDispatcher.stopListening();
    };
  }, [toggleSidebar, toggleTheme, zoomIn, zoomOut, resetZoom]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-bg-app text-text-primary select-none">
      {/* 1. Header Bar with Menu & Primary Horizontal Tabs */}
      <HeaderBar />

      {/* 2. Main Middle Workspace Area (Full Canvas) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Center Main Canvas (Takes Full Workspace Width & Height) */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden relative bg-bg-input">
          <MainCanvas />
        </main>
      </div>

      {/* 3. Bottom Collapsible Drawer / Console */}
      <BottomDrawer />

      {/* 4. Bottom Status Bar */}
      <StatusBar />

      {/* 5. Command Palette Overlay (Ctrl+K) */}
      <CommandPalette />

      {/* 6. Toast Notifications */}
      <ToastProvider />
    </div>
  );
};
