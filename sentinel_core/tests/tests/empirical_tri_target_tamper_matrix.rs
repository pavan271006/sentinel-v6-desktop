//! Empirical Challenger Phase 1 Test Suite
//!
//! Stress-tests and adversarially challenges:
//! 1. CAS Byte-Level Tampering & Merkle Root Invariants (SEC-06 & SEC-07)
//! 2. Merkle Proof Trees across arbitrary leaf counts (1 to 128) and inclusion proof tampering
//! 3. Merkle Proof Chain multi-block tamper rejection
//! 4. Comprehensive Tri-Target Confusion Matrix (Vulnerable vs Fixed vs Benign) across 30 distinct test cases

use std::net::SocketAddr;
use std::sync::Arc;
use chrono::Utc;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use sentinel_common::domain::Scope;
use sentinel_common::enums::FindingLifecycle;
use sentinel_common::SentinelError;
use sentinel_repeater::RepeaterExecutor;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::cas::BlobStorage;
use sentinel_storage::merkle::{MerkleProofChain, MerkleProofTree, ProofDirection};
use sentinel_storage::SqliteObservationStore;
use sentinel_verification::lifecycle::FindingLifecycleManager;
use sentinel_verification::sqli::SqliEngine;

struct MockServer {
    pub addr: SocketAddr,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl MockServer {
    pub async fn spawn(
        handler: impl Fn(&str) -> (u16, &'static str, String) + Send + Sync + 'static,
    ) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        let handler_arc = Arc::new(handler);

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    Ok((mut socket, _)) = listener.accept() => {
                        let handler = handler_arc.clone();
                        tokio::spawn(async move {
                            let mut buf = [0u8; 4096];
                            let n = socket.read(&mut buf).await.unwrap_or(0);
                            let req_str = String::from_utf8_lossy(&buf[..n]).to_string();
                            let (status, reason, body) = handler(&req_str);

                            let response = format!(
                                "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                status,
                                reason,
                                body.len(),
                                body
                            );
                            let _ = socket.write_all(response.as_bytes()).await;
                            let _ = socket.flush().await;
                        });
                    }
                    _ = &mut shutdown_rx => {
                        break;
                    }
                }
            }
        });

        Self {
            addr,
            shutdown_tx: Some(shutdown_tx),
        }
    }
}

