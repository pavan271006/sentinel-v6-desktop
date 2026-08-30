"""
Causal Evidence Engine - Data Models and Enums
Module: research.theory_lab.causal_evidence_engine.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Set
import uuid
import time
import hashlib


class CausalNodeType(str, Enum):
    PROBE_DISPATCH = "PROBE_DISPATCH"           # Specific test probe emitted
    PAYLOAD_MUTATION = "PAYLOAD_MUTATION"       # Injected parameter variable X
    RESPONSE_OBSERVATION = "RESPONSE_OBSERVATION" # Server response Y
    CAS_BLOB = "CAS_BLOB"                       # Immutable cryptographic storage artifact
    FINDING_PROOF = "FINDING_PROOF"             # Promoted verified finding


class CausalRelationType(str, Enum):
    CAUSES = "CAUSES"                           # Direct causal link (X -> Y)
    CONFOUNDED_BY = "CONFOUNDED_BY"             # Confounding background variable (Z -> Y)
    STORED_AS_BLOB = "STORED_AS_BLOB"           # Raw bytes stored in CAS
    CERTIFIES_FINDING = "CERTIFIES_FINDING"     # Cryptographic proof bound to finding


@dataclass
class CASBlobProof:
    """
    Cryptographic proof artifact for Content-Addressed Storage (SEC-07).
    """
    cas_key: str                                # sha256:<hex_digest>
    raw_payload_bytes: bytes
    timestamp: float = field(default_factory=time.time)
    merkle_root: str = ""

    @staticmethod
    def create_from_bytes(data: bytes, merkle_salt: str = "") -> CASBlobProof:
        h = hashlib.sha256(data).hexdigest()
        cas_key = f"cas://sha256/{h}"
        merkle = hashlib.sha256((h + merkle_salt).encode("utf-8")).hexdigest()
        return CASBlobProof(cas_key=cas_key, raw_payload_bytes=data, merkle_root=merkle)


@dataclass
class CausalNode:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    node_type: CausalNodeType = CausalNodeType.PROBE_DISPATCH
    label: str = ""
    payload_data: Dict[str, Any] = field(default_factory=dict)
    cas_proof: Optional[CASBlobProof] = None
    timestamp: float = field(default_factory=time.time)


@dataclass
class CausalEdge:
    from_node: str
    to_node: str
    relation: CausalRelationType = CausalRelationType.CAUSES
    causal_weight: float = 1.0
    is_counterfactual_verified: bool = False


@dataclass
class CausalDAG:
    """
    Directed Acyclic Graph modeling the causal chain from probe mutation to finding.
    """
    nodes: Dict[str, CausalNode] = field(default_factory=dict)
    edges: List[CausalEdge] = field(default_factory=list)

    def add_node(self, node: CausalNode) -> str:
        self.nodes[node.id] = node
        return node.id

    def add_edge(self, edge: CausalEdge):
        self.edges.append(edge)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "nodes": {nid: n.label for nid, n in self.nodes.items()},
        }


@dataclass
class CausalAttributionReport:
    """
    Result of Pearl's SCM counterfactual attribution test.
    """
    is_causally_proven: bool = False
    average_causal_effect: float = 0.0          # ACE in [0.0, 1.0]
    probability_of_necessity: float = 0.0       # PN in [0.0, 1.0]
    confounder_risk: float = 0.0                # Risk of environmental interference
    merkle_proof_root: str = ""
    minimal_subgraph_nodes: List[str] = field(default_factory=list)
    verdict: str = "UNVERIFIED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_causally_proven": self.is_causally_proven,
            "average_causal_effect": round(self.average_causal_effect, 4),
            "probability_of_necessity": round(self.probability_of_necessity, 4),
            "confounder_risk": round(self.confounder_risk, 4),
            "merkle_proof_root": self.merkle_proof_root,
            "minimal_subgraph_nodes_count": len(self.minimal_subgraph_nodes),
            "verdict": self.verdict,
        }
