//! gRPC HTTP/2 wire framing and message decoding.

use bytes::{BufMut, BytesMut};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GrpcError {
    #[error("Incomplete gRPC frame header (expected 5 bytes, got {0})")]
    IncompleteHeader(usize),
    #[error("Incomplete gRPC frame payload (expected {expected} bytes, got {available})")]
    IncompletePayload { expected: usize, available: usize },
    #[error("Protobuf wire format decoding error: {0}")]
    ProtobufDecode(String),
    #[error("Field not found: {0}")]
    FieldNotFound(String),
}

/// An individual gRPC wire frame (5-byte header + message payload).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GrpcFrame {
    pub compressed: bool,
    pub length: u32,
    pub payload: Vec<u8>,
}

impl GrpcFrame {
    pub fn new(payload: impl Into<Vec<u8>>) -> Self {
        let p = payload.into();
        Self {
            compressed: false,
            length: p.len() as u32,
            payload: p,
        }
    }
}

/// Codec for encoding and decoding gRPC wire frames.
pub struct GrpcFrameCodec;

impl GrpcFrameCodec {
    /// Encodes a payload into a standard 5-byte prefixed gRPC frame.
    pub fn encode_frame(payload: &[u8], compressed: bool) -> Vec<u8> {
        let mut buf = BytesMut::with_capacity(5 + payload.len());
        buf.put_u8(if compressed { 1 } else { 0 });
        buf.put_u32(payload.len() as u32);
        buf.put_slice(payload);
        buf.to_vec()
    }

    /// Decodes one or more consecutive gRPC frames from a byte slice.
    pub fn decode_frames(mut data: &[u8]) -> Result<Vec<GrpcFrame>, GrpcError> {
        let mut frames = Vec::new();

        while !data.is_empty() {
            if data.len() < 5 {
                return Err(GrpcError::IncompleteHeader(data.len()));
            }

            let compressed = data[0] != 0;
            let length = u32::from_be_bytes([data[1], data[2], data[3], data[4]]) as usize;

            if data.len() < 5 + length {
                return Err(GrpcError::IncompletePayload {
                    expected: length,
                    available: data.len() - 5,
                });
            }

            let payload = data[5..5 + length].to_vec();
            frames.push(GrpcFrame {
                compressed,
                length: length as u32,
                payload,
            });

            data = &data[5 + length..];
        }

        Ok(frames)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grpc_frame_roundtrip() {
        let message = b"hello protobuf world";
        let encoded = GrpcFrameCodec::encode_frame(message, false);
        assert_eq!(encoded.len(), 5 + message.len());
        assert_eq!(encoded[0], 0);

        let decoded = GrpcFrameCodec::decode_frames(&encoded).unwrap();
        assert_eq!(decoded.len(), 1);
        assert_eq!(decoded[0].payload, message);
        assert!(!decoded[0].compressed);
        assert_eq!(decoded[0].length, message.len() as u32);
    }
}
