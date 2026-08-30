import os
import json

with open(r"c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_v6_audit_1\full_crate_details.json", "r") as f:
    details = json.load(f)

for crate, data in details.items():
    print(f"Crate: {crate}")
    src_files = data["src_files"]
    test_files = data["test_files"]
    for sf, sf_data in list(src_files.items())[:3]:
        print(f"  Src: {sf} ({sf_data['loc']} lines)")
        for item in sf_data["items"][:2]:
            print(f"    - {item['kind']} {item['name']} (line {item['line']})")
    for tf, tf_data in list(test_files.items())[:2]:
        print(f"  Test: {tf} ({tf_data['loc']} lines)")
        for t in tf_data["tests"][:2]:
            print(f"    - test {t['name']} (line {t['line']})")
    print()
