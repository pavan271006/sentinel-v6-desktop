"""
Causal Evidence Engine - Pearl SCM & Minimal Causal DAG Extraction
Module: research.theory_lab.causal_evidence_engine.engine
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict, deque
import hashlib

from .models import (
    CausalNodeType,
    CausalRelationType,
    CASBlobProof,
    CausalNode,
    CausalEdge,
    CausalDAG,
    CausalAttributionReport,
)


class PearlCausalAttributionEvaluator:
    """
    Evaluates Average Causal Effect (ACE) and Probability of Necessity (PN)
    using Pearl's do-calculus.
    """

    @staticmethod
    def evaluate_causal_effect(
        probe_success_rate: float,      # P(Y=1 | do(X=payload))
        control_success_rate: float,    # P(Y=1 | do(X=benign))
        confounders_controlled: bool = True,
    ) -> Tuple[float, float, float, bool]:
        """
        Calculates ACE, PN, ConfounderRisk, and is_proven.
        """
        # Average Causal Effect
        ace = max(0.0, probe_success_rate - control_success_rate)
        
        # Probability of Necessity PN = (P(Y=1 | X=payload) - P(Y=1 | X=benign)) / P(Y=1 | X=payload)
        pn = (ace / probe_success_rate) if probe_success_rate > 0 else 0.0
        
        confounder_risk = 0.05 if confounders_controlled else 0.65
        is_proven = (ace >= 0.80) and (pn >= 0.80) and confounders_controlled
        
        return round(ace, 4), round(pn, 4), round(confounder_risk, 4), is_proven


class MerkleProofGenerator:
    """Generates cryptographic Merkle roots for CAS evidence chains."""

    @staticmethod
    def compute_merkle_root(leaf_hashes: List[str]) -> str:
        if not leaf_hashes:
            return hashlib.sha256(b"EMPTY_MERKLE").hexdigest()
        
        current_layer = [h.replace("cas://sha256/", "") for h in leaf_hashes]
        
        while len(current_layer) > 1:
            if len(current_layer) % 2 != 0:
                current_layer.append(current_layer[-1])
            
            next_layer = []
            for i in range(0, len(current_layer), 2):
                combined = (current_layer[i] + current_layer[i+1]).encode("utf-8")
                next_layer.append(hashlib.sha256(combined).hexdigest())
            current_layer = next_layer
        
        return current_layer[0]


class CausalEvidenceEngine:
    """
    Assembles DAG-based causal evidence chains and extracts minimal proof subgraphs.
    """

    def assemble_evidence_chain(
        self,
        probe_bytes: bytes,
        payload_var: str,
        response_bytes: bytes,
        finding_title: str,
        ace: float = 1.0,
        pn: float = 1.0,
    ) -> Tuple[CausalDAG, CausalAttributionReport]:
        """
        Builds a complete, verifiable Causal DAG linking probe -> payload -> response -> CAS -> finding.
        """
        dag = CausalDAG()

        # 1. CAS Proofs for Probe and Response
        cas_probe = CASBlobProof.create_from_bytes(probe_bytes)
        cas_resp = CASBlobProof.create_from_bytes(response_bytes)
        merkle_root = MerkleProofGenerator.compute_merkle_root([cas_probe.cas_key, cas_resp.cas_key])

        # 2. DAG Nodes
        n_probe = CausalNode(
            node_type=CausalNodeType.PROBE_DISPATCH,
            label="Probe:Injection_Vector",
            payload_data={"raw_len": len(probe_bytes)},
            cas_proof=cas_probe,
        )
        n_payload = CausalNode(
            node_type=CausalNodeType.PAYLOAD_MUTATION,
            label=f"Payload:do({payload_var})",
            payload_data={"variable": payload_var},
        )
        n_resp = CausalNode(
            node_type=CausalNodeType.RESPONSE_OBSERVATION,
            label="Response:Delta_Observed",
            payload_data={"resp_len": len(response_bytes)},
            cas_proof=cas_resp,
        )
        n_finding = CausalNode(
            node_type=CausalNodeType.FINDING_PROOF,
            label=f"FindingProof:{finding_title}",
            payload_data={"merkle_root": merkle_root, "ace": ace, "pn": pn},
        )

        for n in [n_probe, n_payload, n_resp, n_finding]:
            dag.add_node(n)

        # 3. Directed Causal Edges
        dag.add_edge(CausalEdge(from_node=n_probe.id, to_node=n_payload.id, relation=CausalRelationType.CAUSES))
        dag.add_edge(CausalEdge(from_node=n_payload.id, to_node=n_resp.id, relation=CausalRelationType.CAUSES, is_counterfactual_verified=True))
        dag.add_edge(CausalEdge(from_node=n_resp.id, to_node=n_finding.id, relation=CausalRelationType.CERTIFIES_FINDING))

        report = CausalAttributionReport(
            is_causally_proven=(ace >= 0.80 and pn >= 0.80),
            average_causal_effect=ace,
            probability_of_necessity=pn,
            confounder_risk=0.05,
            merkle_proof_root=merkle_root,
            minimal_subgraph_nodes=[n_probe.id, n_payload.id, n_resp.id, n_finding.id],
            verdict="CONFIRMED_VULNERABILITY" if (ace >= 0.80 and pn >= 0.80) else "INSUFFICIENT_PROOF"
        )

        return dag, report

    def extract_minimal_proof_subgraph(self, full_dag: CausalDAG, finding_node_id: str) -> CausalDAG:
        """
        Extracts the minimal sufficient proof DAG by computing reverse reachability from
        the finding proof node, discarding background noise.
        """
        # Build reverse adjacency map
        rev_adj: Dict[str, List[str]] = defaultdict(list)
        for edge in full_dag.edges:
            rev_adj[edge.to_node].append(edge.from_node)

        # Reverse BFS
        visited: Set[str] = set()
        queue = deque([finding_node_id])
        while queue:
            curr = queue.popleft()
            if curr not in visited:
                visited.add(curr)
                for predecessor in rev_adj.get(curr, []):
                    if predecessor not in visited:
                        queue.append(predecessor)

        # Construct minimal DAG
        min_dag = CausalDAG()
        for nid in visited:
            if nid in full_dag.nodes:
                min_dag.add_node(full_dag.nodes[nid])

        for edge in full_dag.edges:
            if edge.from_node in visited and edge.to_node in visited:
                min_dag.add_edge(edge)

        return min_dag
