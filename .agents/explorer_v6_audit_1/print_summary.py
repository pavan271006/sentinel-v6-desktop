import os
import re
import json

CRATES_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates"
TAURI_COMMANDS = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\commands.rs"
TAURI_STATE = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\state.rs"
FRONTEND_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src"
ARCH_SPEC = r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6\V6_CANONICAL_SPEC.yaml"

with open(r"c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_v6_audit_1\deep_crate_audit.json", "r") as f:
    deep_data = json.load(f)

for crate_name, info in deep_data.items():
    print(f"=== {crate_name} ===")
    print(f"  Src LOC: {info['src_loc']}, Test LOC: {info['test_loc']}, Tests: {info['test_count']}")
    print(f"  Src Files: {info['src_files']}")
    print(f"  Test Files: {info['test_files']}")
    print(f"  In Tauri Commands: {info['in_tauri_commands']}, In Tauri State: {info['in_tauri_state']}")
    print(f"  Structs/Enums: {info['structs'][:6]}")
    print(f"  Traits: {info['traits']}")
    print(f"  Sample Tests: {info['test_names'][:4]}")
    print()
