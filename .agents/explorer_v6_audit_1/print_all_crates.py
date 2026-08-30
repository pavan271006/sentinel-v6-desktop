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

for crate_name, info in sorted(deep_data.items()):
    print(f"Crate: {crate_name}")
    print(f"  Src LOC: {info['src_loc']}, Test LOC: {info['test_loc']}, Tests: {info['test_count']}")
    print(f"  Files: {info['src_files']}")
    print(f"  Test Files: {info['test_files']}")
    print(f"  Tauri: cmds={info['in_tauri_commands']}, state={info['in_tauri_state']}")
    print("-" * 50)
