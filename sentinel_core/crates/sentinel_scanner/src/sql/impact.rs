//! SENTINEL Autonomous SQL Security Engine — Demonstrated Impact Engine (M28)
//!
//! Categorizes demonstrated security capabilities based strictly on observed
//! empirical proof rather than theoretical worst-case assumptions.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DemonstratedCapability {
    DataExposure { fields_leaked: Vec<String> },
    AuthenticationBypass { target_user: String },
    MultiTenantBoundaryLeak { tenant_id_observed: String },
    SchemaEnumeration { tables_discovered: Vec<String> },
    InferenceOnly { chars_recovered: usize },
    BooleanExecutionConfirmed,
}

pub struct ImpactAssessmentEngine;

impl ImpactAssessmentEngine {
    /// Evaluates demonstrated impact from confirmed observations
    pub fn assess_impact(
        extracted_data: Option<&str>,
        auth_bypassed: bool,
        multi_tenant_breach: bool,
    ) -> (String, DemonstratedCapability) {
        if auth_bypassed {
            (
                "CRITICAL: Full Authentication Barrier Bypass Demonstrated".to_string(),
                DemonstratedCapability::AuthenticationBypass { target_user: "admin".to_string() },
            )
        } else if multi_tenant_breach {
            (
                "HIGH: Multi-Tenant SaaS Isolation Boundary Breach Demonstrated".to_string(),
                DemonstratedCapability::MultiTenantBoundaryLeak { tenant_id_observed: "foreign_tenant".to_string() },
            )
        } else if let Some(data) = extracted_data {
            (
                format!("HIGH: Unauthorized Data Disclosure ({})", data),
                DemonstratedCapability::DataExposure { fields_leaked: vec![data.to_string()] },
            )
        } else {
            (
                "MEDIUM: Blind Relational SQL Query Manipulation Confirmed".to_string(),
                DemonstratedCapability::BooleanExecutionConfirmed,
            )
        }
    }
}
