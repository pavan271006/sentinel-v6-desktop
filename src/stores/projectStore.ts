import { create } from 'zustand';
import {
  ProjectMetadata,
  RecentProjectInfo,
  WalStatusResult,
  ProjectExportResult,
  ProjectImportResult,
} from '../ipc/contracts';
import { ipcClient } from '../ipc/client';
import { useAppShellStore } from './appShellStore';
import { useScopeStore } from './scopeStore';
import { useToastStore } from './toastStore';

export type ProjectModalTab = 'new' | 'recent' | 'open' | 'settings' | 'export' | 'import';

export interface ProjectStoreState {
  currentProject: ProjectMetadata | null;
  recentProjects: RecentProjectInfo[];
  isModalOpen: boolean;
  activeModalTab: ProjectModalTab;
  isLoading: boolean;
  error: string | null;
  lastWalStatus: WalStatusResult | null;

  // Modal UI actions
  openModal: (tab?: ProjectModalTab) => void;
  closeModal: () => void;
  setActiveModalTab: (tab: ProjectModalTab) => void;

  // Project operations
  fetchCurrentProject: () => Promise<void>;
  fetchRecentProjects: () => Promise<void>;
  createProject: (name: string, path: string, seedScopeRules?: string[]) => Promise<ProjectMetadata>;
  openProject: (path: string) => Promise<void>;
  closeProject: () => Promise<void>;
  exportProject: (path: string, destZip: string, sanitized?: boolean) => Promise<ProjectExportResult>;
  importProject: (sourceZip: string, destDir: string) => Promise<ProjectImportResult>;
  commitWalCheckpoint: () => Promise<WalStatusResult>;
  pinProject: (id: string) => void;
  removeRecentProject: (id: string) => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isModalOpen: false,
  activeModalTab: 'new',
  isLoading: false,
  error: null,
  lastWalStatus: null,

  openModal: (tab = 'new') => {
    set({ isModalOpen: true, activeModalTab: tab, error: null });
    get().fetchRecentProjects();
    get().fetchCurrentProject();
  },

  closeModal: () => {
    set({ isModalOpen: false, error: null });
  },

  setActiveModalTab: (tab: ProjectModalTab) => {
    set({ activeModalTab: tab, error: null });
  },

