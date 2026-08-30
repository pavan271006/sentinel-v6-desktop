use sentinel_productivity::codecs::*;
use sentinel_productivity::hash::*;
use serde_json::json;

#[test]
fn test_base64_all_variants_and_auto_decode() {
    let payload = b"SENTINEL-V6-SECURITY-CODECS-TEST-PAYLOAD!@#$%^&*()_+";

    // 1. Standard
    let std_encoded = encode_base64(payload, Base64Variant::Standard);
    assert!(std_encoded.contains('+') || std_encoded.contains('/') || std_encoded.ends_with('='));
    let std_decoded = decode_base64(&std_encoded, Base64Variant::Standard).unwrap();
    assert_eq!(std_decoded, payload);

    // 2. Standard Unpadded
    let std_unpadded = encode_base64(payload, Base64Variant::StandardUnpadded);
    assert!(!std_unpadded.ends_with('='));
    let std_unp_decoded = decode_base64(&std_unpadded, Base64Variant::StandardUnpadded).unwrap();
    assert_eq!(std_unp_decoded, payload);

    // 3. URL Safe
    let url_encoded = encode_base64(payload, Base64Variant::UrlSafe);
    assert!(!url_encoded.contains('+') && !url_encoded.contains('/'));
    let url_decoded = decode_base64(&url_encoded, Base64Variant::UrlSafe).unwrap();
    assert_eq!(url_decoded, payload);

    // 4. URL Safe Unpadded
    let url_unpadded = encode_base64(payload, Base64Variant::UrlSafeUnpadded);
    assert!(!url_unpadded.ends_with('='));
    let url_unp_decoded = decode_base64(&url_unpadded, Base64Variant::UrlSafeUnpadded).unwrap();
    assert_eq!(url_unp_decoded, payload);

    // 5. Auto Decode with whitespace & newlines
    let messy_input = format!("\n  {} \r\n\t ", url_unpadded);
    let auto_decoded = auto_decode_base64(&messy_input).unwrap();
    assert_eq!(auto_decoded, payload);
}

#[test]
fn test_url_percent_encoding_and_double_encode() {
    let payload = b"/api/v1/search?query=admin&role=sec user<script>";

    // QueryComponent
    let query_enc = encode_url(payload, UrlEncodeMode::QueryComponent);
    assert!(query_enc.contains("%2F"));
    assert!(query_enc.contains("%3F"));
    assert!(query_enc.contains("%26"));
    let query_dec = decode_url(&query_enc, false).unwrap();
    assert_eq!(query_dec, payload);

    // PathSegment
    let path_enc = encode_url(payload, UrlEncodeMode::PathSegment);
    assert!(path_enc.contains("/api/v1/search"));
    let path_dec = decode_url(&path_enc, false).unwrap();
    assert_eq!(path_dec, payload);

    // FormUrlEncoded
    let form_enc = encode_url(payload, UrlEncodeMode::FormUrlEncoded);
    assert!(form_enc.contains('+'));
    let form_dec = decode_url(&form_enc, true).unwrap();
    assert_eq!(form_dec, payload);

    // AllCharacters
    let all_enc = encode_url(b"ABC", UrlEncodeMode::AllCharacters);
    assert_eq!(all_enc, "%41%42%43");
    let all_dec = decode_url(&all_enc, false).unwrap();
    assert_eq!(all_dec, b"ABC");

    // DoubleEncode
    let double_enc = encode_double_url(b"../../etc/passwd");
    assert!(double_enc.contains("%252F") || double_enc.contains("%252E"));
    let single_dec = decode_url(&double_enc, false).unwrap();
    let final_dec = decode_url(std::str::from_utf8(&single_dec).unwrap(), false).unwrap();
    assert_eq!(final_dec, b"../../etc/passwd");
}

#[test]
fn test_hex_encoding_and_hexdump() {
    let payload = b"Hello, Sentinel V6 Security Workstation!";

    // Lowercase None
    let hex_lower = encode_hex(payload, HexCase::Lower, HexDelimiter::None);
    let dec_lower = decode_hex(&hex_lower).unwrap();
    assert_eq!(dec_lower, payload);

    // Uppercase Colon
    let hex_colon = encode_hex(payload, HexCase::Upper, HexDelimiter::Colon);
    assert!(hex_colon.contains(':'));
    let dec_colon = decode_hex(&hex_colon).unwrap();
    assert_eq!(dec_colon, payload);

    // Prefix 0x
    let hex_prefix = encode_hex(payload, HexCase::Lower, HexDelimiter::Prefix0x);
    assert!(hex_prefix.contains("0x"));
    let dec_prefix = decode_hex(&hex_prefix).unwrap();
    assert_eq!(dec_prefix, payload);

    // Escaped Hex
    let hex_escaped = encode_hex(payload, HexCase::Upper, HexDelimiter::EscapedHex);
    assert!(hex_escaped.contains("\\x"));
    let dec_escaped = decode_hex(&hex_escaped).unwrap();
    assert_eq!(dec_escaped, payload);

    // Hexdump
    let dump = hexdump(payload);
    assert!(dump.contains("00000000"));
    assert!(dump.contains("|Hello, Sentinel |"));
}

