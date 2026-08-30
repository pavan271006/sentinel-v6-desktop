//! Dual-Write Persistence Worker & EventBus Telemetry Emission
//!
//! Strictly enforces:
//! - SEC-07: Immutable SHA-256 CAS blob storage for raw transaction byte streams
//! - SEC-10: Triple Representation (raw CAS blob UUID + parsed parts + normalized text)
//! - SEC-12: Bounded mpsc channel backpressure and non-blocking telemetry broadcast

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{error, info, warn};
use uuid::Uuid;

use sentinel_common::domain::meta::{EntityMetadata, MessageRepresentation, TlsData};
use sentinel_common::domain::{Observation, Transaction};
use sentinel_common::enums::{ObservationSource, Provenance};
use sentinel_common::events::SentinelEvent;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};
use sentinel_common::traits::{EventBus, ObservationStore};
use sentinel_parser::normalization::{
    build_normalized_request_text, build_normalized_response_text,
};
use sentinel_storage::SqliteObservationStore;

/// Payload submitted by the proxy connection handler for background persistence.
#[derive(Debug, Clone)]
pub struct PendingTransactionRecord {
    pub raw_request: Vec<u8>,
    pub parsed_request: ParsedRequest,
    pub raw_response: Option<Vec<u8>>,
    pub parsed_response: Option<ParsedResponse>,
    pub timing: Duration,
    pub tls_info: Option<TlsData>,
    pub scope_id: Option<Uuid>,
}

/// Handle to submit transactions to the background persistence worker.
#[derive(Clone)]
pub struct PersistenceRecorder {
    sender: mpsc::Sender<PendingTransactionRecord>,
}

impl PersistenceRecorder {
    /// Starts the background persistence worker loop and returns the recorder handle.
    pub fn start(
        storage: Option<SqliteObservationStore>,
        event_bus: Option<Arc<dyn EventBus>>,
        buffer_capacity: usize,
    ) -> Self {
        let (tx, mut rx) = mpsc::channel::<PendingTransactionRecord>(buffer_capacity.max(1024));

        tokio::spawn(async move {
            info!(
                "Persistence worker started (buffer capacity: {})",
                buffer_capacity
            );

            while let Some(record) = rx.recv().await {
                if let Err(e) = Self::process_record(&storage, &event_bus, record).await {
                    error!("Error persisting transaction record: {}", e);
                }
            }

            info!("Persistence worker drained and shut down cleanly");
        });

        Self { sender: tx }
    }

    /// Submits a completed transaction for background recording without blocking proxy workers.
    pub fn record(&self, record: PendingTransactionRecord) {
        if let Err(mpsc::error::TrySendError::Full(_)) = self.sender.try_send(record) {
            warn!("Persistence queue full (SEC-12 backpressure); dropping transaction record from persistence");
        }
    }

    async fn process_record(
        storage: &Option<SqliteObservationStore>,
        event_bus: &Option<Arc<dyn EventBus>>,
        record: PendingTransactionRecord,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let tx_id = Uuid::new_v4();

        if let Some(store) = storage {
            // 1. CAS Write Request (SEC-07 & SEC-10)
            let req_desc = store.cas().put(&record.raw_request).await?;
            let req_norm_text = build_normalized_request_text(&record.parsed_request);
            let req_repr = MessageRepresentation {
                raw_blob_id: req_desc.blob_id,
                parsed: sentinel_common::domain::meta::HttpParsedParts {
                    method: record.parsed_request.method,
                    uri: record.parsed_request.uri.clone(),
                    version: record.parsed_request.version.clone(),
                    headers: record.parsed_request.headers.clone(),
                },
                normalized_text: req_norm_text,
            };

            // 2. CAS Write Response (SEC-07 & SEC-10)
            let res_repr = if let (Some(raw_res), Some(parsed_res)) = (
                record.raw_response.as_ref(),
                record.parsed_response.as_ref(),
            ) {
                let res_desc = store.cas().put(raw_res).await?;
                let res_norm_text = build_normalized_response_text(parsed_res);
                Some(MessageRepresentation {
                    raw_blob_id: res_desc.blob_id,
                    parsed: sentinel_common::domain::meta::HttpParsedParts {
                        method: sentinel_common::enums::HttpMethod::GET,
                        uri: "".to_string(),
                        version: parsed_res.version.clone(),
                        headers: parsed_res.headers.clone(),
                    },
                    normalized_text: res_norm_text,
                })
            } else {
                None
            };

            // 3. Assemble and persist Transaction entity
            let mut meta = EntityMetadata::new(Provenance::Proxy);
            meta.id = tx_id;
            if let Some(sid) = record.scope_id {
                meta.scope_id = Some(sid);
            }

            let transaction = Transaction {
                meta: meta.clone(),
                request: req_repr,
                response: res_repr,
                timing: record.timing,
                tls_info: record.tls_info,
            };

            store.transactions().insert(&transaction).await?;

            // 4. Create and persist Observation entity
            let obs = Observation {
                meta: EntityMetadata::new(Provenance::Proxy),
                source: ObservationSource::Proxy,
                data_ref: tx_id,
            };
            store.insert(obs).await?;
        }

        // 5. Emit Telemetry to EventBus broadcast channel (SEC-12)
        if let Some(bus) = event_bus {
            let _ = bus.publish_telemetry(SentinelEvent::ObservationCreated(tx_id));

            let status_code = record
                .parsed_response
                .as_ref()
                .map(|r| r.status_code)
                .unwrap_or(200);

            let req_headers = Some(
                record
                    .parsed_request
                    .headers
                    .iter()
                    .map(|(k, v)| sentinel_common::events::HttpHeaderData {
                        name: String::from_utf8_lossy(k).to_string(),
                        value: String::from_utf8_lossy(v).to_string(),
                    })
                    .collect(),
            );

            let res_headers = record.parsed_response.as_ref().map(|r| {
                r.headers
                    .iter()
                    .map(|(k, v)| sentinel_common::events::HttpHeaderData {
                        name: String::from_utf8_lossy(k).to_string(),
                        value: String::from_utf8_lossy(v).to_string(),
                    })
                    .collect()
            });

            let req_body_preview = if !record.raw_request.is_empty() {
                Some(String::from_utf8_lossy(&record.raw_request).to_string())
            } else {
                None
            };

            let res_body_preview = record
                .raw_response
                .as_ref()
                .map(|b| String::from_utf8_lossy(b).to_string());

            let traffic_data = sentinel_common::events::TrafficEventData {
                id: tx_id.to_string(),
                method: format!("{:?}", record.parsed_request.method),
                url: record.parsed_request.uri.clone(),
                status: status_code,
                duration_ms: record.timing.as_millis() as u64,
                in_scope: true,
                req_headers,
                req_body: req_body_preview,
                res_headers,
                res_body: res_body_preview,
            };

            let _ = bus.publish_telemetry(SentinelEvent::Traffic(traffic_data));
        }

        Ok(())
    }
}
