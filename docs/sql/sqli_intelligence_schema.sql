
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
