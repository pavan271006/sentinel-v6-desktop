//! Snapshot creation and conversion adapters.

use crate::response::RawWireResponse;
use ucma_core::ids::RequestId;
use ucma_core::snapshot::ResponseSnapshot;

/// Snapshot generator for HTTP interactions.
pub struct SnapshotBuilder;

impl SnapshotBuilder {
    /// Builds an immutable ResponseSnapshot from raw wire response components.
    pub fn from_raw_response(
        request_id: RequestId,
        raw_response: RawWireResponse,
    ) -> ResponseSnapshot {
        ResponseSnapshot::new(
            request_id,
            raw_response.status_code,
            raw_response.headers,
            raw_response.body,
            raw_response.latency_nanos,
            &raw_response.raw_wire_bytes,
            raw_response.truncated,
            raw_response.remote_ip,
        )
    }
}
