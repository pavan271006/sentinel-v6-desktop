"""
Causal Evidence Engine Prototype - DAG Assembly & Cryptographic Proof Extraction
Module: research.theory_lab.causal_evidence_engine.causal_engine
"""

from collections import defaultdict, deque
import hashlib
from typing import Dict, List, Set, Optional, Tuple
from research.theory_lab.causal_evidence_engine.models import (
    CausalNodeType,
    CausalRelation,
    CausalNode,
    CausalEdge,
    ProofSubgraph,
)


class CausalEvidenceEngine:
    """
    Assembles directed acyclic graphs (DAGs) linking attack probes to CAS cryptographic evidence
    and extracts minimal causal proof subgraphs proving security findings.
    """

    def __init__(self):
        self.nodes: Dict[str, CausalNode] = {}
        self.adjacency: Dict[str, List[CausalEdge]] = defaultdict(list)
        self.reverse_adjacency: Dict[str, List[CausalEdge]] = defaultdict(list)

    def add_node(self, node: CausalNode) -> str:
        self.nodes[node.id] = node
        return node.id

    def add_edge(self, source_id: str, target_id: str, relation: CausalRelation, weight: float = 1.0) -> bool:
        if source_id not in self.nodes or target_id not in self.nodes:
            return False
        
        edge = CausalEdge(source_id=source_id, target_id=target_id, relation=relation, weight=weight)
        self.adjacency[source_id].append(edge)
        self.reverse_adjacency[target_id].append(edge)
        return True

    def is_acyclic(self) -> bool:
        """Kahn's algorithm for DAG cycle validation."""
        in_degree = {nid: 0 for nid in self.nodes}
        for u in self.adjacency:
            for edge in self.adjacency[u]:
                in_degree[edge.target_id] += 1

        queue = deque([nid for nid, deg in in_degree.items() if deg == 0])
        visited_count = 0

        while queue:
            curr = queue.popleft()
            visited_count += 1
            for edge in self.adjacency.get(curr, []):
                in_degree[edge.target_id] -= 1
                if in_degree[edge.target_id] == 0:
                    queue.append(edge.target_id)

        return visited_count == len(self.nodes)

    def extract_minimal_proof_subgraph(self, finding_id: str) -> Optional[ProofSubgraph]:
        """
        Extracts the minimal causal sub-DAG proving finding_id by tracing upstream dependencies
        from the finding node back to the root cause / mutated payload and CAS cryptographic blob proofs.
        """
        if finding_id not in self.nodes:
            return None

        subgraph_nodes: Dict[str, CausalNode] = {}
        subgraph_edges: List[CausalEdge] = []
        visited: Set[str] = set()

        queue = deque([finding_id])
        visited.add(finding_id)
        subgraph_nodes[finding_id] = self.nodes[finding_id]

        root_cause_id = ""

        while queue:
            curr = queue.popleft()
            curr_node = self.nodes[curr]
            if curr_node.node_type in [CausalNodeType.ROOT_CAUSE, CausalNodeType.MUTATED_PAYLOAD] and not root_cause_id:
                root_cause_id = curr

            for edge in self.reverse_adjacency.get(curr, []):
                parent_id = edge.source_id
                subgraph_edges.append(edge)
                if parent_id not in visited:
                    visited.add(parent_id)
                    subgraph_nodes[parent_id] = self.nodes[parent_id]
                    queue.append(parent_id)

        # Compute Merkle Root Hash across all CAS hashes in subgraph
        cas_hashes = sorted([n.sha256_cas_hash for n in subgraph_nodes.values() if n.sha256_cas_hash])
        combined = "".join(cas_hashes).encode("utf-8")
        merkle_root = hashlib.sha256(combined).hexdigest() if combined else ""

        return ProofSubgraph(
            finding_id=finding_id,
            root_cause_id=root_cause_id or finding_id,
            nodes=list(subgraph_nodes.values()),
            edges=subgraph_edges,
            merkle_root_hash=merkle_root,
            is_valid_dag=self.is_acyclic(),
        )

    def verify_proof_subgraph_integrity(self, subgraph: ProofSubgraph) -> bool:
        """
        Verifies that every CAS hash matches its payload data and the Merkle root hash is authentic.
        """
        for node in subgraph.nodes:
            if node.payload_data:
                actual_hash = hashlib.sha256(node.payload_data).hexdigest()
                if actual_hash != node.sha256_cas_hash:
                    return False

        cas_hashes = sorted([n.sha256_cas_hash for n in subgraph.nodes if n.sha256_cas_hash])
        combined = "".join(cas_hashes).encode("utf-8")
        expected_merkle = hashlib.sha256(combined).hexdigest() if combined else ""

        return expected_merkle == subgraph.merkle_root_hash
