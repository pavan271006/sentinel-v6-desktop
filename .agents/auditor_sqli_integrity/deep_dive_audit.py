import os
import re

print("=== DEEP DIVE AUDIT SCRIPT ===")

# 1. Audit Hard-Positive and Hard-Negative Corpora
bench_file = "BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md"
with open(bench_file, "r", encoding="utf-8", errors="ignore") as f:
    bench_text = f.read()

hp_matches = re.findall(r"(HP-\d+|Fixture \d+|Hard-Positive Case \d+)", bench_text, re.IGNORECASE)
hn_matches = re.findall(r"(HN-\d+|Negative Case \d+|Hard-Negative Case \d+)", bench_text, re.IGNORECASE)
ft_matches = re.findall(r"(FT-\d+)", bench_text)

print(f"Benchmark Lab Corpus Analysis:")
print(f"  Hard-Positive fixture indicators: {len(hp_matches)} occurrences (Unique: {len(set(hp_matches))})")
print(f"  Hard-Negative fixture indicators: {len(hn_matches)} occurrences (Unique: {len(set(hn_matches))})")
print(f"  Failure Taxonomy indicators (FT-01..FT-16): {len(ft_matches)} occurrences (Unique: {len(set(ft_matches))})")

# 2. Audit Candidate Architectures & Attacks
cand_file = "CANDIDATE_ARCHITECTURES_AND_ATTACKS.md"
with open(cand_file, "r", encoding="utf-8", errors="ignore") as f:
    cand_text = f.read()

arch_a = "PAL-GME" in cand_text or "Architecture A" in cand_text
arch_b = "DMC-SMT" in cand_text or "Architecture B" in cand_text
arch_c = "DSS-BIG" in cand_text or "Architecture C" in cand_text
attack_a = "Attack on Architecture A" in cand_text or "Red-Team Attack on PAL-GME" in cand_text
attack_b = "Attack on Architecture B" in cand_text or "Red-Team Attack on DMC-SMT" in cand_text
attack_c = "Attack on Architecture C" in cand_text or "Red-Team Attack on DSS-BIG" in cand_text

print(f"\nCandidate Architectures & Attacks Analysis:")
print(f"  Architecture A (PAL-GME) present: {arch_a}")
print(f"  Architecture B (DMC-SMT) present: {arch_b}")
print(f"  Architecture C (DSS-BIG) present: {arch_c}")
print(f"  Attack on Architecture A present: {attack_a}")
print(f"  Attack on Architecture B present: {attack_b}")
print(f"  Attack on Architecture C present: {attack_c}")

# 3. Audit Mathematical Rigor & Formal Models
docs_to_check = [
    "NEXTGEN_SQLI_ENGINE_ARCHITECTURE_BLUEPRINT.md",
    "RESEARCH_LITERATURE_SYNTHESIS.md",
    "CANDIDATE_ARCHITECTURES_AND_ATTACKS.md",
    "BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md"
]

math_terms = [
    r"do\(",
    r"Wald",
    r"SPRT",
    r"log-likelihood",
    r"\\alpha",
    r"\\beta",
    r"\\Pr",
    r"Shannon",
    r"entropy",
    r"Z3",
    r"SMT",
    r"Merkle",
    r"BLAKE3",
    r"Bayesian",
    r"Tanimoto",
    r"Levenshtein",
    r"AST",
    r"CFG",
    r"PQS",
    r"NoREC",
    r"TLP"
]

print("\nMathematical Formalisms & Concepts Occurrences:")
for doc in docs_to_check:
    with open(doc, "r", encoding="utf-8", errors="ignore") as f:
        t = f.read()
    print(f"\nDocument: {doc}")
    for term in math_terms:
        cnt = len(re.findall(term, t, re.IGNORECASE))
        print(f"  - Term '{term}': {cnt} times")

print("\n=== DEEP DIVE AUDIT COMPLETE ===")
