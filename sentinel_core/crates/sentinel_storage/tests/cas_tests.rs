// crates/sentinel_storage/tests/cas_tests.rs

use sentinel_common::SentinelError;
use sentinel_storage::cas::BlobStorage;
use tempfile::tempdir;

#[tokio::test]
async fn test_cas_sha256_known_vectors() {
    let empty_payload = b"";
    let empty_sha256 = BlobStorage::compute_sha256(empty_payload);
    assert_eq!(
        empty_sha256,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    let hello_payload = b"hello world";
    let hello_sha256 = BlobStorage::compute_sha256(hello_payload);
    assert_eq!(
        hello_sha256,
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
}

#[tokio::test]
async fn test_cas_directory_fan_out_structure() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    let payload = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\"}";
    let descriptor = cas.put(payload).await.unwrap();

    let expected_hash = BlobStorage::compute_sha256(payload);
    assert_eq!(descriptor.sha256_hex, expected_hash);

    // Verify directory fan-out: blobs/{sha256[0:2]}/{sha256}.blob
    let expected_prefix = &expected_hash[0..2];
    let expected_blob_path = temp
        .path()
        .join(expected_prefix)
        .join(format!("{}.blob", expected_hash));

    assert!(
        expected_blob_path.exists(),
        "Blob file must exist at partitioned fan-out path: {:?}",
        expected_blob_path
    );

    let stored_bytes = tokio::fs::read(&expected_blob_path).await.unwrap();
    assert_eq!(stored_bytes, payload);
}

#[tokio::test]
async fn test_cas_empty_blob_storage() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    let descriptor = cas.put(b"").await.unwrap();
    assert_eq!(descriptor.size_bytes, 0);
    assert_eq!(
        descriptor.sha256_hex,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    let retrieved = cas.get_verified(&descriptor.sha256_hex).await.unwrap();
    assert!(retrieved.is_empty());
}

#[tokio::test]
async fn test_cas_deduplication() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    let payload = b"REPEATABLE IMMUTABLE AUDIT DATA";
    let desc1 = cas.put(payload).await.unwrap();
    let desc2 = cas.put(payload).await.unwrap();

    assert_eq!(desc1.sha256_hex, desc2.sha256_hex);
    assert_eq!(desc1.size_bytes, desc2.size_bytes);
    assert!(cas.exists(&desc1.sha256_hex).await);
}

#[tokio::test]
async fn test_cas_tampering_detection_sec_07() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    let payload = b"AUTHENTIC VULNERABILITY EVIDENCE PAYLOAD";
    let desc = cas.put(payload).await.unwrap();

    // Verify pristine state
    let valid = cas.verify_integrity(&desc.sha256_hex).await.unwrap();
    assert!(valid);

    // Tamper directly with the underlying blob on disk
    let blob_path = cas.blob_path(&desc.sha256_hex);
    tokio::fs::write(&blob_path, b"TAMPERED EVIDENCE FORGED PAYLOAD")
        .await
        .unwrap();

    // 1. get_verified must return SentinelError::InvariantViolation
    let get_result = cas.get_verified(&desc.sha256_hex).await;
    match get_result {
        Err(SentinelError::InvariantViolation(msg)) => {
            assert!(
                msg.contains("Blob SHA-256 hash mismatch (SEC-07)"),
                "Error message must specify SEC-07 violation: {}",
                msg
            );
        }
        other => panic!(
            "Expected InvariantViolation for tampered blob, got {:?}",
            other
        ),
    }

    // 2. verify_integrity must return SentinelError::InvariantViolation
    let verify_result = cas.verify_integrity(&desc.sha256_hex).await;
    match verify_result {
        Err(SentinelError::InvariantViolation(msg)) => {
            assert!(msg.contains("SEC-07"));
        }
        other => panic!("Expected InvariantViolation, got {:?}", other),
    }
}

#[tokio::test]
async fn test_cas_large_payload_1mb() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    // Generate 1 MB of pseudo-random data
    let mut large_payload = Vec::with_capacity(1024 * 1024);
    for i in 0..(1024 * 1024) {
        large_payload.push((i % 251) as u8);
    }

    let desc = cas.put(&large_payload).await.unwrap();
    assert_eq!(desc.size_bytes, 1024 * 1024);

    let retrieved = cas.get_verified(&desc.sha256_hex).await.unwrap();
    assert_eq!(retrieved.len(), 1024 * 1024);
    assert_eq!(retrieved, large_payload);
}

#[tokio::test]
async fn test_cas_nonexistent_blob_error() {
    let temp = tempdir().unwrap();
    let cas = BlobStorage::new(temp.path()).await.unwrap();

    let fake_hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    assert!(!cas.exists(fake_hash).await);

    let res = cas.get_verified(fake_hash).await;
    assert!(res.is_err());
    match res {
        Err(SentinelError::Storage(_)) => {}
        other => panic!("Expected SentinelError::Storage, got {:?}", other),
    }
}