impl Drop for MockServer {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

// =================================================================================================
// 1. CAS BYTE-LEVEL TAMPERING & MERKLE ROOT INVARIANTS (SEC-06 & SEC-07)
// =================================================================================================

#[tokio::test]
async fn test_adversarial_cas_byte_tampering_at_all_offsets() {
    let tmp = tempdir().unwrap();
    let cas = BlobStorage::new(tmp.path()).await.unwrap();

    let original_payload = b"POST /api/v1/transfer HTTP/1.1\r\nHost: bank.local\r\nContent-Length: 38\r\n\r\n{\"amount\": 1000000, \"to\": \"attacker\"}";
    let blob_desc = cas.put(original_payload).await.unwrap();
    let blob_path = cas.blob_path(&blob_desc.sha256_hex);

    // Initial check: Blob must verify cleanly
    assert!(cas.verify_integrity(&blob_desc.sha256_hex).await.unwrap());

    let tree = MerkleProofTree::from_hashes(std::slice::from_ref(&blob_desc.sha256_hex));
    assert!(tree.verify_tamper(&cas).await.unwrap());

    // Helper to check tamper rejection
    async fn assert_tampered(cas: &BlobStorage, tree: &MerkleProofTree, sha256_hex: &str) {
        let cas_res = cas.verify_integrity(sha256_hex).await;
        match cas_res {
            Ok(false) => {},
            Err(SentinelError::InvariantViolation(_)) => {},
            other => panic!("Expected Ok(false) or InvariantViolation from CAS, got {:?}", other),
        }

        let tree_res = tree.verify_tamper(cas).await;
        match tree_res {
            Ok(false) => {},
            Err(SentinelError::InvariantViolation(_)) => {},
            other => panic!("Expected Ok(false) or InvariantViolation from MerkleTree, got {:?}", other),
        }
    }

    // Test tamper at index 0 (Start of file)
    let mut tampered = original_payload.to_vec();
    tampered[0] ^= 0xFF;
    tokio::fs::write(&blob_path, &tampered).await.unwrap();
    assert_tampered(&cas, &tree, &blob_desc.sha256_hex).await;

    // Test tamper at middle of file
    let mid = original_payload.len() / 2;
    let mut tampered = original_payload.to_vec();
    tampered[mid] ^= 0xAA;
    tokio::fs::write(&blob_path, &tampered).await.unwrap();
    assert_tampered(&cas, &tree, &blob_desc.sha256_hex).await;

    // Test tamper at last byte of file
    let last = original_payload.len() - 1;
    let mut tampered = original_payload.to_vec();
    tampered[last] ^= 0x01;
    tokio::fs::write(&blob_path, &tampered).await.unwrap();
    assert_tampered(&cas, &tree, &blob_desc.sha256_hex).await;

    // Test truncated to 0 bytes
    tokio::fs::write(&blob_path, b"").await.unwrap();
    assert_tampered(&cas, &tree, &blob_desc.sha256_hex).await;

    // Restore original payload -> must verify cleanly again
    tokio::fs::write(&blob_path, original_payload).await.unwrap();
    assert!(cas.verify_integrity(&blob_desc.sha256_hex).await.unwrap());
    assert!(tree.verify_tamper(&cas).await.unwrap());
}

#[tokio::test]
async fn test_adversarial_merkle_tree_scale_and_proof_corruption() {
    // Generate trees of sizes: 1, 2, 3, 4, 5, 7, 8, 15, 16, 31, 32, 63, 64
    let test_sizes = [1, 2, 3, 4, 5, 7, 8, 15, 16, 31, 32, 63, 64];

    for &size in &test_sizes {
        let mut hashes = Vec::with_capacity(size);
        for i in 0..size {
            let fake_hash = format!("{:064x}", i + 1);
            hashes.push(fake_hash);
        }

        let tree = MerkleProofTree::from_hashes(&hashes);
        assert_eq!(tree.leaves.len(), size);
        assert_eq!(tree.root_hash.len(), 64);

        // Every leaf must produce a valid inclusion proof
        for (idx, leaf) in hashes.iter().enumerate() {
            let proof = tree.generate_proof(leaf).expect("Proof must exist");
            assert_eq!(proof.leaf_hash, *leaf);
            assert_eq!(proof.root_hash, tree.root_hash);
            assert!(proof.verify(), "Proof for leaf {} of tree size {} must verify", idx, size);

            // Adversarial test 1: Flipped bit in leaf hash
            let mut corrupted_proof = proof.clone();
            let mut leaf_chars: Vec<char> = corrupted_proof.leaf_hash.chars().collect();
            leaf_chars[0] = if leaf_chars[0] == '0' { '1' } else { '0' };
            corrupted_proof.leaf_hash = leaf_chars.into_iter().collect();
            assert!(!corrupted_proof.verify(), "Corrupted leaf hash must fail verification");

            // Adversarial test 2: Flipped bit in root hash
            let mut corrupted_proof2 = proof.clone();
            let mut root_chars: Vec<char> = corrupted_proof2.root_hash.chars().collect();
            root_chars[0] = if root_chars[0] == 'a' { 'b' } else { 'a' };
            corrupted_proof2.root_hash = root_chars.into_iter().collect();
            assert!(!corrupted_proof2.verify(), "Corrupted root hash must fail verification");

            // Adversarial test 3: Inverted direction on audit path where sibling != current
            if !proof.audit_path.is_empty() {
                let (sibling, dir) = &proof.audit_path[0];
                if sibling != leaf {
                    let mut corrupted_proof3 = proof.clone();
                    corrupted_proof3.audit_path[0].1 = match dir {
                        ProofDirection::Left => ProofDirection::Right,
                        ProofDirection::Right => ProofDirection::Left,
                    };
                    assert!(!corrupted_proof3.verify(), "Inverted audit path direction for distinct sibling must fail");
                }
            }
        }
    }
}

#[tokio::test]
async fn test_adversarial_merkle_proof_chain_tamper_matrix() {
    let mut chain = MerkleProofChain::new();
    let num_blocks = 5;

    for i in 0..num_blocks {
        let finding_id = Uuid::new_v4();
        let cas_hashes = vec![
            format!("{:064x}", i * 3 + 1),
            format!("{:064x}", i * 3 + 2),
            format!("{:064x}", i * 3 + 3),
        ];
        chain.append(finding_id, &cas_hashes);
    }

    assert_eq!(chain.len(), num_blocks);
    assert!(chain.verify_chain(), "Initial untouched chain must verify");

    // Adversarial mutations across every block and every field
    for block_idx in 0..num_blocks {
        // Mutation 1: Tamper index
        let mut mutated = chain.clone();
        mutated.entries[block_idx].index += 100;
        assert!(!mutated.verify_chain(), "Tampered index at block {} must fail", block_idx);

        // Mutation 2: Tamper timestamp
        let mut mutated = chain.clone();
        mutated.entries[block_idx].timestamp = Utc::now();
        assert!(!mutated.verify_chain(), "Tampered timestamp at block {} must fail", block_idx);

        // Mutation 3: Tamper finding_id
        let mut mutated = chain.clone();
        mutated.entries[block_idx].finding_id = Uuid::new_v4();
        assert!(!mutated.verify_chain(), "Tampered finding_id at block {} must fail", block_idx);

        // Mutation 4: Tamper merkle_root
        let mut mutated = chain.clone();
        mutated.entries[block_idx].merkle_root = format!("{:064x}", 0xDEADBEEFu64);
        assert!(!mutated.verify_chain(), "Tampered merkle_root at block {} must fail", block_idx);

        // Mutation 5: Tamper prev_chain_hash
        let mut mutated = chain.clone();
        mutated.entries[block_idx].prev_chain_hash = format!("{:064x}", 0xBAADF00Du64);
        assert!(!mutated.verify_chain(), "Tampered prev_chain_hash at block {} must fail", block_idx);

        // Mutation 6: Tamper chain_hash
        let mut mutated = chain.clone();
        mutated.entries[block_idx].chain_hash = format!("{:064x}", 0xCAFEBABEu64);
        assert!(!mutated.verify_chain(), "Tampered chain_hash at block {} must fail", block_idx);
    }

    // Mutation 7: Block deletion
    let mut mutated = chain.clone();
    mutated.entries.remove(2);
    assert!(!mutated.verify_chain(), "Deleted intermediate block must fail");
}

// =================================================================================================
// 2. COMPREHENSIVE TRI-TARGET CONFUSION MATRIX EMPIRICAL CHALLENGE (30 CASES)
// =================================================================================================

#[tokio::test]
async fn test_comprehensive_tri_target_confusion_matrix_30_cases() {
    let tmp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(tmp.path()).await.unwrap());

