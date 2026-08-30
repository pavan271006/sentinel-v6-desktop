//! gRPC Protobuf Parameter Extractor.
//! Extracts testable parameters from binary gRPC frames and decoded protobuf fields.

use crate::frame::GrpcFrameCodec;
use crate::protobuf::{ProtobufCodec, ProtobufMessage, WireType};
use ucma_core::ids::EndpointId;
use ucma_core::parameter::ParameterLocation;
use ucma_parameter::ExtractedParameter;

pub struct GrpcParameterExtractor;

impl GrpcParameterExtractor {
    /// Extracts parameters from raw binary gRPC body bytes.
    pub fn extract_all(endpoint_id: &EndpointId, raw_grpc_body: &[u8]) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();

        if let Ok(frames) = GrpcFrameCodec::decode_frames(raw_grpc_body) {
            for (f_idx, frame) in frames.iter().enumerate() {
                if let Ok(msg) = ProtobufCodec::decode(&frame.payload) {
                    let frame_path = format!("grpc.frame[{}]", f_idx);
                    Self::extract_from_message(endpoint_id, &msg, &frame_path, &mut params);
                }
            }
        }

        params
    }

    /// Recursively extracts fields from a Protobuf message.
    pub fn extract_from_message(
        endpoint_id: &EndpointId,
        msg: &ProtobufMessage,
        parent_path: &str,
        params: &mut Vec<ExtractedParameter>,
    ) {
        for field in &msg.fields {
            let field_path = format!("{}.field[{}]", parent_path, field.field_number);

            match field.wire_type {
                WireType::LengthDelimited => {
                    if let Ok(s) = std::str::from_utf8(&field.raw_data)
                        && s.chars().all(|c| !c.is_control() || c == '\n' || c == '\r' || c == '\t') {
                            params.push(ExtractedParameter::new(
                                endpoint_id,
                                field_path,
                                ParameterLocation::Unknown("grpc_protobuf".to_string()),
                                s.to_string(),
                            ));
                            continue;
                        }

                    // Try decoding as nested protobuf message
                    if let Ok(nested_msg) = ProtobufCodec::decode(&field.raw_data)
                        && !nested_msg.fields.is_empty() {
                            Self::extract_from_message(
                                endpoint_id,
                                &nested_msg,
                                &field_path,
                                params,
                            );
                            continue;
                        }

                    params.push(ExtractedParameter::new(
                        endpoint_id,
                        field_path,
                        ParameterLocation::Unknown("grpc_protobuf_hex".to_string()),
                        format!("0x{}", hex::encode(&field.raw_data)),
                    ));
                }
                WireType::Varint => {
                    if let Some(n) = field.as_varint() {
                        params.push(ExtractedParameter::new(
                            endpoint_id,
                            field_path,
                            ParameterLocation::Unknown("grpc_protobuf".to_string()),
                            n.to_string(),
                        ));
                    }
                }
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protobuf::ProtobufField;
    use ucma_core::ids::TargetId;

    #[test]
    fn test_extract_grpc_parameters() {
        let tid = TargetId::derive("https://grpc.service.local");
        let eid = EndpointId::derive(&tid, "POST", "/users.UserService/GetUser");

        let mut msg = ProtobufMessage::default();
        msg.fields.push(ProtobufField {
            field_number: 1,
            wire_type: WireType::Varint,
            raw_data: ProtobufCodec::encode_varint(101),
        });
        msg.fields.push(ProtobufField {
            field_number: 2,
            wire_type: WireType::LengthDelimited,
            raw_data: b"admin".to_vec(),
        });

        let payload = ProtobufCodec::encode(&msg);
        let frame_bytes = GrpcFrameCodec::encode_frame(&payload, false);

        let params = GrpcParameterExtractor::extract_all(&eid, &frame_bytes);
        assert_eq!(params.len(), 2);
        assert!(params.iter().any(|p| p.name == "grpc.frame[0].field[1]" && p.raw_value == "101"));
        assert!(params.iter().any(|p| p.name == "grpc.frame[0].field[2]" && p.raw_value == "admin"));
    }
}
