import os
import re
import json
import glob

CRATES_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates"
TAURI_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri"
FRONTEND_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\src"
ARCH_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6"

def audit_crate(crate_name):
    crate_path = os.path.join(CRATES_DIR, crate_name)
    cargo_toml_path = os.path.join(crate_path, "Cargo.toml")
    
    cargo_content = ""
    dependencies = []
    if os.path.exists(cargo_toml_path):
        with open(cargo_toml_path, "r", encoding="utf-8") as f:
            cargo_content = f.read()
            for line in cargo_content.splitlines():
                if line.startswith("sentinel_") and "=" in line:
                    dep = line.split("=")[0].strip()
                    dependencies.append(dep)

    # Find rs files
    src_rs_files = []
    tests_rs_files = []
    
    src_dir = os.path.join(crate_path, "src")
    if os.path.exists(src_dir):
        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith(".rs"):
                    src_rs_files.append(os.path.join(root, file))
                    
    tests_dir = os.path.join(crate_path, "tests")
    if os.path.exists(tests_dir):
        for root, _, files in os.walk(tests_dir):
            for file in files:
                if file.endswith(".rs"):
                    tests_rs_files.append(os.path.join(root, file))

    src_loc = 0
    test_loc = 0
    unit_tests_count = 0
    integration_tests_count = 0
    todo_count = 0
    unimplemented_count = 0
    
    public_types = []
    public_traits = []
    
    for fpath in src_rs_files:
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            src_loc += len(lines)
            content = "".join(lines)
            unit_tests_count += len(re.findall(r"#\[test\]|#\[tokio::test\]", content))
            todo_count += len(re.findall(r"\btodo!\s*\(", content))
            unimplemented_count += len(re.findall(r"\bunimplemented!\s*\(", content))
            
            for line in lines:
                m = re.match(r"^\s*pub\s+(struct|enum)\s+([A-Za-z0-9_]+)", line)
                if m:
                    public_types.append(m.group(2))
                m2 = re.match(r"^\s*pub\s+trait\s+([A-Za-z0-9_]+)", line)
                if m2:
                    public_traits.append(m2.group(1))

    for fpath in tests_rs_files:
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            test_loc += len(lines)
            content = "".join(lines)
            integration_tests_count += len(re.findall(r"#\[test\]|#\[tokio::test\]", content))

    return {
        "crate_name": crate_name,
        "src_files_count": len(src_rs_files),
        "test_files_count": len(tests_rs_files),
        "src_loc": src_loc,
        "test_loc": test_loc,
        "unit_tests_count": unit_tests_count,
        "integration_tests_count": integration_tests_count,
        "total_tests": unit_tests_count + integration_tests_count,
        "todo_count": todo_count,
        "unimplemented_count": unimplemented_count,
        "dependencies": dependencies,
        "public_types": public_types,
        "public_traits": public_traits,
        "src_rs_files": [os.path.relpath(p, CRATES_DIR) for p in src_rs_files],
        "tests_rs_files": [os.path.relpath(p, CRATES_DIR) for p in tests_rs_files],
    }

def main():
    crates = sorted(os.listdir(CRATES_DIR))
    results = []
    for c in crates:
        if os.path.isdir(os.path.join(CRATES_DIR, c)):
            res = audit_crate(c)
            results.append(res)
            
    print(f"Audited {len(results)} crates.")
    with open(r"c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_v6_audit_1\crate_audit_data.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    print(f"{'Crate Name':<25} | {'Src LOC':<8} | {'Test LOC':<8} | {'Unit':<5} | {'Integ':<5} | {'Total':<5} | {'TODO':<4} | {'Traits'}")
    print("-" * 95)
    for r in results:
        print(f"{r['crate_name']:<25} | {r['src_loc']:<8} | {r['test_loc']:<8} | {r['unit_tests_count']:<5} | {r['integration_tests_count']:<5} | {r['total_tests']:<5} | {r['todo_count']:<4} | {', '.join(r['public_traits'][:3])}")

if __name__ == "__main__":
    main()
