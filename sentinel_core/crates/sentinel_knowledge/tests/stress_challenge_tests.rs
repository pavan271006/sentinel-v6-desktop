//! Stress and Adversarial Challenge Tests for Security Context Graph (Engine 1)
//!
//! Evaluates:
//! 1. Deep node hierarchies (10+ hops risk attenuation)
//! 2. Cyclic graph handling and self-loops
//! 3. Complex choke point topologies (diamonds, bypasses, bottlenecks)
//! 4. Lineage tracing with branching and disconnected components
//! 5. Asset subgraph extraction with cycles

use std::collections::HashSet;
use uuid::Uuid;

use sentinel_common::enums::Severity;
use sentinel_knowledge::{
    AttackGraphCteQueries, ContextEdgeType, ContextGraphEdge, ContextGraphNode, ContextNodeType,
    SecurityContextGraph,
};

#[test]
fn challenge_deep_hierarchy_risk_attenuation_12_hops() {
    let mut graph = SecurityContextGraph::new();

    // Create a 12-hop chain:
    // Node 0 (Asset) -> Node 1 -> Node 2 -> ... -> Node 11 -> Node 12 (Finding: Critical, 100.0)
    let mut node_ids = Vec::new();

    let asset_id = Uuid::new_v4();
    node_ids.push(asset_id);
    graph.add_node(ContextGraphNode::new(asset_id, ContextNodeType::Asset, "root.local"));

    for i in 1..=11 {
        let node_id = Uuid::new_v4();
        node_ids.push(node_id);
        graph.add_node(ContextGraphNode::new(
            node_id,
            ContextNodeType::Endpoint,
            format!("/hop_{i}"),
        ));
    }

    let finding_id = Uuid::new_v4();
    node_ids.push(finding_id);
    graph.add_node(
        ContextGraphNode::new(finding_id, ContextNodeType::Finding, "Deep Injected Vulnerability")
            .with_severity(Severity::Critical), // 100.0
    );

    // Link chain
    for i in 0..12 {
        let edge = ContextGraphEdge::new(node_ids[i], node_ids[i + 1], ContextEdgeType::TargetsEndpoint);
        graph.add_edge(edge);
    }

    let updated_scores = graph.propagate_risk_scores();

    // Verify finding score = 100.0
    assert_eq!(*updated_scores.get(&finding_id).unwrap(), 100.0);

    // Verify mathematical attenuation formula for every single hop:
    // Hop k (distance from finding = d): score = 100.0 * (0.85)^d
    for (idx, &id) in node_ids.iter().enumerate() {
        let distance_from_finding = 12 - idx;
        let expected_score = 100.0 * (0.85_f64).powi(distance_from_finding as i32);
        let actual_score = *updated_scores.get(&id).unwrap();

        assert!(
            (actual_score - expected_score).abs() < 0.001,
            "Mismatch at hop {idx} (distance {distance_from_finding}): expected {expected_score}, got {actual_score}"
        );
    }

    // Explicitly verify 10-hop distance: 100.0 * 0.85^10 ≈ 19.68744
    let hop_10_id = node_ids[2]; // distance 12 - 2 = 10 hops
    let hop_10_score = *updated_scores.get(&hop_10_id).unwrap();
    assert!((hop_10_score - 19.68744).abs() < 0.01);

    // Explicitly verify root asset (12 hops): 100.0 * 0.85^12 ≈ 14.22417
    let root_score = *updated_scores.get(&asset_id).unwrap();
    assert!((root_score - 14.22417).abs() < 0.01);
}

