"""
Security Context Graph Engine - Core Implementation
Module: research.prototypes.security_context_graph.engine
"""

from __future__ import annotations
from typing import Dict, List, Set, Optional, Tuple, Any, Callable
from collections import deque, defaultdict
import heapq
import math
import time

from .models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    Severity,
)


class SecurityContextGraph:
    """
    High-performance in-memory DAG / Directed Multigraph engine for modeling
    security contexts, assets, attack surfaces, vulnerabilities, and exploitation chains.
    """

    def __init__(self):
        self._nodes: Dict[str, GraphNode] = {}
        self._edges: Dict[str, GraphEdge] = {}
        
        # Fast Adjacency Indices
        # node_id -> list of edge_ids
        self._out_edges: Dict[str, List[str]] = defaultdict(list)
        self._in_edges: Dict[str, List[str]] = defaultdict(list)
        
        # Type indices: NodeType -> Set of node_ids
        self._nodes_by_type: Dict[NodeType, Set[str]] = defaultdict(set)
        # Edge Type indices: EdgeType -> Set of edge_ids
        self._edges_by_type: Dict[EdgeType, Set[str]] = defaultdict(set)

    # --------------------------------------------------------------------------
    # Mutation Primitives
    # --------------------------------------------------------------------------

    def add_node(self, node: GraphNode) -> str:
        """Add or update a node in the graph."""
        if node.id in self._nodes:
            old_type = self._nodes[node.id].node_type
            self._nodes_by_type[old_type].discard(node.id)
            
        self._nodes[node.id] = node
        self._nodes_by_type[node.node_type].add(node.id)
        return node.id

    def add_edge(self, edge: GraphEdge) -> str:
        """Add a directed edge between two existing nodes."""
        if edge.from_node not in self._nodes:
            raise ValueError(f"Source node {edge.from_node} does not exist in graph.")
        if edge.to_node not in self._nodes:
            raise ValueError(f"Target node {edge.to_node} does not exist in graph.")

        if edge.id in self._edges:
            # remove old indexing if overwriting
            old_edge = self._edges[edge.id]
            self._out_edges[old_edge.from_node].remove(edge.id)
            self._in_edges[old_edge.to_node].remove(edge.id)
            self._edges_by_type[old_edge.edge_type].discard(edge.id)

        self._edges[edge.id] = edge
        self._out_edges[edge.from_node].append(edge.id)
        self._in_edges[edge.to_node].append(edge.id)
        self._edges_by_type[edge.edge_type].add(edge.id)
        return edge.id

    def connect(self, from_node: str, to_node: str, edge_type: EdgeType, weight: float = 1.0, properties: Optional[Dict[str, Any]] = None) -> GraphEdge:
        """Convenience method to create and add an edge."""
        edge = GraphEdge(
            from_node=from_node,
            to_node=to_node,
            edge_type=edge_type,
            weight=weight,
            properties=properties or {}
        )
        self.add_edge(edge)
        return edge

    def remove_node(self, node_id: str) -> bool:
        """Remove a node and all its incident edges."""
        if node_id not in self._nodes:
            return False

        # Remove outgoing edges
        for edge_id in list(self._out_edges[node_id]):
            self.remove_edge(edge_id)

        # Remove incoming edges
        for edge_id in list(self._in_edges[node_id]):
            self.remove_edge(edge_id)

        node = self._nodes.pop(node_id)
        self._nodes_by_type[node.node_type].discard(node_id)
        self._out_edges.pop(node_id, None)
        self._in_edges.pop(node_id, None)
        return True

    def remove_edge(self, edge_id: str) -> bool:
        """Remove an edge by ID."""
        if edge_id not in self._edges:
            return False

        edge = self._edges.pop(edge_id)
        self._edges_by_type[edge.edge_type].discard(edge_id)
        if edge_id in self._out_edges[edge.from_node]:
            self._out_edges[edge.from_node].remove(edge_id)
        if edge_id in self._in_edges[edge.to_node]:
            self._in_edges[edge.to_node].remove(edge_id)
        return True

    # --------------------------------------------------------------------------
    # Retrieval & Inspection
    # --------------------------------------------------------------------------

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        return self._nodes.get(node_id)

    def get_edge(self, edge_id: str) -> Optional[GraphEdge]:
        return self._edges.get(edge_id)

    def get_nodes_by_type(self, node_type: NodeType) -> List[GraphNode]:
        return [self._nodes[nid] for nid in self._nodes_by_type[node_type] if nid in self._nodes]

    def get_edges_by_type(self, edge_type: EdgeType) -> List[GraphEdge]:
        return [self._edges[eid] for eid in self._edges_by_type[edge_type] if eid in self._edges]

    @property
    def node_count(self) -> int:
        return len(self._nodes)

    @property
    def edge_count(self) -> int:
        return len(self._edges)

    def get_successors(self, node_id: str, edge_types: Optional[Set[EdgeType]] = None) -> List[Tuple[GraphNode, GraphEdge]]:
        """Return list of (target_node, edge) for outgoing edges from node_id."""
        results = []
        for edge_id in self._out_edges.get(node_id, []):
            edge = self._edges.get(edge_id)
            if edge and (edge_types is None or edge.edge_type in edge_types):
                target = self._nodes.get(edge.to_node)
                if target:
                    results.append((target, edge))
        return results

    def get_predecessors(self, node_id: str, edge_types: Optional[Set[EdgeType]] = None) -> List[Tuple[GraphNode, GraphEdge]]:
        """Return list of (source_node, edge) for incoming edges to node_id."""
        results = []
        for edge_id in self._in_edges.get(node_id, []):
            edge = self._edges.get(edge_id)
            if edge and (edge_types is None or edge.edge_type in edge_types):
                source = self._nodes.get(edge.from_node)
                if source:
                    results.append((source, edge))
        return results

    # --------------------------------------------------------------------------
    # Cycle Detection & Topology (Tarjan's SCC & 3-Color DFS)
    # --------------------------------------------------------------------------

    def detect_cycles(self, max_cycles: int = 100) -> List[List[str]]:
        """
        Detect simple cycles in the directed graph using iterative DFS.
        Returns a list of cycle paths (sequences of node IDs).
        """
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {nid: WHITE for nid in self._nodes}
        cycles: List[List[str]] = []

        for start_node in self._nodes:
            if color[start_node] != WHITE:
                continue

            call_stack = [(start_node, 0, [t.id for t, _ in self.get_successors(start_node)])]
            path = [start_node]
            color[start_node] = GRAY

            while call_stack and len(cycles) < max_cycles:
                u, succ_idx, successors = call_stack[-1]

                if succ_idx < len(successors):
                    v = successors[succ_idx]
                    call_stack[-1] = (u, succ_idx + 1, successors)

                    if color.get(v, WHITE) == GRAY:
                        try:
                            cycle_start_idx = path.index(v)
                            cycle = list(path[cycle_start_idx:]) + [v]
                            cycles.append(cycle)
                        except ValueError:
                            pass
                    elif color.get(v, WHITE) == WHITE:
                        color[v] = GRAY
                        path.append(v)
                        call_stack.append((v, 0, [t.id for t, _ in self.get_successors(v)]))
                else:
                    call_stack.pop()
                    if path:
                        path.pop()
                    color[u] = BLACK

        return cycles

    def strongly_connected_components(self) -> List[List[str]]:
        """
        Iterative Tarjan's algorithm for finding Strongly Connected Components (SCC).
        Immune to recursion limits across large graphs.
        """
        index = 0
        indices: Dict[str, int] = {}
        lowlinks: Dict[str, int] = {}
        on_stack: Dict[str, bool] = {}
        tarjan_stack: List[str] = []
        sccs: List[List[str]] = []

        for initial_node in self._nodes:
            if initial_node in indices:
                continue

            call_stack = [(initial_node, 0, [t.id for t, _ in self.get_successors(initial_node)])]
            indices[initial_node] = index
            lowlinks[initial_node] = index
            index += 1
            tarjan_stack.append(initial_node)
            on_stack[initial_node] = True

            while call_stack:
                v, succ_idx, successors = call_stack[-1]

                if succ_idx < len(successors):
                    w = successors[succ_idx]
                    call_stack[-1] = (v, succ_idx + 1, successors)

                    if w not in indices:
                        indices[w] = index
                        lowlinks[w] = index
                        index += 1
                        tarjan_stack.append(w)
                        on_stack[w] = True
                        call_stack.append((w, 0, [t.id for t, _ in self.get_successors(w)]))
                    elif on_stack.get(w, False):
                        lowlinks[v] = min(lowlinks[v], indices[w])
                else:
                    call_stack.pop()
                    if lowlinks[v] == indices[v]:
                        scc = []
                        while True:
                            w = tarjan_stack.pop()
                            on_stack[w] = False
                            scc.append(w)
                            if w == v:
                                break
                        sccs.append(scc)

                    if call_stack:
                        parent_v = call_stack[-1][0]
                        lowlinks[parent_v] = min(lowlinks[parent_v], lowlinks[v])

        return sccs

    # --------------------------------------------------------------------------
    # Attack Path Reachability & Pathfinding
    # --------------------------------------------------------------------------

    def find_all_attack_paths(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 10,
        allowed_edge_types: Optional[Set[EdgeType]] = None
    ) -> List[List[str]]:
        """
        Find all acyclic directed paths from source_id to target_id up to max_depth.
        Returns list of node_id paths.
        """
        if source_id not in self._nodes or target_id not in self._nodes:
            return []

        paths: List[List[str]] = []
        
        # DFS with backtracking
        def dfs(current: str, depth: int, visited: Set[str], current_path: List[str]):
            if current == target_id:
                paths.append(list(current_path))
                return
            if depth >= max_depth:
                return

            for target, edge in self.get_successors(current, allowed_edge_types):
                nxt = target.id
                if nxt not in visited:
                    visited.add(nxt)
                    current_path.append(nxt)
                    dfs(nxt, depth + 1, visited, current_path)
                    current_path.pop()
                    visited.remove(nxt)

        dfs(source_id, 0, {source_id}, [source_id])
        return paths

    def shortest_attack_path(
        self,
        source_id: str,
        target_id: str,
        allowed_edge_types: Optional[Set[EdgeType]] = None
    ) -> Optional[Tuple[List[str], float]]:
        """
        Dijkstra's shortest weighted attack path.
        Returns (node_id_path, total_weight) or None if unreachable.
        """
        if source_id not in self._nodes or target_id not in self._nodes:
            return None

        # Min-heap: (accumulated_dist, node_id, path)
        distances: Dict[str, float] = {source_id: 0.0}
        pq = [(0.0, source_id, [source_id])]

        while pq:
            dist, u, path = heapq.heappop(pq)
            if u == target_id:
                return path, dist

            if dist > distances.get(u, float('inf')):
                continue

            for target, edge in self.get_successors(u, allowed_edge_types):
                v = target.id
                new_dist = dist + edge.weight
                if new_dist < distances.get(v, float('inf')):
                    distances[v] = new_dist
                    heapq.heappush(pq, (new_dist, v, path + [v]))

        return None

    def query_reachability(self, source_id: str, max_depth: int = 10) -> Set[str]:
        """
        Compute transitive reachability from source_id up to max_depth.
        Equivalent to SQL recursive CTE reachability query.
        """
        if source_id not in self._nodes:
            return set()

        visited: Set[str] = {source_id}
        queue = deque([(source_id, 0)])

        while queue:
            curr, depth = queue.popleft()
            if depth >= max_depth:
                continue

            for target, _ in self.get_successors(curr):
                nxt = target.id
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append((nxt, depth + 1))

        return visited

    def find_critical_bottlenecks(self, entry_points: List[str], crown_jewels: List[str], max_depth: int = 8) -> Dict[str, float]:
        """
        Identifies critical bottleneck nodes whose remediation / removal
        disconnects the maximum number of attack paths from entry points to crown jewels.
        Returns mapping of node_id -> bottleneck score (fraction of paths traversing this node).
        """
        node_traversal_counts: Dict[str, int] = defaultdict(int)
        total_paths = 0

        for entry in entry_points:
            for jewel in crown_jewels:
                paths = self.find_all_attack_paths(entry, jewel, max_depth=max_depth)
                for path in paths:
                    total_paths += 1
                    # Intermediate nodes (exclude source and target)
                    for node_id in path[1:-1]:
                        node_traversal_counts[node_id] += 1

        if total_paths == 0:
            return {}

        return {nid: count / total_paths for nid, count in node_traversal_counts.items()}

    # --------------------------------------------------------------------------
    # Graph Metrics & Analytics
    # --------------------------------------------------------------------------

    def compute_metrics(self) -> Dict[str, Any]:
        """
        Calculates comprehensive topological metrics for the security graph.
        """
        n = len(self._nodes)
        m = len(self._edges)

        if n == 0:
            return {
                "node_count": 0,
                "edge_count": 0,
                "density": 0.0,
                "node_counts_by_type": {},
                "edge_counts_by_type": {},
                "degree_distribution": {"avg_in_degree": 0.0, "avg_out_degree": 0.0, "max_degree": 0},
                "scc_count": 0,
                "has_cycles": False,
            }

        # Node / Edge breakdowns
        node_counts = {t.value: len(s) for t, s in self._nodes_by_type.items() if len(s) > 0}
        edge_counts = {t.value: len(s) for t, s in self._edges_by_type.items() if len(s) > 0}

        # Density: for directed graph with n > 1, max edges = n*(n-1)
        density = (m / (n * (n - 1))) if n > 1 else 0.0

        # Degree calculations
        in_degrees = [len(self._in_edges.get(nid, [])) for nid in self._nodes]
        out_degrees = [len(self._out_edges.get(nid, [])) for nid in self._nodes]
        total_degrees = [in_degrees[i] + out_degrees[i] for i in range(n)]

        avg_in = sum(in_degrees) / n
        avg_out = sum(out_degrees) / n
        max_deg = max(total_degrees) if total_degrees else 0

        # Cycles & SCCs
        sccs = self.strongly_connected_components()
        has_cycles = any(len(scc) > 1 for scc in sccs) or len(self.detect_cycles()) > 0

        return {
            "node_count": n,
            "edge_count": m,
            "density": round(density, 6),
            "node_counts_by_type": node_counts,
            "edge_counts_by_type": edge_counts,
            "degree_distribution": {
                "avg_in_degree": round(avg_in, 3),
                "avg_out_degree": round(avg_out, 3),
                "max_degree": max_deg,
            },
            "scc_count": len(sccs),
            "has_cycles": has_cycles,
        }

    def compute_degree_centrality(self) -> Dict[str, float]:
        """Compute normalized degree centrality for each node."""
        n = len(self._nodes)
        if n <= 1:
            return {nid: 0.0 for nid in self._nodes}

        scale = 1.0 / (n - 1)
        centrality = {}
        for nid in self._nodes:
            deg = len(self._out_edges.get(nid, [])) + len(self._in_edges.get(nid, []))
            centrality[nid] = deg * scale
        return centrality

    def compute_betweenness_centrality(self, sample_limit: Optional[int] = None) -> Dict[str, float]:
        """
        Brandes algorithm for betweenness centrality.
        """
        cb: Dict[str, float] = {nid: 0.0 for nid in self._nodes}
        nodes_list = list(self._nodes.keys())
        if sample_limit and sample_limit < len(nodes_list):
            import random
            sources = random.sample(nodes_list, sample_limit)
            scale_factor = len(nodes_list) / sample_limit
        else:
            sources = nodes_list
            scale_factor = 1.0

        for s in sources:
            S: List[str] = []
            P: Dict[str, List[str]] = defaultdict(list)
            sigma: Dict[str, int] = defaultdict(int)
            sigma[s] = 1
            d: Dict[str, int] = {s: 0}
            Q = deque([s])

            while Q:
                v = Q.popleft()
                S.append(v)
                for w_node, _ in self.get_successors(v):
                    w = w_node.id
                    if w not in d:
                        d[w] = d[v] + 1
                        Q.append(w)
                    if d[w] == d[v] + 1:
                        sigma[w] += sigma[v]
                        P[w].append(v)

            delta: Dict[str, float] = defaultdict(float)
            while S:
                w = S.pop()
                for v in P[w]:
                    if sigma[w] > 0:
                        delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w])
                if w != s:
                    cb[w] += delta[w]

        n = len(self._nodes)
        norm = (1.0 / ((n - 1) * (n - 2))) if n > 2 else 1.0
        return {nid: round(val * norm * scale_factor, 6) for nid, val in cb.items()}
