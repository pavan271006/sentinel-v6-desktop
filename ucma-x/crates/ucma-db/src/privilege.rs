//! Database privilege and access capability model.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabasePrivileges {
    pub current_user: String,
    pub current_database: String,
    pub is_dba_or_superuser: bool,
    pub can_read_metadata: bool,
    pub can_read_data: bool,
    pub can_write_data: bool,
    pub granted_roles: Vec<String>,
}

impl Default for DatabasePrivileges {
    fn default() -> Self {
        Self {
            current_user: "unknown".to_string(),
            current_database: "unknown".to_string(),
            is_dba_or_superuser: false,
            can_read_metadata: false,
            can_read_data: false,
            can_write_data: false,
            granted_roles: Vec::new(),
        }
    }
}
