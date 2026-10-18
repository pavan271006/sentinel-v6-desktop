import { create } from 'zustand';
import type { SiteMapRequest } from '../workspaces/ProjectScopeWorkspaceView';
import type { UnifiedReconProgress, ReconEngineType } from '../services/contentDiscovery/UnifiedReconOrchestrator';
import type { WebsiteKnowledgeBase } from '../services/contentDiscovery/SentinelAgentBridge';

export type StealthSpeedType = 'turbo' | 'fast' | 'normal' | 'human' | 'deep';

export interface ReconStoreState {
  isCrawling: boolean;
  crawlerTarget: string;
  discoveredEndpointsCount: number;
  activeReconEngine: ReconEngineType;
  reconProgress: UnifiedReconProgress | null;
  stealthSpeed: StealthSpeedType;
  crawlerDiscoveredItems: SiteMapRequest[];
  latestKnowledgeBase: WebsiteKnowledgeBase | null;

  setIsCrawling: (isCrawling: boolean) => void;
  setCrawlerTarget: (target: string) => void;
  setDiscoveredEndpointsCount: (count: number | ((prev: number) => number)) => void;
  setActiveReconEngine: (engine: ReconEngineType) => void;
  setReconProgress: (progress: UnifiedReconProgress | null) => void;
  setStealthSpeed: (speed: StealthSpeedType) => void;
  setCrawlerDiscoveredItems: (items: SiteMapRequest[] | ((prev: SiteMapRequest[]) => SiteMapRequest[])) => void;
  addCrawlerDiscoveredItem: (item: SiteMapRequest) => void;
  setLatestKnowledgeBase: (kb: WebsiteKnowledgeBase | null) => void;
  clearDiscoveredItems: () => void;
}

export const useReconStore = create<ReconStoreState>((set) => ({
  isCrawling: false,
  crawlerTarget: '',
  discoveredEndpointsCount: 0,
  activeReconEngine: 'normal',
  reconProgress: null,
  stealthSpeed: 'fast',
  crawlerDiscoveredItems: [],
  latestKnowledgeBase: null,

  setIsCrawling: (isCrawling) => set({ isCrawling }),
  setCrawlerTarget: (crawlerTarget) => set({ crawlerTarget }),
  setDiscoveredEndpointsCount: (updater) =>
    set((state) => ({
      discoveredEndpointsCount: typeof updater === 'function' ? updater(state.discoveredEndpointsCount) : updater,
    })),
  setActiveReconEngine: (activeReconEngine) => set({ activeReconEngine }),
  setReconProgress: (reconProgress) => set({ reconProgress }),
  setStealthSpeed: (stealthSpeed) => set({ stealthSpeed }),
  setCrawlerDiscoveredItems: (updater) =>
    set((state) => ({
      crawlerDiscoveredItems: typeof updater === 'function' ? updater(state.crawlerDiscoveredItems) : updater,
    })),
  addCrawlerDiscoveredItem: (item) =>
    set((state) => {
      const exists = state.crawlerDiscoveredItems.some(
        (i) => i.id === item.id || (i.method === item.method && i.url === item.url && i.host === item.host)
      );
      if (exists) return state;
      return {
        crawlerDiscoveredItems: [...state.crawlerDiscoveredItems, item],
        discoveredEndpointsCount: state.crawlerDiscoveredItems.length + 1,
      };
    }),
  setLatestKnowledgeBase: (latestKnowledgeBase) => set({ latestKnowledgeBase }),
  clearDiscoveredItems: () => set({ crawlerDiscoveredItems: [], discoveredEndpointsCount: 0, latestKnowledgeBase: null }),
}));
