//! SENTINEL Autonomous SQL Security Engine — DBMS Hypothesis Engine (M09)
//!
//! Maintains multi-hypothesis probability distributions across 32 database
//! engine architectures, evaluating dialect fingerprints and error signatures.

use std::collections::HashMap;
use crate::sql::models::BeliefDistribution;

pub struct DbmsHypothesisEngine;

impl DbmsHypothesisEngine {
    /// Initializes a uniform prior belief distribution across the 32 supported DBMS engines
    pub fn initial_belief() -> BeliefDistribution {
        let engines = vec![
            "DBMS-PG", "DBMS-MYSQL", "DBMS-MARIADB", "DBMS-MSSQL", "DBMS-ORACLE", "DBMS-SQLITE",
            "DBMS-DB2", "DBMS-HANA", "DBMS-CRDB", "DBMS-TIDB", "DBMS-YUGABYTE", "DBMS-DUCKDB",
            "DBMS-SNOWFLAKE", "DBMS-REDSHIFT", "DBMS-BIGQUERY", "DBMS-CLICKHOUSE", "DBMS-DATABRICKS",
            "DBMS-TRINO", "DBMS-FIREBIRD", "DBMS-H2", "DBMS-DERBY", "DBMS-HSQLDB", "DBMS-INFORMIX",
            "DBMS-VERTICA", "DBMS-SPANNER", "DBMS-SCYLLA", "DBMS-AURORA-PG", "DBMS-AURORA-MY",
            "DBMS-AZURE-SQL", "DBMS-SINGLESTORE", "DBMS-QUESTDB", "DBMS-TIMESCALE",
        ];

        let mut dist = BeliefDistribution::uniform(&engines);
        // Default slight web priors for top relational systems
        dist.set("DBMS-PG".to_string(), 0.30);
        dist.set("DBMS-MYSQL".to_string(), 0.30);
        dist.set("DBMS-MSSQL".to_string(), 0.15);
        dist.set("DBMS-SQLITE".to_string(), 0.10);
        dist.set("DBMS-ORACLE".to_string(), 0.05);
        dist.normalize();
        dist
    }

    /// Analyzes raw error strings or response artifacts to compute DBMS likelihoods
    pub fn match_error_signature(error_body: &str) -> HashMap<String, f64> {
        let mut likelihoods = HashMap::new();
        let lower = error_body.to_lowercase();

        if lower.contains("pg_catalog") || lower.contains("postgresql") || lower.contains("syntax error at or near") || lower.contains("psycopg2") {
            likelihoods.insert("DBMS-PG".to_string(), 0.95);
            likelihoods.insert("DBMS-CRDB".to_string(), 0.85);
            likelihoods.insert("DBMS-TIMESCALE".to_string(), 0.90);
            likelihoods.insert("DBMS-AURORA-PG".to_string(), 0.90);
            likelihoods.insert("DBMS-YUGABYTE".to_string(), 0.85);
        } else if lower.contains("you have an error in your sql syntax") || lower.contains("check the manual that corresponds to your mysql") || lower.contains("mariadb") {
            likelihoods.insert("DBMS-MYSQL".to_string(), 0.95);
            likelihoods.insert("DBMS-MARIADB".to_string(), 0.92);
            likelihoods.insert("DBMS-TIDB".to_string(), 0.85);
            likelihoods.insert("DBMS-SINGLESTORE".to_string(), 0.80);
            likelihoods.insert("DBMS-AURORA-MY".to_string(), 0.90);
        } else if lower.contains("unclosed quotation mark after the character string") || lower.contains("microsoft odbc sql server driver") || lower.contains("incorrect syntax near") || lower.contains("sqlexception: ") {
            likelihoods.insert("DBMS-MSSQL".to_string(), 0.95);
            likelihoods.insert("DBMS-AZURE-SQL".to_string(), 0.92);
        } else if lower.contains("ora-01756") || lower.contains("ora-00933") || lower.contains("quoted string not properly terminated") || lower.contains("ora-00904") {
            likelihoods.insert("DBMS-ORACLE".to_string(), 0.98);
        } else if lower.contains("sqlite3::sqlexception") || lower.contains("sqlite error") || lower.contains("near \"\": syntax error") || lower.contains("no such table") {
            likelihoods.insert("DBMS-SQLITE".to_string(), 0.98);
        } else if lower.contains("sql0104n") || lower.contains("db2 sql error") || lower.contains("ibm db2") {
            likelihoods.insert("DBMS-DB2".to_string(), 0.98);
        } else if lower.contains("sap dbtech jdbc") || lower.contains("hana error") || lower.contains("invalid column name") {
            likelihoods.insert("DBMS-HANA".to_string(), 0.95);
        } else if lower.contains("syntax error: unexpected") || lower.contains("snowflake") || lower.contains("001003 (42000)") {
            likelihoods.insert("DBMS-SNOWFLAKE".to_string(), 0.95);
        } else if lower.contains("syntax error, unexpected") && lower.contains("bigquery") {
            likelihoods.insert("DBMS-BIGQUERY".to_string(), 0.95);
        } else if lower.contains("code: 62") || lower.contains("db::exception") || lower.contains("clickhouse") {
            likelihoods.insert("DBMS-CLICKHOUSE".to_string(), 0.98);
        } else if lower.contains("parser error: syntax error at or near") && lower.contains("duckdb") {
            likelihoods.insert("DBMS-DUCKDB".to_string(), 0.95);
        } else if lower.contains("query failed: line") && lower.contains("trino") {
            likelihoods.insert("DBMS-TRINO".to_string(), 0.95);
        } else if lower.contains("dynamic sql error") || lower.contains("firebird") {
            likelihoods.insert("DBMS-FIREBIRD".to_string(), 0.95);
        } else if lower.contains("syntax error in sql statement") && lower.contains("h2") {
            likelihoods.insert("DBMS-H2".to_string(), 0.95);
        }

        likelihoods
    }

