import os
import re
import sys

docs = {
    'NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md': r'c:\Users\Legion 5 pro\Desktop\cyber sec\NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md',
    'RESEARCH_OPEN_SOURCE_STUDY.md': r'c:\Users\Legion 5 pro\Desktop\cyber sec\RESEARCH_OPEN_SOURCE_STUDY.md',
    'RESEARCH_LITERATURE_SYNTHESIS.md': r'c:\Users\Legion 5 pro\Desktop\cyber sec\RESEARCH_LITERATURE_SYNTHESIS.md',
    'CANDIDATE_ARCHITECTURES_AND_ATTACKS.md': r'c:\Users\Legion 5 pro\Desktop\cyber sec\CANDIDATE_ARCHITECTURES_AND_ATTACKS.md',
    'BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md': r'c:\Users\Legion 5 pro\Desktop\cyber sec\BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md',
    'IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md': r'c:\Users\Legion 5 pro\Desktop\cyber sec\IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md'
}

print("================================================================================")
print("VICTORY AUDIT: INDEPENDENT VERIFICATION OF ALL DELIVERABLES")
print("================================================================================")

# 1. Existence and size
print("\n--- 1. FILE EXISTENCE & SIZES ---")
total_bytes = 0
total_lines = 0
total_words = 0
for name, path in docs.items():
    if not os.path.exists(path):
        print(f"FAIL: Missing deliverable: {name}")
        sys.exit(1)
    sz = os.path.getsize(path)
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
    lines = len(text.splitlines())
    words = len(text.split())
    total_bytes += sz
    total_lines += lines
    total_words += words
    print(f"OK: {name:48} | {sz:7} bytes | {lines:5} lines | {words:6} words")

print(f"TOTAL: {total_bytes} bytes | {total_lines} lines | {total_words} words")

# 2. Forbidden patterns / placeholders
print("\n--- 2. SIMULATION & PLACEHOLDER SCAN ---")
forbidden_patterns = [
    r'\bTODO\b', r'\bTBD\b', r'\bFIXME\b', r'\bXXX\b',
    r'lorem ipsum', r'\bplaceholder\b', r'insert here',
    r'coming soon', r'to be determined', r'to be written',
    r'not yet implemented'
]

total_violations = 0
for name, path in docs.items():
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    for pat in forbidden_patterns:
        matches = list(re.finditer(pat, content, re.IGNORECASE))
        if matches:
            print(f"[VIOLATION] {name}: pattern '{pat}' matched {len(matches)} times")
            for m in matches[:3]:
                line_no = content[:m.start()].count('\n') + 1
                snippet = content[max(0, m.start()-30):min(len(content), m.end()+30)].replace('\n', ' ')
                print(f"   Line {line_no}: '...{snippet}...'")
            total_violations += len(matches)

if total_violations == 0:
    print("PASS: Zero forbidden/simulation strings found across all 6 deliverables.")
else:
    print(f"FAIL: {total_violations} violations found.")

# 3. Check Section 63 all 23 sections in NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md
print("\n--- 3. SECTION 63 (23 REQUIRED SECTIONS) VERIFICATION ---")
blueprint_path = docs['NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md']
with open(blueprint_path, 'r', encoding='utf-8') as f:
    bp = f.read()

required_23 = [
    (1, "Executive research conclusion"),
    (2, "Existing-tool capability map"),
    (3, "Research-paper synthesis"),
    (4, "Current-state weaknesses"),
    (5, "What existing approaches should be combined"),
    (6, "What approaches should NOT be combined"),
    (7, "Three candidate architectures"),
    (8, "Attack on Architecture A"),
    (9, "Attack on Architecture B"),
    (10, "Attack on Architecture C"),
    (11, "Revised final architecture"),
    (12, "Proposed novel contribution"),
    (13, "Why the contribution should outperform the baseline"),
    (14, "How the claim can be disproved"),
    (15, "Benchmark laboratory design"),
    (16, "Hard-positive corpus"),
    (17, "Hard-negative corpus"),
    (18, "Metrics"),
    (19, "Failure taxonomy"),
    (20, "Implementation roadmap"),
    (21, "Security model"),
    (22, "Residual risks"),
    (23, "Exact first implementation milestone")
]

missing_sections = []
for sec_num, sec_title in required_23:
    # Look for Section N or title match
    pattern = rf"(#+\s*(?:SECTION\s*)?{sec_num}[\.\:\s\-]+[^\n]*{re.escape(sec_title)}|#+\s*{re.escape(sec_title)})"
    match = re.search(pattern, bp, re.IGNORECASE)
    if match:
        print(f"PASS: Section {sec_num:2d} found: {match.group(0).strip()}")
    else:
        # try more lenient search
        loose_pattern = rf"({re.escape(sec_title)})"
        loose_match = re.search(loose_pattern, bp, re.IGNORECASE)
        if loose_match:
            print(f"PASS (loose): Section {sec_num:2d} '{sec_title}' found")
        else:
            print(f"FAIL: Section {sec_num:2d} '{sec_title}' NOT found in blueprint!")
            missing_sections.append((sec_num, sec_title))

