"""
==============================================================================
SENTINEL V6 — SPECIFICATION CONFORMANCE VALIDATOR TEST SUITE
==============================================================================
File: test_validator.py
Authority: Authoritative Unit Test Suite for validate_v6_spec.py
Description:
    Comprehensive unit tests and negative fixture tests proving genuine logic,
    complete 11-step validation coverage, and fail-closed behavior.
==============================================================================
"""

import os
import sys
import json
import pytest
import subprocess
from pathlib import Path

# Add v6 directory to path to import validator
V6_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(V6_DIR))

from validate_v6_spec import (
    SentinelV6Validator,
    RustParser,
    ProtoParser,
    SqlParser,
    Severity,
    Disposition,
    ValidationIssue
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
CANONICAL_SPEC = V6_DIR / "V6_CANONICAL_SPEC.yaml"
CANONICAL_SCHEMA = V6_DIR / "V6_CANONICAL_SPEC_SCHEMA.yaml"


# ==============================================================================
# 1. PARSER UNIT TESTS (Rust, Proto, SQL)
# ==============================================================================

def test_rust_parser():
    rust_code = """
    pub struct Transaction {
        pub meta: EntityMetadata,
        pub request: MessageRepresentation,
        pub response: Option<MessageRepresentation>,
    }
    pub enum HttpMethod { GET, POST, PUT, DELETE }
    pub trait HttpParser {
        fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError>;
        async fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError>;
    }
    """
    parsed = RustParser.parse(rust_code)
    assert "Transaction" in parsed["structs"]
    assert "meta" in parsed["structs"]["Transaction"]
    assert "request" in parsed["structs"]["Transaction"]
    assert "response" in parsed["structs"]["Transaction"]

    assert "HttpMethod" in parsed["enums"]
    assert set(parsed["enums"]["HttpMethod"]) == {"GET", "POST", "PUT", "DELETE"}

    assert "HttpParser" in parsed["traits"]
    assert "parse_request" in parsed["traits"]["HttpParser"]
    assert "parse_response" in parsed["traits"]["HttpParser"]


def test_proto_parser():
    proto_code = """
    syntax = "proto3";
    service BrowserDaemon {
        rpc Navigate(NavigateRequest) returns (NavigateResponse);
    }
    message NavigateRequest {
        string url = 1;
        int32 timeout_ms = 2;
    }
    message SentinelUiStream {
        oneof event {
            UiTrafficEvent traffic = 1;
            UiFindingEvent finding = 2;
        }
    }
    enum Severity {
        SEVERITY_UNSPECIFIED = 0;
        SEVERITY_CRITICAL = 1;
    }
    """
    parsed = ProtoParser.parse(proto_code)
    assert "BrowserDaemon" in parsed["services"]
    assert "Navigate" in parsed["services"]["BrowserDaemon"]
    assert parsed["services"]["BrowserDaemon"]["Navigate"]["input"] == "NavigateRequest"

    assert "NavigateRequest" in parsed["messages"]
    assert "url" in parsed["messages"]["NavigateRequest"]["fields"]
    assert parsed["messages"]["NavigateRequest"]["fields"]["url"]["tag"] == 1

    assert "SentinelUiStream" in parsed["messages"]
    assert "event" in parsed["messages"]["SentinelUiStream"]["oneofs"]
    assert "traffic" in parsed["messages"]["SentinelUiStream"]["oneofs"]["event"]

    assert "Severity" in parsed["enums"]
    assert parsed["enums"]["Severity"]["SEVERITY_CRITICAL"] == 1


def test_sql_parser():
    sql_code = """
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE scopes (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        timestamp DATETIME NOT NULL
    );

    CREATE TABLE graph_edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX idx_endpoints_unique ON endpoints(host, path, method);
    """
    parsed = SqlParser.parse(sql_code)
    assert parsed["pragmas"]["journal_mode"] == "wal"
    assert parsed["pragmas"]["synchronous"] == "normal"
    assert parsed["pragmas"]["foreign_keys"] == "on"

    assert "scopes" in parsed["tables"]
    assert "id" in parsed["tables"]["scopes"]["columns"]
    assert parsed["tables"]["scopes"]["columns"]["id"]["primary_key"] is True

    assert "graph_edges" in parsed["tables"]
    assert len(parsed["tables"]["graph_edges"]["foreign_keys"]) == 1
    fk = parsed["tables"]["graph_edges"]["foreign_keys"][0]
    assert fk["column"] == "source_id"
    assert fk["foreign_table"] == "graph_nodes"
    assert fk["foreign_column"] == "id"
    assert fk["on_delete"] == "CASCADE"

    assert "idx_endpoints_unique" in parsed["indexes"]
    assert parsed["indexes"]["idx_endpoints_unique"]["unique"] is True


# ==============================================================================
# 2. STEP 1: SCHEMA VALIDATION TESTS
# ==============================================================================

def test_step1_valid_schema():
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), schema_path=str(CANONICAL_SCHEMA))
    res = validator.validate_step1_schema()
    assert res.passed is True
    assert res.blocker_count == 0


