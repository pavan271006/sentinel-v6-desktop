import React from 'react';
import { Modal } from '../../design-system/Modal';
import { useVpnRotatorStore } from '../../stores/vpnRotatorStore';
import {
  RotateCw,
  Zap,
  Power,
} from 'lucide-react';

interface EgressControlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EgressControlModal: React.FC<EgressControlModalProps> = ({ isOpen, onClose }) => {
  const {
    isActive,
    currentNode,
    nodes,
    isRotating,
    rotateVpn,
    selectNode,
    toggleProxy,
  } = useVpnRotatorStore();

  const realProxies = nodes.filter((n) => !n.url.startsWith('direct://'));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🌐 Free GitHub Proxy Pool"
      size="xl"
    >
      <div className="space-y-4 text-xs font-sans text-[#dfdfdf]">
        {/* Top Active Status & Quick Controls */}
        <div className="p-4 bg-[#141517] rounded-xl border border-[#313438] flex items-center justify-between shadow-inner">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm font-mono">
                {isActive ? currentNode.url : 'Direct Connection (No Proxy)'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isActive
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {isActive ? 'PROXY ACTIVE' : 'PROXY OFF'}
              </span>
            </div>
            <div className="text-[#8c9099] text-xs">
              {isActive
                ? `Latency: ${currentNode.latencyMs}ms • Automated GitHub Residential Feeds`
                : 'All traffic dispatching directly via local network adapter.'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleProxy()}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded transition-colors text-xs cursor-pointer ${
                isActive
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isActive ? 'Turn Proxy OFF' : 'Turn Proxy ON'}</span>
            </button>
            <button
              onClick={() => rotateVpn()}
              disabled={isRotating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f37021] hover:bg-[#ff8533] text-white font-semibold rounded shadow transition-all disabled:opacity-50 cursor-pointer text-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
              <span>{isRotating ? 'Rotating...' : 'Rotate'}</span>
            </button>
          </div>
        </div>

        {/* Proxy Nodes Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[#8c9099] text-xs">
            <span>Discovered Free GitHub Proxies ({realProxies.length}):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {realProxies.length === 0 ? (
              <div className="col-span-2 p-6 text-center text-[#8c9099] bg-[#141517] rounded-xl border border-[#313438]">
                Fetching live verified proxies from GitHub...
              </div>
            ) : (
              realProxies.map((n) => {
                const isCurrent = currentNode.id === n.id && isActive;
                return (
                  <div
                    key={n.id}
                    onClick={() => selectNode(n.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-[#2b2d30] border-[#f37021] shadow-sm'
                        : 'bg-[#141517] border-[#313438] hover:border-[#4e5157] hover:bg-[#1a1b1e]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-semibold text-white font-mono text-xs">{n.ip}:{n.port}</div>
                        <div className="text-[10px] text-[#8c9099] uppercase">{n.protocol}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-400 font-mono">{n.latencyMs}ms</span>
                      {isCurrent && (
                        <div className="text-[9px] text-[#f37021] font-bold uppercase">Active</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center pt-2 border-t border-[#313438]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2b2d30] hover:bg-[#35383f] text-white font-medium rounded transition-colors text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
