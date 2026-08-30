//! gRPC Protobuf Framing, Dynamic Message Transcoding & Server Reflection Engine.
//!
//! Handles:
//! - 5-byte gRPC framing header (1-byte compression flag + 4-byte big-endian message length)
//! - Protobuf wire format encoding and decoding (Varint, 64-bit, Length-delimited, 32-bit)
//! - Dynamic message transcoding between JSON and Protobuf binary
//! - gRPC Server Reflection Protocol v1/v1alpha probing & service discovery
//! - Protocol wire security fuzzing (Varint 64-bit overflow, unknown tags, recursion depth)

use sentinel_common::errors::SentinelError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrpcMessageFrame {
    pub is_compressed: bool,
    pub message_length: u32,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrpcServiceInfo {
    pub service_name: String,
    pub methods: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProtobufWireType {
    Varint = 0,
    Fixed64 = 1,
    LengthDelimited = 2,
    Fixed32 = 5,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ProtobufValue {
    Varint(u64),
    Fixed64(u64),
    LengthDelimited(Vec<u8>),
    Fixed32(u32),
    Message(HashMap<u32, Vec<ProtobufValue>>),
}

#[derive(Debug, Clone, Default)]
pub struct DynamicMessage {
    pub fields: HashMap<u32, Vec<ProtobufValue>>,
}

impl DynamicMessage {
    pub fn new() -> Self {
        Self {
            fields: HashMap::new(),
        }
    }

    pub fn insert(&mut self, field_number: u32, val: ProtobufValue) {
        self.fields.entry(field_number).or_default().push(val);
    }

    /// Encodes dynamic message into raw Protobuf wire bytes.
    pub fn encode_to_vec(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        for (&field_num, values) in &self.fields {
            for val in values {
                match val {
                    ProtobufValue::Varint(v) => {
                        let tag = (field_num << 3) | (ProtobufWireType::Varint as u32);
                        encode_varint(tag as u64, &mut buf);
                        encode_varint(*v, &mut buf);
                    }
                    ProtobufValue::Fixed64(v) => {
                        let tag = (field_num << 3) | (ProtobufWireType::Fixed64 as u32);
                        encode_varint(tag as u64, &mut buf);
                        buf.extend_from_slice(&v.to_le_bytes());
                    }
                    ProtobufValue::LengthDelimited(bytes) => {
                        let tag = (field_num << 3) | (ProtobufWireType::LengthDelimited as u32);
                        encode_varint(tag as u64, &mut buf);
                        encode_varint(bytes.len() as u64, &mut buf);
                        buf.extend_from_slice(bytes);
                    }
                    ProtobufValue::Fixed32(v) => {
                        let tag = (field_num << 3) | (ProtobufWireType::Fixed32 as u32);
                        encode_varint(tag as u64, &mut buf);
                        buf.extend_from_slice(&v.to_le_bytes());
                    }
                    ProtobufValue::Message(sub_map) => {
                        let sub_msg = DynamicMessage {
                            fields: sub_map.clone(),
                        };
                        let sub_bytes = sub_msg.encode_to_vec();
                        let tag = (field_num << 3) | (ProtobufWireType::LengthDelimited as u32);
                        encode_varint(tag as u64, &mut buf);
                        encode_varint(sub_bytes.len() as u64, &mut buf);
                        buf.extend_from_slice(&sub_bytes);
                    }
                }
            }
        }
        buf
    }

    /// Decodes raw Protobuf wire bytes into dynamic message fields.
    pub fn decode_from_slice(bytes: &[u8]) -> Result<Self, SentinelError> {
        let mut msg = Self::new();
        let mut offset = 0;

        while offset < bytes.len() {
            let (tag, tag_len) = decode_varint(&bytes[offset..])?;
            offset += tag_len;

            let field_num = (tag >> 3) as u32;
            let wire_type = (tag & 0x07) as u8;

            match wire_type {
                0 => {
                    // Varint
                    let (val, val_len) = decode_varint(&bytes[offset..])?;
                    offset += val_len;
                    msg.insert(field_num, ProtobufValue::Varint(val));
                }
                1 => {
                    // Fixed64
                    if offset + 8 > bytes.len() {
                        return Err(SentinelError::parse_error("Truncated fixed64 in protobuf stream".to_string()));
                    }
                    let val = u64::from_le_bytes([
                        bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3],
                        bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7],
                    ]);
                    offset += 8;
                    msg.insert(field_num, ProtobufValue::Fixed64(val));
                }
                2 => {
                    // Length-delimited
                    let (len, len_len) = decode_varint(&bytes[offset..])?;
                    offset += len_len;
                    let payload_len = len as usize;
                    if offset + payload_len > bytes.len() {
                        return Err(SentinelError::parse_error("Truncated length-delimited payload in protobuf stream".to_string()));
                    }
                    let payload = bytes[offset..offset + payload_len].to_vec();
                    offset += payload_len;

                    // Try recursive sub-message parse
                    if let Ok(sub_msg) = DynamicMessage::decode_from_slice(&payload) {
                        if !sub_msg.fields.is_empty() {
                            msg.insert(field_num, ProtobufValue::Message(sub_msg.fields));
                            continue;
                        }
                    }
                    msg.insert(field_num, ProtobufValue::LengthDelimited(payload));
                }
                5 => {
                    // Fixed32
                    if offset + 4 > bytes.len() {
                        return Err(SentinelError::parse_error("Truncated fixed32 in protobuf stream".to_string()));
                    }
                    let val = u32::from_le_bytes([
                        bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3],
                    ]);
                    offset += 4;
                    msg.insert(field_num, ProtobufValue::Fixed32(val));
                }
                other => {
                    return Err(SentinelError::parse_error(format!(
                        "Unsupported protobuf wire type {} for field {}",
                        other, field_num
                    )));
                }
            }
        }

        Ok(msg)
    }

    /// Transcodes JSON representation into Dynamic Protobuf message.
    pub fn transcode_from_json(&mut self, json_val: &serde_json::Value) -> Result<(), SentinelError> {
        if let Some(obj) = json_val.as_object() {
            for (key, val) in obj {
                let field_num = key.parse::<u32>().unwrap_or_else(|_| {
                    // Hash key string into a stable tag number 1..=1000
                    let hash: u32 = key.bytes().map(|b| b as u32).sum();
                    (hash % 1000) + 1
                });

                match val {
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            self.insert(field_num, ProtobufValue::Varint(i as u64));
                        } else if let Some(f) = n.as_f64() {
                            self.insert(field_num, ProtobufValue::Fixed64(f.to_bits()));
                        }
                    }
                    serde_json::Value::String(s) => {
                        self.insert(field_num, ProtobufValue::LengthDelimited(s.as_bytes().to_vec()));
                    }
                    serde_json::Value::Bool(b) => {
                        self.insert(field_num, ProtobufValue::Varint(if *b { 1 } else { 0 }));
                    }
                    serde_json::Value::Object(_) => {
                        let mut sub_msg = DynamicMessage::new();
                        sub_msg.transcode_from_json(val)?;
                        self.insert(field_num, ProtobufValue::Message(sub_msg.fields));
                    }
                    serde_json::Value::Array(arr) => {
                        for item in arr {
                            if let Some(s) = item.as_str() {
                                self.insert(field_num, ProtobufValue::LengthDelimited(s.as_bytes().to_vec()));
                            } else if let Some(i) = item.as_i64() {
                                self.insert(field_num, ProtobufValue::Varint(i as u64));
                            }
                        }
                    }
                    serde_json::Value::Null => {}
                }
            }
        }
        Ok(())
    }

    /// Transcodes Dynamic Protobuf message into JSON representation.
    pub fn transcode_to_json(&self) -> serde_json::Value {
        let mut map = serde_json::Map::new();
        for (&field_num, values) in &self.fields {
            if values.len() == 1 {
                map.insert(field_num.to_string(), protobuf_val_to_json(&values[0]));
            } else {
                let arr = values.iter().map(protobuf_val_to_json).collect();
                map.insert(field_num.to_string(), serde_json::Value::Array(arr));
            }
        }
        serde_json::Value::Object(map)
    }
}

