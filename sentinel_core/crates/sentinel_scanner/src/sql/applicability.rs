//! SENTINEL Autonomous SQL Security Engine — Applicability Engine (M12)
//!
//! Enforces strict mathematical and architectural compatibility rules between
//! techniques, syntactic AST contexts, DBMS dialects, and observation channels.

use crate::sql::models::{BeliefDistribution, TestIntent};

pub struct ApplicabilityEngine;

impl ApplicabilityEngine {
    /// Determines whether a TestIntent is applicable given current Context and DBMS beliefs
    pub fn is_applicable(
        intent: &TestIntent,
        context_beliefs: &BeliefDistribution,
        dbms_beliefs: &BeliefDistribution,
    ) -> bool {
        // 1. If context probability is established near 0, reject context-incompatible tests
        let ctx_prob = context_beliefs.get(&intent.target_context_id);
        if ctx_prob < 0.01 && context_beliefs.probabilities.len() > 1 {
            return false;
        }

        // 2. If DBMS probability is established near 0, reject DBMS-specific tests
        let dbms_prob = dbms_beliefs.get(&intent.target_dbms_id);
        if dbms_prob < 0.01 && dbms_beliefs.probabilities.len() > 1 {
            return false;
        }

        // 3. Specific Incompatibility Rules:
        // pgvector (<=>) only applicable to PostgreSQL / Timescale
        if intent.technique_id == "TECH-CEIL-49" && !["DBMS-PG", "DBMS-TIMESCALE", "DBMS-CRDB", "DBMS-YUGABYTE"].contains(&intent.target_dbms_id.as_str()) {
            return false;
        }

        // CTE recursive only applicable to engines supporting WITH RECURSIVE
        if intent.technique_id == "TECH-CEIL-53" && intent.target_dbms_id == "DBMS-SCYLLA" {
            return false;
        }

        // RETURNING clause only applicable to PostgreSQL, SQLite, Oracle, CockroachDB
        if intent.technique_id == "TECH-CEIL-56" && ["DBMS-MYSQL", "DBMS-MARIADB"].contains(&intent.target_dbms_id.as_str()) {
            return false;
        }

        true
    }
}
