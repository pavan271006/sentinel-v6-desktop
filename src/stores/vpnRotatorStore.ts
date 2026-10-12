import { create } from 'zustand';
import { useToastStore } from './toastStore';
import { ipcClient } from '../ipc/client';
import { FreeProxyHarvesterService } from '../services/contentDiscovery/FreeProxyHarvesterService';

export interface ProxyNode {
  id: string;
  url: string;
  ip: string;
  port: number;
  protocol: 'socks5' | 'http' | 'https';
  country: string;
  city: string;
  flag: string;
  latencyMs: number;
}

// Clean Direct Egress Node (Default & Most Trusted by WAFs)
export const DIRECT_NODE: ProxyNode = {
  id: 'direct-clean-isp',
  url: 'direct://local-isp',
  ip: 'Direct Network Egress',
  port: 0,
  protocol: 'https',
  country: 'Clean Residential ISP',
  city: 'Direct Connection (No Proxy/Tor)',
  flag: '⚡',
  latencyMs: 12,
};

export const DEFAULT_PROXY_POOL: ProxyNode[] = [
  DIRECT_NODE,
];

export interface VpnRotatorState {
  isActive: boolean;
  autoConnect: boolean;
  currentNode: ProxyNode;
  nodes: ProxyNode[];
  rawProxyText: string;
  rotationCount: number;
  isRotating: boolean;
  isHarvesting: boolean;
  
  // Actions
  initEgressIp: () => Promise<void>;
  toggleVpn: () => Promise<void>;
  toggleProxy: () => Promise<void>;
  setAutoConnect: (enabled: boolean) => void;
  rotateVpn: () => Promise<ProxyNode>;
  setProxyPoolFromText: (text: string) => Promise<void>;
  selectNode: (nodeId: string) => Promise<void>;
  getStealthIp: (cooldownMs?: number) => string;
  setDirectMode: () => Promise<void>;
  harvestFreeProxies: () => Promise<void>;
}

// Default to Direct Mode (Clean Residential / Local ISP) to prevent 403 WAF blocks
const isAutoConnectDefault = typeof window !== 'undefined'
  ? localStorage.getItem('sentinel_vpn_auto_connect') === 'true'
  : false;

