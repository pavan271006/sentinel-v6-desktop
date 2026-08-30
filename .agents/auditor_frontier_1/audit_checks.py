import os
import sys

dossiers = [
    'V6_FRONTIER_REALITY_AUDIT.md',
    'V6_GLOBAL_SECURITY_LANDSCAPE.md',
    'V6_NEW_TOOL_DISCOVERIES.md',
    'V6_VULNERABILITY_LANDSCAPE.md',
    'V6_THEORY_TO_ENGINEERING_CATALOG.md',
    'V6_THEORY_LAB_RESULTS.md',
    'V6_COMPETITIVE_WORKFLOW_ANALYSIS.md',
    'V6_AGENT_ARCHITECTURE_RESEARCH.md',
    'V6_BROWSER_SECURITY_RESEARCH.md',
    'V6_AUTHZ_STATE_RESEARCH.md',
    'V6_PROTOCOL_DIFFERENTIAL_RESEARCH.md',
    'V6_ADAPTIVE_TEST_PLANNING_RESEARCH.md',
    'V6_CUSTOM_ENGINE_CATALOG.md',
    'V6_COMBINATION_ADVANTAGE_ANALYSIS.md',
    'V6_DO_NOT_BUILD_FRONTIER.md',
    'V6_REMOVE_MERGE_REPLACE_PLAN.md',
    'V6_FRONTIER_RESEARCH_CONVERGENCE.md',
    'V6_FRONTIER_ARCHITECTURE_BLUEPRINT.md'
]

root = r'c:\Users\Legion 5 pro\Desktop\cyber sec'

print("="*80)
print("CHECK 1: 18 REQUIRED ROOT MARKDOWN DOSSIERS AUDIT")
print("="*80)

all_pass = True
for idx, name in enumerate(dossiers, 1):
    p = os.path.join(root, name)
    if not os.path.exists(p):
        print(f"[{idx:2d}/18] MISSING: {name}")
        all_pass = False
        continue
    size = os.path.getsize(p)
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    lines = len(content.splitlines())
    words = len(content.split())
    status = 'PASS' if size >= 5000 and lines >= 100 else 'FAIL_TOO_SMALL'
    if status != 'PASS':
        all_pass = False
    print(f"[{idx:2d}/18] {name:<42} | {size:>7} B | {lines:>5} lines | {words:>6} words | {status}")

print(f"\nOVERALL 18 DOSSIER AUDIT: {'PASS (18/18)' if all_pass else 'FAIL'}")
