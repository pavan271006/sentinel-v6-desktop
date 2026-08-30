import os
import re

def inspect_file(filename, checks):
    filepath = os.path.join(r'c:\Users\Legion 5 pro\Desktop\cyber sec', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"\n================================================================================")
    print(f"INSPECTING: {filename} ({len(content):,} chars, {len(content.splitlines())} lines)")
    print(f"================================================================================")
    
    for label, pattern in checks:
        matches = list(re.finditer(pattern, content, re.IGNORECASE))
        if matches:
            print(f"[OK] {label} (matches: {len(matches)})")
            # print sample snippet
            m = matches[0]
            start = max(0, m.start() - 40)
            end = min(len(content), m.end() + 60)
            sample = content[start:end].replace('\n', ' ')
            print(f"     Sample: \"...{sample}...\"")
        else:
            print(f"[FAIL] {label} - Pattern NOT FOUND: {pattern}")

# 1. Open Source Study
inspect_file('RESEARCH_OPEN_SOURCE_STUDY.md', [
    ("sqlmap XML boundaries & ratio engine", r"sqlmap|boundaries\.xml|SequenceMatcher"),
    ("libinjection C state machine & token window", r"libinjection|s&1c|sliding window"),
    ("SQLancer metamorphic testing (PQS, TLP, NoREC)", r"SQLancer|PQS|TLP|NoREC"),
    ("SQLRight AST differential fuzzing", r"SQLRight|differential|valid syntax"),
    ("Squirrel semantic-preserving AST IR", r"Squirrel|Intermediate Representation|IR"),
    ("SQLsmith AST generation & grammar traversal", r"SQLsmith|Andreas Seltenreich|random AST"),
    ("DAST engines (Burp, ZAP, Nuclei, Arachni)", r"Burp|ZAP|Nuclei|Arachni|DAST"),
    ("Parser grammars (Tree-sitter, ANTLR4, pg_query)", r"Tree-sitter|ANTLR4|pg_query|grammar")
])

# 2. Literature Synthesis
inspect_file('RESEARCH_LITERATURE_SYNTHESIS.md', [
    ("Wald SPRT & log-likelihood ratios", r"Wald|SPRT|log-likelihood|Sequential Probability Ratio"),
    ("Shannon Entropy & Error Distribution", r"Shannon|entropy|H\(X\)"),
    ("Timing Jitter Mitigation & Welch t-test", r"Welch|Mann-Whitney|jitter|Box-Cox"),
    ("Pearl Causal DAGs & do-calculus", r"Pearl|do\(|causal DAG|Structural Causal Model"),
    ("Metamorphic Testing Foundations", r"metamorphic|metamorphic relation|TLP"),
    ("Parser Differentials & WAF Inconsistencies", r"parser differential|grammar divergence|WAF")
])

# 3. Candidate Architectures & Attacks
inspect_file('CANDIDATE_ARCHITECTURES_AND_ATTACKS.md', [
    ("Architecture A: PAL-GME", r"Architecture A|PAL-GME|Probabilistic Active-Learning"),
    ("Architecture B: DMC-SMT", r"Architecture B|DMC-SMT|Deterministic Multi-Oracle"),
    ("Architecture C: DSS-BIG", r"Architecture C|DSS-BIG|Differential Semantic Shadowing"),
    ("Red-Team Attack on Arch A", r"Attack.*Architecture A|PAL-GME Vulnerabilities|Attack Vector A"),
    ("Red-Team Attack on Arch B", r"Attack.*Architecture B|DMC-SMT Vulnerabilities|Attack Vector B"),
    ("Red-Team Attack on Arch C", r"Attack.*Architecture C|DSS-BIG Vulnerabilities|Attack Vector C")
])

# 4. Benchmark Lab & Failure Taxonomy
inspect_file('BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md', [
    ("Benchmark Lab Architecture", r"Benchmark Lab|Docker|Network Matrix"),
    ("Hard-Positive Corpus HP-01..50", r"HP-01.*HP-50|HP-01|HP-50"),
    ("Hard-Negative Corpus HN-01..50", r"HN-01.*HN-50|HN-01|HN-50"),
    ("16-Class Failure Taxonomy FT-01..16", r"FT-01.*FT-16|FT-01|FT-16"),
    ("Evaluation Metrics", r"Precision|Recall|F1|ROC-AUC|Request Budget")
])

# 5. Roadmap & Security Model
inspect_file('IMPLEMENTATION_ROADMAP_AND_SECURITY_MODEL.md', [
    ("Implementation Phases 1-6", r"Phase 1|Phase 2|Phase 3|Phase 4|Phase 5|Phase 6"),
    ("Security Model Invariants SEC-01..10", r"SEC-01|SEC-02|SEC-03|SEC-10"),
    ("Residual Risks Analysis", r"Residual Risk|Epistemological"),
    ("Milestone 1 Specification", r"Milestone 1|Target Deliverables|Acceptance Criteria")
])
