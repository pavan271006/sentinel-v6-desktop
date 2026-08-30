import os
import sys
import yaml

spec_path = r'architecture\v6\V6_CANONICAL_SPEC.yaml'
with open(spec_path, 'r', encoding='utf-8') as f:
    spec = yaml.safe_load(f)

invariants = spec.get('security_invariants', {}).get('invariants', [])
print(f"Total security invariants in spec: {len(invariants)}")

for inv in invariants:
    inv_id = inv.get('id')
    name = inv.get('name')
    statement = inv.get('statement')
    layer = inv.get('enforcement_layer')
    test = inv.get('verification_test')
    
    print(f"============================================================")
    print(f"[{inv_id}] {name}")
    print(f"Statement: {statement}")
    print(f"Enforcement Layer: {layer}")
    print(f"Verification Test: {test}")
