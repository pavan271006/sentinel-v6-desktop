//! Unit tests for HTTP/2 framing and HPACK decoding

use sentinel_common::enums::HttpMethod;
use sentinel_parser::h2::{
    convert_h2_to_parsed_request, convert_h2_to_parsed_response, convert_parsed_request_to_h2,
    encode_hpack_headers, H2Frame, H2FrameHeader, HpackDecoder, FLAG_END_HEADERS, FLAG_END_STREAM,
    FRAME_TYPE_DATA, FRAME_TYPE_HEADERS,
};

#[test]
fn test_h2_frame_header_roundtrip() {
    let header = H2FrameHeader::new(
        FRAME_TYPE_HEADERS,
        FLAG_END_HEADERS | FLAG_END_STREAM,
        3,
        42,
    );
    let bytes = header.serialize();
    let parsed = H2FrameHeader::parse(&bytes).expect("Header parse should succeed");

    assert_eq!(parsed, header);
    assert_eq!(parsed.length, 42);
    assert_eq!(parsed.frame_type, FRAME_TYPE_HEADERS);
    assert!(parsed.has_flag(FLAG_END_HEADERS));
    assert!(parsed.has_flag(FLAG_END_STREAM));
    assert_eq!(parsed.stream_id, 3);
}

#[test]
fn test_h2_frame_serialization() {
    let header = H2FrameHeader::new(FRAME_TYPE_DATA, FLAG_END_STREAM, 1, 5);
    let frame = H2Frame::new(header, b"hello".to_vec());
    let raw = frame.serialize();

    assert_eq!(raw.len(), 9 + 5);
    assert_eq!(&raw[9..], b"hello");
}

#[test]
fn test_hpack_static_table_decoding() {
    let mut decoder = HpackDecoder::new();
    // 0x82 corresponds to index 2 in static table: (:method, "GET")
    let payload = vec![0x82];
    let headers = decoder
        .decode(&payload)
        .expect("HPACK decode should succeed");

    assert_eq!(headers.len(), 1);
    assert_eq!(headers[0].0, b":method");
    assert_eq!(headers[0].1, b"GET");
}

#[test]
fn test_hpack_encode_and_decode_roundtrip() {
    let original_headers = vec![
        (b":method".to_vec(), b"POST".to_vec()),
        (b":path".to_vec(), b"/api/v1/auth".to_vec()),
        (b":scheme".to_vec(), b"https".to_vec()),
        (b"user-agent".to_vec(), b"sentinel/6.0".to_vec()),
        (b"content-type".to_vec(), b"application/json".to_vec()),
    ];

    let encoded = encode_hpack_headers(&original_headers);
    let mut decoder = HpackDecoder::new();
    let decoded = decoder
        .decode(&encoded)
        .expect("HPACK roundtrip decode should succeed");

    assert_eq!(decoded.len(), original_headers.len());
    for (i, (name, val)) in decoded.iter().enumerate() {
        assert_eq!(name, &original_headers[i].0);
        assert_eq!(val, &original_headers[i].1);
    }
}

#[test]
fn test_convert_h2_to_parsed_request_and_response() {
    let h2_req_headers = vec![
        (b":method".to_vec(), b"GET".to_vec()),
        (b":path".to_vec(), b"/secure-zone".to_vec()),
        (b":scheme".to_vec(), b"https".to_vec()),
        (b":authority".to_vec(), b"gateway.internal".to_vec()),
        (b"authorization".to_vec(), b"Bearer jwt_token".to_vec()),
    ];

    let parsed_req = convert_h2_to_parsed_request(h2_req_headers, Vec::new())
        .expect("H2 request conversion should succeed");

    assert_eq!(parsed_req.method, HttpMethod::GET);
    assert_eq!(parsed_req.uri, "/secure-zone");
    assert_eq!(parsed_req.version, "HTTP/2.0");

    let h2_back = convert_parsed_request_to_h2(&parsed_req);
    assert_eq!(h2_back[0].0, b":method");
    assert_eq!(h2_back[0].1, b"GET");
    assert_eq!(h2_back[1].0, b":path");
    assert_eq!(h2_back[1].1, b"/secure-zone");

    let h2_res_headers = vec![
        (b":status".to_vec(), b"200".to_vec()),
        (b"server".to_vec(), b"sentinel-h2".to_vec()),
    ];

    let parsed_res = convert_h2_to_parsed_response(h2_res_headers, b"H2 payload".to_vec())
        .expect("H2 response conversion should succeed");

    assert_eq!(parsed_res.status_code, 200);
    assert_eq!(parsed_res.version, "HTTP/2.0");
    assert_eq!(parsed_res.body, b"H2 payload");
}