fn protobuf_val_to_json(val: &ProtobufValue) -> serde_json::Value {
    match val {
        ProtobufValue::Varint(v) => serde_json::json!(*v),
        ProtobufValue::Fixed64(v) => serde_json::json!(*v),
        ProtobufValue::LengthDelimited(b) => {
            if let Ok(s) = std::str::from_utf8(b) {
                serde_json::Value::String(s.to_string())
            } else {
                serde_json::Value::String(hex::encode(b))
            }
        }
        ProtobufValue::Fixed32(v) => serde_json::json!(*v),
        ProtobufValue::Message(m) => {
            let sub = DynamicMessage { fields: m.clone() };
            sub.transcode_to_json()
        }
    }
}

pub fn encode_varint(mut val: u64, buf: &mut Vec<u8>) {
    while val >= 0x80 {
        buf.push(((val as u8) & 0x7F) | 0x80);
        val >>= 7;
    }
    buf.push(val as u8);
}

pub fn decode_varint(bytes: &[u8]) -> Result<(u64, usize), SentinelError> {
    let mut result = 0u64;
    let mut shift = 0;
    let mut idx = 0;

    while idx < bytes.len() {
        let b = bytes[idx];
        result |= ((b & 0x7F) as u64) << shift;
        idx += 1;
        if (b & 0x80) == 0 {
            return Ok((result, idx));
        }
        shift += 7;
        if shift >= 64 {
            return Err(SentinelError::parse_error(
                "Varint exceeds 64-bit integer capacity".to_string(),
            ));
        }
    }

    Err(SentinelError::parse_error(
        "Truncated varint in byte stream".to_string(),
    ))
}

pub struct GrpcEngine;

