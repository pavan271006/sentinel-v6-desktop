"""
Data Models for Security Context Graph
Module: research.theory_lab.context_graph.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Set
import uuid
import time
import json


class NodeType(str, Enum):
    ASSET = "ASSET"                     # Domain, IP, Subdomain, Host
    SERVICE = "SERVICE"                 # HTTP, HTTPS, SSH, MySQL, Redis
    ENDPOINT = "ENDPOINT"               # Path / Route: /api/v1/users, /auth/login
    PARAMETER = "PARAMETER"             # Query/Body/Header: user_id, redirect_uri, token
    IDENTITY = "IDENTITY"               # Role, Session, Principal, API Key
    REQUEST = "REQUEST"                 # Immutable HTTP Transaction Request
    RESPONSE = "RESPONSE"               # Immutable HTTP Transaction Response
    CANDIDATE = "CANDIDATE"             # Test hypothesis scheduled by planner
    FINDING = "FINDING"                 # Confirmed security finding / vulnerability
    EVIDENCE = "EVIDENCE"               # Cryptographic CAS / Merkle proof node
    OAST = "OAST"                       # Out-of-Band callback / correlation token


class EdgeType(str, Enum):
    CONTAINS = "CONTAINS"               # Asset -> Service, Service -> Endpoint
    EXPOSES = "EXPOSES"                 # Endpoint -> Parameter
    ACCEPTS = "ACCEPTS"                 # Parameter -> Input Type / Schema
    AUTHENTICATES = "AUTHENTICATES"     # Identity -> Endpoint / Service
    CHAINS_TO = "CHAINS_TO"             # Finding A -> Finding B (Exploit chain)
    ROUTES_TO = "ROUTES_TO"             # Endpoint -> Microservice / Upstream Backend
    PRODUCES = "PRODUCES"               # Request -> Response
    BOUND_TO_EVIDENCE = "BOUND_TO_EVIDENCE" # Finding -> Evidence CAS Root (SEC-07)
    LEADS_TO_FINDING = "LEADS_TO_FINDING"   # Parameter/Endpoint -> Finding


class Severity(str, Enum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class GraphNode:
    """Represents a vertex in the Security Context Graph."""
    node_type: NodeType
    label: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    severity: Optional[Severity] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    scope_in_bounds: bool = True  # SEC-01 fail-closed scope marker

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "node_type": self.node_type.value,
            "label": self.label,
            "severity": self.severity.value if self.severity else None,
            "properties": self.properties,
            "created_at": self.created_at,
            "scope_in_bounds": self.scope_in_bounds,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> GraphNode:
        return cls(
            id=data["id"],
            node_type=NodeType(data["node_type"]),
            label=data["label"],
            severity=Severity(data["severity"]) if data.get("severity") else None,
            properties=data.get("properties", {}),
            created_at=data.get("created_at", time.time()),
            scope_in_bounds=data.get("scope_in_bounds", True),
        )


@dataclass
class GraphEdge:
    """Represents a typed, directed, weighted edge in the Security Context Graph."""
    from_node: str
    to_node: str
    edge_type: EdgeType
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    weight: float = 1.0  # Traversal difficulty / exploit resistance (lower = easier)
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "from_node": self.from_node,
            "to_node": self.to_node,
            "edge_type": self.edge_type.value,
            "weight": self.weight,
            "properties": self.properties,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> GraphEdge:
        return cls(
            id=data["id"],
            from_node=data["from_node"],
            to_node=data["to_node"],
            edge_type=EdgeType(data["edge_type"]),
            weight=float(data.get("weight", 1.0)),
            properties=data.get("properties", {}),
            created_at=data.get("created_at", time.time()),
        )


@dataclass
class AttackPathResult:
    """Represents a discovered transitive exploitation path."""
    source_node_id: str
    target_node_id: str
    path_nodes: List[str]
    path_edges: List[str]
    total_cost: float
    hop_count: int
    critical_findings: List[str] = field(default_factory=list)


@dataclass
class BottleneckResult:
    """Represents bottleneck analysis of attack pathways."""
    bottleneck_node_id: str
    bottleneck_label: str
    affected_paths_count: int
    total_attack_paths_count: int
    criticality_ratio: float  # B(u) in [0, 1]


@dataclass
class GraphMetrics:
    """Topological metrics for the current graph state."""
    node_count: int
    edge_count: int
    density: float
    nodes_by_type: Dict[str, int]
    edges_by_type: Dict[str, int]
    strongly_connected_components_count: int
    has_cycles: bool
    isolated_nodes_count: int
