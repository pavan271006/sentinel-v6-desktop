use super::schema::{HttpSearchDocument, SearchFilter, SearchHitResult};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

const BM25_K1: f32 = 1.2;
const BM25_B: f32 = 0.75;

#[derive(Debug, Clone, Default)]
struct Posting {
    doc_id: usize,
    term_frequency: u32,
}

#[derive(Debug, Clone, Default)]
struct FieldIndex {
    // term -> list of postings
    inverted_index: HashMap<String, Vec<Posting>>,
    doc_lengths: Vec<usize>,
    total_length: usize,
}

impl FieldIndex {
    fn add_document(&mut self, doc_id: usize, text: &str) {
        let tokens = tokenize(text);
        let len = tokens.len();
        self.doc_lengths.push(len);
        self.total_length += len;

        let mut tf_map: HashMap<String, u32> = HashMap::new();
        for t in tokens {
            *tf_map.entry(t).or_default() += 1;
        }

        for (term, tf) in tf_map {
            self.inverted_index.entry(term).or_default().push(Posting {
                doc_id,
                term_frequency: tf,
            });
        }
    }

    fn avg_length(&self) -> f32 {
        if self.doc_lengths.is_empty() {
            1.0
        } else {
            (self.total_length as f32) / (self.doc_lengths.len() as f32)
        }
    }
}

pub struct Bm25SearchEngine {
    docs: Arc<RwLock<Vec<HttpSearchDocument>>>,
    doc_map: Arc<RwLock<HashMap<Uuid, usize>>>,
    uri_index: Arc<RwLock<FieldIndex>>,
    body_index: Arc<RwLock<FieldIndex>>,
    headers_index: Arc<RwLock<FieldIndex>>,
}

impl Default for Bm25SearchEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl Bm25SearchEngine {
    pub fn new() -> Self {
        Self {
            docs: Arc::new(RwLock::new(Vec::new())),
            doc_map: Arc::new(RwLock::new(HashMap::new())),
            uri_index: Arc::new(RwLock::new(FieldIndex::default())),
            body_index: Arc::new(RwLock::new(FieldIndex::default())),
            headers_index: Arc::new(RwLock::new(FieldIndex::default())),
        }
    }

    /// Indexes a complete HTTP search document.
    pub fn index_document(&self, doc: HttpSearchDocument) {
        let mut docs_guard = self.docs.write().unwrap();
        let mut map_guard = self.doc_map.write().unwrap();
        let mut uri_guard = self.uri_index.write().unwrap();
        let mut body_guard = self.body_index.write().unwrap();
        let mut headers_guard = self.headers_index.write().unwrap();

        let doc_id = docs_guard.len();
        let tx_id = doc.tx_id;

        uri_guard.add_document(doc_id, &doc.req_uri);
        let combined_body = format!("{}\n{}", doc.req_body, doc.res_body);
        body_guard.add_document(doc_id, &combined_body);
        let combined_headers = format!("{}\n{}", doc.req_headers, doc.res_headers);
        headers_guard.add_document(doc_id, &combined_headers);

        map_guard.insert(tx_id, doc_id);
        docs_guard.push(doc);
    }

    /// Searches indexed transactions using BM25 scoring over URI, Headers, and Body.
    pub fn search(&self, query_str: &str, filter: Option<&SearchFilter>, limit: usize) -> Vec<SearchHitResult> {
        let query_tokens = tokenize(query_str);
        if query_tokens.is_empty() {
            return self.list_filtered(filter, limit);
        }

        let docs = self.docs.read().unwrap();
        let num_docs = docs.len();
        if num_docs == 0 {
            return Vec::new();
        }

        let uri_index = self.uri_index.read().unwrap();
        let body_index = self.body_index.read().unwrap();
        let headers_index = self.headers_index.read().unwrap();

        let mut scores: HashMap<usize, f32> = HashMap::new();

        for token in &query_tokens {
            // 1. URI Field (weight: 3.0)
            score_field(&uri_index, token, num_docs, 3.0, &mut scores);

            // 2. Body Field (weight: 1.5)
            score_field(&body_index, token, num_docs, 1.5, &mut scores);

            // 3. Headers Field (weight: 1.0)
            score_field(&headers_index, token, num_docs, 1.0, &mut scores);
        }

        let mut candidate_hits: Vec<(usize, f32)> = scores.into_iter().collect();
        candidate_hits.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let mut results = Vec::with_capacity(limit.min(candidate_hits.len()));

        for (doc_id, score) in candidate_hits {
            if results.len() >= limit {
                break;
            }

            let doc = &docs[doc_id];

            // Apply filter
            if let Some(f) = filter {
                if let Some(m) = &f.method {
                    if !doc.req_method.eq_ignore_ascii_case(m) {
                        continue;
                    }
                }
                if let Some(min_s) = f.min_status {
                    if doc.res_status < min_s {
                        continue;
                    }
                }
                if let Some(max_s) = f.max_status {
                    if doc.res_status > max_s {
                        continue;
                    }
                }
                if let Some(tag) = &f.tag {
                    if !doc.tags.iter().any(|t| t.eq_ignore_ascii_case(tag)) {
                        continue;
                    }
                }
            }

            let snippet = extract_snippet(&doc.req_body, &doc.res_body, &query_tokens);

            results.push(SearchHitResult {
                tx_id: doc.tx_id,
                score,
                req_method: doc.req_method.clone(),
                req_uri: doc.req_uri.clone(),
                res_status: doc.res_status,
                snippet,
            });
        }

        results
    }

