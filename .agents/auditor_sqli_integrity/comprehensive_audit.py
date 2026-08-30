import os
import sys
import re

print("=== STARTING COMPREHENSIVE FORENSIC AUDIT SCRIPT ===")

docs = {
    "BLUEPRINT": "NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md",
    "OSS_STUDY": "RESEARCH_OPEN_SOURCE_STUDY.md",
    "LIT_SYNTHESIS": "RESEARCH_LITERATURE_SYNTHESIS.md",
    "CANDIDATE_ATTACKS": "CANDIDATE_ARCHITECTURES_AND_ATTACKS.md",
    "BENCHMARK_LAB": "BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md",
    "ROADMAP": "IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md"
}

# 1. Size and structural audit
print("\n--- 1. DELIVERABLE METRICS AND INTEGRITY ---")
total_lines = 0
total_words = 0
total_bytes = 0

doc_contents = {}
for key, fname in docs.items():
    if not os.path.exists(fname):
        print(f"ERROR: Missing deliverable {fname}")
        continue
    sz = os.path.getsize(fname)
    with open(fname, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    doc_contents[key] = content
    lines = len(content.splitlines())
    words = len(content.split())
    total_lines += lines
    total_words += words
    total_bytes += sz
    print(f"[{key}] {fname}: {sz:,} bytes | {lines:,} lines | {words:,} words")

print(f"TOTAL DELIVERABLES: {total_bytes:,} bytes | {total_lines:,} lines | {total_words:,} words")

# 2. Check for placeholder strings, TODO, lorem ipsum, dummy text
print("\n--- 2. PLACEHOLDER & SIMULATION PATTERN DETECTION ---")
prohibited_patterns = [
    r"\bTODO\b",
    r"\bTBD\b",
    r"\bFIXME\b",
    r"\bXXX\b",
    r"lorem ipsum",
    r"\bplaceholder\b",
    r"insert here",
    r"coming soon",
    r"to be determined",
    r"to be written",
    r"not yet implemented"
]

found_placeholders = {}
for key, content in doc_contents.items():
    found_placeholders[key] = []
    lines = content.splitlines()
    for idx, line in enumerate(lines):
        for pat in prohibited_patterns:
            matches = re.findall(pat, line, re.IGNORECASE)
            if matches:
                # Check if it's a false alarm (e.g. in a legitimate explanation or table header)
                found_placeholders[key].append((idx + 1, pat, line.strip()))

for key, matches in found_placeholders.items():
    print(f"File {docs[key]}: {len(matches)} potential pattern matches found.")
    for line_no, pat, text in matches[:10]:
        print(f"   Line {line_no} [{pat}]: {text[:100]}")
    if len(matches) > 10:
        print(f"   ... and {len(matches) - 10} more matches.")

# 3. Check Section 63 Coverage (All 23 Sections)
print("\n--- 3. SECTION 63 23-PART SPECIFICATION COVERAGE ---")
section_63_titles = [
    "1. Executive research conclusion",
    "2. Existing-tool capability map",
    "3. Research-paper synthesis",
    "4. Current-state weaknesses",
    "5. What existing approaches should be combined",
    "6. What approaches should NOT be combined",
    "7. Three candidate architectures",
    "8. Attack on Architecture A",
    "9. Attack on Architecture B",
    "10. Attack on Architecture C",
    "11. Revised final architecture",
    "12. Proposed novel contribution",
    "13. Why the contribution should outperform the baseline",
    "14. How the claim can be disproved",
    "15. Benchmark laboratory design",
    "16. Hard-positive corpus",
    "17. Hard-negative corpus",
    "18. Metrics",
    "19. Failure taxonomy",
    "20. Implementation roadmap",
    "21. Security model",
    "22. Residual risks",
    "23. Exact first implementation milestone"
]

blueprint_content = doc_contents.get("BLUEPRINT", "")
print("Auditing NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md for Section 63 sections:")
for sec in section_63_titles:
    # Match section number and keywords
    sec_num = sec.split(".")[0].strip()
    sec_kw = sec.split(".")[1].strip().split()[0]
    pattern = rf"(#+\s*{sec_num}\.?\s+.*{sec_kw})"
    m = re.search(pattern, blueprint_content, re.IGNORECASE)
    if m:
        print(f"  [PASS] Section {sec_num}: Found '{m.group(0)}'")
    else:
        print(f"  [FAIL/WARN] Section {sec_num} ({sec}) not found with exact regex, searching substring...")
        # fallback search
        if f"## {sec_num}." in blueprint_content or f"## {sec_num} " in blueprint_content:
            print(f"  [PASS - Substring] Section {sec_num} found in headers")
        else:
            print(f"  [MISSING] Section {sec_num} NOT FOUND in Blueprint!")

# 4. Open-Source Tools Deep Dive Verification
print("\n--- 4. OPEN-SOURCE TOOLS VERIFICATION ---")
oss_tools = ["sqlmap", "libinjection", "SQLancer", "SQLRight", "Squirrel", "SQLsmith"]
oss_content = doc_contents.get("OSS_STUDY", "")
for tool in oss_tools:
    count = len(re.findall(rf"\b{tool}\b", oss_content, re.IGNORECASE))
    print(f"Tool '{tool}': {count} mentions in RESEARCH_OPEN_SOURCE_STUDY.md")
    # Check for architectural terms related to tool
    if tool == "sqlmap":
        has_terms = any(t in oss_content for t in ["XML", "boundary", "heuristic", "boolean", "time-based", "stacked"])
        print(f"   sqlmap technical concepts verified: {has_terms}")
    elif tool == "libinjection":
        has_terms = any(t in oss_content for t in ["fingerprint", "SQLi token", "B-tree", "lexer", "state machine"])
        print(f"   libinjection technical concepts verified: {has_terms}")
    elif tool == "SQLancer":
        has_terms = any(t in oss_content for t in ["PQS", "Pivoted Query Synthesis", "TLP", "Ternary Logic", "NoREC", "Non-optimizing Reference"])
        print(f"   SQLancer technical concepts verified: {has_terms}")
    elif tool == "SQLRight":
        has_terms = any(t in oss_content for t in ["validity", "mutation", "AST-guided", "differential", "coverage"])
        print(f"   SQLRight technical concepts verified: {has_terms}")
    elif tool == "Squirrel":
        has_terms = any(t in oss_content for t in ["IR", "Intermediate Representation", "AFL", "semantic-preserving"])
        print(f"   Squirrel technical concepts verified: {has_terms}")
    elif tool == "SQLsmith":
        has_terms = any(t in oss_content for t in ["grammar", "AST generation", "random", "schema"])
        print(f"   SQLsmith technical concepts verified: {has_terms}")

# 5. Check helper scripts in root
print("\n--- 5. HELPER SCRIPTS IN ROOT INSPECTION ---")
root_scripts = ["gen_part2_sec8.py", "generate_all.py", "test_write.py", "make_adaptive_planner.py"]
for s in root_scripts:
    if os.path.exists(s):
        sz = os.path.getsize(s)
        with open(s, "r", encoding="utf-8", errors="ignore") as f:
            c = f.read()
        print(f"File {s} ({sz} bytes):")
        print("  Snippet:", repr(c[:150]))

print("\n=== COMPREHENSIVE FORENSIC AUDIT SCRIPT COMPLETE ===")
