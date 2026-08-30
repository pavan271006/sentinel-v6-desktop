//! gRPC Payload Mutator.
//! Modifies Protobuf message fields and reconstitutes binary gRPC frames.

use crate::frame::{GrpcError, GrpcFrameCodec};
use crate::protobuf::{ProtobufCodec, WireType};

pub struct GrpcParameterMutator;

impl GrpcParameterMutator {
    /// Injects a mutated payload value into a target gRPC field path and returns the updated wire bytes.
    pub fn mutate_grpc_body(
        raw_grpc_body: &[u8],
        target_param_name: &str,
        new_val: &str,
    ) -> Result<Vec<u8>, GrpcError> {
        let mut frames = GrpcFrameCodec::decode_frames(raw_grpc_body)?;
        if frames.is_empty() {
            return Err(GrpcError::ProtobufDecode("No gRPC frames in body".to_string()));
        }

        // Parse target field number from path, e.g. `grpc.frame[0].field[2]`
        let field_num = Self::extract_field_number(target_param_name)?;

        for frame in &mut frames {
            let mut msg = ProtobufCodec::decode(&frame.payload)?;
            let mut matched = false;

            for field in &mut msg.fields {
                if field.field_number == field_num {
                    match field.wire_type {
                        WireType::LengthDelimited => {
                            field.raw_data = new_val.as_bytes().to_vec();
                            matched = true;
                        }
                        WireType::Varint => {
                            if let Ok(n) = new_val.parse::<u64>() {
                                field.raw_data = ProtobufCodec::encode_varint(n);
                                matched = true;
                            } else {
                                field.raw_data = new_val.as_bytes().to_vec();
                                matched = true;
                            }
                        }
                        _ => {}
                    }
                }
            }

            if matched {
                frame.payload = ProtobufCodec::encode(&msg);
                frame.length = frame.payload.len() as u32;
            }
        }

        let mut output = Vec::new();
        for frame in &frames {
            output.extend_from_slice(&GrpcFrameCodec::encode_frame(
                &frame.payload,
                frame.compressed,
            ));
        }

        Ok(output)
    }

    fn extract_field_number(path: &str) -> Result<u32, GrpcError> {
        let re = regex::Regex::new(r"field\[(\d+)\]").unwrap();
        if let Some(caps) = re.captures(path)
            && let Some(m) = caps.get(1)
                && let Ok(num) = m.as_str().parse::<u32>() {
                    return Ok(num);
                }
        Err(GrpcError::FieldNotFound(path.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extractor::GrpcParameterExtractor;
    use crate::protobuf::{ProtobufField, ProtobufMessage};
    use ucma_core::ids::{EndpointId, TargetId};

    #[test]
    fn test_mutate_grpc_payload() {
        let mut msg = ProtobufMessage::default();
        msg.fields.push(ProtobufField {
            field_number: 1,
            wire_type: WireType::Varint,
            raw_data: ProtobufCodec::encode_varint(42),
        });
        msg.fields.push(ProtobufField {
            field_number: 2,
            wire_type: WireType::LengthDelimited,
            raw_data: b"normal_user".to_vec(),
        });

        let payload = ProtobufCodec::encode(&msg);
        let frame_bytes = GrpcFrameCodec::encode_frame(&payload, false);

        let mutated = GrpcParameterMutator::mutate_grpc_body(
            &frame_bytes,
            "grpc.frame[0].field[2]",
            "admin' OR 1=1 --",
        )
        .unwrap();

        let tid = TargetId::derive("https://target.local");
        let eid = EndpointId::derive(&tid, "POST", "/GetUser");
        let params = GrpcParameterExtractor::extract_all(&eid, &mutated);

        assert!(params
            .iter()
            .any(|p| p.name == "grpc.frame[0].field[2]" && p.raw_value == "admin' OR 1=1 --"));
    }
}