    /// Clears and rebuilds the full-text search index from a collection of documents.
    pub fn rebuild_from_documents(&self, documents: Vec<HttpSearchDocument>) {
        let mut docs_guard = self.docs.write().unwrap();
        let mut map_guard = self.doc_map.write().unwrap();
        let mut uri_guard = self.uri_index.write().unwrap();
        let mut body_guard = self.body_index.write().unwrap();
        let mut headers_guard = self.headers_index.write().unwrap();

        *docs_guard = Vec::new();
        *map_guard = HashMap::new();
        *uri_guard = FieldIndex::default();
        *body_guard = FieldIndex::default();
        *headers_guard = FieldIndex::default();

        for doc in documents {
            let doc_id = docs_guard.len();
            let tx_id = doc.tx_id;

            uri_guard.add_document(doc_id, &doc.req_uri);
            let combined_body = format!("{}\n{}", doc.req_body, doc.res_body);
            body_guard.add_document(doc_id, &combined_body);
            let combined_headers = format!("{}\n{}", doc.req_headers, doc.res_headers);
            headers_guard.add_document(doc_id, &combined_headers);

            map_guard.insert(tx_id, doc_id);
            docs_guard.push(doc);
        }
    }

    /// Total count of indexed documents.
    pub fn count(&self) -> usize {
        self.docs.read().unwrap().len()
    }

    fn list_filtered(&self, filter: Option<&SearchFilter>, limit: usize) -> Vec<SearchHitResult> {
        let docs = self.docs.read().unwrap();
        let mut results = Vec::new();

        for doc in docs.iter().rev() {
            if results.len() >= limit {
                break;
            }

            if let Some(f) = filter {
                if let Some(m) = &f.method {
                    if !doc.req_method.eq_ignore_ascii_case(m) {
                        continue;
                    }
                }
                if let Some(min_s) = f.min_status {
                    if doc.res_status < min_s {
                        continue;
                    }
                }
                if let Some(max_s) = f.max_status {
                    if doc.res_status > max_s {
                        continue;
                    }
                }
                if let Some(tag) = &f.tag {
                    if !doc.tags.iter().any(|t| t.eq_ignore_ascii_case(tag)) {
                        continue;
                    }
                }
            }

            results.push(SearchHitResult {
                tx_id: doc.tx_id,
                score: 1.0,
                req_method: doc.req_method.clone(),
                req_uri: doc.req_uri.clone(),
                res_status: doc.res_status,
                snippet: None,
            });
        }

        results
    }
}

fn score_field(
    field_index: &FieldIndex,
    token: &str,
    total_docs: usize,
    field_weight: f32,
    scores: &mut HashMap<usize, f32>,
) {
    if let Some(postings) = field_index.inverted_index.get(token) {
        let df = postings.len() as f32;
        let idf = ((total_docs as f32 - df + 0.5) / (df + 0.5) + 1.0).ln().max(0.1);
        let avg_dl = field_index.avg_length();

        for post in postings {
            let doc_len = field_index.doc_lengths[post.doc_id] as f32;
            let tf = post.term_frequency as f32;
            let numerator = tf * (BM25_K1 + 1.0);
            let denominator = tf + BM25_K1 * (1.0 - BM25_B + BM25_B * (doc_len / avg_dl));
            let term_score = idf * (numerator / denominator) * field_weight;

            *scores.entry(post.doc_id).or_default() += term_score;
        }
    }
}

fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for c in text.chars() {
        if c.is_alphanumeric() || c == '_' || c == '-' {
            current.push(c.to_ascii_lowercase());
        } else {
            if current.len() >= 2 {
                tokens.push(current.clone());
            }
            current.clear();
        }
    }
    if current.len() >= 2 {
        tokens.push(current);
    }

    tokens
}

fn extract_snippet(req_body: &str, res_body: &str, query_tokens: &[String]) -> Option<String> {
    let combined = format!("{}\n{}", req_body, res_body);
    let lower = combined.to_lowercase();

    for token in query_tokens {
        if let Some(idx) = lower.find(token) {
            let start = idx.saturating_sub(40);
            let end = (idx + token.len() + 60).min(combined.len());
            let snippet_str = &combined[start..end];
            return Some(format!("...{}...", snippet_str.replace('\n', " ")));
        }
    }

    if !combined.trim().is_empty() {
        let end = combined.len().min(100);
        Some(format!("...{}...", combined[..end].replace('\n', " ")))
    } else {
        None
    }
}
