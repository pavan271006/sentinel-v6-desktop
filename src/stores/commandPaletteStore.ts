import { create } from 'zustand';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Workspace' | 'Proxy' | 'Scope' | 'Testing' | 'Appearance' | 'System';
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  disabledReason?: string;
}

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  setSelectedIndex: (idx: number) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  query: '',
  selectedIndex: 0,
  open: () => set({ isOpen: true, query: '', selectedIndex: 0 }),
  close: () => set({ isOpen: false, query: '', selectedIndex: 0 }),
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
}));
