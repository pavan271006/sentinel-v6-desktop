//! Test Suite for Knowledge Graph Subsystem

use std::sync::Arc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_common::operational::{GraphEdge, GraphNode};
use sentinel_common::traits::KnowledgeEngine;
use sentinel_knowledge::DefaultKnowledgeEngine;
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_knowledge_graph_node_and_edge_management() {
    let engine = DefaultKnowledgeEngine::new();

    // 1. Create nodes: Host -> Endpoint -> Parameter
    let host_node = GraphNode {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        node_type: "Host".to_string(),
        label: "api.target.com".to_string(),
        metadata_json: Some("{\"ip\": \"192.168.1.50\"}".to_string()),
    };

    let endpoint_node = GraphNode {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        node_type: "Endpoint".to_string(),
        label: "POST /v1/auth/login".to_string(),
        metadata_json: None,
    };

    let param_node = GraphNode {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        node_type: "Parameter".to_string(),
        label: "username".to_string(),
        metadata_json: Some("{\"class\": \"FreeText\"}".to_string()),
    };

    engine.add_node(host_node.clone()).await.unwrap();
    engine.add_node(endpoint_node.clone()).await.unwrap();
    engine.add_node(param_node.clone()).await.unwrap();

    // 2. Connect with edges
    let edge1 = GraphEdge {
        id: Uuid::new_v4(),
        source_id: host_node.id,
        target_id: endpoint_node.id,
        edge_type: "EXPOSES".to_string(),
        timestamp: chrono::Utc::now(),
    };

    let edge2 = GraphEdge {
        id: Uuid::new_v4(),
        source_id: endpoint_node.id,
        target_id: param_node.id,
        edge_type: "ACCEPTS".to_string(),
        timestamp: chrono::Utc::now(),
    };

    engine.add_edge(edge1.clone()).await.unwrap();
    engine.add_edge(edge2.clone()).await.unwrap();

    // 3. Query Neighbors
    let neighbors = engine.query_neighbors(host_node.id).await.unwrap();
    assert_eq!(neighbors.len(), 1);
    assert_eq!(neighbors[0].label, "POST /v1/auth/login");

    // 4. Pathfinding
    let paths = engine.find_path(host_node.id, param_node.id).await.unwrap();
    assert_eq!(paths.len(), 1);
    assert_eq!(paths[0].len(), 2);
    assert_eq!(paths[0][0].edge_type, "EXPOSES");
    assert_eq!(paths[0][1].edge_type, "ACCEPTS");

    // 5. Entity Resolution
    let resolved = engine.resolve_entity("api.target.com").await.unwrap();
    assert!(resolved.is_some());
    assert_eq!(resolved.unwrap().node_type, "Host");
}

#[tokio::test]
async fn test_knowledge_graph_sqlite_persistence() {
    let temp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(temp.path()).await.unwrap());

    let engine = DefaultKnowledgeEngine::new().with_storage(store.clone());

    let node = GraphNode {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        node_type: "Asset".to_string(),
        label: "database.corp.internal".to_string(),
        metadata_json: None,
    };

    engine.add_node(node.clone()).await.unwrap();

    let resolved = engine
        .resolve_entity("database.corp.internal")
        .await
        .unwrap();
    assert!(resolved.is_some());
    assert_eq!(resolved.unwrap().id, node.id);
}
