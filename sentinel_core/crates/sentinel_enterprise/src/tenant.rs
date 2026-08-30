//! Multi-Tenant Isolation Manager (SEC-08)

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone)]
pub struct TenantContext {
    pub tenant_id: Uuid,
    pub name: String,
    pub active_projects: Vec<String>,
}

pub struct TenantManager {
    tenants: Arc<RwLock<HashMap<Uuid, TenantContext>>>,
}

impl TenantManager {
    pub fn new() -> Self {
        Self {
            tenants: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn register_tenant(&self, name: &str) -> Uuid {
        let tenant_id = Uuid::new_v4();
        let ctx = TenantContext {
            tenant_id,
            name: name.to_string(),
            active_projects: Vec::new(),
        };
        self.tenants.write().insert(tenant_id, ctx);
        tenant_id
    }

    pub fn add_project_to_tenant(
        &self,
        tenant_id: Uuid,
        project_slug: &str,
    ) -> Result<(), SentinelError> {
        let mut guard = self.tenants.write();
        let tenant = guard.get_mut(&tenant_id).ok_or_else(|| {
            SentinelError::InvariantViolation(format!("Tenant {} not found", tenant_id))
        })?;

        tenant.active_projects.push(project_slug.to_string());
        Ok(())
    }

    pub fn verify_tenant_access(
        &self,
        tenant_id: Uuid,
        project_slug: &str,
    ) -> Result<bool, SentinelError> {
        let guard = self.tenants.read();
        let tenant = guard.get(&tenant_id).ok_or_else(|| {
            SentinelError::InvariantViolation(format!("Tenant {} not found", tenant_id))
        })?;

        Ok(tenant.active_projects.iter().any(|p| p == project_slug))
    }
}

impl Default for TenantManager {
    fn default() -> Self {
        Self::new()
    }
}
