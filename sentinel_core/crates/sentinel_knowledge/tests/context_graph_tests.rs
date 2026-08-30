use uuid::Uuid;

use sentinel_common::enums::Severity;
use sentinel_knowledge::{
    AttackGraphCteQueries, ContextEdgeType, ContextGraphEdge, ContextGraphNode, ContextNodeType,
    SecurityContextGraph,
};

#[test]
fn test_security_context_graph_crud_and_topology() {
    let mut graph = SecurityContextGraph::new();

    let asset_id = Uuid::new_v4();
    let endpoint_id = Uuid::new_v4();
    let param_id = Uuid::new_v4();

    let asset_node = ContextGraphNode::new(asset_id, ContextNodeType::Asset, "https://api.target.local")
        .with_meta("ip", "10.0.0.1");
    let endpoint_node = ContextGraphNode::new(endpoint_id, ContextNodeType::Endpoint, "POST /api/v1/auth/login");
    let param_node = ContextGraphNode::new(param_id, ContextNodeType::Parameter, "username");

    graph.add_node(asset_node);
    graph.add_node(endpoint_node);
    graph.add_node(param_node);

    let edge1 = ContextGraphEdge::new(asset_id, endpoint_id, ContextEdgeType::HasEndpoint);
    let edge2 = ContextGraphEdge::new(endpoint_id, param_id, ContextEdgeType::AcceptsParam);

    graph.add_edge(edge1);
    graph.add_edge(edge2);

    assert_eq!(graph.nodes.len(), 3);
    assert_eq!(graph.get_outgoing_edges(&asset_id).len(), 1);
    assert_eq!(graph.get_incoming_edges(&endpoint_id).len(), 1);
    assert_eq!(graph.get_outgoing_edges(&endpoint_id).len(), 1);
    assert_eq!(graph.get_incoming_edges(&param_id).len(), 1);
}

