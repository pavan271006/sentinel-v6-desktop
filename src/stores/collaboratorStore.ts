import { create } from 'zustand';
import { InteractshClient, OastInteraction } from '../services/sqlScanner/engine/InteractshClient';

export interface CollaboratorStore {
  activePayload: string;
  domain: string;
  customDomain: string;
  serverStatus: 'idle' | 'registering' | 'active' | 'error';
  isPolling: boolean;
  interactions: OastInteraction[];
  lastPollTime: number | null;
  error: string | null;

  initSession: (customDomainOverride?: string) => Promise<string>;
  generateNewPayload: () => string;
  pollNow: () => Promise<OastInteraction[]>;
  setCustomDomain: (domain: string) => void;
  clearInteractions: () => void;
}

export const useCollaboratorStore = create<CollaboratorStore>((set, get) => ({
  activePayload: '',
  domain: '',
  customDomain: '',
  serverStatus: 'idle',
  isPolling: false,
  interactions: [],
  lastPollTime: null,
  error: null,

  setCustomDomain: (customDomain: string) => {
    set({ customDomain });
  },

  clearInteractions: () => {
    set({ interactions: [] });
  },

  initSession: async (customDomainOverride?: string) => {
    const custom = customDomainOverride !== undefined ? customDomainOverride : get().customDomain.trim();
    set({ serverStatus: 'registering', error: null });

    try {
      const client = InteractshClient.getInstance();
      const session = await client.initialize(undefined, custom || undefined);

      const fqdn = client.generateCallbackDomain('manual', 'Generic', 'dns', 'collaborator_tab');
      set({
        domain: session.domain,
        activePayload: fqdn,
        serverStatus: 'active',
        error: null,
      });
      return fqdn;
    } catch (err: any) {
      const msg = err?.message || 'Failed to initialize Collaborator session';
      set({ serverStatus: 'error', error: msg });
      return '';
    }
  },

  generateNewPayload: () => {
    const client = InteractshClient.getInstance();
    const session = client.getSession();
    if (!session || !session.active) {
      get().initSession();
      return '';
    }
    const fqdn = client.generateCallbackDomain('manual', 'Generic', 'dns', `manual_token_${Date.now()}`);
    set({ activePayload: fqdn });
    return fqdn;
  },

  pollNow: async () => {
    const client = InteractshClient.getInstance();
    const session = client.getSession();
    if (!session) return [];

    set({ isPolling: true });
    try {
      const newInteractions = await client.pollInteractions(500);
      set((state) => {
        const existingIds = new Set(state.interactions.map((i) => i.id));
        const added = newInteractions.filter((i) => !existingIds.has(i.id));
        return {
          interactions: [...added, ...state.interactions],
          lastPollTime: Date.now(),
          isPolling: false,
        };
      });
      return newInteractions;
    } catch {
      set({ isPolling: false });
      return [];
    }
  },
}));
