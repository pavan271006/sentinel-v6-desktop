//! Test Suite for Enterprise Integration Subsystem

use tokio::net::UdpSocket;
use uuid::Uuid;

use sentinel_common::enums::Severity;
use sentinel_enterprise::{Permission, RbacManager, SiemExporter, TenantManager, UserRole};

#[test]
fn test_enterprise_rbac_permissions() {
    assert!(RbacManager::has_permission(
        UserRole::Admin,
        Permission::ManageUsers
    ));
    assert!(RbacManager::has_permission(
        UserRole::Pentester,
        Permission::ExecuteActiveScan
    ));
    assert!(!RbacManager::has_permission(
        UserRole::Auditor,
        Permission::ExecuteActiveScan
    ));
    assert!(!RbacManager::has_permission(
        UserRole::Viewer,
        Permission::ExportData
    ));
}

#[test]
fn test_siem_cef_and_syslog_formatting() {
    let id = Uuid::new_v4();
    let cef = SiemExporter::format_cef(id, "SQL Injection", Severity::Critical, "192.168.1.50");
    assert!(
        cef.starts_with("CEF:0|SentinelSecurity|SentinelPlatform|6.0.0|FINDING|SQL Injection|10|")
    );
    assert!(cef.contains("src=192.168.1.50"));

    let syslog = SiemExporter::format_syslog(16, 1, "sentinel-core", "Critical alert");
    assert!(syslog.contains("sentinel-core"));
    assert!(syslog.contains("Critical alert"));
}

#[tokio::test]
async fn test_siem_udp_socket_transmission() {
    // Bind local receiver
    let receiver = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let port = receiver.local_addr().unwrap().port();
    let target = format!("127.0.0.1:{}", port);

    let id = Uuid::new_v4();
    SiemExporter::send_cef_udp(&target, id, "XSS Detected", Severity::High, "10.0.0.2")
        .await
        .unwrap();

    let mut buf = [0u8; 1024];
    let (len, _) = receiver.recv_from(&mut buf).await.unwrap();
    let received_str = String::from_utf8_lossy(&buf[..len]);

    assert!(received_str.contains("CEF:0|SentinelSecurity"));
    assert!(received_str.contains("XSS Detected"));
}

#[test]
fn test_tenant_manager_isolation() {
    let mgr = TenantManager::new();
    let tenant_id = mgr.register_tenant("Acme Corp");

    assert!(mgr
        .add_project_to_tenant(tenant_id, "project_alpha")
        .is_ok());
    assert!(mgr
        .verify_tenant_access(tenant_id, "project_alpha")
        .unwrap());
    assert!(!mgr.verify_tenant_access(tenant_id, "project_beta").unwrap());
}
