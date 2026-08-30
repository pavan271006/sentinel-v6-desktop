import os
import re

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
print("DEEP CONTENT & CITATION RIGOR AUDIT ACROSS 18 DOSSIERS")
print("="*80)

for idx, name in enumerate(dossiers, 1):
    p = os.path.join(root, name)
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Check headers
    headers = [line for line in content.splitlines() if line.startswith('#')]
    # Check links / citations
    urls = re.findall(r'https?://[^\s\)\>\]]+', content)
    # Check table rows
    tables = [line for line in content.splitlines() if '|' in line]
    # Check code blocks
    code_blocks = content.count('```') // 2
    # Check mathematical / complexity references
    math_refs = len(re.findall(r'(\bO\([^\)]+\)|\\frac|\\sum|\\beta|\\alpha|P\(|Beta\(|Shannon|Welch|Tarjan|Dijkstra|Markov|Bayesian|CTE)', content, re.IGNORECASE))
    
    print(f"[{idx:2d}/18] {name:<40} | Headers: {len(headers):>2} | URLs: {len(urls):>2} | Table rows: {len(tables):>3} | Code blocks: {code_blocks:>2} | Math/Algo refs: {math_refs:>3}")

print("="*80)