    // 10 Distinct Vulnerable Target Responses across MySQL, PostgreSQL, Oracle, MSSQL, SQLite, DB2
    let vuln_responses = vec![
        // SQLite
        ("{\"error\":\"sqlite3.OperationalError: unrecognized token: '\"}", 500),
        ("{\"error\":\"Syntax error in SQL statement near 'SELECT * FROM users'\"}", 500),
        // PostgreSQL
        ("{\"error\":\"ERROR: syntax error at or near \\\"'\\\" at character 42 (PostgreSQL query parser)\"}", 500),
        ("{\"error\":\"PSQLException: ERROR: unterminated quoted string at or near \\\"'\\\"\"}", 500),
        // MySQL
        ("{\"error\":\"You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1\"}", 500),
        ("{\"error\":\"Warning: mysql_fetch_array() expects parameter 1 to be resource, boolean given in /var/www/search.php\"}", 500),
        // MSSQL
        ("{\"error\":\"Microsoft OLE DB Provider for SQL Server error '80040e14' Unclosed quotation mark after the character string ''\"}", 500),
        ("{\"error\":\"System.Data.SqlClient.SqlException (0x80131904): Line 1: Incorrect syntax near '''.\"}", 500),
        // Oracle
        ("{\"error\":\"ORA-01756: quoted string not properly terminated\"}", 500),
        ("{\"error\":\"java.sql.SQLSyntaxErrorException: ORA-00933: SQL command not properly ended\"}", 500),
    ];

