use sentinel_parser::h3::*;

#[test]
fn test_quic_varint_1_2_4_8_bytes() {
    // 1-byte (0..63)
    let mut buf1 = Vec::new();
    let n1 = QuicVarint::encode(25, &mut buf1).unwrap();
    assert_eq!(n1, 1);
    assert_eq!(buf1.len(), 1);
    let (val1, consumed1) = QuicVarint::decode(&buf1).unwrap();
    assert_eq!(val1, 25);
    assert_eq!(consumed1, 1);

    // 2-byte (64..16383)
    let mut buf2 = Vec::new();
    let n2 = QuicVarint::encode(15293, &mut buf2).unwrap();
    assert_eq!(n2, 2);
    assert_eq!(buf2.len(), 2);
    let (val2, consumed2) = QuicVarint::decode(&buf2).unwrap();
    assert_eq!(val2, 15293);
    assert_eq!(consumed2, 2);

    // 4-byte (16384..1073741823)
    let mut buf4 = Vec::new();
    let n4 = QuicVarint::encode(494878333, &mut buf4).unwrap();
    assert_eq!(n4, 4);
    assert_eq!(buf4.len(), 4);
    let (val4, consumed4) = QuicVarint::decode(&buf4).unwrap();
    assert_eq!(val4, 494878333);
    assert_eq!(consumed4, 4);

    // 8-byte (1073741824..4611686018427387903)
    let mut buf8 = Vec::new();
    let n8 = QuicVarint::encode(151288809941914, &mut buf8).unwrap();
    assert_eq!(n8, 8);
    assert_eq!(buf8.len(), 8);
    let (val8, consumed8) = QuicVarint::decode(&buf8).unwrap();
    assert_eq!(val8, 151288809941914);
    assert_eq!(consumed8, 8);
}

#[test]
fn test_h3_frame_types_and_wire_codec() {
    let payload = b"HTTP/3 Live Data Payload Stream";

    // 1. DATA Frame (0x00)
    let data_frame = H3Frame::new(H3FrameType::Data, payload.to_vec());
    let encoded_data = data_frame.encode();
    assert_eq!(encoded_data[0], 0x00); // Frame Type 0
    let (decoded_data, consumed) = H3Frame::decode(&encoded_data).unwrap();
    assert_eq!(consumed, encoded_data.len());
    assert_eq!(decoded_data.frame_type, H3FrameType::Data);
    assert_eq!(decoded_data.payload, payload);

    // 2. HEADERS Frame (0x01)
    let headers_payload = b"QPACK_COMPRESSED_BLOCK_12345";
    let headers_frame = H3Frame::new(H3FrameType::Headers, headers_payload.to_vec());
    let encoded_headers = headers_frame.encode();
    assert_eq!(encoded_headers[0], 0x01); // Frame Type 1
    let (decoded_headers, _) = H3Frame::decode(&encoded_headers).unwrap();
    assert_eq!(decoded_headers.frame_type, H3FrameType::Headers);
    assert_eq!(decoded_headers.payload, headers_payload);

    // 3. SETTINGS Frame (0x04)
    let settings_frame = H3Frame::new(H3FrameType::Settings, vec![0x06, 0x80, 0x00]);
    let encoded_settings = settings_frame.encode();
    let (decoded_settings, _) = H3Frame::decode(&encoded_settings).unwrap();
    assert_eq!(decoded_settings.frame_type, H3FrameType::Settings);
}

#[test]
fn test_qpack_header_block_encode_and_decode() {
    let headers = vec![
        (":method".to_string(), "GET".to_string()),
        (":scheme".to_string(), "https".to_string()),
        (":path".to_string(), "/api/v1/auth".to_string()),
        (":authority".to_string(), "api.sentinel.internal".to_string()),
        ("x-custom-security-token".to_string(), "sec_token_9999".to_string()),
    ];

    let encoded_block = QpackDecoder::encode_header_block(&headers);
    assert!(encoded_block.len() > 5);

    let decoded_headers = QpackDecoder::decode_header_block(&encoded_block).unwrap();
    assert!(decoded_headers.iter().any(|(k, v)| k == ":method" && v == "GET"));
    assert!(decoded_headers.iter().any(|(k, v)| k == ":scheme" && v == "https"));
    assert!(decoded_headers.iter().any(|(k, v)| k == ":path" && v == "/api/v1/auth"));
    assert!(decoded_headers.iter().any(|(k, v)| k == ":authority" && v == "api.sentinel.internal"));
    assert!(decoded_headers.iter().any(|(k, v)| k == "x-custom-security-token" && v == "sec_token_9999"));
}
