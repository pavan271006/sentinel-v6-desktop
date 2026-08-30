//! WebSocket Message Mutator.
//! Mutates JSON or text payloads within RFC 6455 frames and re-encodes wire frames.

use crate::frame::{WsError, WsFrameCodec};
use ucma_parameter::ParameterMutator;

pub struct WsMessageMutator;

impl WsMessageMutator {
    /// Mutates the target parameter in a WebSocket wire frame and re-encodes the frame.
    pub fn mutate_frames(
        raw_frames: &[u8],
        target_param_name: &str,
        new_val: &str,
    ) -> Result<Vec<u8>, WsError> {
        let mut frames = WsFrameCodec::decode_frames(raw_frames)?;
        if frames.is_empty() {
            return Err(WsError::IncompletePayload {
                expected: 1,
                available: 0,
            });
        }

        // e.g. target_param_name is `ws.frame[0].$.channel`
        let (f_idx, inner_param) = Self::parse_frame_target(target_param_name);

        if let Some(frame) = frames.get_mut(f_idx)
            && let Ok(text) = std::str::from_utf8(&frame.payload) {
                let trimmed = text.trim();
                let mutated_text = if inner_param.starts_with('$') {
                    ParameterMutator::mutate_json(trimmed, inner_param, new_val)
                        .unwrap_or_else(|_| new_val.to_string())
                } else if trimmed.contains('=') {
                    ParameterMutator::mutate_form(trimmed, inner_param, new_val)
                } else {
                    new_val.to_string()
                };

                frame.payload = mutated_text.into_bytes();
            }

        let mut output = Vec::new();
        for frame in &frames {
            output.extend_from_slice(&WsFrameCodec::encode_frame(frame));
        }

        Ok(output)
    }

    fn parse_frame_target(param_name: &str) -> (usize, &str) {
        if let Some(rest) = param_name.strip_prefix("ws.frame[")
            && let Some(close_idx) = rest.find(']') {
                let idx_str = &rest[..close_idx];
                let frame_idx = idx_str.parse::<usize>().unwrap_or(0);
                let inner = if rest.len() > close_idx + 2 {
                    &rest[close_idx + 2..] // skip `].`
                } else {
                    ""
                };
                return (frame_idx, inner);
            }
        (0, param_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extractor::WsParameterExtractor;
    use crate::frame::WsFrame;
    use ucma_core::ids::{EndpointId, TargetId};

    #[test]
    fn test_mutate_websocket_json_payload() {
        let mut frame = WsFrame::text(r#"{"action":"subscribe","channel":"crypto"}"#);
        frame.masked = true;
        frame.mask_key = Some([0xAA, 0xBB, 0xCC, 0xDD]);

        let frame_bytes = WsFrameCodec::encode_frame(&frame);

        let mutated = WsMessageMutator::mutate_frames(
            &frame_bytes,
            "ws.frame[0].$.channel",
            "crypto' UNION SELECT 1--",
        )
        .unwrap();

        let tid = TargetId::derive("wss://target.local");
        let eid = EndpointId::derive(&tid, "GET", "/ws");
        let params = WsParameterExtractor::extract_from_frames(&eid, &mutated);

        assert!(params.iter().any(|p| p.name == "ws.frame[0].$.channel"
            && p.raw_value == "crypto' UNION SELECT 1--"));
    }
}
