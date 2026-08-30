"""
==============================================================================
SENTINEL V6 — ADVERSARIAL STRESS TEST & EDGE-CASE HARNESS
==============================================================================
File: test_adversarial_stress.py
Author: challenger_1 (Empirical Challenger)
Description:
    Adversarial challenge suite stress-testing SentinelV6Validator across:
    1. Malformed syntax, invalid types, and empty inputs (Step 1)
    2. Dangling cross-references, broken FKs, missing events/traits (Step 2)
    3. Arithmetic anomalies, count tampering, duplicate IDs, invalid tiers (Step 3)
    4. Lifecycle pipeline corruption, missing core/supporting entities, scope violations (Step 4)
    5. Rust scaffolding mutations, missing structs/traits/fields (Step 5)
    6. Protobuf service/RPC mutations, missing UiStream oneof variants (Step 6)
    7. SQLite pragma violations, dropped tables/columns (Step 7)
    8. Manifest table tampering, obsolete subsystem leaks, dead links (Step 8)
    9. Security invariant omissions and keyword stripping (Step 9)
    10. Dependency DAG cycles, research-to-core/pro/adapter leaks, tier inversions (Step 10)
    11. Fail-closed exit code and report verification (Step 11)
==============================================================================
"""

import copy
import json
import pytest
import yaml
from pathlib import Path

from validate_v6_spec import (
    SentinelV6Validator,
    RustParser,
    ProtoParser,
    SqlParser,
    Severity,
    Disposition
)

V6_DIR = Path(__file__).resolve().parent.parent
CANONICAL_SPEC = V6_DIR / "V6_CANONICAL_SPEC.yaml"
CANONICAL_SCHEMA = V6_DIR / "V6_CANONICAL_SPEC_SCHEMA.yaml"


