"""
Security Context Graph Prototype - Data Models and Enums
Module: research.prototypes.security_context_graph.models
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Set
import uuid
import time


class NodeType(str, Enum):
    ASSET = "ASSET"
    SERVICE = "SERVICE"
    ENDPOINT = "ENDPOINT"
    PARAMETER = "PARAMETER"
    IDENTITY = "IDENTITY"
    REQUEST = "REQUEST"
    RESPONSE = "RESPONSE"
    CANDIDATE = "CANDIDATE"
    FINDING = "FINDING"
    EVIDENCE = "EVIDENCE"
    OAST_CALLBACK = "OAST_CALLBACK"


class EdgeType(str, Enum):
    EXPOSES = "EXPOSES"                     # Asset -> Service
    ROUTES_TO = "ROUTES_TO"                 # Service -> Endpoint
    ACCEPTS_PARAM = "ACCEPTS_PARAM"         # Endpoint -> Parameter
    REQUIRES_IDENTITY = "REQUIRES_IDENTITY" # Endpoint -> Identity
    EMITS_REQUEST = "EMITS_REQUEST"         # Endpoint -> Request
    YIELDS_RESPONSE = "YIELDS_RESPONSE"     # Request -> Response
    PRODUCES_CANDIDATE = "PRODUCES_CANDIDATE" # Response -> Candidate
    PROMOTES_TO_FINDING = "PROMOTES_TO_FINDING" # Candidate -> Finding
    BOUND_TO_EVIDENCE = "BOUND_TO_EVIDENCE" # Finding -> Evidence
    CORRELATES_OAST = "CORRELATES_OAST"     # Finding -> OastCallback
    LEADS_TO_PRIVILEGE = "LEADS_TO_PRIVILEGE" # Finding -> Identity
    CHAINS_TO = "CHAINS_TO"                 # Finding -> Endpoint (Privilege escalation pivot)


class ParamLocation(str, Enum):
    QUERY = "QUERY"
    BODY = "BODY"
    HEADER = "HEADER"
    COOKIE = "COOKIE"
    PATH = "PATH"


class Severity(str, Enum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class GraphNode:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    node_type: NodeType = NodeType.ASSET
    label: str = ""
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "node_type": self.node_type.value,
            "label": self.label,
            "properties": self.properties,
            "created_at": self.created_at,
        }


@dataclass
class GraphEdge:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    from_node: str = ""
    to_node: str = ""
    edge_type: EdgeType = EdgeType.EXPOSES
    weight: float = 1.0
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


# Specialized Node Builders
def create_asset_node(fqdn: str, ip: str, tags: Optional[List[str]] = None, node_id: Optional[str] = None) -> GraphNode:
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.ASSET,
        label=fqdn,
        properties={"fqdn": fqdn, "ip": ip, "tags": tags or []}
    )


def create_service_node(asset_id: str, port: int, protocol: str = "https", tls: bool = True, node_id: Optional[str] = None) -> GraphNode:
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.SERVICE,
        label=f"{protocol}://:{port}",
        properties={"asset_id": asset_id, "port": port, "protocol": protocol, "tls": tls}
    )


def create_endpoint_node(service_id: str, method: str, path: str, auth_required: bool = False, node_id: Optional[str] = None) -> GraphNode:
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.ENDPOINT,
        label=f"{method.upper()} {path}",
        properties={"service_id": service_id, "method": method.upper(), "path": path, "auth_required": auth_required}
    )


def create_parameter_node(endpoint_id: str, name: str, location: Any, param_type: str = "string", node_id: Optional[str] = None) -> GraphNode:
    loc_val = location.value if hasattr(location, "value") else str(location)
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.PARAMETER,
        label=f"{loc_val}:{name}",
        properties={"endpoint_id": endpoint_id, "name": name, "location": loc_val, "param_type": param_type}
    )


def create_identity_node(role_name: str, token_ref: str, permissions: Optional[List[str]] = None, node_id: Optional[str] = None) -> GraphNode:
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.IDENTITY,
        label=f"Identity:{role_name}",
        properties={"role_name": role_name, "token_ref": token_ref, "permissions": permissions or []}
    )


def create_finding_node(candidate_id: str, title: str, severity: Any, cwe_id: str, cvss_score: float, node_id: Optional[str] = None) -> GraphNode:
    sev_val = severity.value if hasattr(severity, "value") else str(severity)
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.FINDING,
        label=f"Finding:[{sev_val}] {title}",
        properties={"candidate_id": candidate_id, "title": title, "severity": sev_val, "cwe_id": cwe_id, "cvss_score": cvss_score}
    )


def create_evidence_node(finding_id: str, cas_key: str, merkle_root: str, digest: str, node_id: Optional[str] = None) -> GraphNode:
    return GraphNode(
        id=node_id or str(uuid.uuid4()),
        node_type=NodeType.EVIDENCE,
        label=f"Evidence:{cas_key[:12]}",
        properties={"finding_id": finding_id, "cas_key": cas_key, "merkle_root": merkle_root, "digest": digest}
    )
