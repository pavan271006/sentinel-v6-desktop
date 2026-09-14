/**
 * Sentinel V6 - Dynamic Attack Surface Knowledge Graph Engine
 *
 * Inspired by BloodHound & OWASP Amass.
 * Builds dynamic graph topologies connecting Domains -> Endpoints -> Parameters -> Findings -> Resources,
 * computing risk metrics and isolating critical choke-points from live proxy and scanner telemetry.
 */

import { TrafficSummary, TransactionDetails } from '../../types/traffic';
import { TransactionModel } from '../../types/models';

export type NodeType = 'DOMAIN' | 'ENDPOINT' | 'PARAMETER' | 'FINDING' | 'RESOURCE' | 'IDENTITY';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  riskScore: number;
  connections: string[];
  metadata?: Record<string, any>;
  isChokePoint?: boolean;
  blastRadius?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface AttackGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  chokePointsCount: number;
  highestRiskNode: GraphNode | null;
  totalEntities: number;
  criticalAttackPath?: string[];
}

export class AttackGraphEngine {
  /**
   * Generates dynamic attack surface graph from live proxy transactions and findings.
   */
  public static buildFromTraffic(
    transactions: (TrafficSummary | TransactionModel | TransactionDetails)[],
    findings: any[] = []
  ): AttackGraphData {
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Fallback seed if no traffic exists yet
    if (transactions.length === 0) {
      return AttackGraphEngine.getFallbackGraph();
    }

    // 1. Identify Target Host
    const firstTx = transactions[0];
    const host = ('host' in firstTx && firstTx.host) ? firstTx.host : 'target.local';
    const domainNodeId = `node-domain-${host.replace(/[^a-zA-Z0-9]/g, '_')}`;

    nodeMap.set(domainNodeId, {
      id: domainNodeId,
      label: host,
      type: 'DOMAIN',
      riskScore: 75,
      connections: [],
      metadata: { host },
    });

    // 2. Discover Unique Endpoints and Parameters
    const endpointMap = new Map<string, { method: string; path: string; params: Set<string>; status: number }>();

    for (const tx of transactions) {
      const url = 'request' in tx && tx.request?.url ? tx.request.url : (tx as any).url || '';
      const method = ('request' in tx && tx.request?.method ? tx.request.method : (tx as any).method || 'GET').toUpperCase();
      const status = 'response' in tx && tx.response?.statusCode ? tx.response.statusCode : (tx as any).status || 200;

      if (!url || url.match(/\.(js|css|png|jpg|gif|svg|ico|woff|woff2)$/i)) continue;

      try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        const key = `${method} ${path}`;

        if (!endpointMap.has(key)) {
          endpointMap.set(key, { method, path, params: new Set<string>(), status });
        }

        const epEntry = endpointMap.get(key)!;
        // Parse query params
        parsed.searchParams.forEach((_, paramName) => epEntry.params.add(paramName));

        // Parse body JSON params if present
        const reqBody = ('request' in tx && (tx.request as any)?.bodyText) ? (tx.request as any).bodyText : (tx as any).reqBody;
        if (reqBody && reqBody.startsWith('{')) {
          try {
            const bodyObj = JSON.parse(reqBody);
            Object.keys(bodyObj).forEach((k) => epEntry.params.add(k));
          } catch {
            // ignore non-JSON
          }
        }
      } catch {
        // ignore invalid URL
      }
    }

    // 3. Create Endpoint Nodes & Domain Edges
    const domainNode = nodeMap.get(domainNodeId)!;