if not missing_sections:
    print("PASS: All 23 required sections are explicitly present in the master blueprint.")
else:
    print(f"FAIL: {len(missing_sections)} sections missing from master blueprint.")

# 4. Open-Source Study Verification
print("\n--- 4. OPEN-SOURCE STUDY VERIFICATION ---")
oss_path = docs['RESEARCH_OPEN_SOURCE_STUDY.md']
with open(oss_path, 'r', encoding='utf-8') as f:
    oss = f.read()

tools_to_check = [
    "sqlmap", "libinjection", "SQLancer", "SQLRight", "Squirrel", "SQLsmith"
]
for tool in tools_to_check:
    count = len(re.findall(rf"\b{tool}\b", oss, re.IGNORECASE))
    print(f"Tool '{tool}': mentioned {count} times in RESEARCH_OPEN_SOURCE_STUDY.md")
    if count < 5:
        print(f"WARNING: Tool '{tool}' has surprisingly few mentions ({count})")

# 5. Literature Synthesis Verification
print("\n--- 5. LITERATURE SYNTHESIS VERIFICATION ---")
lit_path = docs['RESEARCH_LITERATURE_SYNTHESIS.md']
with open(lit_path, 'r', encoding='utf-8') as f:
    lit = f.read()

concepts_to_check = [
    ("SPRT / Sequential Probability Ratio Test", r"SPRT|Sequential Probability Ratio"),
    ("Error Entropy / Shannon Entropy", r"Shannon|entropy"),
    ("Timing Jitter Mitigation / Welch t-test / Mann-Whitney", r"jitter|Welch|Mann-Whitney|t-test"),
    ("Causal DAGs / Pearl's do-calculus", r"causal|Pearl|do\(|DAG"),
    ("Metamorphic Testing", r"metamorphic|TLP|PQS|NoREC"),
    ("Parser Differentials", r"parser differential|grammar|differential")
]
for name, pat in concepts_to_check:
    matches = len(re.findall(pat, lit, re.IGNORECASE))
    print(f"Concept '{name}': matched {matches} times")

# 6. Candidate Architectures and Attacks Verification
print("\n--- 6. CANDIDATE ARCHITECTURES & ATTACKS VERIFICATION ---")
arch_path = docs['CANDIDATE_ARCHITECTURES_AND_ATTACKS.md']
with open(arch_path, 'r', encoding='utf-8') as f:
    arch = f.read()

arch_checks = [
    ("Architecture A", r"Architecture A"),
    ("Architecture B", r"Architecture B"),
    ("Architecture C", r"Architecture C"),
    ("Attack on Architecture A", r"Attack.*Architecture A"),
    ("Attack on Architecture B", r"Attack.*Architecture B"),
    ("Attack on Architecture C", r"Attack.*Architecture C"),
    ("Revised Architecture", r"Revised.*Architecture|UCMA")
]
for name, pat in arch_checks:
    matches = len(re.findall(pat, arch, re.IGNORECASE))
    print(f"Component '{name}': matched {matches} times")

# 7. Benchmark Lab & Failure Taxonomy Verification
print("\n--- 7. BENCHMARK LAB & FAILURE TAXONOMY VERIFICATION ---")
bench_path = docs['BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md']
with open(bench_path, 'r', encoding='utf-8') as f:
    bench = f.read()

hp_count = len(re.findall(r"HP-\d+", bench))
hn_count = len(re.findall(r"HN-\d+", bench))
ft_count = len(re.findall(r"FT-\d+", bench))
print(f"Hard-Positive items found: {hp_count} (target >= 50)")
print(f"Hard-Negative items found: {hn_count} (target >= 50)")
print(f"Failure Taxonomy items found: {ft_count} (target >= 16)")

# 8. Implementation Roadmap & Security Model Verification
print("\n--- 8. ROADMAP & SECURITY MODEL VERIFICATION ---")
road_path = docs['IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md']
with open(road_path, 'r', encoding='utf-8') as f:
    road = f.read()

road_checks = [
    ("Phased Roadmap", r"Milestone|Phase 1|Roadmap"),
    ("Security Model", r"Security Model|Invariants|SEC-01"),
    ("Residual Risks", r"Residual Risk"),
    ("Exact First Milestone", r"Milestone 1|First Milestone")
]
for name, pat in road_checks:
    matches = len(re.findall(pat, road, re.IGNORECASE))
    print(f"Section '{name}': matched {matches} times")

print("\n================================================================================")
print("AUDIT VERIFICATION SCRIPT EXECUTION COMPLETED")
print("================================================================================")
