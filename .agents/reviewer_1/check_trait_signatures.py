#!/usr/bin/env python3
"""
Deep inspection of Trait Signatures between V6_CANONICAL_SPEC.yaml and V6_COMMON_TYPES.rs
"""
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

# Extract Rust traits and methods
rust_traits = {}
for m in re.finditer(r'pub\s+trait\s+([a-zA-Z0-9_]+)\s*\{([^}]+)\}', clean_rs, re.DOTALL):
    t_name = m.group(1)
    body = m.group(2)
    methods = {}
    for mm in re.finditer(r'(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^;{]+))?', body):
        m_name = mm.group(1)
        params = mm.group(2).strip()
        ret = (mm.group(3) or "").strip()
        methods[m_name] = {"params": params, "returns": ret}
    rust_traits[t_name] = methods

spec_traits = spec.get("interfaces_and_traits", {}).get("traits", [])

print(f"Total Spec Traits: {len(spec_traits)}")
print(f"Total Rust Traits: {len(rust_traits)}")

missing_traits = []
method_mismatches = []

for st in spec_traits:
    st_name = st.get("name")
    alt_names = [st_name, st_name.replace("OAST", "Oast"), st_name.replace("AI", "Ai")]
    matched_trait = next((n for n in alt_names if n in rust_traits), None)
    if not matched_trait:
        missing_traits.append(st_name)
    else:
        r_methods = rust_traits[matched_trait]
        for meth in st.get("methods", []):
            m_name = meth.get("name")
            if m_name not in r_methods:
                method_mismatches.append({"trait": st_name, "missing_method": m_name})

print("Missing traits:", missing_traits)
print("Method mismatches:", method_mismatches)