def test_step1_invalid_schema():
    spec_path = FIXTURES_DIR / "bad_schema_missing_subsystems.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path), schema_path=str(CANONICAL_SCHEMA))
    res = validator.validate_step1_schema()
    assert res.passed is False
    assert res.blocker_count >= 1
    assert any(i.code == "ERR_SCHEMA_VALIDATION" for i in res.issues)


def test_step1_file_not_found():
    validator = SentinelV6Validator(spec_path="non_existent_spec.yaml")
    res = validator.validate_step1_schema()
    assert res.passed is False
    assert res.blocker_count >= 1
    assert any(i.code == "ERR_SPEC_NOT_FOUND" for i in res.issues)


# ==============================================================================
# 3. STEP 2: INTERNAL REFERENCE INTEGRITY TESTS
# ==============================================================================

def test_step2_valid_internal_refs():
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC))
    validator.validate_step1_schema()
    res = validator.validate_step2_internal_references()
    assert res.passed is True
    assert res.blocker_count == 0


def test_step2_broken_subsystem_dependency():
    spec_path = FIXTURES_DIR / "broken_internal_ref_dependency.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    validator.validate_step1_schema()
    res = validator.validate_step2_internal_references()
    assert res.passed is False
    assert any(i.code == "ERR_UNKNOWN_SUBSYSTEM_DEPENDENCY" for i in res.issues)


def test_step2_broken_foreign_key_in_spec():
    spec_path = FIXTURES_DIR / "broken_internal_ref_fk.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    validator.validate_step1_schema()
    res = validator.validate_step2_internal_references()
    assert res.passed is False
    assert any(i.code == "ERR_BROKEN_SPEC_FK_TABLE" for i in res.issues)


# ==============================================================================
# 4. STEP 3: TAXONOMY AND ARITHMETIC TESTS
# ==============================================================================

def test_step3_valid_taxonomy():
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC))
    validator.validate_step1_schema()
    res = validator.validate_step3_taxonomy_and_arithmetic()
    assert res.passed is True
    assert res.blocker_count == 0
    assert res.details["tier_counts"] == {"Core": 14, "Professional": 7, "Adapter": 4, "Research": 3}


def test_step3_broken_taxonomy_counts():
    spec_path = FIXTURES_DIR / "broken_taxonomy_counts.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    validator.validate_step1_schema()
    res = validator.validate_step3_taxonomy_and_arithmetic()
    assert res.passed is False
    assert any(i.code == "ERR_TAXONOMY_COUNT_MISMATCH" for i in res.issues)


def test_step3_duplicate_subsystem_id():
    spec_path = FIXTURES_DIR / "broken_taxonomy_duplicate_id.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    validator.validate_step1_schema()
    res = validator.validate_step3_taxonomy_and_arithmetic()
    assert res.passed is False
    assert any(i.code == "ERR_DUPLICATE_SUBSYSTEM_ID" for i in res.issues)


# ==============================================================================
# 5. STEP 4: CANONICAL CONTENT COMPLETENESS TESTS
# ==============================================================================

def test_step4_canonical_completeness():
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC))
    validator.validate_step1_schema()
    res = validator.validate_step4_canonical_completeness()
    assert res.passed is True
    assert res.blocker_count == 0


# ==============================================================================
# 6. STEP 5: RUST CONTRACT CONFORMANCE TESTS
# ==============================================================================

def test_step5_missing_rust_core_struct():
    rust_path = FIXTURES_DIR / "broken_rust_missing_struct.rs"
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), rust_path=str(rust_path))
    validator.validate_step1_schema()
    res = validator.validate_step5_rust_conformance()
    assert res.passed is False
    assert any(i.code == "ERR_MISSING_RUST_CORE_STRUCT" for i in res.issues)


# ==============================================================================
# 7. STEP 6: PROTOBUF/IPC CONTRACT TESTS
# ==============================================================================