    /// Returns the comment sequence for a target DBMS
    pub fn comment_marker(dbms_id: &str) -> &'static str {
        match dbms_id {
            "DBMS-MYSQL" | "DBMS-MARIADB" | "DBMS-TIDB" => "#",
            "DBMS-SCYLLA" => "//",
            "DBMS-BIGQUERY" => "#",
            _ => "-- ",
        }
    }

    /// Returns the string concatenation operator for a target DBMS
    pub fn concat_syntax(dbms_id: &str, a: &str, b: &str) -> String {
        match dbms_id {
            "DBMS-MYSQL" | "DBMS-MARIADB" | "DBMS-TIDB" | "DBMS-BIGQUERY" | "DBMS-DATABRICKS" => {
                format!("CONCAT({}, {})", a, b)
            }
            "DBMS-MSSQL" | "DBMS-AZURE-SQL" => {
                format!("{} + {}", a, b)
            }
            _ => {
                format!("{} || {}", a, b)
            }
        }
    }

    /// Returns the active sleep injection function for a target DBMS
    pub fn sleep_probe(dbms_id: &str, seconds: u32) -> String {
        match dbms_id {
            "DBMS-PG" | "DBMS-CRDB" | "DBMS-YUGABYTE" | "DBMS-AURORA-PG" | "DBMS-TIMESCALE" | "DBMS-REDSHIFT" | "DBMS-DUCKDB" => {
                format!("pg_sleep({})", seconds)
            }
            "DBMS-MYSQL" | "DBMS-MARIADB" | "DBMS-TIDB" | "DBMS-AURORA-MY" | "DBMS-SINGLESTORE" => {
                format!("SLEEP({})", seconds)
            }
            "DBMS-MSSQL" | "DBMS-AZURE-SQL" => {
                format!("WAITFOR DELAY '0:0:{}'", seconds)
            }
            "DBMS-ORACLE" => {
                format!("DBMS_LOCK.SLEEP({})", seconds)
            }
            "DBMS-CLICKHOUSE" | "DBMS-VERTICA" => {
                format!("sleep({})", seconds)
            }
            "DBMS-DB2" => {
                format!("(SELECT COUNT(*) FROM SYSIBM.SYSTABLES WHERE SLEEP({}) = 1)", seconds)
            }
            "DBMS-HANA" => {
                format!("WAITFOR DELAY '0:0:{}'", seconds)
            }
            _ => {
                format!("pg_sleep({})", seconds)
            }
        }
    }
}
