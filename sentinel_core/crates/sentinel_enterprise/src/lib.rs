//! SENTINEL V6: Enterprise Integration Subsystem (WP-20.1)
//!
//! Provides enterprise multi-tenancy isolation (SEC-08), RBAC role/permission management,
//! and SIEM event streaming (CEF / Syslog RFC 5424, SEC-12).

pub mod rbac;
pub mod siem;
pub mod tenant;

pub use rbac::{Permission, RbacManager, UserRole};
pub use siem::SiemExporter;
pub use tenant::{TenantContext, TenantManager};
