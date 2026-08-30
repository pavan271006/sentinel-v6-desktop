//! RFC 6455 WebSocket framing, masking, and message codecs.

use bytes::{BufMut, BytesMut};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum WsError {
    #[error("Incomplete WebSocket frame header")]
    IncompleteHeader,
    #[error("Incomplete WebSocket payload (expected {expected}, got {available})")]
    IncompletePayload { expected: usize, available: usize },
    #[error("Invalid opcode: {0}")]
    InvalidOpcode(u8),
    #[error("Invalid frame length")]
    InvalidFrameLength,
}

/// RFC 6455 WebSocket Opcode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Opcode {
    Continuation = 0x0,
    Text = 0x1,
    Binary = 0x2,
    Close = 0x8,
    Ping = 0x9,
    Pong = 0xA,
}

impl Opcode {
    pub fn from_u8(val: u8) -> Result<Self, WsError> {
        match val {
            0x0 => Ok(Self::Continuation),
            0x1 => Ok(Self::Text),
            0x2 => Ok(Self::Binary),
            0x8 => Ok(Self::Close),
            0x9 => Ok(Self::Ping),
            0xA => Ok(Self::Pong),
            _ => Err(WsError::InvalidOpcode(val)),
        }
    }

    pub fn is_control(&self) -> bool {
        matches!(self, Self::Close | Self::Ping | Self::Pong)
    }
}

/// An individual decoded or pending RFC 6455 WebSocket frame.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WsFrame {
    pub fin: bool,
    pub rsv: u8,
    pub opcode: Opcode,
    pub masked: bool,
    pub mask_key: Option<[u8; 4]>,
    pub payload: Vec<u8>,
}

impl WsFrame {
    /// Creates a text frame.
    pub fn text(text: impl Into<String>) -> Self {
        let bytes = text.into().into_bytes();
        Self {
            fin: true,
            rsv: 0,
            opcode: Opcode::Text,
            masked: false,
            mask_key: None,
            payload: bytes,
        }
    }

    /// Creates a binary frame.
    pub fn binary(payload: impl Into<Vec<u8>>) -> Self {
        Self {
            fin: true,
            rsv: 0,
            opcode: Opcode::Binary,
            masked: false,
            mask_key: None,
            payload: payload.into(),
        }
    }
}

/// RFC 6455 Frame Codec.
pub struct WsFrameCodec;

impl WsFrameCodec {
    /// Encodes a WsFrame into raw RFC 6455 wire bytes.
    pub fn encode_frame(frame: &WsFrame) -> Vec<u8> {
        let mut buf = BytesMut::new();

        // Byte 1: FIN + RSV + Opcode
        let b1 = (if frame.fin { 0x80 } else { 0x00 })
            | ((frame.rsv & 0x07) << 4)
            | (frame.opcode as u8 & 0x0F);
        buf.put_u8(b1);

        let mask_bit = if frame.masked { 0x80 } else { 0x00 };
        let len = frame.payload.len();

        if len <= 125 {
            buf.put_u8(mask_bit | (len as u8));
        } else if len <= 65535 {
            buf.put_u8(mask_bit | 126);
            buf.put_u16(len as u16);
        } else {
            buf.put_u8(mask_bit | 127);
            buf.put_u64(len as u64);
        }

        if let Some(mask) = frame.mask_key {
            buf.put_slice(&mask);
            // Apply XOR mask to payload
            for (i, byte) in frame.payload.iter().enumerate() {
                buf.put_u8(byte ^ mask[i % 4]);
            }
        } else {
            buf.put_slice(&frame.payload);
        }

        buf.to_vec()
    }

    /// Decodes consecutive RFC 6455 frames from a byte slice.
    pub fn decode_frames(mut data: &[u8]) -> Result<Vec<WsFrame>, WsError> {
        let mut frames = Vec::new();

        while !data.is_empty() {
            if data.len() < 2 {
                return Err(WsError::IncompleteHeader);
            }

            let b1 = data[0];
            let b2 = data[1];

            let fin = (b1 & 0x80) != 0;
            let rsv = (b1 >> 4) & 0x07;
            let opcode = Opcode::from_u8(b1 & 0x0F)?;

            let masked = (b2 & 0x80) != 0;
            let len_code = b2 & 0x7F;

            let mut header_size = 2;
            let payload_len: usize = if len_code <= 125 {
                len_code as usize
            } else if len_code == 126 {
                if data.len() < 4 {
                    return Err(WsError::IncompleteHeader);
                }
                header_size += 2;
                u16::from_be_bytes([data[2], data[3]]) as usize
            } else {
                if data.len() < 10 {
                    return Err(WsError::IncompleteHeader);
                }
                header_size += 8;
                u64::from_be_bytes([
                    data[2], data[3], data[4], data[5], data[6], data[7], data[8], data[9],
                ]) as usize
            };

            let mask_key = if masked {
                if data.len() < header_size + 4 {
                    return Err(WsError::IncompleteHeader);
                }
                let mask = [
                    data[header_size],
                    data[header_size + 1],
                    data[header_size + 2],
                    data[header_size + 3],
                ];
                header_size += 4;
                Some(mask)
            } else {
                None
            };

            if data.len() < header_size + payload_len {
                return Err(WsError::IncompletePayload {
                    expected: payload_len,
                    available: data.len() - header_size,
                });
            }

            let raw_payload = &data[header_size..header_size + payload_len];
            let payload = if let Some(mask) = mask_key {
                raw_payload
                    .iter()
                    .enumerate()
                    .map(|(i, &b)| b ^ mask[i % 4])
                    .collect()
            } else {
                raw_payload.to_vec()
            };

            frames.push(WsFrame {
                fin,
                rsv,
                opcode,
                masked,
                mask_key,
                payload,
            });

            data = &data[header_size + payload_len..];
        }

        Ok(frames)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_frame_roundtrip_unmasked() {
        let frame = WsFrame::text(r#"{"action":"ping"}"#);
        let encoded = WsFrameCodec::encode_frame(&frame);
        let decoded = WsFrameCodec::decode_frames(&encoded).unwrap();

        assert_eq!(decoded.len(), 1);
        assert_eq!(decoded[0].opcode, Opcode::Text);
        assert_eq!(
            std::str::from_utf8(&decoded[0].payload).unwrap(),
            r#"{"action":"ping"}"#
        );
    }

    #[test]
    fn test_ws_frame_roundtrip_masked() {
        let mut frame = WsFrame::text("hello masked websocket");
        frame.masked = true;
        frame.mask_key = Some([0x12, 0x34, 0x56, 0x78]);

        let encoded = WsFrameCodec::encode_frame(&frame);
        let decoded = WsFrameCodec::decode_frames(&encoded).unwrap();

        assert_eq!(decoded.len(), 1);
        assert_eq!(
            std::str::from_utf8(&decoded[0].payload).unwrap(),
            "hello masked websocket"
        );
    }
}