#[test]
fn challenge_cyclic_graphs_and_self_loops() {
    let mut graph = SecurityContextGraph::new();

    let n1 = Uuid::new_v4();
    let n2 = Uuid::new_v4();
    let n3 = Uuid::new_v4();
    let finding_id = Uuid::new_v4();

    graph.add_node(ContextGraphNode::new(n1, ContextNodeType::Asset, "asset.local"));
    graph.add_node(ContextGraphNode::new(n2, ContextNodeType::Endpoint, "/endpoint2"));
    graph.add_node(ContextGraphNode::new(n3, ContextNodeType::Endpoint, "/endpoint3"));
    graph.add_node(
        ContextGraphNode::new(finding_id, ContextNodeType::Finding, "Loop Finding")
            .with_severity(Severity::High), // 80.0
    );

    // Form cycle: n1 -> n2 -> n3 -> n1
    graph.add_edge(ContextGraphEdge::new(n1, n2, ContextEdgeType::HasEndpoint));
    graph.add_edge(ContextGraphEdge::new(n2, n3, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(n3, n1, ContextEdgeType::TargetsEndpoint));

    // Self-loop on n2: n2 -> n2
    graph.add_edge(ContextGraphEdge::new(n2, n2, ContextEdgeType::TargetsEndpoint));

    // Finding attached to n3: n3 -> finding
    graph.add_edge(ContextGraphEdge::new(n3, finding_id, ContextEdgeType::ExhibitsFinding));

    // Finding self-loop: finding -> finding
    graph.add_edge(ContextGraphEdge::new(finding_id, finding_id, ContextEdgeType::ExhibitsFinding));

    // 1. Test Lineage Tracing does not loop infinitely
    let lineage = graph.trace_finding_lineage(finding_id).expect("Lineage should resolve");
    assert_eq!(lineage.finding_id, finding_id);
    // All 4 unique nodes should be captured
    let visited_ids: HashSet<Uuid> = lineage.nodes.iter().map(|n| n.id).collect();
    assert_eq!(visited_ids.len(), 4);
    assert!(visited_ids.contains(&n1));
    assert!(visited_ids.contains(&n2));
    assert!(visited_ids.contains(&n3));
    assert!(visited_ids.contains(&finding_id));

    // 2. Test Risk Propagation terminates and converges
    let scores = graph.propagate_risk_scores();
    assert_eq!(*scores.get(&finding_id).unwrap(), 80.0);

    // Because of attenuation 0.85 < 1.0, the cycle decays and converges
    let score_n3 = *scores.get(&n3).unwrap();
    assert!(score_n3 >= 80.0 * 0.85); // at least 68.0

    let score_n2 = *scores.get(&n2).unwrap();
    assert!(score_n2 > 0.0 && score_n2 <= 80.0);

    let score_n1 = *scores.get(&n1).unwrap();
    assert!(score_n1 > 0.0 && score_n1 <= 80.0);

    // 3. Test asset subgraph extraction with cycle
    let sub = graph.get_asset_subgraph(n1, 10);
    assert_eq!(sub.nodes.len(), 4);
}

#[test]
fn challenge_complex_choke_point_topology() {
    let mut graph = SecurityContextGraph::new();

    // Topology:
    // Assets: A1, A2, A3
    // Choke Point 1: Gateway (all A1, A2, A3 connect to Gateway)
    // Services: Svc1, Svc2 (Gateway connects to Svc1 and Svc2)
    // Choke Point 2: SharedDb (both Svc1 and Svc2 connect to SharedDb)
    // Sinks (Findings): F1, F2 (SharedDb exhibits F1, F2)
    //
    // Bypass: A3 -> BypassSvc -> F3 (bypasses Gateway and SharedDb)

    let a1 = Uuid::new_v4();
    let a2 = Uuid::new_v4();
    let a3 = Uuid::new_v4();
    let gateway = Uuid::new_v4();
    let svc1 = Uuid::new_v4();
    let svc2 = Uuid::new_v4();
    let shared_db = Uuid::new_v4();
    let bypass_svc = Uuid::new_v4();
    let f1 = Uuid::new_v4();
    let f2 = Uuid::new_v4();
    let f3 = Uuid::new_v4();

    graph.add_node(ContextGraphNode::new(a1, ContextNodeType::Asset, "asset1.local"));
    graph.add_node(ContextGraphNode::new(a2, ContextNodeType::Asset, "asset2.local"));
    graph.add_node(ContextGraphNode::new(a3, ContextNodeType::Asset, "asset3.local"));

    graph.add_node(ContextGraphNode::new(gateway, ContextNodeType::Service, "API-Gateway"));
    graph.add_node(ContextGraphNode::new(svc1, ContextNodeType::Service, "User-Service"));
    graph.add_node(ContextGraphNode::new(svc2, ContextNodeType::Service, "Order-Service"));
    graph.add_node(ContextGraphNode::new(shared_db, ContextNodeType::Service, "Shared-Postgres"));
    graph.add_node(ContextGraphNode::new(bypass_svc, ContextNodeType::Service, "Static-CDN"));

    graph.add_node(ContextGraphNode::new(f1, ContextNodeType::Finding, "SQLi in SharedDb").with_severity(Severity::High));
    graph.add_node(ContextGraphNode::new(f2, ContextNodeType::Finding, "Info Disclosure").with_severity(Severity::Low));
    graph.add_node(ContextGraphNode::new(f3, ContextNodeType::Finding, "CORS Misconfig").with_severity(Severity::Info));

    // Edges
    graph.add_edge(ContextGraphEdge::new(a1, gateway, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(a2, gateway, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(a3, gateway, ContextEdgeType::TargetsEndpoint));

    graph.add_edge(ContextGraphEdge::new(gateway, svc1, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(gateway, svc2, ContextEdgeType::TargetsEndpoint));

    graph.add_edge(ContextGraphEdge::new(svc1, shared_db, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(svc2, shared_db, ContextEdgeType::TargetsEndpoint));

    graph.add_edge(ContextGraphEdge::new(shared_db, f1, ContextEdgeType::ExhibitsFinding));
    graph.add_edge(ContextGraphEdge::new(shared_db, f2, ContextEdgeType::ExhibitsFinding));

    // Bypass
    graph.add_edge(ContextGraphEdge::new(a3, bypass_svc, ContextEdgeType::TargetsEndpoint));
    graph.add_edge(ContextGraphEdge::new(bypass_svc, f3, ContextEdgeType::ExhibitsFinding));

    // Calculate choke points
    let choke_points = graph.find_choke_points(5);
    assert!(!choke_points.is_empty());

    // Gateway path count:
    // From A1: A1->GW->S1->DB->F1, A1->GW->S1->DB->F2, A1->GW->S2->DB->F1, A1->GW->S2->DB->F2 = 4 paths
    // From A2: 4 paths
    // From A3: 4 paths
    // Total paths through Gateway = 12
    // Total paths through SharedDb = 12
    // Services Svc1 and Svc2 each have 6 paths

    let gw_entry = choke_points.iter().find(|(id, _)| *id == gateway).expect("Gateway must be detected as choke point");
    let db_entry = choke_points.iter().find(|(id, _)| *id == shared_db).expect("SharedDb must be detected as choke point");

    assert_eq!(gw_entry.1, 12, "Gateway must be in 12 paths");
    assert_eq!(db_entry.1, 12, "SharedDb must be in 12 paths");

    // Top 2 choke points should be Gateway and SharedDb (both 12)
    assert!(choke_points[0].1 == 12 && choke_points[1].1 == 12);
}

#[test]
fn challenge_disconnected_and_empty_graphs() {
    let empty_graph = SecurityContextGraph::new();
    assert!(empty_graph.trace_finding_lineage(Uuid::new_v4()).is_none());
    assert!(empty_graph.find_choke_points(10).is_empty());
    assert!(empty_graph.find_all_paths(Uuid::new_v4(), Uuid::new_v4(), 5).is_empty());

    // Disconnected nodes
    let mut disconnected_graph = SecurityContextGraph::new();
    let n1 = Uuid::new_v4();
    let n2 = Uuid::new_v4();
    disconnected_graph.add_node(ContextGraphNode::new(n1, ContextNodeType::Asset, "isolated1"));
    disconnected_graph.add_node(ContextGraphNode::new(n2, ContextNodeType::Finding, "isolated2"));

    let paths = disconnected_graph.find_all_paths(n1, n2, 10);
    assert!(paths.is_empty());
    let lineage = disconnected_graph.trace_finding_lineage(n2).unwrap();
    assert_eq!(lineage.nodes.len(), 1); // Only the finding itself
}

#[test]
fn challenge_recursive_cte_generator_contracts() {
    let target_uuid = Uuid::new_v4().to_string();
    let lineage_cte = AttackGraphCteQueries::query_lineage_sql(&target_uuid, 20);
    assert!(lineage_cte.contains(&format!("WHERE target_id = '{target_uuid}'")));
    assert!(lineage_cte.contains("WHERE l.depth < 20"));
    assert!(lineage_cte.contains("JOIN lineage l ON e.target_id = l.source_id"));

    let paths_cte = AttackGraphCteQueries::query_attack_paths_sql(&target_uuid, 15);
    assert!(paths_cte.contains(&format!("WHERE source_id = '{target_uuid}'")));
    assert!(paths_cte.contains("WHERE ap.depth < 15 AND instr(ap.path_str, e.target_id) = 0"));

    let choke_cte = AttackGraphCteQueries::query_choke_points_sql(10);
    assert!(choke_cte.contains("WHERE n.node_type = 'asset'"));
    assert!(choke_cte.contains("WHERE p.depth < 10"));
    assert!(choke_cte.contains("WHERE gn.node_type NOT IN ('asset', 'finding')"));
}

