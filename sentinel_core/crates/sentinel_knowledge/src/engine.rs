//! Knowledge Engine Implementation

use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{GraphEdge, GraphNode};
use sentinel_common::traits::KnowledgeEngine;
use sentinel_storage::SqliteObservationStore;

use crate::graph::GraphIndex;

#[derive(Clone)]
pub struct DefaultKnowledgeEngine {
    index: Arc<RwLock<GraphIndex>>,
    storage: Option<Arc<SqliteObservationStore>>,
}

impl DefaultKnowledgeEngine {
    pub fn new() -> Self {
        Self {
            index: Arc::new(RwLock::new(GraphIndex::new())),
            storage: None,
        }
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }
}

impl Default for DefaultKnowledgeEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl KnowledgeEngine for DefaultKnowledgeEngine {
    async fn add_node(&self, node: GraphNode) -> Result<Uuid, SentinelError> {
        let node_id = node.id;

        if let Some(storage) = &self.storage {
            let id = node.id.to_string();
            let ver = node.version as i64;
            let ts = node.timestamp.to_rfc3339();
            let n_type = &node.node_type;
            let label = &node.label;
            let meta = node.metadata_json.as_deref();

            sqlx::query(
                "INSERT INTO graph_nodes (id, version, timestamp, node_type, label, metadata_json) VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(ver)
            .bind(ts)
            .bind(n_type)
            .bind(label)
            .bind(meta)
            .execute(storage.pool())
            .await
            .map_err(SentinelError::Database)?;
        }

        self.index.write().insert_node(node);
        Ok(node_id)
    }

    async fn add_edge(&self, edge: GraphEdge) -> Result<Uuid, SentinelError> {
        let edge_id = edge.id;

        if let Some(storage) = &self.storage {
            let id = edge.id.to_string();
            let src = edge.source_id.to_string();
            let tgt = edge.target_id.to_string();
            let e_type = &edge.edge_type;
            let ts = edge.timestamp.to_rfc3339();

            sqlx::query(
                "INSERT INTO graph_edges (id, source_id, target_id, edge_type, timestamp) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(src)
            .bind(tgt)
            .bind(e_type)
            .bind(ts)
            .execute(storage.pool())
            .await
            .map_err(SentinelError::Database)?;
        }

        self.index.write().insert_edge(edge);
        Ok(edge_id)
    }

    async fn query_neighbors(&self, node_id: Uuid) -> Result<Vec<GraphNode>, SentinelError> {
        Ok(self.index.read().get_neighbors(node_id))
    }

    async fn find_path(&self, from: Uuid, to: Uuid) -> Result<Vec<Vec<GraphEdge>>, SentinelError> {
        Ok(self.index.read().find_paths(from, to))
    }

    async fn resolve_entity(&self, identifier: &str) -> Result<Option<GraphNode>, SentinelError> {
        Ok(self.index.read().resolve_label(identifier).cloned())
    }
}