def test_step6_missing_proto_service():
    proto_path = FIXTURES_DIR / "broken_proto_missing_service.proto"
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), proto_path=str(proto_path))
    validator.validate_step1_schema()
    res = validator.validate_step6_proto_conformance()
    assert res.passed is False
    assert any(i.code == "ERR_MISSING_PROTO_SERVICE" for i in res.issues)


# ==============================================================================
# 8. STEP 7: SQL SCHEMA CONFORMANCE TESTS
# ==============================================================================

def test_step7_bad_pragma_and_missing_tables():
    sql_path = FIXTURES_DIR / "broken_sql_bad_pragma.sql"
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), sql_path=str(sql_path))
    validator.validate_step1_schema()
    res = validator.validate_step7_sql_conformance()
    assert res.passed is False
    assert any(i.code == "ERR_SQL_PRAGMA_MISMATCH" for i in res.issues)
    assert any(i.code == "ERR_MISSING_CORE_SQL_TABLE" for i in res.issues)


# ==============================================================================
# 9. STEP 8: MARKDOWN REGISTRIES & OBSOLETE NAMES TESTS
# ==============================================================================

def test_step8_markdown_manifest_and_links(tmp_path):
    manifest_content = "| ID | Name | Tier |\n|---|---|---|\n" + "\n".join([f"| SUB-{i:02d} | `Sub{i}` | Core |" for i in range(1, 29)])
    (tmp_path / "V6_FINAL_SUBSYSTEM_MANIFEST.md").write_text(manifest_content, encoding='utf-8')
    (tmp_path / "broken_link.md").write_text("[Missing](missing.md)", encoding='utf-8')
    (tmp_path / "obsolete.md").write_text("Uses TargetManager for assets", encoding='utf-8')

    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), workspace_dir=str(tmp_path))
    validator.validate_step1_schema()
    res = validator.validate_step8_markdown_conformance()
    assert any(i.code == "WARN_OBSOLETE_SUBSYSTEM_MENTION" for i in res.issues)
    assert any(i.code == "WARN_BROKEN_LOCAL_LINK" for i in res.issues)


# ==============================================================================
# 10. STEP 9: SECURITY INVARIANTS TESTS
# ==============================================================================

def test_step9_security_invariants():
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC))
    validator.validate_step1_schema()
    res = validator.validate_step9_security_invariants()
    assert res.passed is True
    assert res.blocker_count == 0


# ==============================================================================
# 11. STEP 10: DEPENDENCY DAG & TIER ISOLATION TESTS
# ==============================================================================

def test_step10_dag_valid():
    validator = SentinelV6Validator(spec_path=str(CANONICAL_SPEC))
    validator.validate_step1_schema()
    res = validator.validate_step10_dependency_graph()
    assert res.passed is True
    assert res.blocker_count == 0


def test_step10_dependency_cycle():
    spec_path = FIXTURES_DIR / "broken_graph_cycle.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    validator.validate_step1_schema()
    res = validator.validate_step10_dependency_graph()
    assert res.passed is False
    assert any(i.code == "ERR_DEPENDENCY_CYCLE_DETECTED" for i in res.issues)


def test_step10_research_to_core_violation():
    spec_path = FIXTURES_DIR / "broken_graph_research_to_core.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    validator.validate_step1_schema()
    res = validator.validate_step10_dependency_graph()
    assert res.passed is False
    assert any(i.code == "ERR_RESEARCH_TIER_DEPENDENCY_VIOLATION" for i in res.issues)


# ==============================================================================
# 12. STEP 11 & FAIL-CLOSED INTEGRATION TESTS
# ==============================================================================

def test_fail_closed_on_bad_inputs():
    spec_path = FIXTURES_DIR / "bad_schema_missing_subsystems.yaml"
    validator = SentinelV6Validator(spec_path=str(spec_path))
    exit_code, report_md = validator.run_all()
    assert exit_code >= 2  # Fails closed on blockers
    assert "🔴 **FAIL" in report_md


def test_cli_execution_json_and_file_output(tmp_path):
    validator_script = V6_DIR / "validate_v6_spec.py"
    report_file = tmp_path / "output_report.md"
    
    result = subprocess.run(
        [
            sys.executable, str(validator_script),
            "--spec", str(CANONICAL_SPEC),
            "--json",
            "--workspace", str(V6_DIR),
            "--output-report", str(report_file)
        ],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    assert result.stdout.strip() != ""
    data = json.loads(result.stdout)
    assert "steps" in data
    assert len(data["steps"]) == 11
    assert "exit_code" in data
    assert report_file.exists()
    assert "SENTINEL V6 — SPECIFICATION CONFORMANCE VALIDATION REPORT" in report_file.read_text(encoding='utf-8')
