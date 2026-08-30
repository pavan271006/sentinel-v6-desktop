//! SIEM Event Exporter (CEF / Syslog RFC 5424, SEC-12)

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::enums::Severity;
use sentinel_common::errors::SentinelError;
use tokio::net::UdpSocket;

pub struct SiemExporter;

impl SiemExporter {
    pub fn format_cef(
        finding_id: Uuid,
        title: &str,
        severity: Severity,
        source_ip: &str,
    ) -> String {
        let sev_num = match severity {
            Severity::Critical => 10,
            Severity::High => 8,
            Severity::Medium => 5,
            Severity::Low => 3,
            Severity::Info => 1,
        };

        format!(
            "CEF:0|SentinelSecurity|SentinelPlatform|6.0.0|FINDING|{}|{}|src={} findingId={}",
            title, sev_num, source_ip, finding_id
        )
    }

    pub fn format_syslog(facility: u8, severity: u8, app_name: &str, message: &str) -> String {
        let pri = (facility * 8) + severity;
        let ts = Utc::now().to_rfc3339();
        format!("<{}>1 {} localhost {} - - - {}", pri, ts, app_name, message)
    }

    /// Dispatches a CEF security event over UDP socket to a remote SIEM receiver (Splunk, QRadar, ArcSight)
    pub async fn send_cef_udp(
        target_addr: &str,
        finding_id: Uuid,
        title: &str,
        severity: Severity,
        source_ip: &str,
    ) -> Result<(), SentinelError> {
        let message = Self::format_cef(finding_id, title, severity, source_ip);
        let socket = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to bind local UDP socket for SIEM export: {}", e))
        })?;

        socket.send_to(message.as_bytes(), target_addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to transmit CEF event to {}: {}", target_addr, e))
        })?;

        Ok(())
    }

    /// Dispatches an RFC 5424 Syslog event over UDP socket to a remote Syslog collector
    pub async fn send_syslog_udp(
        target_addr: &str,
        facility: u8,
        severity: u8,
        app_name: &str,
        message: &str,
    ) -> Result<(), SentinelError> {
        let formatted = Self::format_syslog(facility, severity, app_name, message);
        let socket = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to bind local UDP socket for Syslog export: {}", e))
        })?;

        socket.send_to(formatted.as_bytes(), target_addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to transmit Syslog event to {}: {}", target_addr, e))
        })?;

        Ok(())
    }
}
