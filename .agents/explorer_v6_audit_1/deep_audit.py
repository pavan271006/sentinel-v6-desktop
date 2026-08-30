import os
import re
import json

CRATES_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates"
TAURI_COMMANDS = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\commands.rs"
TAURI_STATE = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\src\state.rs"
FRONTEND_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src"
ARCH_SPEC = r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6\V6_CANONICAL_SPEC.yaml"

with open(TAURI_COMMANDS, "r", encoding="utf-8", errors="ignore") as f:
    tauri_commands_content = f.read()

with open(TAURI_STATE, "r", encoding="utf-8", errors="ignore") as f:
    tauri_state_content = f.read()

crates_analysis = {}

for crate_name in sorted(os.listdir(CRATES_DIR)):
    crate_path = os.path.join(CRATES_DIR, crate_name)
    if not os.path.isdir(crate_path):
        continue
        
    src_dir = os.path.join(crate_path, "src")
    tests_dir = os.path.join(crate_path, "tests")
    
    src_files = {}
    test_files = {}
    
    if os.path.exists(src_dir):
        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith(".rs"):
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, src_dir)
                    with open(full_p, "r", encoding="utf-8", errors="ignore") as f:
                        src_files[rel_p] = f.read()
                        
    if os.path.exists(tests_dir):
        for root, _, files in os.walk(tests_dir):
            for file in files:
                if file.endswith(".rs"):
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, tests_dir)
                    with open(full_p, "r", encoding="utf-8", errors="ignore") as f:
                        test_files[rel_p] = f.read()
                        
    # Check if mentioned in tauri commands / state
    in_tauri_commands = crate_name in tauri_commands_content
    in_tauri_state = crate_name in tauri_state_content
    
    # Check key structs, enums, functions
    structs = []
    traits = []
    functions = []
    test_names = []
    
    for fname, content in src_files.items():
        structs.extend(re.findall(r"pub\s+(?:struct|enum)\s+([A-Za-z0-9_]+)", content))
        traits.extend(re.findall(r"pub\s+trait\s+([A-Za-z0-9_]+)", content))
        functions.extend(re.findall(r"pub\s+(?:async\s+)?fn\s+([A-Za-z0-9_]+)", content))
        
    for fname, content in test_files.items():
        test_names.extend(re.findall(r"fn\s+([A-Za-z0-9_]+)\s*\(\s*\)", content))
        
    crates_analysis[crate_name] = {
        "src_files": list(src_files.keys()),
        "test_files": list(test_files.keys()),
        "src_loc": sum(len(c.splitlines()) for c in src_files.values()),
        "test_loc": sum(len(c.splitlines()) for c in test_files.values()),
        "structs": list(set(structs)),
        "traits": list(set(traits)),
        "functions_count": len(functions),
        "test_names": test_names,
        "test_count": len(test_names),
        "in_tauri_commands": in_tauri_commands,
        "in_tauri_state": in_tauri_state,
    }

with open(r"c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_v6_audit_1\deep_crate_audit.json", "w", encoding="utf-8") as f:
    json.dump(crates_analysis, f, indent=2)

print(f"Deep crate audit saved for {len(crates_analysis)} crates.")
