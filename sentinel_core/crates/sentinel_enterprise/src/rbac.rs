//! Enterprise RBAC & Permissions Model

use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UserRole {
    Admin,
    Auditor,
    Pentester,
    Viewer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Permission {
    ReadFindings,
    ExecuteActiveScan,
    ConfigureScope,
    ExportData,
    ManageUsers,
}

pub struct RbacManager;

impl RbacManager {
    pub fn get_permissions(role: UserRole) -> HashSet<Permission> {
        let mut perms = HashSet::new();
        match role {
            UserRole::Admin => {
                perms.insert(Permission::ReadFindings);
                perms.insert(Permission::ExecuteActiveScan);
                perms.insert(Permission::ConfigureScope);
                perms.insert(Permission::ExportData);
                perms.insert(Permission::ManageUsers);
            }
            UserRole::Pentester => {
                perms.insert(Permission::ReadFindings);
                perms.insert(Permission::ExecuteActiveScan);
                perms.insert(Permission::ConfigureScope);
                perms.insert(Permission::ExportData);
            }
            UserRole::Auditor => {
                perms.insert(Permission::ReadFindings);
                perms.insert(Permission::ExportData);
            }
            UserRole::Viewer => {
                perms.insert(Permission::ReadFindings);
            }
        }
        perms
    }

    pub fn has_permission(role: UserRole, permission: Permission) -> bool {
        Self::get_permissions(role).contains(&permission)
    }
}
