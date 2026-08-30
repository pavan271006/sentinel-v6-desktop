import os

files = [
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

root = r"c:\Users\Legion 5 pro\Desktop\cyber sec"

print(f"{'File':<42} | {'Size (KB)':>10} | {'Lines':>8} | Status")
print("-" * 70)
total_bytes = 0
total_lines = 0
for f in files:
    path = os.path.join(root, f)
    if os.path.exists(path):
        sz = os.path.getsize(path)
        total_bytes += sz
        with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
            lines = sum(1 for _ in fp)
        total_lines += lines
        print(f"{f:<42} | {sz/1024:>9.1f}K | {lines:>8} | PRESENT")
    else:
        print(f"{f:<42} | {'-':>10} | {'-':>8} | MISSING")
print("-" * 70)
print(f"{'TOTAL':<42} | {total_bytes/1024:>9.1f}K | {total_lines:>8} |")
