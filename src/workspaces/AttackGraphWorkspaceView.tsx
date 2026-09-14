import React, { useState, useMemo } from 'react';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { useToastStore } from '../stores/toastStore';
import { useTrafficStore } from '../stores/trafficStore';
import {
  Network,
  RefreshCw,
  ArrowRight,
  Flame,
} from 'lucide-react';
import {
  AttackGraphEngine,
  NodeType,
} from '../services/attackGraph/AttackGraphEngine';

export const AttackGraphWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const { transactions } = useTrafficStore();

  const [filterType, setFilterType] = useState<NodeType | 'ALL'>('ALL');
  const [refreshKey, setRefreshKey] = useState(0);

  // Dynamically compute attack graph from live proxy traffic
  const graphData = useMemo(() => {
    return AttackGraphEngine.buildFromTraffic(transactions, [
      { name: 'SQL Injection in Query Param', severity: 'CRITICAL' },
      { name: 'BOLA Tenant Data Leak', severity: 'HIGH' },
    ]);
  }, [transactions, refreshKey]);

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    graphData.nodes[0]?.id || 'node-domain'
  );

  const selectedNode = graphData.nodes.find((n) => n.id === selectedNodeId) || graphData.nodes[0];

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    addToast({
      type: 'success',
      title: 'Attack Graph Recomputed',
      description: `Mapped ${graphData.totalEntities} entities and ${graphData.chokePointsCount} choke points from traffic stream`,
    });
  };

  const filteredNodes = graphData.nodes.filter((n) => {
    if (filterType !== 'ALL' && n.type !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[#38bdf8]" />
          <div>
            <span className="font-bold text-white text-xs">Attack Surface Knowledge Graph & Choke Points</span>
            <span className="bg-[#141517] text-[#34d399] border border-[#3e4249] px-2 py-0.5 rounded text-[10px] font-mono ml-2">
              BloodHound / Amass Topology
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            leftIcon={<RefreshCw className="w-3 h-3 text-[#38bdf8]" />}
            onClick={handleRefresh}
          >
            Rebuild from Traffic
          </Button>
          <Badge variant="scope-in">{graphData.chokePointsCount} CHOKE POINTS</Badge>
          <Badge variant="neutral">{graphData.totalEntities} Entities</Badge>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="p-2.5 bg-[#141517] border-b border-[#2b2d30] grid grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249] flex items-center justify-between">
          <span className="text-[#9da5b4]">Graph Nodes:</span>
          <span className="font-bold text-white">{graphData.totalEntities}</span>
        </div>
        <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249] flex items-center justify-between">
          <span className="text-[#9da5b4]">Exploit Edges:</span>
          <span className="font-bold text-[#38bdf8]">{graphData.edges.length}</span>
        </div>
        <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249] flex items-center justify-between">
          <span className="text-[#9da5b4]">Critical Choke Points:</span>
          <span className="font-bold text-[#f97316]">{graphData.chokePointsCount}</span>
        </div>
        <div className="bg-[#1e1f22] p-2 rounded border border-[#3e4249] flex items-center justify-between">
          <span className="text-[#9da5b4]">Max Path Risk:</span>
          <span className="font-bold text-[#ef4444]">{graphData.highestRiskNode?.riskScore || 100} / 100</span>
        </div>
      </div>

      {/* Main Split Layout: Left Nodes Grid, Right Choke Point Inspector */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={700}
          minSize={420}
          maxSize={980}
          storageKey="attack_graph_split_v6"
          primary={
            <div className="flex flex-col h-full bg-[#141517] border-r border-[#2b2d30] p-3 overflow-y-auto space-y-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'DOMAIN', 'ENDPOINT', 'PARAMETER', 'FINDING', 'RESOURCE'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      filterType === type
                        ? 'bg-[#38bdf8] text-black font-bold'
                        : 'bg-[#1e1f22] text-[#9da5b4] hover:text-white border border-[#3e4249]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Dynamic Entity Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {filteredNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`p-2.5 rounded border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#1e1f22] border-[#38bdf8] shadow-md shadow-[#38bdf8]/10'
                          : 'bg-[#1a1b1e] border-[#313438] hover:border-[#3e4249]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              node.type === 'FINDING'
                                ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40'
                                : node.type === 'RESOURCE'
                                ? 'bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/40'
                                : node.type === 'ENDPOINT'
                                ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                                : 'bg-[#3e4249] text-white'
                            }`}
                          >
                            {node.type}
                          </span>
                          {node.isChokePoint && (
                            <span className="px-1 bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/40 rounded text-[9px] font-bold">
                              CHOKE POINT
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-xs font-mono font-bold ${
                            node.riskScore >= 90
                              ? 'text-[#ef4444]'
                              : node.riskScore >= 70
                              ? 'text-[#f97316]'
                              : 'text-[#34d399]'
                          }`}
                        >
                          Risk: {node.riskScore}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-white font-mono truncate">{node.label}</h3>

                      <div className="flex items-center justify-between text-[10px] text-[#9da5b4] mt-2">
                        <div className="flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-[#38bdf8]" />
                          <span>{node.connections.length} targets</span>
                        </div>
                        {node.blastRadius !== undefined && node.blastRadius > 0 && (
                          <span className="text-[#f97316] font-mono font-semibold">
                            Radius: {node.blastRadius}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-[#1e1f22] overflow-y-auto p-4 space-y-4">
              {/* Critical Attack Path Corridor */}
              {graphData.criticalAttackPath && graphData.criticalAttackPath.length > 0 && (
                <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/40 rounded space-y-2">
                  <div className="flex items-center gap-1.5 text-[#ef4444] font-bold">
                    <Flame className="w-4 h-4" /> Shortest Attack Path Corridor (Dijkstra BFS)
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#dfdfdf] flex-wrap">
                    {graphData.criticalAttackPath.map((nodeId, idx) => {
                      const n = graphData.nodes.find((item) => item.id === nodeId);
                      return (
                        <React.Fragment key={nodeId}>
                          <span className="px-1.5 py-0.5 rounded bg-[#1e1f22] border border-[#3e4249] text-white font-bold text-[10px]">
                            {n ? n.label : nodeId}
                          </span>
                          {idx < graphData.criticalAttackPath!.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-[#f97316]" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedNode ? (
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-3 bg-[#141517] rounded border border-[#3e4249] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#9da5b4] uppercase">Selected Topology Node</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#38bdf8]/20 text-[#38bdf8]">
                        {selectedNode.type}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-white break-all">{selectedNode.label}</h2>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#9da5b4]">Composite Risk:</span>
                        <span className="font-bold text-[#ef4444] text-xs">{selectedNode.riskScore} / 100</span>
                      </div>
                      {selectedNode.blastRadius !== undefined && (
                        <div className="flex items-center gap-1 text-[11px] text-[#f97316]">
                          <span>Blast Radius:</span>
                          <span className="font-bold">{selectedNode.blastRadius} reachable nodes</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedNode.isChokePoint && (
                    <div className="p-3 bg-[#f97316]/10 border border-[#f97316]/40 rounded space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[#f97316] font-bold">
                        <Flame className="w-4 h-4" /> Strategic Choke Point Detected
                      </div>
                      <p className="text-[11px] text-white">
                        This entity sits directly on critical exploit corridors. Remediating vulnerabilities on this node neutralizes multiple downstream exploit branches.
                      </p>
                    </div>
                  )}

                  {/* Connected Nodes */}
                  <div className="p-3 bg-[#141517] rounded border border-[#3e4249] space-y-2">
                    <span className="text-[10px] text-[#9da5b4] uppercase font-semibold">
                      Outbound Relationships ({selectedNode.connections.length})
                    </span>
                    {selectedNode.connections.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedNode.connections.map((targetId) => {
                          const targetNode = graphData.nodes.find((n) => n.id === targetId);
                          return (
                            <div
                              key={targetId}
                              onClick={() => setSelectedNodeId(targetId)}
                              className="p-2 bg-[#1e1f22] rounded border border-[#3e4249] hover:border-[#38bdf8] cursor-pointer flex items-center justify-between text-[11px]"
                            >
                              <span className="text-[#38bdf8] truncate max-w-xs">{targetNode?.label || targetId}</span>
                              <span className="text-[10px] text-[#9da5b4]">{targetNode?.type || 'NODE'}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#9da5b4]">No outbound edges; this node represents an attack sink/terminus.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-[#9da5b4] py-16 text-xs">
                  Select a graph node to inspect attack path topology and choke points.
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
