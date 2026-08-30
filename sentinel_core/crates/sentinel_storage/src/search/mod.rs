//! Full-text search engine module for HTTP transactions.

pub mod engine;
pub mod schema;

pub use engine::Bm25SearchEngine;
pub use schema::{HttpSearchDocument, SearchFilter, SearchHitResult};
