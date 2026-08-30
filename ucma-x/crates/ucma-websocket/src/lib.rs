//! # UCMA-WebSocket
//! WebSocket RFC 6455 frame capture, decode, and message payload parameter extraction for UCMA-X.

pub mod extractor;
pub mod frame;
pub mod mutator;

pub use extractor::WsParameterExtractor;
pub use frame::{Opcode, WsError, WsFrame, WsFrameCodec};
pub use mutator::WsMessageMutator;
