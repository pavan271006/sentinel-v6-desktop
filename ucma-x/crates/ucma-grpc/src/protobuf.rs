//! Protobuf wire format parser and serializer.

use crate::frame::GrpcError;
use serde::{Deserialize, Serialize};

/// Protobuf Wire Types (RFC / Proto specification).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WireType {
    Varint = 0,
    Bit64 = 1,
    LengthDelimited = 2,
    StartGroup = 3,
    EndGroup = 4,
    Bit32 = 5,
}

impl WireType {
    pub fn from_u8(val: u8) -> Result<Self, GrpcError> {
        match val {
            0 => Ok(Self::Varint),
            1 => Ok(Self::Bit64),
            2 => Ok(Self::LengthDelimited),
            3 => Ok(Self::StartGroup),
            4 => Ok(Self::EndGroup),
            5 => Ok(Self::Bit32),
            other => Err(GrpcError::ProtobufDecode(format!("Invalid wire type: {}", other))),
        }
    }
}

/// A parsed field from a Protobuf message.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProtobufField {
    pub field_number: u32,
    pub wire_type: WireType,
    pub raw_data: Vec<u8>,
}

impl ProtobufField {
    pub fn as_str(&self) -> Option<&str> {
        if self.wire_type == WireType::LengthDelimited {
            std::str::from_utf8(&self.raw_data).ok()
        } else {
            None
        }
    }

    pub fn as_varint(&self) -> Option<u64> {
        if self.wire_type == WireType::Varint {
            let mut offset = 0;
            ProtobufCodec::decode_varint(&self.raw_data, &mut offset).ok()
        } else {
            None
        }
    }
}

/// A parsed Protobuf message holding multiple fields.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ProtobufMessage {
    pub fields: Vec<ProtobufField>,
}

/// Protobuf wire encoder and decoder.
pub struct ProtobufCodec;

impl ProtobufCodec {
    /// Decodes a Protobuf wire message from bytes.
    pub fn decode(bytes: &[u8]) -> Result<ProtobufMessage, GrpcError> {
        let mut fields = Vec::new();
        let mut offset = 0;

        while offset < bytes.len() {
            let tag = Self::decode_varint(bytes, &mut offset)?;
            let wire_type_num = (tag & 0x07) as u8;
            let field_number = (tag >> 3) as u32;
            let wire_type = WireType::from_u8(wire_type_num)?;

            let raw_data = match wire_type {
                WireType::Varint => {
                    let start = offset;
                    let _ = Self::decode_varint(bytes, &mut offset)?;
                    bytes[start..offset].to_vec()
                }
                WireType::Bit64 => {
                    if offset + 8 > bytes.len() {
                        return Err(GrpcError::ProtobufDecode("Unexpected EOF in 64-bit field".to_string()));
                    }
                    let d = bytes[offset..offset + 8].to_vec();
                    offset += 8;
                    d
                }
                WireType::LengthDelimited => {
                    let len = Self::decode_varint(bytes, &mut offset)? as usize;
                    if offset + len > bytes.len() {
                        return Err(GrpcError::ProtobufDecode("Unexpected EOF in length-delimited field".to_string()));
                    }
                    let d = bytes[offset..offset + len].to_vec();
                    offset += len;
                    d
                }
                WireType::Bit32 => {
                    if offset + 4 > bytes.len() {
                        return Err(GrpcError::ProtobufDecode("Unexpected EOF in 32-bit field".to_string()));
                    }
                    let d = bytes[offset..offset + 4].to_vec();
                    offset += 4;
                    d
                }
                WireType::StartGroup | WireType::EndGroup => {
                    return Err(GrpcError::ProtobufDecode("Unsupported group wire type".to_string()));
                }
            };

            fields.push(ProtobufField {
                field_number,
                wire_type,
                raw_data,
            });
        }

        Ok(ProtobufMessage { fields })
    }

    /// Serializes a ProtobufMessage back into wire bytes.
    pub fn encode(msg: &ProtobufMessage) -> Vec<u8> {
        let mut out = Vec::new();
        for field in &msg.fields {
            let tag = ((field.field_number as u64) << 3) | (field.wire_type as u64);
            out.extend_from_slice(&Self::encode_varint(tag));

            match field.wire_type {
                WireType::Varint | WireType::Bit64 | WireType::Bit32 => {
                    out.extend_from_slice(&field.raw_data);
                }
                WireType::LengthDelimited => {
                    let len = field.raw_data.len() as u64;
                    out.extend_from_slice(&Self::encode_varint(len));
                    out.extend_from_slice(&field.raw_data);
                }
                _ => {}
            }
        }
        out
    }

    /// Decodes a LEB128 varint from the byte stream.
    pub fn decode_varint(bytes: &[u8], offset: &mut usize) -> Result<u64, GrpcError> {
        let mut result: u64 = 0;
        let mut shift = 0;

        while *offset < bytes.len() {
            let byte = bytes[*offset];
            *offset += 1;
            result |= ((byte & 0x7F) as u64) << shift;

            if (byte & 0x80) == 0 {
                return Ok(result);
            }
            shift += 7;
            if shift >= 64 {
                return Err(GrpcError::ProtobufDecode("Varint overflow".to_string()));
            }
        }

        Err(GrpcError::ProtobufDecode("Unexpected EOF in varint".to_string()))
    }

    /// Encodes a u64 into LEB128 varint bytes.
    pub fn encode_varint(mut val: u64) -> Vec<u8> {
        let mut out = Vec::new();
        while val >= 0x80 {
            out.push(((val & 0x7F) as u8) | 0x80);
            val >>= 7;
        }
        out.push(val as u8);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protobuf_varint_codec() {
        let val = 123456789u64;
        let encoded = ProtobufCodec::encode_varint(val);
        let mut offset = 0;
        let decoded = ProtobufCodec::decode_varint(&encoded, &mut offset).unwrap();
        assert_eq!(decoded, val);
        assert_eq!(offset, encoded.len());
    }

    #[test]
    fn test_protobuf_message_roundtrip() {
        let mut msg = ProtobufMessage::default();
        msg.fields.push(ProtobufField {
            field_number: 1,
            wire_type: WireType::Varint,
            raw_data: ProtobufCodec::encode_varint(42),
        });
        msg.fields.push(ProtobufField {
            field_number: 2,
            wire_type: WireType::LengthDelimited,
            raw_data: b"admin".to_vec(),
        });

        let encoded = ProtobufCodec::encode(&msg);
        let decoded = ProtobufCodec::decode(&encoded).unwrap();

        assert_eq!(decoded.fields.len(), 2);
        assert_eq!(decoded.fields[0].as_varint(), Some(42));
        assert_eq!(decoded.fields[1].as_str(), Some("admin"));
    }
}
