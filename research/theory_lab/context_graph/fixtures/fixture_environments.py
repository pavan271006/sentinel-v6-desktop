"""
Fixture Environments for Security Context Graph
Module: research.theory_lab.context_graph.fixtures.fixture_environments
"""

from ..models import (
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
    Severity,
)
from ..engine import ContextGraphEngine


def build_vulnerable_ecommerce_graph() -> ContextGraphEngine:
    """
    Builds a multi-hop vulnerable enterprise e-commerce attack graph:
    Asset (shop.acme.com) -> Service (HTTPS) -> Endpoint (/api/v1/orders)
    -> Parameter (order_id) -> Finding (SQL Injection) -> Finding (Admin Role Escalation)
    -> Service (Internal Admin Database) -> Finding (Full Data Exfiltration)
    """
    graph = ContextGraphEngine()

    n_asset = GraphNode(id="asset_root", node_type=NodeType.ASSET, label="shop.acme.com")
    n_service_web = GraphNode(id="srv_web", node_type=NodeType.SERVICE, label="Nginx HTTPS Gateway")
    n_service_db = GraphNode(id="srv_db", node_type=NodeType.SERVICE, label="PostgreSQL Customer DB")
    
    n_ep_orders = GraphNode(id="ep_orders", node_type=NodeType.ENDPOINT, label="/api/v1/orders")
    n_ep_admin = GraphNode(id="ep_admin", node_type=NodeType.ENDPOINT, label="/internal/admin/dump")
    
    n_param_order_id = GraphNode(id="param_order_id", node_type=NodeType.PARAMETER, label="order_id")
    
    n_find_sqli = GraphNode(
        id="find_sqli",
        node_type=NodeType.FINDING,
        label="SQL Injection in order_id",
        severity=Severity.HIGH
    )
    n_find_priv_esc = GraphNode(
        id="find_priv_esc",
        node_type=NodeType.FINDING,
        label="Privilege Escalation to Admin",
        severity=Severity.CRITICAL
    )
    n_find_exfil = GraphNode(
        id="find_exfil",
        node_type=NodeType.FINDING,
        label="Full Customer DB Exfiltration",
        severity=Severity.CRITICAL
    )

    for n in [n_asset, n_service_web, n_service_db, n_ep_orders, n_ep_admin, n_param_order_id, n_find_sqli, n_find_priv_esc, n_find_exfil]:
        graph.add_node(n)

    graph.connect("asset_root", "srv_web", EdgeType.CONTAINS, weight=1.0)
    graph.connect("srv_web", "ep_orders", EdgeType.CONTAINS, weight=1.0)
    graph.connect("ep_orders", "param_order_id", EdgeType.EXPOSES, weight=0.5)
    graph.connect("param_order_id", "find_sqli", EdgeType.LEADS_TO_FINDING, weight=1.5)
    graph.connect("find_sqli", "find_priv_esc", EdgeType.CHAINS_TO, weight=2.0)
    graph.connect("find_priv_esc", "ep_admin", EdgeType.AUTHENTICATES, weight=1.0)
    graph.connect("ep_admin", "srv_db", EdgeType.ROUTES_TO, weight=1.0)
    graph.connect("srv_db", "find_exfil", EdgeType.LEADS_TO_FINDING, weight=2.5)

    return graph


def build_fixed_remediated_graph() -> ContextGraphEngine:
    """
    Builds the remediated architecture where SQL injection is patched (prepared statements)
    and the attack chain to Admin Role Escalation is broken.
    """
    graph = ContextGraphEngine()

    n_asset = GraphNode(id="asset_root", node_type=NodeType.ASSET, label="shop.acme.com")
    n_service_web = GraphNode(id="srv_web", node_type=NodeType.SERVICE, label="Nginx HTTPS Gateway")
    n_ep_orders = GraphNode(id="ep_orders", node_type=NodeType.ENDPOINT, label="/api/v1/orders")
    n_param_order_id = GraphNode(id="param_order_id", node_type=NodeType.PARAMETER, label="order_id (Validated UUID)")
    
    n_ep_admin = GraphNode(id="ep_admin", node_type=NodeType.ENDPOINT, label="/internal/admin/dump (MFA Enforced)")
    n_service_db = GraphNode(id="srv_db", node_type=NodeType.SERVICE, label="PostgreSQL Customer DB")

    for n in [n_asset, n_service_web, n_ep_orders, n_param_order_id, n_ep_admin, n_service_db]:
        graph.add_node(n)

    graph.connect("asset_root", "srv_web", EdgeType.CONTAINS, weight=1.0)
    graph.connect("srv_web", "ep_orders", EdgeType.CONTAINS, weight=1.0)
    graph.connect("ep_orders", "param_order_id", EdgeType.EXPOSES, weight=0.5)
    # Patched: No LEADS_TO_FINDING edge exists from param_order_id to find_sqli
    graph.connect("ep_admin", "srv_db", EdgeType.ROUTES_TO, weight=1.0)

    return graph


def build_benign_complex_graph(endpoint_count: int = 50) -> ContextGraphEngine:
    """
    Builds a large benign enterprise microservices graph with multiple tiers.
    """
    graph = ContextGraphEngine()

    n_asset = GraphNode(id="asset_corp", node_type=NodeType.ASSET, label="corp.enterprise.com")
    graph.add_node(n_asset)

    for i in range(5):
        srv = GraphNode(id=f"srv_{i}", node_type=NodeType.SERVICE, label=f"Microservice_{i}")
        graph.add_node(srv)
        graph.connect("asset_corp", f"srv_{i}", EdgeType.CONTAINS, weight=1.0)

        for j in range(endpoint_count // 5):
            ep_id = f"ep_{i}_{j}"
            ep = GraphNode(id=ep_id, node_type=NodeType.ENDPOINT, label=f"/api/v{i}/resource_{j}")
            graph.add_node(ep)
            graph.connect(f"srv_{i}", ep_id, EdgeType.CONTAINS, weight=1.0)

            param_id = f"param_{i}_{j}"
            param = GraphNode(id=param_id, node_type=NodeType.PARAMETER, label=f"query_param_{j}")
            graph.add_node(param)
            graph.connect(ep_id, param_id, EdgeType.EXPOSES, weight=0.5)

    return graph


def build_noisy_graph_with_cycles() -> ContextGraphEngine:
    """
    Builds a noisy graph with cross-service redirect loops and cyclical dependencies.
    """
    graph = ContextGraphEngine()

    nodes = [
        GraphNode(id=f"n_cycle_{i}", node_type=NodeType.ENDPOINT, label=f"/router/hop_{i}")
        for i in range(10)
    ]
    for n in nodes:
        graph.add_node(n)

    # Form a circular loop
    for i in range(len(nodes)):
        nxt = (i + 1) % len(nodes)
        graph.connect(nodes[i].id, nodes[nxt].id, EdgeType.ROUTES_TO, weight=1.0)

    # Add cross-chords
    graph.connect(nodes[0].id, nodes[5].id, EdgeType.ROUTES_TO, weight=0.8)
    graph.connect(nodes[5].id, nodes[2].id, EdgeType.ROUTES_TO, weight=1.2)

    return graph
