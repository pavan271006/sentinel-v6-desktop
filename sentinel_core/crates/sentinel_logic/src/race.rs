//! Barrier-Synchronized & HTTP/2 Single-Packet Race Condition Prober
//!
//! Coordinates sub-millisecond concurrent executions:
//! - Multi-threaded barrier synchronization via Tokio
//! - Single-packet HTTP/2 multiplexed stream frame synchronization
//! - HTTP/1.1 TCP Last-Byte synchronization

use sentinel_common::errors::SentinelError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Barrier;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaceSyncResult<T> {
    pub execution_index: usize,
    pub output: T,
    pub latency_us: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SinglePacketAttackFrame {
    pub stream_id: u32,
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub struct RaceConditionProber;

impl RaceConditionProber {
    /// Executes synchronized multi-threaded race test with in-process barrier
    pub async fn execute_race_test<F, Fut, T>(
        concurrency: usize,
        action: F,
    ) -> Result<Vec<T>, SentinelError>
    where
        F: Fn(usize) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = T> + Send + 'static,
        T: Send + 'static,
    {
        let barrier = Arc::new(Barrier::new(concurrency));
        let action = Arc::new(action);
        let mut handles = Vec::with_capacity(concurrency);

        for i in 0..concurrency {
            let b = barrier.clone();
            let act = action.clone();

            handles.push(tokio::spawn(async move {
                b.wait().await;
                act(i).await
            }));
        }

        let mut results = Vec::with_capacity(concurrency);
        for handle in handles {
            let res = handle.await.map_err(|e| {
                SentinelError::InvariantViolation(format!("Race worker thread panicked: {}", e))
            })?;
            results.push(res);
        }

        Ok(results)
    }

    /// Prepares an HTTP/2 Single-Packet synchronized attack payload batch
    pub fn prepare_h2_single_packet_batch(
        endpoint_path: &str,
        stream_count: usize,
        auth_header: &str,
    ) -> Vec<SinglePacketAttackFrame> {
        let mut frames = Vec::with_capacity(stream_count);
        for i in 0..stream_count {
            let stream_id = (i as u32 * 2) + 1; // H2 client streams are odd
            frames.push(SinglePacketAttackFrame {
                stream_id,
                method: "POST".to_string(),
                path: endpoint_path.to_string(),
                headers: vec![
                    (":method".to_string(), "POST".to_string()),
                    (":path".to_string(), endpoint_path.to_string()),
                    (":scheme".to_string(), "https".to_string()),
                    ("authorization".to_string(), auth_header.to_string()),
                    ("x-race-stream-id".to_string(), stream_id.to_string()),
                ],
                body: vec![],
            });
        }
        frames
    }

    /// Evaluates if race test results exhibited a race condition (e.g. multi-spend / double coupon)
    pub fn evaluate_race_success<T: PartialEq>(
        results: &[T],
        target_success_item: &T,
        max_allowed_successes: usize,
    ) -> (bool, usize) {
        let success_count = results
            .iter()
            .filter(|&item| item == target_success_item)
            .count();

        let is_vulnerable = success_count > max_allowed_successes;
        (is_vulnerable, success_count)
    }
}
