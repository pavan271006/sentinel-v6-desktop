import yaml
import json
from pathlib import Path

spec_path = Path("architecture/v6/V6_CANONICAL_SPEC.yaml")
with open(spec_path, "r", encoding="utf-8") as f:
    spec = yaml.safe_load(f)

print("=== SUBSYSTEMS ===")
subsystems = spec.get("subsystems", {}).get("definitions", [])
for s in subsystems:
    print(f"[{s.get('id')}] {s.get('name')} (Tier: {s.get('tier')}, Crate: {s.get('crate')})")
    print(f"  Provided Traits: {s.get('traits_provided')}")
    print(f"  Consumed Traits: {s.get('traits_consumed')}")
    print(f"  Emitted Events: {s.get('events_emitted')}")
    print(f"  Storage: {s.get('storage_access')}")

print("\n=== TRAITS & METHODS ===")
traits = spec.get("interfaces_and_traits", {}).get("traits", [])
for t in traits:
    methods = [m.get("name") for m in t.get("methods", [])]
    print(f"\n--- Trait: {t.get('name')} (Subsystem: {t.get('subsystem')}) ---")
    for m in t.get("methods", []):
        arg_strs = [f"{a.get('name')}: {a.get('type')}" for a in m.get("args", [])]
        print(f"  fn {m.get('name')}({', '.join(arg_strs)}) -> {m.get('return_type')}")

print("\n=== EVENTS ===")
events = spec.get("events", {}).get("definitions", [])
for e in events:
    print(f"Event: {e.get('name')} (Channel: {e.get('channel')}, Priority: {e.get('priority')})")
    print(f"  Fields: {[f.get('name') + ': ' + f.get('type') for f in e.get('fields', [])]}")

print("\n=== DOMAIN CORE ENTITIES ===")
core_ents = spec.get("domain_model", {}).get("core_entities", [])
for ce in core_ents:
    print(f"Entity: {ce.get('name')}")
    for f in ce.get("fields", []):
        print(f"  - {f.get('name')}: {f.get('type')}")

print("\n=== DOMAIN ENUMS ===")
enums = spec.get("domain_model", {}).get("enums", [])
for en in enums:
    print(f"Enum: {en.get('name')} -> {en.get('variants')}")

print("\n=== SECURITY INVARIANTS ===")
invs = spec.get("security_invariants", {}).get("invariants", [])
for inv in invs:
    print(f"[{inv.get('id')}] {inv.get('name')}")
    print(f"  Statement: {inv.get('statement')}")
    print(f"  Enforcement: {inv.get('enforcement_layer')}")
    print(f"  Verification: {inv.get('verification_test')}")

print("\n=== STORAGE TABLES ===")
tables = spec.get("storage", {}).get("sqlite", {}).get("tables", [])
for tbl in tables:
    print(f"Table: {tbl.get('name')}")
    print(f"  Columns: {[c.get('name') for c in tbl.get('columns', [])]}")