#[test]
fn test_finding_lineage_tracing() {
    let mut graph = SecurityContextGraph::new();

    let asset_id = Uuid::new_v4();
    let endpoint_id = Uuid::new_v4();
    let param_id = Uuid::new_v4();
    let req_id = Uuid::new_v4();
    let res_id = Uuid::new_v4();
    let finding_id = Uuid::new_v4();

    graph.add_node(ContextGraphNode::new(asset_id, ContextNodeType::Asset, "https://target.local"));
    graph.add_node(ContextGraphNode::new(endpoint_id, ContextNodeType::Endpoint, "GET /api/v1/users"));
    graph.add_node(ContextGraphNode::new(param_id, ContextNodeType::Parameter, "id"));
    graph.add_node(ContextGraphNode::new(req_id, ContextNodeType::Request, "GET /api/v1/users?id=10"));
    graph.add_node(ContextGraphNode::new(res_id, ContextNodeType::Response, "200 OK"));
    graph.add_node(
        ContextGraphNode::new(finding_id, ContextNodeType::Finding, "BOLA / IDOR Violation")
            .with_severity(Severity::High),
    );

    // Build chain: Asset -> Endpoint -> Parameter -> Request -> Response -> Finding
    graph.add_edge(ContextGraphEdge::new(asset_id, endpoint_id, ContextEdgeType::HasEndpoint));
    graph.add_edge(ContextGraphEdge::new(endpoint_id, param_id, ContextEdgeType::AcceptsParam));
    graph.add_edge(ContextGraphEdge::new(param_id, req_id, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(req_id, res_id, ContextEdgeType::EmitsResponse));
    graph.add_edge(ContextGraphEdge::new(res_id, finding_id, ContextEdgeType::ExhibitsFinding));

    let lineage = graph.trace_finding_lineage(finding_id).expect("Lineage must be found");
    assert_eq!(lineage.finding_id, finding_id);
    assert_eq!(lineage.nodes.len(), 6);
    assert!(lineage.nodes.iter().any(|n| n.id == asset_id));
    assert!(lineage.nodes.iter().any(|n| n.id == endpoint_id));
    assert!(lineage.nodes.iter().any(|n| n.id == param_id));
    assert!(lineage.nodes.iter().any(|n| n.id == req_id));
    assert!(lineage.nodes.iter().any(|n| n.id == res_id));
    assert!(lineage.nodes.iter().any(|n| n.id == finding_id));
}

#[test]
fn test_risk_score_propagation() {
    let mut graph = SecurityContextGraph::new();

    let asset_id = Uuid::new_v4();
    let endpoint_id = Uuid::new_v4();
    let finding_id = Uuid::new_v4();

    graph.add_node(ContextGraphNode::new(asset_id, ContextNodeType::Asset, "target.local"));
    graph.add_node(ContextGraphNode::new(endpoint_id, ContextNodeType::Endpoint, "/admin/delete"));
    graph.add_node(
        ContextGraphNode::new(finding_id, ContextNodeType::Finding, "RCE via Deserialization")
            .with_severity(Severity::Critical), // Risk 100.0
    );

    graph.add_edge(ContextGraphEdge::new(asset_id, endpoint_id, ContextEdgeType::HasEndpoint));
    graph.add_edge(ContextGraphEdge::new(endpoint_id, finding_id, ContextEdgeType::ExhibitsFinding));

    let updated = graph.propagate_risk_scores();

    // Finding should have 100.0
    assert_eq!(*updated.get(&finding_id).unwrap(), 100.0);
    // Endpoint gets 100 * 0.85 = 85.0
    let ep_score = *updated.get(&endpoint_id).unwrap();
    assert!((ep_score - 85.0).abs() < 0.01);
    // Asset gets 85 * 0.85 = 72.25
    let asset_score = *updated.get(&asset_id).unwrap();
    assert!((asset_score - 72.25).abs() < 0.01);
}

#[test]
fn test_choke_point_detection() {
    let mut graph = SecurityContextGraph::new();

    let asset1 = Uuid::new_v4();
    let asset2 = Uuid::new_v4();
    let auth_gateway = Uuid::new_v4(); // Choke point
    let sink1 = Uuid::new_v4();
    let sink2 = Uuid::new_v4();

    graph.add_node(ContextGraphNode::new(asset1, ContextNodeType::Asset, "https://app1.local"));
    graph.add_node(ContextGraphNode::new(asset2, ContextNodeType::Asset, "https://app2.local"));
    graph.add_node(ContextGraphNode::new(auth_gateway, ContextNodeType::Service, "Auth-Gateway"));
    graph.add_node(ContextGraphNode::new(sink1, ContextNodeType::Finding, "Finding A"));
    graph.add_node(ContextGraphNode::new(sink2, ContextNodeType::Finding, "Finding B"));

    // Asset1 -> AuthGateway -> Sink1
    // Asset1 -> AuthGateway -> Sink2
    // Asset2 -> AuthGateway -> Sink1
    // Asset2 -> AuthGateway -> Sink2
    graph.add_edge(ContextGraphEdge::new(asset1, auth_gateway, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(asset2, auth_gateway, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(auth_gateway, sink1, ContextEdgeType::ExhibitsFinding));
    graph.add_edge(ContextGraphEdge::new(auth_gateway, sink2, ContextEdgeType::ExhibitsFinding));

    let choke_points = graph.find_choke_points(5);
    assert!(!choke_points.is_empty());
    assert_eq!(choke_points[0].0, auth_gateway);
    assert_eq!(choke_points[0].1, 4); // Traversed in 4 distinct paths
}

#[test]
fn test_asset_subgraph_extraction() {
    let mut graph = SecurityContextGraph::new();

    let root_asset = Uuid::new_v4();
    let ep1 = Uuid::new_v4();
    let ep2 = Uuid::new_v4();
    let other_asset = Uuid::new_v4();
    let other_ep = Uuid::new_v4();

    graph.add_node(ContextGraphNode::new(root_asset, ContextNodeType::Asset, "root.local"));
    graph.add_node(ContextGraphNode::new(ep1, ContextNodeType::Endpoint, "/login"));
    graph.add_node(ContextGraphNode::new(ep2, ContextNodeType::Endpoint, "/logout"));
    graph.add_node(ContextGraphNode::new(other_asset, ContextNodeType::Asset, "other.local"));
    graph.add_node(ContextGraphNode::new(other_ep, ContextNodeType::Endpoint, "/other"));

    graph.add_edge(ContextGraphEdge::new(root_asset, ep1, ContextEdgeType::HasEndpoint));
    graph.add_edge(ContextGraphEdge::new(root_asset, ep2, ContextEdgeType::HasEndpoint));
    graph.add_edge(ContextGraphEdge::new(other_asset, other_ep, ContextEdgeType::HasEndpoint));

    let sub = graph.get_asset_subgraph(root_asset, 5);
    assert_eq!(sub.nodes.len(), 3);
    assert!(sub.nodes.contains_key(&root_asset));
    assert!(sub.nodes.contains_key(&ep1));
    assert!(sub.nodes.contains_key(&ep2));
    assert!(!sub.nodes.contains_key(&other_asset));
    assert!(!sub.nodes.contains_key(&other_ep));
}

#[test]
fn test_cte_sql_generation_contracts() {
    let lineage_sql = AttackGraphCteQueries::query_lineage_sql("find-1", 10);
    assert!(lineage_sql.contains("WITH RECURSIVE lineage"));
    assert!(lineage_sql.contains("ORDER BY l.depth ASC"));

    let paths_sql = AttackGraphCteQueries::query_attack_paths_sql("asset-1", 5);
    assert!(paths_sql.contains("WITH RECURSIVE attack_path"));

    let blast_sql = AttackGraphCteQueries::query_blast_radius_sql("endpoint-1", 5);
    assert!(blast_sql.contains("WITH RECURSIVE blast_radius"));
}