  fetchCurrentProject: async () => {
    try {
      set({ isLoading: true, error: null });
      const current = await ipcClient.getCurrentProject();
      set({ currentProject: current, isLoading: false });
      if (current) {
        useAppShellStore.getState().setActiveProjectName(current.name);
        useAppShellStore.getState().setScopeRulesCount(current.scope_rules_count);
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  fetchRecentProjects: async () => {
    try {
      const recents = await ipcClient.listRecentProjects();
      set({ recentProjects: recents });
    } catch (err) {
      console.error('[ProjectStore] Failed to list recent projects:', err);
    }
  },

  createProject: async (name: string, path: string, seedScopeRules?: string[]) => {
    const { addToast } = useToastStore.getState();
    try {
      set({ isLoading: true, error: null });
      const metadata = await ipcClient.createProject(name, path, seedScopeRules);
      set({ currentProject: metadata, isLoading: false, isModalOpen: false });

      useAppShellStore.getState().setActiveProjectName(metadata.name);
      useAppShellStore.getState().setScopeRulesCount(metadata.scope_rules_count);
      addToast({
        type: 'success',
        title: `Created Project: ${metadata.name}`,
        description: `Database initialized at ${metadata.path} with WAL journaling`,
      });

      await get().fetchRecentProjects();
      return metadata;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      addToast({
        type: 'error',
        title: 'Project Creation Failed',
        description: String(err),
      });
      throw err;
    }
  },

  openProject: async (path: string) => {
    const { addToast } = useToastStore.getState();
    try {
      set({ isLoading: true, error: null });
      const state = await ipcClient.openProject(path);
      set({
        currentProject: state.metadata,
        isLoading: false,
        isModalOpen: false,
      });

      if (state.scope) {
        useScopeStore.setState({
          scopeId: state.scope.id,
          version: state.scope.version,
          timestamp: state.scope.timestamp,
          rules: state.scope.rules || [],
        });
        useAppShellStore.getState().setScopeRulesCount(
          (state.scope.rules || []).filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
        );
      } else {
        useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count || 0);
      }

      useAppShellStore.getState().setActiveProjectName(state.metadata.name);
      addToast({
        type: 'success',
        title: `Opened Project: ${state.metadata.name}`,
        description: `${state.metadata.transaction_count} transactions, ${state.metadata.finding_count} findings loaded`,
      });

      await get().fetchRecentProjects();
    } catch (err) {
      set({ error: String(err), isLoading: false });
      addToast({
        type: 'error',
        title: 'Open Project Failed',
        description: String(err),
      });
      throw err;
    }
  },

  closeProject: async () => {
    const { addToast } = useToastStore.getState();
    try {
      set({ isLoading: true, error: null });
      await ipcClient.closeProject();
      set({ currentProject: null, isLoading: false });
      useAppShellStore.getState().setActiveProjectName('');
      useAppShellStore.getState().setScopeRulesCount(0);
      addToast({
        type: 'info',
        title: 'Project Closed',
        description: 'SQLite WAL checkpoint committed cleanly',
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  exportProject: async (path: string, destZip: string, sanitized = false) => {
    const { addToast } = useToastStore.getState();
    try {
      set({ isLoading: true, error: null });
      const result = await ipcClient.exportProject(path, destZip, sanitized);
      set({ isLoading: false });
      addToast({
        type: 'success',
        title: sanitized ? 'Sanitized Project Export Complete' : 'Project Archive Exported',
        description: `Saved to ${result.archive_path} (SHA-256: ${result.sha256_checksum.slice(0, 12)}...)`,
      });
      return result;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      addToast({
        type: 'error',
        title: 'Export Failed',
        description: String(err),
      });
      throw err;
    }
  },

  importProject: async (sourceZip: string, destDir: string) => {
    const { addToast } = useToastStore.getState();
    try {
      set({ isLoading: true, error: null });
      const result = await ipcClient.importProject(sourceZip, destDir);
      set({ currentProject: result.metadata, isLoading: false, isModalOpen: false });

      useAppShellStore.getState().setActiveProjectName(result.metadata.name);
      useAppShellStore.getState().setScopeRulesCount(result.metadata.scope_rules_count);
      addToast({
        type: 'success',
        title: `Imported Project: ${result.metadata.name}`,
        description: `Unpacked to ${result.metadata.path}`,
      });

      await get().fetchRecentProjects();
      return result;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      addToast({
        type: 'error',
        title: 'Import Failed',
        description: String(err),
      });
      throw err;
    }
  },

  commitWalCheckpoint: async () => {
    const { addToast } = useToastStore.getState();
    try {
      set({ isLoading: true });
      const status = await ipcClient.walCheckpoint();
      set({ lastWalStatus: status, isLoading: false });
      addToast({
        type: 'success',
        title: 'SQLite WAL Snapshot Committed',
        description: `Journal mode: ${status.journal_mode}, ${status.page_count} pages fsynced`,
      });
      return status;
    } catch (err) {
      set({ isLoading: false });
      addToast({
        type: 'error',
        title: 'WAL Checkpoint Failed',
        description: String(err),
      });
      throw err;
    }
  },

  pinProject: (id: string) => {
    const updated = get().recentProjects.map((p) =>
      p.id === id ? { ...p, pinned: !p.pinned } : p
    );
    set({ recentProjects: updated });
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sentinel_v6_projects', JSON.stringify(updated));
      }
    } catch {}
  },

  removeRecentProject: (id: string) => {
    const updated = get().recentProjects.filter((p) => p.id !== id);
    set({ recentProjects: updated });
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sentinel_v6_projects', JSON.stringify(updated));
      }
    } catch {}
  },
}));
