import React, { useState } from 'react';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import { SplitPane } from '../design-system/SplitPane';
import { useToastStore } from '../stores/toastStore';
import { Network, ArrowRight } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  type: 'DOMAIN' | 'ENDPOINT' | 'IDENTITY' | 'FINDING' | 'RESOURCE';
  riskScore: number;
  connections: string[];
}

const SAMPLE_NODES: GraphNode[] = [
  { id: 'node-domain', label: 'target.local', type: 'DOMAIN', riskScore: 85, connections: ['node-ep-login', 'node-ep-invoices', 'node-ep-search'] },
  { id: 'node-ep-login', label: '/api/v1/auth/login', type: 'ENDPOINT', riskScore: 40, connections: ['node-ident-alice', 'node-ident-bob'] },
  { id: 'node-ep-invoices', label: '/api/v1/invoices/:id', type: 'ENDPOINT', riskScore: 92, connections: ['node-fnd-bola', 'node-res-invoice'] },
  { id: 'node-ep-search', label: '/api/v1/users/search', type: 'ENDPOINT', riskScore: 98, connections: ['node-fnd-sqli'] },
  { id: 'node-fnd-bola', label: 'BOLA Access Defect (HIGH)', type: 'FINDING', riskScore: 90, connections: ['node-res-invoice'] },
  { id: 'node-fnd-sqli', label: 'SQL Injection (CRITICAL)', type: 'FINDING', riskScore: 99, connections: ['node-res-db'] },
  { id: 'node-ident-alice', label: 'Alice (Tenant A)', type: 'IDENTITY', riskScore: 30, connections: ['node-res-invoice'] },
  { id: 'node-ident-bob', label: 'Bob (Tenant B)', type: 'IDENTITY', riskScore: 75, connections: ['node-fnd-bola'] },
  { id: 'node-res-invoice', label: 'Invoice #9042', type: 'RESOURCE', riskScore: 80, connections: [] },
  { id: 'node-res-db', label: 'SQLite Production DB', type: 'RESOURCE', riskScore: 100, connections: [] },
];

export const AttackGraphWorkspaceView: React.FC = () => {
  const { addToast } = useToastStore();
  const [nodes] = useState<GraphNode[]>(SAMPLE_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-fnd-sqli');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  return (
    <div className="flex flex-col w-full h-full bg-bg-app overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-accent-cyan" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Attack Surface Knowledge Graph & Choke Points</h1>
            <p className="text-xs text-text-secondary">SQLite recursive CTE attack graph mapping exploit paths from entrypoint to database.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="scope-in">CTE GRAPH ACTIVE</Badge>
          <Badge variant="neutral">{nodes.length} Graph Entities</Badge>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={700}
          minSize={400}
          maxSize={950}
          storageKey="attack_graph_split"
          primary={
            <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle p-4 overflow-y-auto space-y-4">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Attack Path Topology (Bounded Depth &le; 5)
              </span>

              <div className="grid grid-cols-2 gap-3">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      selectedNodeId === node.id
                        ? 'bg-bg-panel-elevated border-accent-cyan shadow-sm shadow-accent-cyan/20'
                        : 'bg-bg-app border-border-subtle hover:border-border-default'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Badge
                        variant={
                          node.type === 'FINDING' ? 'scope-deny' : node.type === 'RESOURCE' ? 'scope-deny' : 'neutral'
                        }
                      >
                        {node.type}
                      </Badge>
                      <span className="text-xs font-mono font-bold text-accent-cyan">Risk: {node.riskScore}</span>
                    </div>
                    <h3 className="text-xs font-bold text-text-primary font-mono truncate">{node.label}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-text-muted mt-2">
                      <span>{node.connections.length} outbound edge(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
          secondary={
            <div className="flex flex-col h-full bg-bg-app overflow-y-auto p-4 space-y-4">
              {selectedNode && (
                <div className="p-4 bg-bg-panel rounded border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                      Entity Graph Dossier
                    </span>
                    <Badge variant="neutral">{selectedNode.type}</Badge>
                  </div>

                  <h2 className="text-sm font-bold text-text-primary font-mono">{selectedNode.label}</h2>

                  <div className="p-2.5 bg-bg-panel-elevated rounded border border-border-subtle space-y-2 text-xs">
                    <span className="text-[10px] text-text-muted uppercase block font-semibold">Traversed Exploit Edges:</span>
                    {selectedNode.connections.length === 0 ? (
                      <p className="text-text-muted text-[11px]">Terminal sink / Leaf target entity.</p>
                    ) : (
                      selectedNode.connections.map((c) => (
                        <div key={c} className="flex items-center gap-2 font-mono text-accent-cyan">
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>{c}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => addToast({ type: 'info', title: `Filtered traffic and findings for node: ${selectedNode.label}` })}
                  >
                    Trace Attack Path in Repeater
                  </Button>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
