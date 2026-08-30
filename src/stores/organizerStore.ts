import { create } from 'zustand';

export interface OrganizedItem {
  id: number;
  title: string;
  url: string;
  method: string;
  statusTag: 'To Investigate' | 'High Priority' | 'Exploited' | 'Reported';
  notes: string;
  addedAt: string;
  rawRequest?: string;
  rawResponse?: string;
}

export interface OrganizerState {
  items: OrganizedItem[];
  selectedItemId: number;
  setSelectedItemId: (id: number) => void;
  addItem: (item: Omit<OrganizedItem, 'id' | 'addedAt'>) => void;
  updateNotes: (id: number, notes: string) => void;
  updateStatusTag: (id: number, tag: OrganizedItem['statusTag']) => void;
  deleteItem: (id: number) => void;
  sendToOrganizer: (tx: any) => void;
}

export const useOrganizerStore = create<OrganizerState>((set) => ({
  items: [
    {
      id: 1,
      title: 'BOLA / IDOR on user invoice endpoint',
      url: 'https://target.local/api/v1/invoices/9924',
      method: 'GET',
      statusTag: 'High Priority',
      notes: 'Changing invoice ID returns customer PII without authorization check.',
      addedAt: '14:22:01',
    },
  ],
  selectedItemId: 1,
  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
  addItem: (item) =>
    set((state) => {
      const newItem: OrganizedItem = {
        ...item,
        id: Date.now(),
        addedAt: new Date().toLocaleTimeString(),
      };
      return { items: [newItem, ...state.items], selectedItemId: newItem.id };
    }),
  updateNotes: (id, notes) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, notes } : i)),
    })),
  updateStatusTag: (id, statusTag) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, statusTag } : i)),
    })),
  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),
  sendToOrganizer: (tx) => {
    const url = tx?.url || tx?.request?.url || 'https://target.local/';
    const method = tx?.method || tx?.request?.method || 'GET';
    const path = url.replace(/^https?:\/\/[^/]+/, '') || '/';
    const newItem: OrganizedItem = {
      id: Date.now(),
      title: `${method} ${path}`,
      url,
      method,
      statusTag: 'To Investigate',
      notes: 'Captured from HTTP history for in-depth inspection and validation.',
      addedAt: new Date().toLocaleTimeString(),
    };
    set((state) => ({
      items: [newItem, ...state.items],
      selectedItemId: newItem.id,
    }));
  },
}));
