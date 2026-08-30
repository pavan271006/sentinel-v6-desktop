import os
import sys
import yaml

spec_path = r'architecture\v6\V6_CANONICAL_SPEC.yaml'
with open(spec_path, 'r', encoding='utf-8') as f:
    spec = yaml.safe_load(f)

invariants = spec.get('security_invariants', [])
print(f"Total security invariants in spec: {len(invariants)}")

results = []

for inv in invariants:
    inv_id = inv.get('id')
    title = inv.get('title') or inv.get('name')
    desc = inv.get('description')
    enforcement = inv.get('enforcement_mechanism')
    code_loc = inv.get('code_location') or inv.get('location')
    test_ev = inv.get('test_evidence') or inv.get('tests')
    
    # Check if files exist
    code_loc_exists = False
    if code_loc:
        # Code loc may be crate path or file path
        # Split by file or comma
        loc_paths = [p.strip() for p in str(code_loc).replace(';', ',').split(',')]
        existing_locs = []
        for lp in loc_paths:
            # clean line number if any (e.g. file.rs:123)
            clean_p = lp.split(':')[0]
            if os.path.exists(clean_p) or os.path.exists(os.path.join('sentinel_core', clean_p)):
                existing_locs.append(lp)
        code_loc_exists = len(existing_locs) > 0
    
    test_ev_exists = False
    if test_ev:
        test_paths = [p.strip() for p in str(test_ev).replace(';', ',').split(',')]
        existing_tests = []
        for tp in test_paths:
            clean_t = tp.split(':')[0]
            if os.path.exists(clean_t) or os.path.exists(os.path.join('sentinel_core', clean_t)):
                existing_tests.append(tp)
        test_ev_exists = len(existing_tests) > 0

    results.append({
        'id': inv_id,
        'title': title,
        'enforcement': enforcement,
        'code_loc': code_loc,
        'code_loc_exists': code_loc_exists,
        'test_ev': test_ev,
        'test_ev_exists': test_ev_exists,
    })
    print(f"[{inv_id}] {title}")
    print(f"  Enforcement: {enforcement}")
    print(f"  Code Location: {code_loc} (Exists: {code_loc_exists})")
    print(f"  Test Evidence: {test_ev} (Exists: {test_ev_exists})")
    print("-" * 60)
