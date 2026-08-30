import { create } from 'zustand';
import { WorkspaceId, BottomDrawerTab, AppTheme } from '../types/shell';

interface AppShellState {
  activeWorkspace: WorkspaceId;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  bottomDrawerOpen: boolean;
  bottomDrawerTab: BottomDrawerTab;
  theme: AppTheme;

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
  setProxyRunning: (running: boolean) => void;
  setScopeStatus: (active: boolean, count: number) => void;
  setActiveProjectName: (name: string | null) => void;
  setScopeRulesCount: (count: number) => void;
  updateDiagnostics: (metrics: Partial<{ dbSizeBytes: number; memoryRssBytes: number; ipcLatencyMs: number }>) => void;
  setProject: (name: string | null, dbPath: string | null) => void;
}

export const useAppShellStore = create<AppShellState>((set) => ({
  activeWorkspace: 'traffic',
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  bottomDrawerOpen: false,
  bottomDrawerTab: 'logs',
  theme: (localStorage.getItem('sentinel_theme') as AppTheme) || 'dark',

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

  setProxyRunning: (running) => set({ proxyRunning: running }),
  setScopeStatus: (active, count) => set({ scopeActive: active, scopeRulesCount: count }),
  setActiveProjectName: (name) => set({ activeProjectName: name }),
  setScopeRulesCount: (count) => set({ scopeRulesCount: count }),
  updateDiagnostics: (metrics) => set((state) => ({ ...state, ...metrics })),
  setProject: (name, dbPath) => set({ activeProjectName: name, activeProjectDbPath: dbPath }),
}));