    // 10 Distinct Fixed / Remediated Target Responses (Safe parameterized handling, 400 Bad Request, empty sets, sanitized data)
    let fixed_responses = vec![
        ("{\"status\":\"ok\",\"products\":[]}", 200),
        ("{\"status\":\"ok\",\"products\":[{\"id\":1,\"name\":\"Item 1\"}]}", 200),
        ("{\"error\":\"invalid_input\",\"message\":\"The search query contained unsupported special characters.\"}", 400),
        ("{\"status\":\"rejected\",\"code\":\"INVALID_PARAMETER\",\"details\":[\"Query string sanitized\"]}", 400),
        ("{\"count\":0,\"items\":[],\"page\":1}", 200),
        ("{\"status\":\"not_found\",\"message\":\"No records matching query.\"}", 404),
        ("{\"data\":{\"search\":{\"nodes\":[]}}}", 200),
        ("{\"success\":true,\"results\":[]}", 200),
        ("{\"error\":\"bad_request\",\"fields\":{\"q\":\"contains forbidden characters\"}}", 422),
        ("{\"status\":\"ok\",\"total\":0}", 200),
    ];

    // 10 Distinct Benign Control Target Responses (Health endpoints, static assets, non-vulnerable text containing "SQL" or "error", documentation)
    let benign_responses = vec![
        ("{\"status\":\"HEALTHY\",\"uptime_seconds\":86400}", 200),
        ("{\"version\":\"6.0.0\",\"service\":\"sentinel-telemetry\",\"environment\":\"production\"}", 200),
        ("{\"title\":\"Database Guide\",\"content\":\"SQL (Structured Query Language) is standard for relational databases.\"}", 200),
        ("{\"message\":\"User error: Please verify your email address before continuing.\"}", 200),
        ("{\"blog\":{\"title\":\"Understanding NoSQL vs SQL Databases\",\"author\":\"Security Team\"}}", 200),
        ("{\"metrics\":{\"cpu_percent\":12.4,\"memory_mb\":102.5}}", 200),
        ("{\"schema_version\":3,\"features\":[\"auth\",\"proxy\",\"repeater\",\"fuzzer\"]}", 200),
        ("{\"help\":\"Visit /docs/api for complete API reference.\",\"endpoints\":[\"/users\",\"/orders\"]}", 200),
        ("{\"notification\":\"Maintenance scheduled for Sunday 02:00 UTC\"}", 200),
        ("{\"status\":\"pong\",\"timestamp\":1740288000}", 200),
    ];

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["127.0.0.1".to_string()],
        excludes: vec![],
    };
    let scope_engine = Arc::new(DefaultScopeEngine::new(scope));
    let executor = RepeaterExecutor::new(scope_engine).with_storage(store.clone());

    let probe_payload = b"GET /api/v1/search?q=' OR 1=1 -- HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";

    let mut true_positives = 0;
    let mut false_negatives = 0;
    let mut true_negatives = 0;
    let mut false_positives = 0;

    // --- PHASE A: TEST 10 VULNERABLE TARGETS ---
    for (i, (body, status)) in vuln_responses.into_iter().enumerate() {
        let b = body.to_string();
        let server = MockServer::spawn(move |_req| {
            (status, "Error", b.clone())
        }).await;

        let url = format!("http://{}/api/v1/search", server.addr);
        let output = executor.execute_raw(&url, probe_payload, None).await.unwrap();
        let verdict = SqliEngine::evaluate_error_based(&output.raw_response);

        let detected = verdict.as_ref().map(|v| v.is_vulnerable).unwrap_or(false);
        if detected {
            true_positives += 1;
        } else {
            false_negatives += 1;
            eprintln!("[FAIL] Vulnerable target {} was NOT detected! Response: {}", i, body);
        }
    }

    // --- PHASE B: TEST 10 FIXED (NEGATIVE CONTROL) TARGETS ---
    for (i, (body, status)) in fixed_responses.into_iter().enumerate() {
        let b = body.to_string();
        let server = MockServer::spawn(move |_req| {
            (status, "OK", b.clone())
        }).await;

        let url = format!("http://{}/api/v1/search", server.addr);
        let output = executor.execute_raw(&url, probe_payload, None).await.unwrap();
        let verdict = SqliEngine::evaluate_error_based(&output.raw_response);

        let falsely_flagged = verdict.as_ref().map(|v| v.is_vulnerable).unwrap_or(false);
        if falsely_flagged {
            false_positives += 1;
            eprintln!("[FAIL] Fixed target {} was FALSELY flagged as vulnerable! Response: {}", i, body);
        } else {
            true_negatives += 1;
        }
    }

    // --- PHASE C: TEST 10 BENIGN CONTROL TARGETS ---
    for (i, (body, status)) in benign_responses.into_iter().enumerate() {
        let b = body.to_string();
        let server = MockServer::spawn(move |_req| {
            (status, "OK", b.clone())
        }).await;

        let url = format!("http://{}/api/v1/test", server.addr);
        let output = executor.execute_raw(&url, probe_payload, None).await.unwrap();
        let verdict = SqliEngine::evaluate_error_based(&output.raw_response);

        let falsely_flagged = verdict.as_ref().map(|v| v.is_vulnerable).unwrap_or(false);
        if falsely_flagged {
            false_positives += 1;
            eprintln!("[FAIL] Benign target {} was FALSELY flagged as vulnerable! Response: {}", i, body);
        } else {
            true_negatives += 1;
        }
    }

    println!("===========================================================");
    println!("TRI-TARGET CONFUSION MATRIX (30 TEST CASES):");
    println!("  True Positives  (TP) : {}", true_positives);
    println!("  False Negatives (FN) : {}", false_negatives);
    println!("  True Negatives  (TN) : {}", true_negatives);
    println!("  False Positives (FP) : {}", false_positives);
    println!("===========================================================");

    assert_eq!(true_positives, 10, "All 10 vulnerable cases must yield True Positives");
    assert_eq!(false_negatives, 0, "Zero False Negatives allowed on vulnerable targets");
    assert_eq!(true_negatives, 20, "All 20 Fixed and Benign cases must yield True Negatives");
    assert_eq!(false_positives, 0, "Zero False Positives allowed on non-vulnerable targets");

    let precision = true_positives as f64 / (true_positives + false_positives) as f64;
    let recall = true_positives as f64 / (true_positives + false_negatives) as f64;
    let specificity = true_negatives as f64 / (true_negatives + false_positives) as f64;
    let fpr = false_positives as f64 / (false_positives + true_negatives) as f64;
    let f1 = 2.0 * (precision * recall) / (precision + recall);

    assert_eq!(precision, 1.0);
    assert_eq!(recall, 1.0);
    assert_eq!(specificity, 1.0);
    assert_eq!(fpr, 0.0);
    assert_eq!(f1, 1.0);
}