@pytest.fixture(scope="module")
def base_spec():
    with open(CANONICAL_SPEC, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def create_validator_with_spec_mutation(tmp_path, mutated_spec, schema_path=None):
    spec_file = tmp_path / "mutated_spec.yaml"
    with open(spec_file, "w", encoding="utf-8") as f:
        yaml.dump(mutated_spec, f)
    v = SentinelV6Validator(
        spec_path=str(spec_file),
        schema_path=str(schema_path or CANONICAL_SCHEMA),
        workspace_dir=str(V6_DIR)
    )
    return v, spec_file


# ==============================================================================
# 1. PARSER STRESS TESTS & SYNTACTIC BOUNDARY CASES
# ==============================================================================

class TestParserAdversarial:
    def test_rust_parser_with_attributes_and_comments(self):
        rust_src = """
        // Top-level comment
        /* Multiline comment pub struct FakeStruct { pub bad: u32 } */
        #[derive(Debug, Clone, Serialize, Deserialize)]
        pub struct RealStruct {
            #[serde(rename = "custom_name")]
            pub real_field: String,
            pub nested_field: Vec<u8>,
        }
        #[repr(C)]
        pub enum RealEnum {
            Alpha,
            Beta,
            Gamma,
        }
        pub trait RealTrait {
            async fn do_something(&self) -> Result<(), Error>;
            fn sync_action(&mut self, val: u64) -> bool;
        }
        """
        parsed = RustParser.parse(rust_src)
        assert "RealStruct" in parsed["structs"]
        assert "FakeStruct" not in parsed["structs"]
        assert "real_field" in parsed["structs"]["RealStruct"]
        assert "nested_field" in parsed["structs"]["RealStruct"]
        assert "RealEnum" in parsed["enums"]
        assert set(parsed["enums"]["RealEnum"]) == {"Alpha", "Beta", "Gamma"}
        assert "RealTrait" in parsed["traits"]
        assert "do_something" in parsed["traits"]["RealTrait"]
        assert "sync_action" in parsed["traits"]["RealTrait"]

    def test_proto_parser_with_nested_blocks_and_oneofs(self):
        proto_src = """
        syntax = "proto3";
        // Comment service FakeService {}
        service GenuineService {
            rpc Process(ProcessReq) returns (ProcessResp);
            rpc StreamEvents(StreamReq) returns (stream StreamResp);
        }
        message OuterMessage {
            string id = 1;
            oneof payload {
                string text_payload = 2;
                bytes binary_payload = 3;
            }
            repeated int64 tags = 4;
        }
        enum GenuineEnum {
            UNKNOWN = 0;
            ACTIVE = 1;
        }
        """
        parsed = ProtoParser.parse(proto_src)
        assert "GenuineService" in parsed["services"]
        assert "FakeService" not in parsed["services"]
        assert "Process" in parsed["services"]["GenuineService"]
        assert "OuterMessage" in parsed["messages"]
        assert "id" in parsed["messages"]["OuterMessage"]["fields"]
        assert "tags" in parsed["messages"]["OuterMessage"]["fields"]
        assert "payload" in parsed["messages"]["OuterMessage"]["oneofs"]
        assert "text_payload" in parsed["messages"]["OuterMessage"]["oneofs"]["payload"]
        assert "GenuineEnum" in parsed["enums"]

    def test_sql_parser_with_case_insensitivity_and_multiline(self):
        sql_src = """
        -- SQLite schema comments
        PRAGMA journal_mode = WAL;
        pragma synchronous = normal;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS alpha_table (
            id TEXT PRIMARY KEY,
            created_at DATETIME NOT NULL,
            parent_id TEXT,
            FOREIGN KEY (parent_id) REFERENCES beta_table(id) ON DELETE CASCADE
        );

        create unique index idx_alpha_created on alpha_table(created_at);
        """
        parsed = SqlParser.parse(sql_src)
        assert parsed["pragmas"]["journal_mode"] == "wal"
        assert parsed["pragmas"]["synchronous"] == "normal"
        assert parsed["pragmas"]["foreign_keys"] == "on"
        assert "alpha_table" in parsed["tables"]
        assert "id" in parsed["tables"]["alpha_table"]["columns"]
        assert parsed["tables"]["alpha_table"]["columns"]["id"]["primary_key"] is True
        assert len(parsed["tables"]["alpha_table"]["foreign_keys"]) == 1
        assert parsed["tables"]["alpha_table"]["foreign_keys"][0]["foreign_table"] == "beta_table"
        assert "idx_alpha_created" in parsed["indexes"]
        assert parsed["indexes"]["idx_alpha_created"]["unique"] is True


# ==============================================================================
# 2. STEP 1: SCHEMA VALIDATION ADVERSARIAL STRESS
# ==============================================================================

class TestStep1SchemaAdversarial:
    def test_missing_metadata_block(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        del spec["metadata"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        res = v.validate_step1_schema()
        assert not res.passed
        assert res.blocker_count > 0
        assert any(i.code == "ERR_SCHEMA_VALIDATION" for i in res.issues)

    def test_corrupted_subsystem_taxonomy_type(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["taxonomy"]["core_count"] = "fourteen"  # string instead of integer
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        res = v.validate_step1_schema()
        assert not res.passed
        assert any(i.code == "ERR_SCHEMA_VALIDATION" for i in res.issues)

    def test_empty_yaml_file(self, tmp_path):
        spec_file = tmp_path / "empty.yaml"
        spec_file.write_text("", encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(spec_file), schema_path=str(CANONICAL_SCHEMA))
        res = v.validate_step1_schema()
        assert not res.passed
        assert res.blocker_count > 0

    def test_malformed_yaml_syntax(self, tmp_path):
        spec_file = tmp_path / "syntax_error.yaml"
        spec_file.write_text("version: [unclosed list", encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(spec_file), schema_path=str(CANONICAL_SCHEMA))
        res = v.validate_step1_schema()
        assert not res.passed
        assert any(i.code == "ERR_SPEC_YAML_PARSE" for i in res.issues)


# ==============================================================================
# 3. STEP 2: INTERNAL REFERENCE INTEGRITY ADVERSARIAL STRESS
# ==============================================================================

class TestStep2InternalReferencesAdversarial:
    def test_dangling_subsystem_dependency(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["dependencies"].append("GhostSubsystem")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_UNKNOWN_SUBSYSTEM_DEPENDENCY" and "GhostSubsystem" in i.message for i in res.issues)

    def test_dangling_emitted_event(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["events_emitted"].append("Event_PhantomFired")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_UNKNOWN_EMITTED_EVENT" and "Event_PhantomFired" in i.message for i in res.issues)

    def test_dangling_consumed_event(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["events_consumed"].append("Event_PhantomConsumed")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_UNKNOWN_CONSUMED_EVENT" and "Event_PhantomConsumed" in i.message for i in res.issues)

    def test_dangling_provided_trait(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["traits_provided"].append("Trait_NonExistent")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_UNKNOWN_PROVIDED_TRAIT" for i in res.issues)

    def test_dangling_consumed_trait(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["traits_consumed"].append("Trait_PhantomConsumer")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_UNKNOWN_CONSUMED_TRAIT" for i in res.issues)

    def test_broken_foreign_key_table_reference(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["storage"]["sqlite"]["tables"][0]["foreign_keys"] = [{
            "column": "id",
            "foreign_table": "phantom_table_xyz",
            "foreign_column": "id"
        }]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_BROKEN_SPEC_FK_TABLE" for i in res.issues)

    def test_broken_foreign_key_column_reference(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["storage"]["sqlite"]["tables"][0]["foreign_keys"] = [{
            "column": "id",
            "foreign_table": "transactions",
            "foreign_column": "ghost_column_xyz"
        }]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step2_internal_references()
        assert not res.passed
        assert any(i.code == "ERR_BROKEN_SPEC_FK_COLUMN" for i in res.issues)


# ==============================================================================
# 4. STEP 3: TAXONOMY & ARITHMETIC ADVERSARIAL STRESS
# ==============================================================================

class TestStep3TaxonomyAdversarial:
    def test_tampered_core_count(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["taxonomy"]["core_count"] = 15
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step3_taxonomy_and_arithmetic()
        assert not res.passed
        assert any(i.code == "ERR_TAXONOMY_COUNT_MISMATCH" for i in res.issues)

    def test_arithmetic_sum_violation(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["taxonomy"]["total_count"] = 29
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step3_taxonomy_and_arithmetic()
        assert not res.passed
        assert any(i.code in ("ERR_TAXONOMY_COUNT_MISMATCH", "ERR_TAXONOMY_ARITHMETIC_INCONSISTENCY") for i in res.issues)

    def test_duplicate_subsystem_id(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][1]["id"] = "SUB-01"
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step3_taxonomy_and_arithmetic()
        assert not res.passed
        assert any(i.code == "ERR_DUPLICATE_SUBSYSTEM_ID" for i in res.issues)

    def test_duplicate_subsystem_name(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][1]["name"] = spec["subsystems"]["definitions"][0]["name"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step3_taxonomy_and_arithmetic()
        assert not res.passed
        assert any(i.code == "ERR_DUPLICATE_SUBSYSTEM_NAME" for i in res.issues)

    def test_invalid_subsystem_id_format(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["id"] = "INVALID-01"
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step3_taxonomy_and_arithmetic()
        assert not res.passed
        assert any(i.code == "ERR_INVALID_SUBSYSTEM_ID_FORMAT" for i in res.issues)

    def test_unknown_tier_in_definition(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["definitions"][0]["tier"] = "Quantum"
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step3_taxonomy_and_arithmetic()
        assert not res.passed
        assert any(i.code == "ERR_UNKNOWN_SUBSYSTEM_TIER" for i in res.issues)


# ==============================================================================
# 5. STEP 4: CANONICAL CONTENT COMPLETENESS ADVERSARIAL STRESS
# ==============================================================================

class TestStep4ContentCompletenessAdversarial:
    def test_scrambled_lifecycle_pipeline(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["domain_model"]["lifecycle_pipeline"] = ["Finding", "Evidence", "Candidate", "Observation", "Transaction", "VerificationResult"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_INVALID_LIFECYCLE_PIPELINE" for i in res.issues)

    def test_missing_core_entity(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["domain_model"]["core_entities"] = [e for e in spec["domain_model"]["core_entities"] if e["name"] != "Candidate"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_CORE_ENTITY" and "Candidate" in i.message for i in res.issues)

    def test_missing_supporting_entity(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["domain_model"]["supporting_entities"] = [e for e in spec["domain_model"]["supporting_entities"] if e["name"] != "SecretReference"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_SUPPORTING_ENTITY" and "SecretReference" in i.message for i in res.issues)

    def test_scope_policy_not_default_deny(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["scope_model"]["policy"] = "ALLOW_ALL"
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_SCOPE_DEFAULT_NOT_DENY" for i in res.issues)

    def test_scope_decision_missing_mandatory_field(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["scope_model"]["decision_schema"]["fields"] = [
            f for f in spec["scope_model"]["decision_schema"]["fields"] if f["name"] != "matched_rule"
        ]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_SCOPE_DECISION_FIELD" and "matched_rule" in i.message for i in res.issues)

    def test_missing_security_invariant_sec07(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["security_invariants"]["invariants"] = [
            inv for inv in spec["security_invariants"]["invariants"] if inv["id"] != "SEC-07"
        ]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_SECURITY_INVARIANT" and "SEC-07" in i.message for i in res.issues)

    def test_missing_zero_plaintext_rules(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["credential_security"]["zero_plaintext_rules"] = []
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_ZERO_PLAINTEXT_RULES" for i in res.issues)

    def test_missing_plugin_security_separation(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        del spec["plugin_security"]["capability_set"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step4_canonical_completeness()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_PLUGIN_SECURITY_SEPARATION" for i in res.issues)


# ==============================================================================
# 6. STEP 5: RUST SCAFFOLDING ADVERSARIAL STRESS
# ==============================================================================

class TestStep5RustScaffoldingAdversarial:
    def test_missing_core_entity_struct(self, tmp_path):
        bad_rust = """
        pub struct Observation { pub id: String }
        """
        rust_file = tmp_path / "bad_types.rs"
        rust_file.write_text(bad_rust, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), rust_path=str(rust_file))
        v.validate_step1_schema()
        res = v.validate_step5_rust_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_RUST_CORE_STRUCT" and "Transaction" in i.message for i in res.issues)

    def test_missing_core_entity_field(self, tmp_path):
        rust_code = (V6_DIR / "V6_COMMON_TYPES.rs").read_text(encoding="utf-8")
        corrupt_rust = rust_code.replace("pub response: Option<MessageRepresentation>,", "// removed response")
        rust_file = tmp_path / "corrupt_types.rs"
        rust_file.write_text(corrupt_rust, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), rust_path=str(rust_file))
        v.validate_step1_schema()
        res = v.validate_step5_rust_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_RUST_STRUCT_FIELD" and "response" in i.message for i in res.issues)

    def test_missing_canonical_trait(self, tmp_path):
        rust_code = (V6_DIR / "V6_COMMON_TYPES.rs").read_text(encoding="utf-8")
        corrupt_rust = rust_code.replace("pub trait ScopeEngine", "pub trait DisabledScopeEngine")
        rust_file = tmp_path / "corrupt_traits.rs"
        rust_file.write_text(corrupt_rust, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), rust_path=str(rust_file))
        v.validate_step1_schema()
        res = v.validate_step5_rust_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_RUST_TRAIT" and "ScopeEngine" in i.message for i in res.issues)


# ==============================================================================
# 7. STEP 6: PROTOBUF CONTRACT ADVERSARIAL STRESS
# ==============================================================================

class TestStep6ProtobufAdversarial:
    def test_missing_ipc_service(self, tmp_path):
        proto_code = (V6_DIR / "V6_IPC_CONTRACTS.proto").read_text(encoding="utf-8")
        corrupt_proto = proto_code.replace("service BrowserDaemon", "service DisabledDaemon")
        proto_file = tmp_path / "corrupt.proto"
        proto_file.write_text(corrupt_proto, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), proto_path=str(proto_file))
        v.validate_step1_schema()
        res = v.validate_step6_proto_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_PROTO_SERVICE" and "BrowserDaemon" in i.message for i in res.issues)

    def test_missing_ipc_rpc_method(self, tmp_path):
        proto_code = (V6_DIR / "V6_IPC_CONTRACTS.proto").read_text(encoding="utf-8")
        corrupt_proto = proto_code.replace("rpc Navigate(", "rpc DisabledNavigate(")
        proto_file = tmp_path / "corrupt_rpc.proto"
        proto_file.write_text(corrupt_proto, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), proto_path=str(proto_file))
        v.validate_step1_schema()
        res = v.validate_step6_proto_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_PROTO_RPC" and "Navigate" in i.message for i in res.issues)

    def test_missing_ui_stream_oneof_variant(self, tmp_path):
        proto_code = (V6_DIR / "V6_IPC_CONTRACTS.proto").read_text(encoding="utf-8")
        corrupt_proto = proto_code.replace("UiScopeViolationEvent scope_violation = 7;", "// removed scope_violation")
        proto_file = tmp_path / "corrupt_oneof.proto"
        proto_file.write_text(corrupt_proto, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), proto_path=str(proto_file))
        v.validate_step1_schema()
        res = v.validate_step6_proto_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_UI_STREAM_ONEOF" and "scope_violation" in i.message for i in res.issues)


# ==============================================================================
# 8. STEP 7: SQL SCHEMA ADVERSARIAL STRESS
# ==============================================================================

class TestStep7SqlAdversarial:
    def test_bad_pragma_journal_mode(self, tmp_path):
        sql_code = (V6_DIR / "V6_SQLITE_SCHEMA.sql").read_text(encoding="utf-8")
        corrupt_sql = sql_code.replace("PRAGMA journal_mode=WAL;", "PRAGMA journal_mode=DELETE;")
        sql_file = tmp_path / "bad_journal.sql"
        sql_file.write_text(corrupt_sql, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), sql_path=str(sql_file))
        v.validate_step1_schema()
        res = v.validate_step7_sql_conformance()
        assert not res.passed
        assert any(i.code == "ERR_SQL_PRAGMA_MISMATCH" and "journal_mode" in i.message for i in res.issues)

    def test_bad_pragma_foreign_keys(self, tmp_path):
        sql_code = (V6_DIR / "V6_SQLITE_SCHEMA.sql").read_text(encoding="utf-8")
        corrupt_sql = sql_code.replace("PRAGMA foreign_keys=ON;", "PRAGMA foreign_keys=OFF;")
        sql_file = tmp_path / "bad_fk.sql"
        sql_file.write_text(corrupt_sql, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), sql_path=str(sql_file))
        v.validate_step1_schema()
        res = v.validate_step7_sql_conformance()
        assert not res.passed
        assert any(i.code == "ERR_SQL_PRAGMA_MISMATCH" and "foreign_keys" in i.message for i in res.issues)

    def test_missing_core_table_transactions(self, tmp_path):
        sql_code = (V6_DIR / "V6_SQLITE_SCHEMA.sql").read_text(encoding="utf-8")
        corrupt_sql = sql_code.replace("CREATE TABLE transactions", "CREATE TABLE dropped_transactions")
        sql_file = tmp_path / "missing_tbl.sql"
        sql_file.write_text(corrupt_sql, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), sql_path=str(sql_file))
        v.validate_step1_schema()
        res = v.validate_step7_sql_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_CORE_SQL_TABLE" and "transactions" in i.message for i in res.issues)


# ==============================================================================
# 9. STEP 8: MARKDOWN MANIFEST & OBSOLETE NAMES ADVERSARIAL STRESS
# ==============================================================================

class TestStep8MarkdownAdversarial:
    def test_manifest_with_missing_row(self, tmp_path):
        rows = [f"| SUB-{i:02d} | `Subsystem{i}` | Core |" for i in range(1, 28)]
        manifest_text = "# Subsystems\n| ID | Name | Tier |\n|---|---|---|\n" + "\n".join(rows) + "\n"
        (tmp_path / "V6_FINAL_SUBSYSTEM_MANIFEST.md").write_text(manifest_text, encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), workspace_dir=str(tmp_path))
        v.validate_step1_schema()
        res = v.validate_step8_markdown_conformance()
        assert not res.passed
        assert any(i.code == "ERR_MANIFEST_ROW_COUNT_MISMATCH" for i in res.issues)

    def test_obsolete_name_leak_detection(self, tmp_path):
        rows = [f"| SUB-{i:02d} | `Subsystem{i}` | Core |" for i in range(1, 29)]
        manifest_text = "# Subsystems\n| ID | Name | Tier |\n|---|---|---|\n" + "\n".join(rows) + "\n"
        (tmp_path / "V6_FINAL_SUBSYSTEM_MANIFEST.md").write_text(manifest_text, encoding="utf-8")
        (tmp_path / "leaked_doc.md").write_text("Old architecture used TargetManager for discovery.", encoding="utf-8")
        v = SentinelV6Validator(spec_path=str(CANONICAL_SPEC), workspace_dir=str(tmp_path))
        v.validate_step1_schema()
        res = v.validate_step8_markdown_conformance()
        assert any(i.code == "WARN_OBSOLETE_SUBSYSTEM_MENTION" and "TargetManager" in i.message for i in res.issues)


# ==============================================================================
# 10. STEP 9: SECURITY INVARIANTS ADVERSARIAL STRESS
# ==============================================================================

class TestStep9SecurityInvariantsAdversarial:
    def test_missing_sec01_invariant(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["security_invariants"]["invariants"] = [inv for inv in spec["security_invariants"]["invariants"] if inv["id"] != "SEC-01"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step9_security_invariants()
        assert not res.passed
        assert any(i.code == "ERR_MISSING_SECURITY_INVARIANT" and "SEC-01" in i.message for i in res.issues)

    def test_incomplete_invariant_fields(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        for inv in spec["security_invariants"]["invariants"]:
            if inv["id"] == "SEC-02":
                inv["verification_test"] = ""  # empty verification test
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step9_security_invariants()
        assert not res.passed
        assert any(i.code == "ERR_INCOMPLETE_SECURITY_INVARIANT" and "SEC-02" in i.message for i in res.issues)


# ==============================================================================
# 11. STEP 10: DEPENDENCY GRAPH & ARCHITECTURAL BOUNDARY ADVERSARIAL STRESS
# ==============================================================================

class TestStep10DependencyGraphAdversarial:
    def test_2_node_circular_dependency(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        for s in spec["subsystems"]["definitions"]:
            if s["name"] == "ProxyEngine":
                s["dependencies"] = ["ScopeEngine"]
            elif s["name"] == "ScopeEngine":
                s["dependencies"] = ["ProxyEngine"]
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step10_dependency_graph()
        assert not res.passed
        assert any(i.code == "ERR_DEPENDENCY_CYCLE_DETECTED" for i in res.issues)

    def test_multi_node_circular_dependency(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        for s in spec["subsystems"]["definitions"]:
            if s["name"] == "ScanOrchestrator":
                s["dependencies"].append("ScopeEngine")
            elif s["name"] == "ScopeEngine":
                s["dependencies"].append("EventBus")
            elif s["name"] == "EventBus":
                s["dependencies"].append("ProxyEngine")
            elif s["name"] == "ProxyEngine":
                s["dependencies"].append("ScanOrchestrator")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step10_dependency_graph()
        assert not res.passed
        assert any(i.code == "ERR_DEPENDENCY_CYCLE_DETECTED" for i in res.issues)

    def test_research_to_core_leak_injection(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        for s in spec["subsystems"]["definitions"]:
            if s["name"] == "ScanOrchestrator":
                s["dependencies"].append("SmtSolverEngine")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step10_dependency_graph()
        assert not res.passed
        assert any(i.code == "ERR_RESEARCH_TIER_DEPENDENCY_VIOLATION" and "ScanOrchestrator" in i.message and "SmtSolverEngine" in i.message for i in res.issues)

    def test_research_to_pro_leak_injection(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        for s in spec["subsystems"]["definitions"]:
            if s["name"] == "BrowserService":
                s["dependencies"].append("RlStateEngine")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step10_dependency_graph()
        assert not res.passed
        assert any(i.code == "ERR_RESEARCH_TIER_DEPENDENCY_VIOLATION" and "BrowserService" in i.message for i in res.issues)

    def test_core_to_pro_tier_inversion_injection(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        for s in spec["subsystems"]["definitions"]:
            if s["name"] == "ProxyEngine":
                s["dependencies"].append("BrowserService")
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        v.validate_step1_schema()
        res = v.validate_step10_dependency_graph()
        assert not res.passed
        assert any(i.code == "ERR_CORE_TIER_VIOLATION" and "ProxyEngine" in i.message for i in res.issues)


# ==============================================================================
# 12. STEP 11 & FAIL-CLOSED VERDICT INTEGRATION
# ==============================================================================

class TestStep11FailClosedVerdict:
    def test_clean_spec_passes_with_zero_exit_code(self):
        v = SentinelV6Validator(
            spec_path=str(CANONICAL_SPEC),
            schema_path=str(CANONICAL_SCHEMA),
            workspace_dir=str(V6_DIR)
        )
        exit_code, report = v.run_all()
        assert exit_code == 0
        assert "🟢 **PASS (ZERO BLOCKERS)**" in report
        assert "**Blockers Count**: `0`" in report

    def test_blocker_fails_closed_with_error_exit_code(self, tmp_path, base_spec):
        spec = copy.deepcopy(base_spec)
        spec["subsystems"]["taxonomy"]["total_count"] = 999  # Blocker
        v, _ = create_validator_with_spec_mutation(tmp_path, spec)
        exit_code, report = v.run_all()
        assert exit_code >= 2
        assert "🔴 **FAIL (BLOCKERS DETECTED)**" in report
        assert "ERR_TAXONOMY_COUNT_MISMATCH" in report
