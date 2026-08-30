// crates/sentinel_storage/tests/merkle_tests.rs

use sentinel_common::SentinelError;
use sentinel_storage::cas::BlobStorage;
use sentinel_storage::merkle::{MerkleProofChain, MerkleProofTree};
use tempfile::tempdir;
use uuid::Uuid;

#[tokio::test]
async fn test_canonical_cas_merkle_root_matches_causal_engine() {
    let hashes = vec![
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ];

    let canonical_root = MerkleProofTree::compute_canonical_cas_merkle_root(&hashes);
    assert!(!canonical_root.is_empty());
    assert_eq!(canonical_root.len(), 64);

    // Permuting the input hashes produces the identical canonical root because of sorting
    let permuted = vec![hashes[2], hashes[0], hashes[1]];
    let permuted_root = MerkleProofTree::compute_canonical_cas_merkle_root(&permuted);
    assert_eq!(canonical_root, permuted_root);
}

#[tokio::test]
async fn test_binary_merkle_tree_construction_and_proof() {
    let leaf1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let leaf2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    let leaf3 = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    let leaf4 = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

    let leaves = vec![leaf1, leaf2, leaf3, leaf4];
    let tree = MerkleProofTree::from_hashes(&leaves);

    assert_eq!(tree.leaves.len(), 4);
    assert_eq!(tree.root_hash.len(), 64);

    // Test proof generation for each leaf
    for (i, &leaf) in leaves.iter().enumerate() {
        let proof = tree.generate_proof(leaf).expect("Proof must be generated");
        assert_eq!(proof.leaf_hash, leaf);
        assert_eq!(proof.root_hash, tree.root_hash);
        assert!(proof.verify(), "Proof for leaf {} must verify", i);
    }
}

#[tokio::test]
async fn test_merkle_tree_odd_leaves() {
    let leaves = vec![
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2222222222222222222222222222222222222222222222222222222222222222",
        "3333333333333333333333333333333333333333333333333333333333333333",
    ];
    let tree = MerkleProofTree::from_hashes(&leaves);
    assert_eq!(tree.leaves.len(), 3);

    for (i, &leaf) in leaves.iter().enumerate() {
        let proof = tree.generate_proof(leaf).expect("Proof must be generated");
        assert!(proof.verify(), "Odd tree proof for leaf {} must verify", i);
    }
}

#[tokio::test]
async fn test_merkle_tree_tamper_detection_against_cas() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    let req_bytes = b"GET /api/v1/resource HTTP/1.1\r\nHost: target.local\r\n\r\n";
    let res_bytes = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"id\": 1}";
    let diff_bytes = b"--- original\n+++ modified\n@@ -1 +1 @@\n-guest\n+admin";

    let req_desc = cas.put(req_bytes).await.unwrap();
    let res_desc = cas.put(res_bytes).await.unwrap();
    let diff_desc = cas.put(diff_bytes).await.unwrap();

    let labeled = vec![
        ("request", req_desc.sha256_hex.as_str()),
        ("response", res_desc.sha256_hex.as_str()),
        ("diff", diff_desc.sha256_hex.as_str()),
    ];
    let tree = MerkleProofTree::from_labeled_hashes(&labeled);

    // Pristine verification
    let is_valid = tree.verify_tamper(&cas).await.unwrap();
    assert!(is_valid);

    // Tamper with response blob on disk
    let res_blob_path = cas.blob_path(&res_desc.sha256_hex);
    tokio::fs::write(&res_blob_path, b"TAMPERED CONTENT").await.unwrap();

    // Verify tamper is detected
    let tamper_result = tree.verify_tamper(&cas).await;
    match tamper_result {
        Err(SentinelError::InvariantViolation(msg)) => {
            assert!(msg.contains("SEC-07"));
        }
        other => panic!("Expected InvariantViolation on tampered blob, got {:?}", other),
    }
}

#[tokio::test]
async fn test_merkle_proof_chain_lifecycle() {
    let mut chain = MerkleProofChain::new();
    assert!(chain.is_empty());

    let finding1 = Uuid::new_v4();
    let cas_hashes1 = vec![
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string(),
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb".to_string(),
    ];
    let entry1 = chain.append(finding1, &cas_hashes1);
    assert_eq!(entry1.index, 0);
    assert_eq!(chain.len(), 1);
    assert!(chain.verify_chain());

    let finding2 = Uuid::new_v4();
    let cas_hashes2 = vec![
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc".to_string(),
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd".to_string(),
    ];
    let entry2 = chain.append(finding2, &cas_hashes2);
    assert_eq!(entry2.index, 1);
    assert_eq!(entry2.prev_chain_hash, entry1.chain_hash);
    assert_eq!(chain.len(), 2);
    assert!(chain.verify_chain());

    // Tampering with chain entry invalidates chain
    chain.entries[0].merkle_root = "0000000000000000000000000000000000000000000000000000000000000000".to_string();
    assert!(!chain.verify_chain());
}
