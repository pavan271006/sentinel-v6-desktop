//! Stored input and second-order candidate tracking.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ucma_core::ids::{EndpointId, ParameterId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredInputVector {
    pub source_endpoint: EndpointId,
    pub source_param: ParameterId,
    pub payload_value: String,
    pub injected_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SinkObservation {
    pub sink_endpoint: EndpointId,
    pub observed_error_or_delay: bool,
    pub observed_at: DateTime<Utc>,
}