impl GrpcEngine {
    /// Encodes a protobuf binary payload into a 5-byte length-prefixed gRPC wire frame
    pub fn encode_frame(data: &[u8], compressed: bool) -> Vec<u8> {
        let mut frame = Vec::with_capacity(5 + data.len());
        frame.push(if compressed { 1 } else { 0 });
        let len = data.len() as u32;
        frame.extend_from_slice(&len.to_be_bytes());
        frame.extend_from_slice(data);
        frame
    }

    /// Decodes a 5-byte length-prefixed gRPC wire frame
    pub fn decode_frame(wire_bytes: &[u8]) -> Result<GrpcMessageFrame, SentinelError> {
        if wire_bytes.len() < 5 {
            return Err(SentinelError::parse_error(
                "gRPC frame too short (must be at least 5 bytes)".to_string(),
            ));
        }

        let is_compressed = wire_bytes[0] == 1;
        let message_length = u32::from_be_bytes([
            wire_bytes[1],
            wire_bytes[2],
            wire_bytes[3],
            wire_bytes[4],
        ]);

        let payload = if wire_bytes.len() >= 5 + message_length as usize {
            wire_bytes[5..5 + message_length as usize].to_vec()
        } else {
            return Err(SentinelError::parse_error(
                "Incomplete gRPC payload in wire frame".to_string(),
            ));
        };

        Ok(GrpcMessageFrame {
            is_compressed,
            message_length,
            data: payload,
        })
    }

    /// Generates standard gRPC Server Reflection v1 request (list_services)
    pub fn generate_reflection_request() -> Vec<u8> {
        // Encoded ServerReflectionRequest asking for list_services
        // Protobuf: field 7 (list_services = "") -> tag 0x3a, len 0x00
        let proto_payload = vec![0x3a, 0x00];
        Self::encode_frame(&proto_payload, false)
    }

    /// Generates reflection request for specific symbol file descriptor
    pub fn generate_file_containing_symbol_request(symbol: &str) -> Vec<u8> {
        // Field 4: file_containing_symbol (string) -> tag (4 << 3 | 2) = 0x22
        let mut proto = Vec::new();
        proto.push(0x22);
        encode_varint(symbol.len() as u64, &mut proto);
        proto.extend_from_slice(symbol.as_bytes());
        Self::encode_frame(&proto, false)
    }

    /// Parses Reflection v1 response payload discovering services
    pub fn parse_reflection_services_response(payload: &[u8]) -> Result<Vec<GrpcServiceInfo>, SentinelError> {
        let msg = DynamicMessage::decode_from_slice(payload)?;
        let mut services = Vec::new();

        // Field 7: list_services_response
        if let Some(values) = msg.fields.get(&7) {
            for v in values {
                if let ProtobufValue::Message(sub_map) = v {
                    // Inside ListServiceResponse, field 1 is repeated ServiceResponse
                    if let Some(svc_responses) = sub_map.get(&1) {
                        for svc_v in svc_responses {
                            if let ProtobufValue::Message(svc_map) = svc_v {
                                // ServiceResponse field 1: name (string)
                                if let Some(name_vals) = svc_map.get(&1) {
                                    for name_v in name_vals {
                                        if let ProtobufValue::LengthDelimited(name_bytes) = name_v {
                                            if let Ok(name_str) = std::str::from_utf8(name_bytes) {
                                                services.push(GrpcServiceInfo {
                                                    service_name: name_str.to_string(),
                                                    methods: vec![],
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(services)
    }

    /// Security Fuzzing Generator: Varint 64-bit integer overflow payload
    pub fn generate_varint_overflow_fuzz_frame() -> Vec<u8> {
        // Field 1: tag (1 << 3 | 0) = 0x08, followed by 10-byte 64-bit overflow varint
        let mut proto = vec![0x08];
        proto.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F]);
        Self::encode_frame(&proto, false)
    }

    /// Security Fuzzing Generator: Unknown high field tag injection (> 2^19)
    pub fn generate_high_tag_injection_frame(tag_number: u32) -> Vec<u8> {
        let mut proto = Vec::new();
        let tag = (tag_number << 3) | (ProtobufWireType::LengthDelimited as u32);
        encode_varint(tag as u64, &mut proto);
        let junk = b"SENTINEL_UNKNOWN_TAG_FUZZ";
        encode_varint(junk.len() as u64, &mut proto);
        proto.extend_from_slice(junk);
        Self::encode_frame(&proto, false)
    }

    /// Security Fuzzing Generator: Deep nested sub-message exhaustion (DoS probe)
    pub fn generate_recursion_depth_fuzz_frame(depth: usize) -> Vec<u8> {
        let mut current = b"leaf".to_vec();
        for _ in 0..depth {
            let mut wrapper = Vec::new();
            wrapper.push(0x0A); // field 1, wire type 2
            encode_varint(current.len() as u64, &mut wrapper);
            wrapper.extend_from_slice(&current);
            current = wrapper;
        }
        Self::encode_frame(&current, false)
    }
}
