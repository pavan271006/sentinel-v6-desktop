"""
Security Context Graph Engine - Core Implementation
Module: research.theory_lab.context_graph.engine
"""

from __future__ import annotations
from typing import Dict, List, Set, Optional, Tuple, Any, Callable
from collections import deque, defaultdict
import heapq
import math
import time
import sqlite3
import json

from .models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    Severity,
    AttackPathResult,
    BottleneckResult,
    GraphMetrics,
)


class ContextGraphEngine:
    """
    High-performance in-memory and SQLite CTE DAG / Directed Multigraph engine
    for modeling security contexts, assets, attack surfaces, vulnerabilities,
    and multi-hop exploitation chains.
    """

    def __init__(self):
        self._nodes: Dict[str, GraphNode] = {}
        self._edges: Dict[str, GraphEdge] = {}
        
        # Fast Adjacency Indices
        self._out_edges: Dict[str, List[str]] = defaultdict(list)
        self._in_edges: Dict[str, List[str]] = defaultdict(list)
        
        # Type indices
        self._nodes_by_type: Dict[NodeType, Set[str]] = defaultdict(set)
        self._edges_by_type: Dict[EdgeType, Set[str]] = defaultdict(set)

    # --------------------------------------------------------------------------
    # Mutation Primitives
    # --------------------------------------------------------------------------

    def add_node(self, node: GraphNode) -> str:
        """Add or update a node in the graph (enforces SEC-01 scope tag)."""
        if not node.scope_in_bounds:
            # SEC-01: Fail-closed out-of-scope rejection
            return node.id

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
            old_edge = self._edges[edge.id]
            self._out_edges[old_edge.from_node].remove(edge.id)
            self._in_edges[old_edge.to_node].remove(edge.id)
            self._edges_by_type[old_edge.edge_type].discard(edge.id)

        self._edges[edge.id] = edge
        self._out_edges[edge.from_node].append(edge.id)
        self._in_edges[edge.to_node].append(edge.id)
        self._edges_by_type[edge.edge_type].add(edge.id)
        return edge.id

    def connect(
        self,
        from_node: str,
        to_node: str,
        edge_type: EdgeType,
        weight: float = 1.0,
        properties: Optional[Dict[str, Any]] = None
    ) -> GraphEdge:
        """Convenience method to create and add a directed edge."""
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
        """Remove a node and all incident edges."""
        if node_id not in self._nodes:
            return False

        for edge_id in list(self._out_edges[node_id]):
            self.remove_edge(edge_id)

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
        if edge.id in self._out_edges[edge.from_node]:
            self._out_edges[edge.from_node].remove(edge.id)
        if edge.id in self._in_edges[edge.to_node]:
            self._in_edges[edge.to_node].remove(edge.id)
        self._edges_by_type[edge.edge_type].discard(edge.id)
        return True

    # --------------------------------------------------------------------------
    # Retrieval & Filtering
    # --------------------------------------------------------------------------

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        return self._nodes.get(node_id)

    def get_edge(self, edge_id: str) -> Optional[GraphEdge]:
        return self._edges.get(edge_id)

    @property
    def nodes(self) -> Dict[str, GraphNode]:
        return self._nodes

    @property
    def edges(self) -> Dict[str, GraphEdge]:
        return self._edges

    def get_nodes_by_type(self, node_type: NodeType) -> List[GraphNode]:
        return [self._nodes[nid] for nid in self._nodes_by_type[node_type] if nid in self._nodes]

    def get_edges_by_type(self, edge_type: EdgeType) -> List[GraphEdge]:
        return [self._edges[eid] for eid in self._edges_by_type[edge_type] if eid in self._edges]

    def get_neighbors_out(self, node_id: str) -> List[GraphNode]:
        """Get nodes that node_id points to."""
        targets = [self._edges[eid].to_node for eid in self._out_edges.get(node_id, [])]
        return [self._nodes[nid] for nid in targets if nid in self._nodes]

    def get_neighbors_in(self, node_id: str) -> List[GraphNode]:
        """Get nodes that point to node_id."""
        sources = [self._edges[eid].from_node for eid in self._in_edges.get(node_id, [])]
        return [self._nodes[nid] for nid in sources if nid in self._nodes]

    # --------------------------------------------------------------------------
    # Graph Analytics & Attack Path Algorithms
    # --------------------------------------------------------------------------

    def query_reachability(
        self,
        start_node_id: str,
        max_depth: int = 10,
        allowed_edge_types: Optional[Set[EdgeType]] = None
    ) -> List[Tuple[str, int]]:
        """
        Calculates all reachable nodes from start_node_id using BFS within max_depth.
        Returns list of (node_id, depth).
        """
        if start_node_id not in self._nodes:
            return []

        visited: Dict[str, int] = {start_node_id: 0}
        queue: deque[Tuple[str, int]] = deque([(start_node_id, 0)])

        while queue:
            curr_id, depth = queue.popleft()
            if depth >= max_depth:
                continue

            for edge_id in self._out_edges.get(curr_id, []):
                edge = self._edges[edge_id]
                if allowed_edge_types and edge.edge_type not in allowed_edge_types:
                    continue

                nxt_id = edge.to_node
                if nxt_id not in visited:
                    visited[nxt_id] = depth + 1
                    queue.append((nxt_id, depth + 1))

        return [(nid, d) for nid, d in visited.items() if nid != start_node_id]

    def shortest_attack_path(
        self,
        start_node_id: str,
        target_node_id: str,
        edge_weight_fn: Optional[Callable[[GraphEdge], float]] = None
    ) -> Optional[AttackPathResult]:
        """
        Finds the lowest-cost attack trajectory from start to target using Dijkstra's algorithm.
        """
        if start_node_id not in self._nodes or target_node_id not in self._nodes:
            return None

        # distances: node_id -> best known cost
        dist: Dict[str, float] = {start_node_id: 0.0}
        prev_node: Dict[str, str] = {}
        prev_edge: Dict[str, str] = {}

        # priority queue: (cost, node_id)
        pq: List[Tuple[float, str]] = [(0.0, start_node_id)]

        while pq:
            curr_cost, curr_node = heapq.heappop(pq)

            if curr_node == target_node_id:
                break

            if curr_cost > dist.get(curr_node, float("inf")):
                continue

            for edge_id in self._out_edges.get(curr_node, []):
                edge = self._edges[edge_id]
                w = edge_weight_fn(edge) if edge_weight_fn else edge.weight
                nxt_node = edge.to_node
                new_cost = curr_cost + w

                if new_cost < dist.get(nxt_node, float("inf")):
                    dist[nxt_node] = new_cost
                    prev_node[nxt_node] = curr_node
                    prev_edge[nxt_node] = edge_id
                    heapq.heappush(pq, (new_cost, nxt_node))

        if target_node_id not in dist:
            return None

        # Reconstruct path
        path_nodes: List[str] = []
        path_edges: List[str] = []
        curr = target_node_id

        while curr != start_node_id:
            path_nodes.append(curr)
            edge_id = prev_edge[curr]
            path_edges.append(edge_id)
            curr = prev_node[curr]
        path_nodes.append(start_node_id)

        path_nodes.reverse()
        path_edges.reverse()

        critical_findings = [
            nid for nid in path_nodes
            if self._nodes[nid].node_type == NodeType.FINDING
        ]

        return AttackPathResult(
            source_node_id=start_node_id,
            target_node_id=target_node_id,
            path_nodes=path_nodes,
            path_edges=path_edges,
            total_cost=dist[target_node_id],
            hop_count=len(path_edges),
            critical_findings=critical_findings
        )

    def find_all_attack_paths(
        self,
        start_node_id: str,
        target_node_id: str,
        max_depth: int = 8,
        max_paths: int = 100
    ) -> List[List[str]]:
        """Finds all distinct simple attack paths between start and target."""
        if start_node_id not in self._nodes or target_node_id not in self._nodes:
            return []

        all_paths: List[List[str]] = []

        def dfs(curr: str, path: List[str], visited: Set[str]):
            if len(all_paths) >= max_paths:
                return
            if curr == target_node_id:
                all_paths.append(list(path))
                return
            if len(path) > max_depth:
                return

            for edge_id in self._out_edges.get(curr, []):
                nxt = self._edges[edge_id].to_node
                if nxt not in visited:
                    visited.add(nxt)
                    path.append(nxt)
                    dfs(nxt, path, visited)
                    path.pop()
                    visited.remove(nxt)

        dfs(start_node_id, [start_node_id], {start_node_id})
        return all_paths

    def analyze_bottlenecks(
        self,
        entry_nodes: List[str],
        crown_jewel_targets: List[str]
    ) -> List[BottleneckResult]:
        """
        Identifies critical bottleneck articulation nodes across all attack trajectories.
        Bottleneck index B(u) = (paths through u) / (total paths).
        """
        all_paths: List[List[str]] = []
        for src in entry_nodes:
            for dst in crown_jewel_targets:
                paths = self.find_all_attack_paths(src, dst)
                all_paths.extend(paths)

        total_paths = len(all_paths)
        if total_paths == 0:
            return []

        node_path_counts: Dict[str, int] = defaultdict(int)
        endpoints_set = set(entry_nodes) | set(crown_jewel_targets)

        for p in all_paths:
            # exclude start and end nodes from intermediate bottleneck count
            intermediates = set(p[1:-1]) if len(p) > 2 else set()
            for nid in intermediates:
                node_path_counts[nid] += 1

        results: List[BottleneckResult] = []
        for nid, count in node_path_counts.items():
            ratio = count / float(total_paths)
            node_label = self._nodes[nid].label if nid in self._nodes else nid
            results.append(BottleneckResult(
                bottleneck_node_id=nid,
                bottleneck_label=node_label,
                affected_paths_count=count,
                total_attack_paths_count=total_paths,
                criticality_ratio=round(ratio, 4)
            ))

        results.sort(key=lambda x: x.criticality_ratio, reverse=True)
        return results

    def strongly_connected_components(self) -> List[List[str]]:
        """
        Computes strongly connected components (SCCs) using Tarjan's algorithm.
        Enables cyclic dependency clustering and condensation graph generation.
        """
        index = 0
        indices: Dict[str, int] = {}
        lowlinks: Dict[str, int] = {}
        on_stack: Dict[str, bool] = {}
        stack: List[str] = []
        sccs: List[List[str]] = []

        def strongconnect(v: str):
            nonlocal index
            indices[v] = index
            lowlinks[v] = index
            index += 1
            stack.append(v)
            on_stack[v] = True

            for edge_id in self._out_edges.get(v, []):
                w = self._edges[edge_id].to_node
                if w not in indices:
                    strongconnect(w)
                    lowlinks[v] = min(lowlinks[v], lowlinks[w])
                elif on_stack.get(w, False):
                    lowlinks[v] = min(lowlinks[v], indices[w])

            if lowlinks[v] == indices[v]:
                scc = []
                while True:
                    w = stack.pop()
                    on_stack[w] = False
                    scc.append(w)
                    if w == v:
                        break
                sccs.append(scc)

        for nid in self._nodes:
            if nid not in indices:
                strongconnect(nid)

        return sccs

    def detect_cycles(self) -> bool:
        """Returns True if the graph contains one or more directed cycles."""
        sccs = self.strongly_connected_components()
        for scc in sccs:
            if len(scc) > 1:
                return True
            if len(scc) == 1:
                nid = scc[0]
                for eid in self._out_edges.get(nid, []):
                    if self._edges[eid].to_node == nid:
                        return True
        return False

    def compute_metrics(self) -> GraphMetrics:
        """Calculates global topological graph metrics."""
        n_count = len(self._nodes)
        e_count = len(self._edges)
        max_possible_edges = n_count * (n_count - 1) if n_count > 1 else 1
        density = e_count / float(max_possible_edges) if n_count > 1 else 0.0

        n_by_type = {t.value: len(s) for t, s in self._nodes_by_type.items()}
        e_by_type = {t.value: len(s) for t, s in self._edges_by_type.items()}

        sccs = self.strongly_connected_components()
        has_cycles = self.detect_cycles()

        isolated = sum(1 for nid in self._nodes if not self._out_edges.get(nid) and not self._in_edges.get(nid))

        return GraphMetrics(
            node_count=n_count,
            edge_count=e_count,
            density=round(density, 6),
            nodes_by_type=n_by_type,
            edges_by_type=e_by_type,
            strongly_connected_components_count=len(sccs),
            has_cycles=has_cycles,
            isolated_nodes_count=isolated
        )

    # --------------------------------------------------------------------------
    # SQLite CTE Integration & Export Layer
    # --------------------------------------------------------------------------

    def export_to_sqlite(self, db_conn: sqlite3.Connection):
        """Exports graph structure into SQLite tables for CTE queries."""
        cursor = db_conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS graph_nodes (
                id TEXT PRIMARY KEY,
                node_type TEXT NOT NULL,
                label TEXT NOT NULL,
                severity TEXT,
                properties TEXT,
                created_at REAL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS graph_edges (
                id TEXT PRIMARY KEY,
                from_node TEXT NOT NULL,
                to_node TEXT NOT NULL,
                edge_type TEXT NOT NULL,
                weight REAL NOT NULL,
                properties TEXT,
                created_at REAL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_from ON graph_edges(from_node)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_to ON graph_edges(to_node)")

        # Clear previous data
        cursor.execute("DELETE FROM graph_edges")
        cursor.execute("DELETE FROM graph_nodes")

        node_rows = [
            (
                n.id,
                n.node_type.value,
                n.label,
                n.severity.value if n.severity else None,
                json.dumps(n.properties),
                n.created_at,
            )
            for n in self._nodes.values()
        ]
        edge_rows = [
            (
                e.id,
                e.from_node,
                e.to_node,
                e.edge_type.value,
                e.weight,
                json.dumps(e.properties),
                e.created_at,
            )
            for e in self._edges.values()
        ]

        cursor.executemany("INSERT INTO graph_nodes VALUES (?, ?, ?, ?, ?, ?)", node_rows)
        cursor.executemany("INSERT INTO graph_edges VALUES (?, ?, ?, ?, ?, ?, ?)", edge_rows)
        db_conn.commit()

    def query_recursive_cte_attack_paths(
        self,
        db_conn: sqlite3.Connection,
        start_node_id: str,
        max_depth: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Executes a recursive Common Table Expression (CTE) query in SQLite to
        resolve transitive attack paths.
        """
        query = """
        WITH RECURSIVE AttackPath AS (
            SELECT
                gn.id,
                gn.node_type,
                gn.label,
                0 AS depth,
                CAST(gn.id AS TEXT) AS path,
                0.0 AS total_weight
            FROM graph_nodes gn
            WHERE gn.id = ?

            UNION ALL

            SELECT
                gn.id,
                gn.node_type,
                gn.label,
                ap.depth + 1,
                ap.path || ' -> ' || CAST(gn.id AS TEXT),
                ap.total_weight + ge.weight
            FROM graph_nodes gn
            JOIN graph_edges ge ON gn.id = ge.to_node
            JOIN AttackPath ap ON ge.from_node = ap.id
            WHERE ap.depth < ? AND ap.path NOT LIKE '%' || CAST(gn.id AS TEXT) || '%'
        )
        SELECT id, node_type, label, depth, path, total_weight
        FROM AttackPath
        WHERE depth > 0;
        """
        cursor = db_conn.cursor()
        cursor.execute(query, (start_node_id, max_depth))
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "node_type": r[1],
                "label": r[2],
                "depth": r[3],
                "path": r[4],
                "total_weight": r[5],
            }
            for r in rows
        ]
