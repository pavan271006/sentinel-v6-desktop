//! Global Omni-Search Engine

use parking_lot::RwLock;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SearchResultKind {
    Endpoint,
    Finding,
    Transaction,
    Note,
    GraphNode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchHit {
    pub id: Uuid,
    pub kind: SearchResultKind,
    pub title: String,
    pub snippet: String,
    pub score: u32,
}

pub struct OmniSearchEngine {
    index: Arc<RwLock<Vec<SearchHit>>>,
}

impl OmniSearchEngine {
    pub fn new() -> Self {
        Self {
            index: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn index_item(&self, hit: SearchHit) {
        self.index.write().push(hit);
    }

    pub fn search(&self, query: &str) -> Vec<SearchHit> {
        let q = query.to_lowercase();
        let items = self.index.read();
        let mut results: Vec<SearchHit> = items
            .iter()
            .filter(|h| {
                h.title.to_lowercase().contains(&q) || h.snippet.to_lowercase().contains(&q)
            })
            .cloned()
            .collect();

        results.sort_by_key(|b| std::cmp::Reverse(b.score));
        results
    }

    pub fn clear(&self) {
        self.index.write().clear();
    }
}

impl Default for OmniSearchEngine {
    fn default() -> Self {
        Self::new()
    }
}
