import os

files = [
    'NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md',
    'RESEARCH_OPEN_SOURCE_STUDY.md',
    'RESEARCH_LITERATURE_SYNTHESIS.md',
    'CANDIDATE_ARCHITECTURES_AND_ATTACKS.md',
    'BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md',
    'IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    lines = content.splitlines()
    h1 = [l for l in lines if l.startswith('# ')]
    h2 = [l for l in lines if l.startswith('## ')]
    h3 = [l for l in lines if l.startswith('### ')]
    code_blocks = content.count('```') // 2
    tables = content.count('|---|')
    math_blocks = content.count('$$') // 2
    print(f"=== {f} ===")
    print(f"  Size: {len(content):,} chars, Lines: {len(lines):,}, Words: {len(content.split()):,}")
    print(f"  H1: {len(h1)}, H2: {len(h2)}, H3: {len(h3)}, Code/Spec blocks: {code_blocks}, Tables: {tables}, Math blocks: {math_blocks}")
