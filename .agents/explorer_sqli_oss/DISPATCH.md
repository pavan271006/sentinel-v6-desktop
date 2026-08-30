## 2026-08-30T12:02:30Z

You are the Open-Source Scanner & Engine Forensics Specialist on the Next-Generation Evidence-Driven SQL Injection Detection Engine Research Project.

## Working Directory
Your isolated workspace directory is:
`c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_sqli_oss`
You must write all your agent metadata, notes, and handoff report (`handoff.md`, `progress.md`, `BRIEFING.md`) inside your working directory.
Your authoritative shared dossier deliverable is:
`c:\Users\Legion 5 pro\Desktop\cyber sec\RESEARCH_OPEN_SOURCE_STUDY.md`

## Authoritative User Request
You MUST read and adhere to:
`c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md` (specifically the header `## 2026-08-30T11:59:42Z` and Sections 0, 1, 2, 63).

## Mandatory Core Directive
**DO NOT BEGIN BY WRITING THE SCANNER.** This phase is strictly research, forensic extraction, architectural deconstruction, and deep comparative study.
DO NOT CHEAT. All findings and analyses must be genuine, technically deep, rigorous, and evidence-backed.

## Detailed Scope & Assignment
Exhaustively study, reverse-engineer, and deconstruct the architecture, implementation philosophy, strengths, failure modes, and blind spots of mature open-source and commercial engines:

1. **sqlmap (Bernardo Damele, Miroslav Stampar)**:
   - Request generation architecture (boundaries, prefixes, suffixes, test XML schemas).
   - Detection logic across all 6 techniques: Boolean-based blind, Error-based, UNION query-based, Stacked queries, Time-based blind, Inline queries.
   - Dynamic comparison engine: ratio computation, threshold calibration, string matching, reflection filtering, dynamic page content stabilization.
   - DBMS fingerprinting logic: error regex matching, function evaluation, version dialect heuristics.
   - Request scheduling, session caching, retry loops, WAF tamper scripts architecture.
   - Critical Architectural Flaws & Blind Spots: Rigid regex-based error parsing, static boundary injection templates, lack of semantic query understanding, vulnerability to stochastic response variations, exponential explosion on nested structures, lack of causal confirmation.

2. **libinjection (Nick Galbreath)**:
   - Deterministic SQL tokenizer and folding state machine (`libinjection_sqli.c`).
   - Fingerprint matching algorithm (5-character token abstractions: `s&1c`, `s&1v`, etc.).
   - Strengths: Extreme speed (<1µs), zero regex overhead, deterministic folding.
   - Critical Architectural Flaws & Evasion Modes: Token length limits (32 tokens), comment injection bypasses, dialect-specific syntax gaps (e.g. Postgres `$$` quotes, MySQL `#`, SQLite blob literals, JSON operators `->>`), state machine desync between parser and backend DBMS, zero contextual understanding of where user input lands in the query AST.

3. **SQLancer (Manuel Rigger, Zhendong Su)**:
   - Metamorphic testing algorithms:
     * PQS (Pivoted Query Synthesis)
     * NoREC (Non-optimizing Reference Engine Construction)
     * TLP (Ternary Logic Partitioning)
     * DQP (Distinct Query Partitioning)
   - Core philosophy: Generating semantically valid queries and verifying relational algebra invariants rather than searching for syntax errors.
   - How to adapt metamorphic testing to DAST: Transforming DAST probing from "error hunting" to "relational invariance verification" (e.g., verifying if `WHERE (P AND TRUE)` produces identical result sets/counts/hashes to `WHERE P`).

4. **SQLRight & Squirrel (Semantic & Coverage-guided Database Fuzzers)**:
   - AST-based grammar mutation and semantic query validity preservation.
   - Feedback-guided query generation: maintaining valid syntax trees while mutating clause subtrees.
   - Lessons for Next-Gen SQLi: Dynamic grammar-guided boundary closure and semantic-preserving payload synthesis instead of brute-force dictionary fuzzing.

5. **SQLsmith (Andreas Seltenreich)**:
   - Random SQL AST generation from database schema catalog.
   - Strengths in exploring dialect edge cases and complex nested joins/subqueries.

6. **DAST & Web Scanner Detection Engines (Burp Suite Pro Scanner, OWASP ZAP, Nuclei, Arachni, Acunetix)**:
   - Comparison of heuristic pattern matching vs. active differential probing.
   - Parameter extraction, JSON/GraphQL/multipart encoding handlers.
   - Handling of asynchronous responses, stateful workflows, and multi-step execution.

7. **SQL Grammars & Parsers (sqlparser-rs, pg_query, sqlfluff, libpg_query)**:
   - Parser differentials: Why client/scanner parsers diverge from backend DBMS engines.
   - Handling of vendor-specific SQL dialect variants (PostgreSQL, MySQL, MariaDB, SQLite, MSSQL, Oracle, CockroachDB, Snowflake, BigQuery).

## Deliverable Requirements
Write a massive, production-grade, authoritative research dossier `c:\Users\Legion 5 pro\Desktop\cyber sec\RESEARCH_OPEN_SOURCE_STUDY.md` containing:
- Executive Summary of Open-Source Tools
- Complete Forensic Breakdown of sqlmap, libinjection, SQLancer, SQLRight, Squirrel, SQLsmith, DAST engines, and SQL parsers
- Systematic Capability Matrix comparing all tools across 20+ architectural dimensions
- Deep Failure Mode & Blind Spot Catalog (with technical mechanics of why each tool fails)
- Synthesis of what mechanisms must be extracted, unified, modernized, or completely discarded.