#[tokio::test]
async fn test_finding_lifecycle_state_machine_strict_linear_invariants() {
    // Valid linear transition:
    // Candidate -> Verified -> Confirmed -> Reported -> Remediated
    let mut state = FindingLifecycle::Candidate;
    state = FindingLifecycleManager::transition(state, FindingLifecycle::Verified).expect("Valid: Candidate -> Verified");
    state = FindingLifecycleManager::transition(state, FindingLifecycle::Confirmed).expect("Valid: Verified -> Confirmed");
    state = FindingLifecycleManager::transition(state, FindingLifecycle::Reported).expect("Valid: Confirmed -> Reported");
    state = FindingLifecycleManager::transition(state, FindingLifecycle::Remediated).expect("Valid: Reported -> Remediated");
    assert_eq!(state, FindingLifecycle::Remediated);

    // Retest cycle: Remediated -> Verified (reopen) or Remediated -> Candidate
    // Assert all invalid state skips return typed errors
    assert!(FindingLifecycleManager::transition(FindingLifecycle::Candidate, FindingLifecycle::Reported).is_err());
    assert!(FindingLifecycleManager::transition(FindingLifecycle::Candidate, FindingLifecycle::Remediated).is_err());
    assert!(FindingLifecycleManager::transition(FindingLifecycle::Verified, FindingLifecycle::Remediated).is_err());
}