#[test]
fn test_html_entity_encoding_and_decoding() {
    let raw = "<script>alert('XSS & \"injection\"');</script>";

    // Named
    let named_enc = encode_html(raw, HtmlEntityMode::Named);
    assert_eq!(
        named_enc,
        "&lt;script&gt;alert(&apos;XSS &amp; &quot;injection&quot;&apos;);&lt;/script&gt;"
    );
    let named_dec = decode_html(&named_enc).unwrap();
    assert_eq!(named_dec, raw);

    // Decimal
    let dec_enc = encode_html(raw, HtmlEntityMode::Decimal);
    assert!(dec_enc.contains("&#60;"));
    let dec_dec = decode_html(&dec_enc).unwrap();
    assert_eq!(dec_dec, raw);

    // Hex
    let hex_enc = encode_html(raw, HtmlEntityMode::Hex);
    assert!(hex_enc.contains("&#x3c;"));
    let hex_dec = decode_html(&hex_enc).unwrap();
    assert_eq!(hex_dec, raw);

    // Complex legacy entities & numeric codes
    let complex = "&copy; 2026 &euro; 100 &#x26; &#38; &amp; &nbsp;";
    let complex_dec = decode_html(complex).unwrap();
    assert!(complex_dec.contains('©'));
    assert!(complex_dec.contains('€'));
    assert!(complex_dec.contains('&'));
}

#[test]
fn test_jwt_engine_lifecycle_and_tampering() {
    let secret = b"super-secret-key-12345";
    let header = JwtHeader {
        alg: JwtAlgorithm::HS256,
        typ: Some("JWT".to_string()),
        kid: Some("key-01".to_string()),
        extra: std::collections::HashMap::new(),
    };
    let payload = json!({
        "sub": "usr_10928",
        "name": "Alice Auditor",
        "role": "user",
        "iss": "sentinel-auth",
        "aud": "sentinel-api",
        "exp": chrono::Utc::now().timestamp() + 3600,
        "nbf": chrono::Utc::now().timestamp() - 60
    });

    // 1. Sign JWT
    let raw_jwt = JwtEngine::sign_or_tamper(&header, &payload, Some(secret), None).unwrap();
    assert_eq!(raw_jwt.split('.').count(), 3);

    // 2. Inspect JWT
    let token = JwtEngine::inspect(&raw_jwt).unwrap();
    assert_eq!(token.header.alg, JwtAlgorithm::HS256);
    assert_eq!(token.payload["role"], "user");

    // 3. Verify Valid
    let options = JwtValidationOptions {
        expected_iss: Some("sentinel-auth".to_string()),
        expected_aud: Some("sentinel-api".to_string()),
        ..Default::default()
    };
    let verdict = JwtEngine::verify(&token, secret, &options).unwrap();
    assert_eq!(verdict, JwtVerifyVerdict::Valid);

    // 4. Verify Invalid Secret
    let wrong_secret = b"wrong-secret-key-99999";
    let bad_verdict = JwtEngine::verify(&token, wrong_secret, &options).unwrap();
    assert_eq!(bad_verdict, JwtVerifyVerdict::SignatureInvalid);

    // 5. Tamper Payload (Privilege Escalation)
    let tampered_payload = json!({
        "sub": "usr_10928",
        "role": "admin",
        "exp": chrono::Utc::now().timestamp() + 3600
    });
    // Tamper with 'none' algorithm
    let none_jwt = JwtEngine::sign_or_tamper(
        &header,
        &tampered_payload,
        None,
        Some(JwtAlgorithm::None),
    )
    .unwrap();
    let none_token = JwtEngine::inspect(&none_jwt).unwrap();
    assert_eq!(none_token.header.alg, JwtAlgorithm::None);

    let none_verdict = JwtEngine::verify(&none_token, b"", &options).unwrap();
    assert_eq!(none_verdict, JwtVerifyVerdict::NoneAlgorithmWarning);
}

#[test]
fn test_gzip_compression_and_bomb_protection() {
    let original = b"SENTINEL-GZIP-COMPRESSION-TEST-DATA-STREAM-1234567890".repeat(50);

    // 1. Compress
    let compressed = compress_gzip(&original).unwrap();
    assert_eq!(compressed[0], 0x1f);
    assert_eq!(compressed[1], 0x8b);

    // 2. Decompress
    let decompressed = decompress_gzip(&compressed).unwrap();
    assert_eq!(decompressed, original);

    // 3. Decompression Bomb Guard
    let bomb_res = decompress_gzip_bounded(&compressed, 100);
    assert!(matches!(bomb_res, Err(CodecError::DecompressionBomb { .. })));
}

#[test]
fn test_hash_engine_all_algorithms_and_hmac() {
    let input = b"Sentinel V6 Cryptographic Verification Test";

    // 1. MD5
    let md5_out = HashEngine::digest(HashAlgorithm::Md5, input);
    assert_eq!(md5_out.hex.len(), 32);

    // 2. SHA-1
    let sha1_out = HashEngine::digest(HashAlgorithm::Sha1, input);
    assert_eq!(sha1_out.hex.len(), 40);

    // 3. SHA-256
    let sha256_out = HashEngine::digest(HashAlgorithm::Sha256, input);
    assert_eq!(sha256_out.hex.len(), 64);

    // 4. SHA-512
    let sha512_out = HashEngine::digest(HashAlgorithm::Sha512, input);
    assert_eq!(sha512_out.hex.len(), 128);

    // 5. Keccak-256 (Test against known Ethereum empty hash: c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470)
    let empty_keccak = HashEngine::keccak256(b"");
    assert_eq!(
        empty_keccak.hex,
        "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    );

    // 6. Digest All
    let all_digests = HashEngine::digest_all(input);
    assert_eq!(all_digests.len(), 6);

    // 7. HMAC & Constant-Time Verification
    let key = b"pentester-secret-key";
    let hmac_sha256 = HashEngine::hmac(HmacAlgorithm::HmacSha256, key, input);
    assert!(HashEngine::verify_hmac(
        HmacAlgorithm::HmacSha256,
        key,
        input,
        &hmac_sha256.raw
    ));
    assert!(!HashEngine::verify_hmac(
        HmacAlgorithm::HmacSha256,
        b"wrong-key",
        input,
        &hmac_sha256.raw
    ));
}
