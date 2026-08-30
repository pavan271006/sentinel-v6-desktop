//! WebSocket Frame Decoder, Encoder & CSWSH Testing Engine (RFC 6455)
//!
//! Handles WebSocket frame manipulation and Cross-Site WebSocket Hijacking (CSWSH) testing:
//! - RFC 6455 Frame Parser & Encoder (Text, Binary, Ping/Pong, Close, Masking)
//! - Cross-Site WebSocket Hijacking (CSWSH) probe generator:
//!   - Evaluates WebSocket handshake acceptance with arbitrary / null / spoofed Origin headers

use sentinel_common::errors::SentinelError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WsOpcode {
    Continuation,
    Text,
    Binary,
    Close,
    Ping,
    Pong,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WsFrame {
    pub fin: bool,
    pub opcode: WsOpcode,
    pub payload: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CswshProbe {
    pub origin_tested: String,
    pub headers: Vec<(String, String)>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CswshFinding {
    pub is_vulnerable: bool,
    pub accepted_origin: String,
    pub confidence: f32,
    pub description: String,
}

pub struct WebSocketParser;

impl WebSocketParser {
    pub fn parse_frame(data: &[u8]) -> Result<WsFrame, SentinelError> {
        if data.len() < 2 {
            return Err(SentinelError::parse_error("WebSocket frame too short".to_string()));
        }

        let first = data[0];
        let fin = (first & 0x80) != 0;
        let opcode = match first & 0x0F {
            0x0 => WsOpcode::Continuation,
            0x1 => WsOpcode::Text,
            0x2 => WsOpcode::Binary,
            0x8 => WsOpcode::Close,
            0x9 => WsOpcode::Ping,
            0xA => WsOpcode::Pong,
            other => return Err(SentinelError::parse_error(format!("Unknown WS opcode: {}", other))),
        };

        let second = data[1];
        let masked = (second & 0x80) != 0;
        let mut payload_len = (second & 0x7F) as usize;
        let mut offset = 2;

        if payload_len == 126 {
            if data.len() < offset + 2 {
                return Err(SentinelError::parse_error("Incomplete 16-bit WS frame".to_string()));
            }
            payload_len = u16::from_be_bytes([data[offset], data[offset + 1]]) as usize;
            offset += 2;
        } else if payload_len == 127 {
            if data.len() < offset + 8 {
                return Err(SentinelError::parse_error("Incomplete 64-bit WS frame".to_string()));
            }
            payload_len = u64::from_be_bytes(data[offset..offset + 8].try_into().unwrap()) as usize;
            offset += 8;
        }

        let mut mask = [0u8; 4];
        if masked {
            if data.len() < offset + 4 {
                return Err(SentinelError::parse_error("Incomplete WS mask key".to_string()));
            }
            mask.copy_from_slice(&data[offset..offset + 4]);
            offset += 4;
        }

        if data.len() < offset + payload_len {
            return Err(SentinelError::parse_error("Incomplete WS payload body".to_string()));
        }

        let mut payload = data[offset..offset + payload_len].to_vec();
        if masked {
            for (i, byte) in payload.iter_mut().enumerate() {
                *byte ^= mask[i % 4];
            }
        }

        Ok(WsFrame {
            fin,
            opcode,
            payload,
        })
    }

    /// Encodes a text/binary payload into an RFC 6455 client masked frame
    pub fn encode_frame(opcode: WsOpcode, payload: &[u8], mask_key: Option<[u8; 4]>) -> Vec<u8> {
        let mut frame = Vec::new();
        let op_byte = match opcode {
            WsOpcode::Continuation => 0x00,
            WsOpcode::Text => 0x01,
            WsOpcode::Binary => 0x02,
            WsOpcode::Close => 0x08,
            WsOpcode::Ping => 0x09,
            WsOpcode::Pong => 0x0A,
        };
        frame.push(0x80 | op_byte); // FIN = 1

        let len = payload.len();
        let mask_bit = if mask_key.is_some() { 0x80 } else { 0x00 };

        if len < 126 {
            frame.push(mask_bit | (len as u8));
        } else if len <= 65535 {
            frame.push(mask_bit | 126);
            frame.extend_from_slice(&(len as u16).to_be_bytes());
        } else {
            frame.push(mask_bit | 127);
            frame.extend_from_slice(&(len as u64).to_be_bytes());
        }

        if let Some(mask) = mask_key {
            frame.extend_from_slice(&mask);
            let mut masked_payload = payload.to_vec();
            for (i, byte) in masked_payload.iter_mut().enumerate() {
                *byte ^= mask[i % 4];
            }
            frame.extend_from_slice(&masked_payload);
        } else {
            frame.extend_from_slice(payload);
        }

        frame
    }

    /// Generates Cross-Site WebSocket Hijacking (CSWSH) origin probes
    pub fn generate_cswsh_probes(ws_endpoint: &str, session_cookie: &str) -> Vec<CswshProbe> {
        vec![
            CswshProbe {
                origin_tested: "https://attacker.evil.com".to_string(),
                headers: vec![
                    ("Upgrade".to_string(), "websocket".to_string()),
                    ("Connection".to_string(), "Upgrade".to_string()),
                    ("Origin".to_string(), "https://attacker.evil.com".to_string()),
                    ("Cookie".to_string(), session_cookie.to_string()),
                ],
                description: format!("CSWSH Arbitrary Origin Probe against {}", ws_endpoint),
            },
            CswshProbe {
                origin_tested: "null".to_string(),
                headers: vec![
                    ("Upgrade".to_string(), "websocket".to_string()),
                    ("Connection".to_string(), "Upgrade".to_string()),
                    ("Origin".to_string(), "null".to_string()),
                    ("Cookie".to_string(), session_cookie.to_string()),
                ],
                description: format!("CSWSH Null Origin Probe against {}", ws_endpoint),
            },
        ]
    }

    /// Evaluates if WebSocket handshake response accepted the cross-origin upgrade
    pub fn evaluate_cswsh_response(status: u16, origin_tested: &str) -> Option<CswshFinding> {
        // Status 101 Switching Protocols indicates handshake accepted without Origin validation
        if status == 101 {
            return Some(CswshFinding {
                is_vulnerable: true,
                accepted_origin: origin_tested.to_string(),
                confidence: 0.98,
                description: format!(
                    "Cross-Site WebSocket Hijacking (CSWSH) Confirmed: Handshake accepted (HTTP 101) with unauthenticated origin '{}'.",
                    origin_tested
                ),
            });
        }
        None
    }
}
