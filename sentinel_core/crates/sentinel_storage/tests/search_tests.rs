use sentinel_storage::search::*;
use uuid::Uuid;

#[test]
fn test_bm25_search_indexing_scoring_and_filtering() {
    let engine = Bm25SearchEngine::new();

    let doc1 = HttpSearchDocument {
        tx_id: Uuid::new_v4(),
        timestamp: 1724400000000,
        req_method: "GET".to_string(),
        req_uri: "/api/v1/users/admin/credentials".to_string(),
        req_headers: "Host: target.corp\r\nAuthorization: Bearer token123".to_string(),
        req_body: "".to_string(),
        res_status: 200,
        res_headers: "Content-Type: application/json".to_string(),
        res_body: r#"{"status": "ok", "role": "admin", "secret": "s3cr3t_pass"}"#.to_string(),
        content_type: "application/json".to_string(),
        tags: vec!["auth".to_string(), "admin".to_string()],
    };

    let doc2 = HttpSearchDocument {
        tx_id: Uuid::new_v4(),
        timestamp: 1724400001000,
        req_method: "POST".to_string(),
        req_uri: "/api/v1/public/contact".to_string(),
        req_headers: "Host: target.corp\r\nContent-Type: application/json".to_string(),
        req_body: r#"{"name": "Alice", "message": "hello support team"}"#.to_string(),
        res_status: 201,
        res_headers: "Content-Type: application/json".to_string(),
        res_body: r#"{"status": "received"}"#.to_string(),
        content_type: "application/json".to_string(),
        tags: vec!["public".to_string()],
    };

    let doc3 = HttpSearchDocument {
        tx_id: Uuid::new_v4(),
        timestamp: 1724400002000,
        req_method: "GET".to_string(),
        req_uri: "/api/v1/auth/login?redirect=admin".to_string(),
        req_headers: "Host: target.corp".to_string(),
        req_body: "".to_string(),
        res_status: 401,
        res_headers: "Content-Type: application/json".to_string(),
        res_body: r#"{"error": "Unauthorized"}"#.to_string(),
        content_type: "application/json".to_string(),
        tags: vec!["auth".to_string()],
    };

    engine.index_document(doc1.clone());
    engine.index_document(doc2.clone());
    engine.index_document(doc3.clone());

    assert_eq!(engine.count(), 3);

    // 1. BM25 Search for "admin credentials"
    let hits1 = engine.search("admin credentials", None, 10);
    assert!(!hits1.is_empty());
    assert_eq!(hits1[0].tx_id, doc1.tx_id);
    assert!(hits1[0].snippet.is_some());

    // 2. Filter search: method POST
    let filter_post = SearchFilter {
        method: Some("POST".to_string()),
        min_status: None,
        max_status: None,
        tag: None,
    };
    let hits_post = engine.search("alice support", Some(&filter_post), 10);
    assert_eq!(hits_post.len(), 1);
    assert_eq!(hits_post[0].tx_id, doc2.tx_id);

    // 3. Status range filter (status 400..=499)
    let filter_status = SearchFilter {
        method: None,
        min_status: Some(400),
        max_status: Some(499),
        tag: None,
    };
    let hits_401 = engine.search("unauthorized", Some(&filter_status), 10);
    assert_eq!(hits_401.len(), 1);
    assert_eq!(hits_401[0].tx_id, doc3.tx_id);

    // 4. Index rebuild from document collection
    engine.rebuild_from_documents(vec![doc1, doc2]);
    assert_eq!(engine.count(), 2);
    let hits_after_rebuild = engine.search("credentials", None, 10);
    assert_eq!(hits_after_rebuild.len(), 1);
}
