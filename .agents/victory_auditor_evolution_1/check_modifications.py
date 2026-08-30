import os
import sys
import datetime
import hashlib

dirs_to_check = [
    r"c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core",
    r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri",
    r"c:\Users\Legion 5 pro\Desktop\cyber sec\frontend",
    r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6"
]

cutoff = datetime.datetime(2026, 8, 22, 14, 0, 0)
modified_files = []

for base in dirs_to_check:
    for root, dirs, files in os.walk(base):
        if "target" in root.split(os.sep) or "node_modules" in root.split(os.sep):
            continue
        for f in files:
            p = os.path.join(root, f)
            try:
                mtime = datetime.datetime.fromtimestamp(os.path.getmtime(p))
                if mtime > cutoff:
                    modified_files.append((p, mtime))
            except Exception as e:
                pass

print(f"Total source/architecture files modified after {cutoff}: {len(modified_files)}")
for p, mtime in modified_files:
    print(f"  {p} -> {mtime}")

# Check Canonical Hashes
spec_files = {
    "V6_CANONICAL_SPEC.yaml": ("architecture/v6/V6_CANONICAL_SPEC.yaml", "424f75dece3d64ef6868145b783053534149bb932fe89e51fbe548f665675041"),
    "V6_CANONICAL_SPEC_SCHEMA.yaml": ("architecture/v6/V6_CANONICAL_SPEC_SCHEMA.yaml", "ee31c5c08fdfcc366d28b5cd46f0b0e39e94ee72b882b1d90a520ead71ccbf27"),
    "V6_COMMON_TYPES.rs": ("architecture/v6/V6_COMMON_TYPES.rs", "4ddc26c203a67ad3b67eee740be1e9b2b6f9693d6423e51b1ae39ca6c1a443ad"),
    "V6_IPC_CONTRACTS.proto": ("architecture/v6/V6_IPC_CONTRACTS.proto", "bc941bc207503a4d9dd4cc3b188f34da350335dcff38182909b8be511902cf5b"),
    "V6_SQLITE_SCHEMA.sql": ("architecture/v6/V6_SQLITE_SCHEMA.sql", "5b0d1e58f03b0cb9f08c01dc4cfad75a8f8d94af3b67d294dc62c2d80d1a8bd7"),
    "validate_v6_spec.py": ("architecture/v6/validate_v6_spec.py", "02e6552e83c859b2bc96696c764a44e7d237354fc11f7c6bb59d95caaa690784")
}

print("\n--- SPEC HASH AUDIT ---")
for name, (rel_path, expected_hash) in spec_files.items():
    full_p = os.path.join(r"c:\Users\Legion 5 pro\Desktop\cyber sec", rel_path)
    if not os.path.exists(full_p):
        print(f"MISSING: {full_p}")
        continue
    with open(full_p, "rb") as f:
        actual_hash = hashlib.sha256(f.read()).hexdigest()
    match = actual_hash.lower() == expected_hash.lower()
    print(f"{name}: {'MATCH' if match else 'MISMATCH'}")
    if not match:
        print(f"  Expected: {expected_hash}")
        print(f"  Actual:   {actual_hash}")
