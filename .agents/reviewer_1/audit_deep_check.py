#!/usr/bin/env python3
"""
Independent Deep Verification & Adversarial Audit Script for Sentinel V6 Architecture.
Executes thorough, unbiased cross-checks across all files.
"""

import os
import re
import sys
import yaml
import json
import hashlib
from pathlib import Path

WORKSPACE = Path(r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6")
SPEC_PATH = WORKSPACE / "V6_CANONICAL_SPEC.yaml"
SCHEMA_PATH = WORKSPACE / "V6_CANONICAL_SPEC_SCHEMA.yaml"
RUST_PATH = WORKSPACE / "V6_COMMON_TYPES.rs"
PROTO_PATH = WORKSPACE / "V6_IPC_CONTRACTS.proto"
SQL_PATH = WORKSPACE / "V6_SQLITE_SCHEMA.sql"
FROZEN_PATH = WORKSPACE / "V6_ARCHITECTURE_FROZEN.md"

def sha256_file(p):
    if not p.exists():
        return "MISSING"
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        while c := f.read(8192):
            h.update(c)
    return h.hexdigest()

def run_audit():
    results = {}
    print("=== STARTING INDEPENDENT AUDIT ===")

    # 1. Load Spec & Schema
    with open(SPEC_PATH, 'r', encoding='utf-8') as f:
        spec = yaml.safe_load(f)
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema = yaml.safe_load(f)

    # 2. Check Subsystems
    subs = spec.get("subsystems", {}).get("definitions", [])
    tax = spec.get("subsystems", {}).get("taxonomy", {})
    tier_counts = {"Core": 0, "Professional": 0, "Adapter": 0, "Research": 0}
    sub_names = []
    sub_ids = []
    for s in subs:
        t = s.get("tier")
        tier_counts[t] = tier_counts.get(t, 0) + 1
        sub_names.append(s.get("name"))
        sub_ids.append(s.get("id"))

    results["subsystem_counts"] = tier_counts
    results["subsystem_total"] = len(subs)
    results["subsystem_ids_unique"] = len(set(sub_ids)) == len(sub_ids)
    results["subsystem_names_unique"] = len(set(sub_names)) == len(sub_names)

    # 3. Check Obsolete Subsystem Names in all architecture files
    obsolete_names = ["TargetManager", "EngineManager", "PluginHost", "TargetDiscoveryEngine", "AuthEngine", "ScannerEngine"]
    found_obsolete = {}
    for p in WORKSPACE.glob("*.*"):
        if p.suffix in ('.md', '.rs', '.proto', '.sql', '.yaml', '.pest'):
            content = p.read_text(encoding='utf-8', errors='ignore')
            for obs in obsolete_names:
                if re.search(r'\b' + obs + r'\b', content):
                    if p.name not in found_obsolete:
                        found_obsolete[p.name] = []
                    found_obsolete[p.name].append(obs)
    results["obsolete_names_found"] = found_obsolete

    # 4. Check 6 Domain Lifecycle Stages
    pipeline = spec.get("domain_model", {}).get("lifecycle_pipeline", [])
    results["lifecycle_pipeline"] = pipeline

    # 5. Check 20 Supporting Entities
    expected_supporting = [
        "Scope", "Endpoint", "Payload", "Identity", "Session", "Credential", "SecretReference",
        "Asset", "Technology", "State", "Workflow", "Resource", "Action", "Task", "Report",
        "RegressionTest", "OASTInteraction", "AttackPath", "Note", "Screenshot"
    ]
    supporting_entities = [e.get("name") for e in spec.get("domain_model", {}).get("supporting_entities", [])]
    results["supporting_entities_count"] = len(supporting_entities)
    results["missing_supporting_entities"] = [e for e in expected_supporting if e not in supporting_entities]

    # 6. Check Scope Policy & ScopeDecision
    scope_policy = spec.get("scope_model", {}).get("policy", {})
    results["scope_default_action"] = scope_policy.get("default_action") if isinstance(scope_policy, dict) else scope_policy
    decision_fields = [f.get("name") for f in spec.get("scope_model", {}).get("decision_schema", {}).get("fields", [])]
    results["scope_decision_fields"] = decision_fields

    # 7. Check SQLite Tables
    sql_text = SQL_PATH.read_text(encoding='utf-8')
    sql_tables = re.findall(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)', sql_text, re.IGNORECASE)
    spec_tables = [t.get("name") for t in spec.get("storage", {}).get("sqlite", {}).get("tables", [])]
    results["sql_tables_in_file_count"] = len(sql_tables)
    results["sql_tables_in_spec_count"] = len(spec_tables)
    results["sql_tables_diff_spec_minus_sql"] = list(set(spec_tables) - set(sql_tables))
    results["sql_tables_diff_sql_minus_spec"] = list(set(sql_tables) - set(spec_tables))

    # Check Pragmas
    pragmas = dict(re.findall(r'PRAGMA\s+([a-zA-Z0-9_]+)\s*=\s*([a-zA-Z0-9_]+);', sql_text, re.IGNORECASE))
    results["sql_pragmas"] = pragmas

    # 8. Check Traits in Rust vs Spec
    rs_text = RUST_PATH.read_text(encoding='utf-8')
    rs_traits = re.findall(r'pub\s+trait\s+([a-zA-Z0-9_]+)', rs_text)
    spec_traits = [t.get("name") for t in spec.get("interfaces_and_traits", {}).get("traits", [])]
    results["traits_in_rust_count"] = len(rs_traits)
    results["traits_in_spec_count"] = len(spec_traits)
    results["missing_traits_in_rust"] = [t for t in spec_traits if t not in rs_traits and t.replace("OAST", "Oast").replace("AI", "Ai") not in rs_traits]

    # 9. Check Protobuf Services and Messages
    proto_text = PROTO_PATH.read_text(encoding='utf-8')
    proto_services = re.findall(r'service\s+([a-zA-Z0-9_]+)', proto_text)
    proto_messages = re.findall(r'message\s+([a-zA-Z0-9_]+)', proto_text)
    spec_services = [s.get("name") for s in spec.get("ipc_contracts", {}).get("services", [])]
    spec_messages = [m.get("name") for m in spec.get("ipc_contracts", {}).get("messages", [])]
    results["proto_services_in_file"] = proto_services
    results["proto_services_in_spec"] = spec_services
    results["missing_proto_services"] = [s for s in spec_services if s not in proto_services]
    results["missing_proto_messages"] = [m for m in spec_messages if m not in proto_messages]

    # Check UI stream oneofs
    ui_stream_match = re.search(r'message\s+SentinelUiStream\s*\{([^}]+(?:\{[^}]+\}[^}]*)*)\}', proto_text)
    if ui_stream_match:
        oneof_variants = re.findall(r'([a-zA-Z0-9_.]+)\s+([a-zA-Z0-9_]+)\s*=\s*\d+;', ui_stream_match.group(1))
        results["ui_stream_variants"] = [v[1] for v in oneof_variants]
    else:
        results["ui_stream_variants"] = []

    # 10. Check Security Invariants SEC-01 through SEC-12
    spec_invariants = [inv.get("id") for inv in spec.get("security_invariants", {}).get("invariants", [])]
    results["spec_invariants"] = spec_invariants
    results["spec_invariants_count"] = len(spec_invariants)

    # 11. Check Hashes & Frozen Metadata
    hashes = {
        "V6_CANONICAL_SPEC.yaml": sha256_file(SPEC_PATH),
        "V6_CANONICAL_SPEC_SCHEMA.yaml": sha256_file(SCHEMA_PATH),
        "V6_COMMON_TYPES.rs": sha256_file(RUST_PATH),
        "V6_IPC_CONTRACTS.proto": sha256_file(PROTO_PATH),
        "V6_SQLITE_SCHEMA.sql": sha256_file(SQL_PATH),
        "V6_FINAL_SUBSYSTEM_MANIFEST.md": sha256_file(WORKSPACE / "V6_FINAL_SUBSYSTEM_MANIFEST.md"),
        "validate_v6_spec.py": sha256_file(WORKSPACE / "validate_v6_spec.py")
    }
    results["artifact_hashes"] = hashes

    # Check Frozen Document Content
    frozen_content = FROZEN_PATH.read_text(encoding='utf-8')
    results["frozen_contains_hashes"] = any(h in frozen_content for h in hashes.values())
    results["frozen_length_lines"] = len(frozen_content.splitlines())

    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    run_audit()