    for (const [key, ep] of endpointMap.entries()) {
      const epNodeId = `node-ep-${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const isAuth = ep.path.includes('/auth') || ep.path.includes('/login') || ep.path.includes('/token');
      const isAdmin = ep.path.includes('/admin') || ep.path.includes('/manage');
      const isSensitive = isAuth || isAdmin || ep.path.includes('/user') || ep.path.includes('/invoice');

      let risk = isSensitive ? 75 : 30;
      if (isAdmin) risk = 88;
      if (ep.status >= 500) risk = Math.max(risk, 82);

      const epConnections: string[] = [];

      // Link domain to endpoint
      domainNode.connections.push(epNodeId);
      edges.push({
        id: `edge-${domainNodeId}-${epNodeId}`,
        source: domainNodeId,
        target: epNodeId,
        relation: 'EXPOSES_ROUTE',
      });

      // 4. Create Parameter Nodes & Endpoint Edges
      for (const param of ep.params) {
        const paramNodeId = `node-param-${epNodeId}-${param}`;
        const isDangerousParam = param.toLowerCase().includes('id') || param.toLowerCase().includes('token') || param.toLowerCase().includes('debug');
        const paramRisk = isDangerousParam ? 70 : 35;

        nodeMap.set(paramNodeId, {
          id: paramNodeId,
          label: `Param: ${param}`,
          type: 'PARAMETER',
          riskScore: paramRisk,
          connections: [],
        });

        epConnections.push(paramNodeId);
        edges.push({
          id: `edge-${epNodeId}-${paramNodeId}`,
          source: epNodeId,
          target: paramNodeId,
          relation: 'ACCEPTS_PARAM',
        });
      }

      nodeMap.set(epNodeId, {
        id: epNodeId,
        label: `${ep.method} ${ep.path}`,
        type: 'ENDPOINT',
        riskScore: risk,
        connections: epConnections,
        metadata: { method: ep.method, path: ep.path, status: ep.status },
      });
    }

    // 5. Connect Findings & Backend Resources
    let fndCount = 1;
    for (const f of findings) {
      const fndNodeId = `node-fnd-${fndCount++}`;
      const severity = (f.severity || 'HIGH').toUpperCase();
      const risk = severity === 'CRITICAL' ? 99 : severity === 'HIGH' ? 88 : 60;

      nodeMap.set(fndNodeId, {
        id: fndNodeId,
        label: `${f.title || f.name || 'Security Vulnerability'} (${severity})`,
        type: 'FINDING',
        riskScore: risk,
        connections: ['node-res-db'],
      });

      // Link domain to finding
      edges.push({
        id: `edge-fnd-${fndNodeId}`,
        source: domainNodeId,
        target: fndNodeId,
        relation: 'EXPLOITABLE_ON',
      });
    }

    // Add Core Backend Target Resources
    nodeMap.set('node-res-db', {
      id: 'node-res-db',
      label: 'Production Database & Persistent Store',
      type: 'RESOURCE',
      riskScore: 100,
      connections: [],
    });

    nodeMap.set('node-res-tokens', {
      id: 'node-res-tokens',
      label: 'Session Tokens & Identity Secrets',
      type: 'RESOURCE',
      riskScore: 95,
      connections: [],
    });

    // Calculate Choke Points & Blast Radius
    let chokeCount = 0;
    let highestRiskNode: GraphNode | null = null;

    for (const node of nodeMap.values()) {
      node.blastRadius = AttackGraphEngine.computeBlastRadius(node.id, edges);
      if (node.connections.length >= 3 || node.type === 'DOMAIN' || (node.blastRadius && node.blastRadius >= 3)) {
        node.isChokePoint = true;
        chokeCount++;
      }
      if (!highestRiskNode || node.riskScore > highestRiskNode.riskScore) {
        highestRiskNode = node;
      }
    }

    // Compute Critical Attack Path from domain perimeter to highest risk node
    const criticalAttackPath = highestRiskNode
      ? AttackGraphEngine.findShortestPath(domainNodeId, highestRiskNode.id, edges)
      : [];

    const nodes = Array.from(nodeMap.values());
    return {
      nodes,
      edges,
      chokePointsCount: chokeCount,
      highestRiskNode,
      totalEntities: nodes.length,
      criticalAttackPath,
    };
  }

  /**
   * Computes shortest attack path from an untrusted root node to target node via BFS
   */
  public static findShortestPath(startId: string, targetId: string, edges: GraphEdge[]): string[] {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }

    const queue: string[][] = [[startId]];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      if (current === targetId) {
        return path;
      }

      const neighbors = adj.get(current) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }

    return [];
  }

  /**
   * Computes downstream blast radius (count of all reachable nodes from a given node)
   */
  public static computeBlastRadius(startId: string, edges: GraphEdge[]): number {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }

    const visited = new Set<string>([startId]);
    const stack = [startId];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      const neighbors = adj.get(curr) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          stack.push(n);
        }
      }
    }

    return Math.max(0, visited.size - 1);
  }

  private static getFallbackGraph(): AttackGraphData {
    const fallbackNodes: GraphNode[] = [
      { id: 'node-domain', label: 'target.local', type: 'DOMAIN', riskScore: 85, connections: ['node-ep-login', 'node-ep-invoices', 'node-ep-search'], isChokePoint: true },
      { id: 'node-ep-login', label: 'POST /api/v1/auth/login', type: 'ENDPOINT', riskScore: 70, connections: ['node-res-tokens'], isChokePoint: false },
      { id: 'node-ep-invoices', label: 'GET /api/v1/invoices/:id', type: 'ENDPOINT', riskScore: 92, connections: ['node-fnd-bola', 'node-res-db'], isChokePoint: true },
      { id: 'node-ep-search', label: 'GET /api/v1/users/search', type: 'ENDPOINT', riskScore: 98, connections: ['node-fnd-sqli'], isChokePoint: false },
      { id: 'node-fnd-bola', label: 'BOLA Access Control Defect (HIGH)', type: 'FINDING', riskScore: 90, connections: ['node-res-db'] },
      { id: 'node-fnd-sqli', label: 'SQL Injection in Query Param (CRITICAL)', type: 'FINDING', riskScore: 99, connections: ['node-res-db'] },
      { id: 'node-res-tokens', label: 'Session Secret Vault', type: 'RESOURCE', riskScore: 95, connections: [] },
      { id: 'node-res-db', label: 'Backend Database Store', type: 'RESOURCE', riskScore: 100, connections: [] },
    ];

    const fallbackEdges: GraphEdge[] = [
      { id: 'e1', source: 'node-domain', target: 'node-ep-login', relation: 'EXPOSES_ROUTE' },
      { id: 'e2', source: 'node-domain', target: 'node-ep-invoices', relation: 'EXPOSES_ROUTE' },
      { id: 'e3', source: 'node-domain', target: 'node-ep-search', relation: 'EXPOSES_ROUTE' },
      { id: 'e4', source: 'node-ep-invoices', target: 'node-fnd-bola', relation: 'EXHIBITS_FLAW' },
      { id: 'e5', source: 'node-ep-search', target: 'node-fnd-sqli', relation: 'EXHIBITS_FLAW' },
      { id: 'e6', source: 'node-fnd-sqli', target: 'node-res-db', relation: 'COMPROMISES' },
      { id: 'e7', source: 'node-fnd-bola', target: 'node-res-db', relation: 'UNAUTHORIZED_READ' },
      { id: 'e8', source: 'node-ep-login', target: 'node-res-tokens', relation: 'GENERATES' },
    ];

    return {
      nodes: fallbackNodes,
      edges: fallbackEdges,
      chokePointsCount: 2,
      highestRiskNode: fallbackNodes[7],
      totalEntities: fallbackNodes.length,
    };
  }
}
