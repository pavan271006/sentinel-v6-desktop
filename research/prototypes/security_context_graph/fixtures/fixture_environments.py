"""
Fixture Environments for Security Context Graph Prototype
Provides ground-truth graph topologies: VULNERABLE, FIXED, BENIGN, and NOISY.
"""

from ..models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    ParamLocation,
    Severity,
    create_asset_node,
    create_service_node,
    create_endpoint_node,
    create_parameter_node,
    create_identity_node,
    create_finding_node,
    create_evidence_node,
)
from ..engine import SecurityContextGraph


def build_vulnerable_environment() -> SecurityContextGraph:
    """
    Builds a target with a full, unmitigated attack path from public Internet
    to crown jewel database via an unauthenticated SQLi and administrative privilege jump.
    """
    g = SecurityContextGraph()
    
    asset = create_asset_node("corp-portal.target.com", "198.51.100.10", tags=["dmz", "public"])
    svc = create_service_node(asset.id, 443, "https", tls=True)
    ep_login = create_endpoint_node(svc.id, "POST", "/api/v1/auth/login", auth_required=False)
    p_user = create_parameter_node(ep_login.id, "username", ParamLocation.BODY)
    p_pass = create_parameter_node(ep_login.id, "password", ParamLocation.BODY)
    
    cand = GraphNode(node_type=NodeType.CANDIDATE, label="Candidate:Auth-Bypass-SQLi", properties={"cwe": "CWE-89"})
    find = create_finding_node(cand.id, "Authentication Bypass via SQL Injection", Severity.CRITICAL, "CWE-89", 9.8)
    ev = create_evidence_node(find.id, "cas://sha256/auth_sqli_payload", "merkle_root_vulnerable", "digest_vulnerable")
    
    id_admin = create_identity_node("Administrator", "sec-ref-admin-token", permissions=["ALL"])
    ep_db_export = create_endpoint_node(svc.id, "POST", "/api/v1/admin/export_db", auth_required=True)
    asset_db = create_asset_node("db-primary.internal", "10.0.50.2", tags=["crown_jewel", "database"])

    for n in [asset, svc, ep_login, p_user, p_pass, cand, find, ev, id_admin, ep_db_export, asset_db]:
        g.add_node(n)

    g.connect(asset.id, svc.id, EdgeType.EXPOSES)
    g.connect(svc.id, ep_login.id, EdgeType.ROUTES_TO)
    g.connect(ep_login.id, p_user.id, EdgeType.ACCEPTS_PARAM)
    g.connect(ep_login.id, p_pass.id, EdgeType.ACCEPTS_PARAM)
    g.connect(ep_login.id, cand.id, EdgeType.PRODUCES_CANDIDATE)
    g.connect(cand.id, find.id, EdgeType.PROMOTES_TO_FINDING)
    g.connect(find.id, ev.id, EdgeType.BOUND_TO_EVIDENCE)
    
    # Exploitation pivot
    g.connect(find.id, id_admin.id, EdgeType.LEADS_TO_PRIVILEGE)
    g.connect(id_admin.id, ep_db_export.id, EdgeType.REQUIRES_IDENTITY)
    g.connect(ep_db_export.id, asset_db.id, EdgeType.CHAINS_TO)

    return g


def build_fixed_environment() -> SecurityContextGraph:
    """
    Builds the remediated target where the parameter is parameterized and input-validated.
    The finding edge is severed, breaking the attack path to the crown jewel.
    """
    g = SecurityContextGraph()
    
    asset = create_asset_node("corp-portal.target.com", "198.51.100.10", tags=["dmz", "public"])
    svc = create_service_node(asset.id, 443, "https", tls=True)
    ep_login = create_endpoint_node(svc.id, "POST", "/api/v1/auth/login", auth_required=False)
    p_user = create_parameter_node(ep_login.id, "username", ParamLocation.BODY, param_type="validated_string")
    p_pass = create_parameter_node(ep_login.id, "password", ParamLocation.BODY, param_type="hashed_password")
    
    id_admin = create_identity_node("Administrator", "sec-ref-admin-token", permissions=["ALL"])
    ep_db_export = create_endpoint_node(svc.id, "POST", "/api/v1/admin/export_db", auth_required=True)
    asset_db = create_asset_node("db-primary.internal", "10.0.50.2", tags=["crown_jewel", "database"])

    for n in [asset, svc, ep_login, p_user, p_pass, id_admin, ep_db_export, asset_db]:
        g.add_node(n)

    g.connect(asset.id, svc.id, EdgeType.EXPOSES)
    g.connect(svc.id, ep_login.id, EdgeType.ROUTES_TO)
    g.connect(ep_login.id, p_user.id, EdgeType.ACCEPTS_PARAM)
    g.connect(ep_login.id, p_pass.id, EdgeType.ACCEPTS_PARAM)
    g.connect(id_admin.id, ep_db_export.id, EdgeType.REQUIRES_IDENTITY)
    g.connect(ep_db_export.id, asset_db.id, EdgeType.CHAINS_TO)

    return g


def build_noisy_environment(num_noise_nodes: int = 500) -> SecurityContextGraph:
    """
    Builds a large graph with extensive background endpoints, dead-ends, cyclic redirects,
    and disconnected clusters to test robustness and query filtering under realistic pentest noise.
    """
    g = build_vulnerable_environment()
    
    # Add noise clusters
    for i in range(num_noise_nodes):
        noise_node = GraphNode(
            node_type=NodeType.ENDPOINT,
            label=f"GET /static/asset_{i}.js",
            properties={"is_static": True, "cacheable": True}
        )
        g.add_node(noise_node)
        
        if i % 10 == 0:
            # Create a cyclic redirect cluster
            r1 = GraphNode(node_type=NodeType.ENDPOINT, label=f"GET /redirect/a_{i}")
            r2 = GraphNode(node_type=NodeType.ENDPOINT, label=f"GET /redirect/b_{i}")
            g.add_node(r1)
            g.add_node(r2)
            g.connect(r1.id, r2.id, EdgeType.ROUTES_TO)
            g.connect(r2.id, r1.id, EdgeType.ROUTES_TO)

    return g
