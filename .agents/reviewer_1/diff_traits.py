#!/usr/bin/env python3
import re
import yaml
from pathlib import Path

WORKSPACE = Path(r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6")
SPEC_PATH = WORKSPACE / "V6_CANONICAL_SPEC.yaml"
RUST_PATH = WORKSPACE / "V6_COMMON_TYPES.rs"

with open(SPEC_PATH, 'r', encoding='utf-8') as f:
    spec = yaml.safe_load(f)

rs_content = RUST_PATH.read_text(encoding='utf-8')
clean_rs = re.sub(r'//.*', '', rs_content)
clean_rs = re.sub(r'/\*.*?\*/', '', clean_rs, flags=re.DOTALL)

rust_traits = set(re.findall(r'pub\s+trait\s+([a-zA-Z0-9_]+)', clean_rs))
spec_traits = set(t.get("name") for t in spec.get("interfaces_and_traits", {}).get("traits", []))

print("In spec but not in rust:", spec_traits - rust_traits)
print("In rust but not in spec:", rust_traits - spec_traits)
