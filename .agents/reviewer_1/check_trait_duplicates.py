#!/usr/bin/env python3
import yaml
from pathlib import Path

WORKSPACE = Path(r"c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6")
SPEC_PATH = WORKSPACE / "V6_CANONICAL_SPEC.yaml"
with open(SPEC_PATH, 'r', encoding='utf-8') as f:
    spec = yaml.safe_load(f)

traits = spec.get("interfaces_and_traits", {}).get("traits", [])
trait_names = [t.get("name") for t in traits]
print("Spec trait count:", len(trait_names))
print("Unique trait count:", len(set(trait_names)))
from collections import Counter
c = Counter(trait_names)
duplicates = [k for k, v in c.items() if v > 1]
print("Duplicates:", duplicates)
