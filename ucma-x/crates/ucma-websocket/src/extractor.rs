//! WebSocket Message Parameter Extractor.
//! Extracts testable parameters from WebSocket frame payloads (JSON, URL-encoded, or raw text).

use crate::frame::{Opcode, WsFrameCodec};
use ucma_core::ids::EndpointId;
use ucma_core::parameter::ParameterLocation;
use ucma_parameter::{ExtractedParameter, ParameterExtractor};

pub struct WsParameterExtractor;

impl WsParameterExtractor {
    /// Extracts parameters from raw RFC 6455 wire frame bytes.
    pub fn extract_from_frames(
        endpoint_id: &EndpointId,
        raw_frames: &[u8],
    ) -> Vec<ExtractedParameter> {
        let mut params = Vec::new();

        if let Ok(frames) = WsFrameCodec::decode_frames(raw_frames) {
            for (f_idx, frame) in frames.iter().enumerate() {
                if frame.opcode == Opcode::Text
                    && let Ok(text) = std::str::from_utf8(&frame.payload) {
                        let frame_prefix = format!("ws.frame[{}]", f_idx);
                        Self::extract_from_text(endpoint_id, text, &frame_prefix, &mut params);
                    }
            }
        }

        params
    }

    /// Extracts parameters from a WebSocket text message payload.
    pub fn extract_from_text(
        endpoint_id: &EndpointId,
        text: &str,
        prefix: &str,
        params: &mut Vec<ExtractedParameter>,
    ) {
        let trimmed = text.trim();

        // 1. Check if JSON payload
        if (trimmed.starts_with('{') && trimmed.ends_with('}'))
            || (trimmed.starts_with('[') && trimmed.ends_with(']'))
        {
            let json_params = ParameterExtractor::extract_from_json(endpoint_id, trimmed);
            if !json_params.is_empty() {
                for mut p in json_params {
                    p.name = format!("{}.{}", prefix, p.name);
                    p.location = ParameterLocation::Unknown("websocket_json".to_string());
                    params.push(p);
                }
                return;
            }
        }

        // 2. Check if Form / Query key-value pairs
        if trimmed.contains('=') && !trimmed.contains('\n') {
            let form_params = ParameterExtractor::extract_from_form(endpoint_id, trimmed);
            if !form_params.is_empty() {
                for mut p in form_params {
                    p.name = format!("{}.{}", prefix, p.name);
                    p.location = ParameterLocation::Unknown("websocket_form".to_string());
                    params.push(p);
                }
                return;
            }
        }

        // 3. Raw text parameter
        params.push(ExtractedParameter::new(
            endpoint_id,
            format!("{}.text", prefix),
            ParameterLocation::Unknown("websocket_text".to_string()),
            text.to_string(),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frame::WsFrame;
    use ucma_core::ids::TargetId;

    #[test]
    fn test_extract_websocket_json_params() {
        let tid = TargetId::derive("wss://stream.local");
        let eid = EndpointId::derive(&tid, "GET", "/ws/chat");

        let frame = WsFrame::text(r#"{"action":"subscribe","channel":"stocks","userId":42}"#);
        let frame_bytes = WsFrameCodec::encode_frame(&frame);

        let params = WsParameterExtractor::extract_from_frames(&eid, &frame_bytes);
        assert_eq!(params.len(), 3);
        assert!(params
            .iter()
            .any(|p| p.name == "ws.frame[0].$.channel" && p.raw_value == "stocks"));
        assert!(params
            .iter()
            .any(|p| p.name == "ws.frame[0].$.userId" && p.raw_value == "42"));
    }
}
