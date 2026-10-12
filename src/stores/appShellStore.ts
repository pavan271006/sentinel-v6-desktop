import { create } from 'zustand';
import { WorkspaceId, BottomDrawerTab, AppTheme } from '../types/shell';

interface AppShellState {
  activeWorkspace: WorkspaceId;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  bottomDrawerOpen: boolean;
  bottomDrawerTab: BottomDrawerTab;
  theme: AppTheme;
  uiZoom: number;

  // Project & Scope status
  activeProjectName: string | null;
  activeProjectDbPath: string | null;
  scopeActive: boolean;
  scopeRulesCount: number;

  // Proxy status
  proxyRunning: boolean;
  proxyPort: number;

  // System Diagnostics
  dbSizeBytes: number;
  memoryRssBytes: number;
  ipcLatencyMs: number;
  backendVersion: string;

  // Actions
  setActiveWorkspace: (ws: WorkspaceId) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleBottomDrawer: () => void;
  setBottomDrawerTab: (tab: BottomDrawerTab) => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setUiZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setProxyRunning: (running: boolean) => void;
  setScopeStatus: (active: boolean, count: number) => void;
  setActiveProjectName: (name: string | null) => void;
  setScopeRulesCount: (count: number) => void;
  updateDiagnostics: (metrics: Partial<{ dbSizeBytes: number; memoryRssBytes: number; ipcLatencyMs: number }>) => void;
  setProject: (name: string | null, dbPath: string | null) => void;
}

export const useAppShellStore = create<AppShellState>((set, get) => ({
  activeWorkspace: 'scanner',
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  bottomDrawerOpen: false,
  bottomDrawerTab: 'logs',
  theme: (localStorage.getItem('sentinel_theme') as AppTheme) || 'dark',
  uiZoom: Number(localStorage.getItem('sentinel_ui_zoom')) || 100,

  activeProjectName: 'Production Target Assessment',
  activeProjectDbPath: 'sentinel_assessment.db',
  scopeActive: true,
  scopeRulesCount: 4,

  proxyRunning: true,
  proxyPort: 8080,

  dbSizeBytes: 14200000, // 14.2 MB
  memoryRssBytes: 68500000, // 68.5 MB
  ipcLatencyMs: 0.42,
  backendVersion: '6.0.0 (FROZEN)',

  setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleInspector: () => set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
  toggleBottomDrawer: () => set((state) => ({ bottomDrawerOpen: !state.bottomDrawerOpen })),
  setBottomDrawerTab: (tab) => set({ bottomDrawerTab: tab, bottomDrawerOpen: true }),

  setTheme: (theme) => {
    localStorage.setItem('sentinel_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sentinel_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),

  setUiZoom: (zoom) => {
    const clamped = Math.min(200, Math.max(60, zoom));
    localStorage.setItem('sentinel_ui_zoom', String(clamped));
    document.documentElement.style.zoom = `${(clamped / 100).toFixed(2)}`;
    set({ uiZoom: clamped });
  },

  zoomIn: () => {
    const current = get().uiZoom;
    const next = Math.min(200, current + 10);
    localStorage.setItem('sentinel_ui_zoom', String(next));
    document.documentElement.style.zoom = `${(next / 100).toFixed(2)}`;
    set({ uiZoom: next });
  },

  zoomOut: () => {
    const current = get().uiZoom;
    const next = Math.max(60, current - 10);
    localStorage.setItem('sentinel_ui_zoom', String(next));
    document.documentElement.style.zoom = `${(next / 100).toFixed(2)}`;
    set({ uiZoom: next });
  },

  resetZoom: () => {
    localStorage.setItem('sentinel_ui_zoom', '100');
    document.documentElement.style.zoom = '1.0';
    set({ uiZoom: 100 });
  },

  setProxyRunning: (running) => set({ proxyRunning: running }),
  setScopeStatus: (active, count) => set({ scopeActive: active, scopeRulesCount: count }),
  setActiveProjectName: (name) => set({ activeProjectName: name }),
  setScopeRulesCount: (count) => set({ scopeRulesCount: count }),
  updateDiagnostics: (metrics) => set((state) => ({ ...state, ...metrics })),
  setProject: (name, dbPath) => set({ activeProjectName: name, activeProjectDbPath: dbPath }),
}));

