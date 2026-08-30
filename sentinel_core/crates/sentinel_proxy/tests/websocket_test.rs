//! Unit and Integration tests for WebSocket framing and tapping

use sentinel_proxy::websocket::{
    read_ws_frame, write_ws_frame, WsFrame, WS_OPCODE_CLOSE, WS_OPCODE_TEXT,
};
use std::io::Cursor;

#[tokio::test]
async fn test_ws_frame_write_and_read_roundtrip() {
    let original_payload = b"Hello from Sentinel WebSocket!".to_vec();
    let frame = WsFrame {
        opcode: WS_OPCODE_TEXT,
        payload: original_payload.clone(),
        is_final: true,
        from_client: true,
    };

    let mut buffer = Vec::new();
    write_ws_frame(&mut buffer, &frame, true)
        .await
        .expect("Writing masked frame should succeed");

    let mut cursor = Cursor::new(buffer);
    let decoded_opt = read_ws_frame(&mut cursor, true)
        .await
        .expect("Reading frame should succeed");

    assert!(decoded_opt.is_some());
    let decoded = decoded_opt.unwrap();
    assert_eq!(decoded.opcode, WS_OPCODE_TEXT);
    assert_eq!(decoded.payload, original_payload);
    assert!(decoded.is_final);
}

#[tokio::test]
async fn test_ws_close_frame_handling() {
    let frame = WsFrame {
        opcode: WS_OPCODE_CLOSE,
        payload: vec![0x03, 0xE8], // 1000 Normal Closure
        is_final: true,
        from_client: false,
    };

    let mut buffer = Vec::new();
    write_ws_frame(&mut buffer, &frame, false)
        .await
        .expect("Writing unmasked frame should succeed");

    let mut cursor = Cursor::new(buffer);
    let decoded = read_ws_frame(&mut cursor, false).await.unwrap().unwrap();

    assert_eq!(decoded.opcode, WS_OPCODE_CLOSE);
    assert_eq!(decoded.payload, vec![0x03, 0xE8]);
}
