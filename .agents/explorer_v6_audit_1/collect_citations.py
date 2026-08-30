import os
import re
import json

CRATES_DIR = r"c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates"

def analyze_crate_details(crate_name):
    crate_path = os.path.join(CRATES_DIR, crate_name)
    src_dir = os.path.join(crate_path, "src")
    tests_dir = os.path.join(crate_path, "tests")
    
    files_detail = {}
    if os.path.exists(src_dir):
        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith(".rs"):
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, crate_path)
                    with open(full_p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        lines = content.splitlines()
                        
                        # Find key structs, enums, functions with line numbers
                        items = []
                        for idx, line in enumerate(lines):
                            m = re.match(r"^\s*pub\s+(struct|enum|trait)\s+([A-Za-z0-9_]+)", line)
                            if m:
                                items.append({"line": idx + 1, "kind": m.group(1), "name": m.group(2)})
                            m2 = re.match(r"^\s*pub\s+(?:async\s+)?fn\s+([A-Za-z0-9_]+)", line)
                            if m2:
                                items.append({"line": idx + 1, "kind": "fn", "name": m2.group(1)})
                        files_detail[rel_p] = {"loc": len(lines), "items": items}

    tests_detail = {}
    if os.path.exists(tests_dir):
        for root, _, files in os.walk(tests_dir):
            for file in files:
                if file.endswith(".rs"):
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, crate_path)
                    with open(full_p, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        lines = content.splitlines()
                        test_cases = []
                        for idx, line in enumerate(lines):
                            if "#[test]" in line or "#[tokio::test]" in line:
                                fn_name = "unknown"
                                for j in range(idx+1, min(idx+6, len(lines))):
                                    m = re.search(r"fn\s+([A-Za-z0-9_]+)", lines[j])
                                    if m:
                                        fn_name = m.group(1)
                                        test_cases.append({"line": j + 1, "name": fn_name})
                                        break
                        tests_detail[rel_p] = {"loc": len(lines), "tests": test_cases}
                        
    return {
        "crate": crate_name,
        "src_files": files_detail,
        "test_files": tests_detail,
    }

full_details = {}
for c in sorted(os.listdir(CRATES_DIR)):
    if os.path.isdir(os.path.join(CRATES_DIR, c)):
        full_details[c] = analyze_crate_details(c)

with open(r"c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_v6_audit_1\full_crate_details.json", "w", encoding="utf-8") as f:
    json.dump(full_details, f, indent=2)

print("Full crate details gathered successfully.")
