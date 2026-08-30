//! Unit tests for Chunked Transfer Encoding decoder and encoder

use sentinel_parser::chunked::ChunkedDecoder;
use sentinel_parser::SentinelHttpParser;

#[test]
fn test_decode_standard_chunked_stream() {
    let raw = b"4\r\nWiki\r\n6\r\npedia \r\nE\r\nin \r\n\r\nchunks.\r\n0\r\n\r\n";
    let res = ChunkedDecoder::decode(raw, 1024 * 1024).expect("Decoding should succeed");

    assert_eq!(res.body, b"Wikipedia in \r\n\r\nchunks.");
    assert_eq!(res.bytes_consumed, raw.len());
}

#[test]
fn test_decode_chunk_with_extensions() {
    let raw = b"5;ext=foo\r\nhello\r\n0;final=true\r\n\r\n";
    let res =
        ChunkedDecoder::decode(raw, 1024).expect("Chunk extensions should be ignored in payload");

    assert_eq!(res.body, b"hello");
    assert_eq!(res.extensions.len(), 2);
}

#[test]
fn test_decode_chunked_with_trailers() {
    let raw =
        b"4\r\ntest\r\n0\r\nExpires: Wed, 21 Oct 2026 07:28:00 GMT\r\nChecksum: abcd1234\r\n\r\n";
    let res = ChunkedDecoder::decode(raw, 1024).expect("Trailers should decode");

    assert_eq!(res.body, b"test");
    assert_eq!(res.trailers.len(), 2);
    assert_eq!(res.trailers[0].name, b"Expires");
    assert_eq!(res.trailers[1].name, b"Checksum");
    assert_eq!(res.trailers[1].value, b"abcd1234");
}

#[test]
fn test_encode_and_decode_roundtrip() {
    let original = b"The quick brown fox jumps over the lazy dog. 1234567890!@#$%^&*()";
    let encoded = ChunkedDecoder::encode(original, 8);
    let decoded = ChunkedDecoder::decode(&encoded, 1024).expect("Roundtrip decode should succeed");

    assert_eq!(decoded.body, original);
}

#[test]
fn test_chunked_request_full_parse() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST /chunked-endpoint HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n";

    let req = parser
        .parse_request_rich(raw)
        .expect("Chunked request should parse");
    assert!(req.is_chunked);
    assert_eq!(req.body, b"hello world");
}