export const useVpnRotatorStore = create<VpnRotatorState>((set, get) => {
  return {
    isActive: isAutoConnectDefault,
    autoConnect: isAutoConnectDefault,
    currentNode: DIRECT_NODE,
    nodes: DEFAULT_PROXY_POOL,
    rawProxyText: '',
    rotationCount: 1,
    isRotating: false,
    isHarvesting: false,

    setAutoConnect: (enabled: boolean) => {
      set({ autoConnect: enabled });
      if (typeof window !== 'undefined') {
        localStorage.setItem('sentinel_vpn_auto_connect', enabled ? 'true' : 'false');
      }
    },

    initEgressIp: async () => {
      // Automatically fetch free GitHub proxies on Sentinel startup
      try {
        await get().harvestFreeProxies();
      } catch (err) {
        console.warn('[Egress] Auto-harvest on startup failed:', err);
        await get().setDirectMode();
      }
    },

    setDirectMode: async () => {
      set({
        isActive: false,
        currentNode: DIRECT_NODE,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('sentinel_vpn_auto_connect', 'false');
      }
      try {
        await ipcClient.setUpstreamProxy(null);
        await ipcClient.toggleSystemVpn(false);
      } catch {}

      useToastStore.getState().addToast({
        type: 'info',
        title: 'Proxy Disengaged (OFF)',
        description: 'Switched to Direct Egress. Traffic now routes directly without proxy.',
      });
    },

    toggleProxy: async () => {
      const { isActive, nodes, currentNode } = get();
      if (isActive) {
        // Automatically turn OFF
        await get().setDirectMode();
      } else {
        // Automatically turn ON
        const realProxies = nodes.filter((n) => !n.url.startsWith('direct://'));
        if (realProxies.length > 0) {
          const nodeToUse = (!currentNode || currentNode.url.startsWith('direct://'))
            ? realProxies[0]
            : currentNode;
          await get().selectNode(nodeToUse.id);
        } else {
          // If no proxies in pool, harvest free GitHub proxies
          await get().harvestFreeProxies();
        }
      }
    },

    toggleVpn: async () => {
      await get().toggleProxy();
    },

    rotateVpn: async () => {
      const { rotationCount, nodes, currentNode } = get();
      const newCount = rotationCount + 1;
      set({ isRotating: true });

      // Filter available non-direct proxies
      const realProxies = nodes.filter((n) => !n.url.startsWith('direct://'));

      // If pool is low or empty, fetch new ones from GitHub immediately
      if (realProxies.length <= 1) {
        try {
          await get().harvestFreeProxies();
        } catch {}
        set({ isRotating: false });
        return get().currentNode;
      }

      // Cycle to the next proxy in the list
      const currentIndex = realProxies.findIndex((n) => n.id === currentNode.id);
      const nextIndex = (currentIndex + 1) % realProxies.length;
      const nextNode = realProxies[nextIndex];

      // Proactively harvest fresh proxies in background if getting close to end
      if (nextIndex >= realProxies.length - 2) {
        FreeProxyHarvesterService.harvestAndValidate(30).then((res) => {
          if (res.proxies.length > 0) {
            const currentList = get().nodes;
            const existingUrls = new Set(currentList.map((p) => p.url));
            const fresh = res.proxies.filter((p) => !existingUrls.has(p.url));
            if (fresh.length > 0) {
              set({ nodes: [...currentList, ...fresh] });
            }
          }
        }).catch(() => {});
      }

      try {
        await ipcClient.setUpstreamProxy(nextNode.url);
      } catch {}

      set({
        currentNode: nextNode,
        isActive: true,
        rotationCount: newCount,
        isRotating: false,
      });

      useToastStore.getState().addToast({
        type: 'success',
        title: `🌐 Proxy Rotated (#${newCount})`,
        description: `Active Node: ${nextNode.url} (${nextNode.latencyMs}ms)`,
      });

      return nextNode;
    },

    harvestFreeProxies: async () => {
      set({ isHarvesting: true });
      useToastStore.getState().addToast({
        type: 'info',
        title: '🔍 Harvesting Live Proxies',
        description: 'Scraping and probing open-source proxy feeds from GitHub...',
      });

      try {
        const result = await FreeProxyHarvesterService.harvestAndValidate(50);
        if (result.proxies.length > 0) {
          const newNodes = [DIRECT_NODE, ...result.proxies];
          const bestNode = result.proxies[0];
          set({
            nodes: newNodes,
            currentNode: bestNode,
            isActive: true,
            isHarvesting: false,
          });

          await ipcClient.setUpstreamProxy(bestNode.url);

          useToastStore.getState().addToast({
            type: 'success',
            title: `✅ Harvested ${result.workingCount} Live Free Proxies`,
            description: `Active proxy: ${bestNode.url} (${bestNode.latencyMs}ms latency)`,
          });
        } else {
          set({ isHarvesting: false });
          useToastStore.getState().addToast({
            type: 'warning',
            title: 'No Responsive Free Proxies Found',
            description: 'Public proxies timed out. Using Direct Clean Egress (recommended to avoid WAF blocks).',
          });
        }
      } catch (err: any) {
        set({ isHarvesting: false });
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Harvester Error',
          description: err.message || 'Failed to harvest open-source proxies.',
        });
      }
    },

    setProxyPoolFromText: async (text: string) => {
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));

      const newNodes: ProxyNode[] = lines.map((line, idx) => {
        let protocol: 'socks5' | 'http' | 'https' = 'http';
        let clean = line;
        if (line.startsWith('socks5://')) {
          protocol = 'socks5';
        } else if (line.startsWith('https://')) {
          protocol = 'https';
        } else if (line.startsWith('http://')) {
          protocol = 'http';
        } else {
          clean = `http://${line}`;
        }

        const urlObj = clean.replace(/^(socks5|http|https):\/\//, '');
        const [hostPort] = urlObj.split('@').reverse();
        const [ip, portStr] = hostPort.split(':');
        const port = parseInt(portStr || '8080', 10);

        return {
          id: `custom-proxy-${idx + 1}`,
          url: clean,
          ip: ip || '127.0.0.1',
          port,
          protocol,
          country: 'Custom Proxy',
          city: `Node #${idx + 1}`,
          flag: '🌐',
          latencyMs: 25 + (idx % 15),
        };
      });

      const updatedPool = newNodes.length > 0 ? [DIRECT_NODE, ...newNodes] : [DIRECT_NODE];
      const activeNode = newNodes.length > 0 ? newNodes[0] : DIRECT_NODE;

      set({
        nodes: updatedPool,
        rawProxyText: text,
        currentNode: activeNode,
        isActive: newNodes.length > 0,
      });

      if (newNodes.length > 0) {
        try {
          await ipcClient.setUpstreamProxy(activeNode.url);
        } catch {}
      } else {
        try {
          await ipcClient.setUpstreamProxy(null);
        } catch {}
      }

      useToastStore.getState().addToast({
        type: 'success',
        title: `Proxy Pool Updated (${newNodes.length} Nodes)`,
        description: `Active proxy: ${activeNode.url}`,
      });
    },

    selectNode: async (nodeId: string) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (node) {
        const isDirect = node.url.startsWith('direct://');
        set({ currentNode: node, isActive: !isDirect });
        try {
          await ipcClient.setUpstreamProxy(isDirect ? null : node.url);
          if (isDirect) {
            await ipcClient.toggleSystemVpn(false);
          }
        } catch {}
        useToastStore.getState().addToast({
          type: 'success',
          title: `Selected: ${node.flag} ${node.url}`,
          description: isDirect
            ? 'Direct clean connection (Zero proxy/Tor interference)'
            : `Routing via ${node.city}, ${node.country}`,
        });
      }
    },

    getStealthIp: (_cooldownMs = 30000) => {
      const nodes = get().nodes;
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      return node.ip;
    },
  };
});
