# RESEARCH DOSSIER: FORENSIC DECONSTRUCTION OF OPEN-SOURCE & STATE-OF-THE-ART SQL INJECTION DETECTION ENGINES, METAMORPHIC ORACLES, AND DATABASE FUZZERS

**Document ID:** `RESEARCH_OPEN_SOURCE_STUDY.md`  
**Classification:** Authoritative Technical Research & Architectural Forensic Study  
**Author:** Next-Generation Evidence-Driven SQLi Engine Research Group (Open-Source Scanner & Engine Forensics Specialist)  
**Date:** August 30, 2026  
**Status:** COMPLETE / FROZEN FOR ARCHITECTURAL SYNTHESIS  

---

## TABLE OF CONTENTS
1. [Executive Summary: Open-Source Tools & Detection Paradigms](#1-executive-summary-open-source-tools--detection-paradigms)
2. [Deep Forensic Breakdown: sqlmap (Bernardo Damele & Miroslav Stampar)](#2-deep-forensic-breakdown-sqlmap-bernardo-damele--miroslav-stampar)
3. [Deep Forensic Breakdown: libinjection (Nick Galbreath)](#3-deep-forensic-breakdown-libinjection-nick-galbreath)
4. [Deep Forensic Breakdown: SQLancer (Manuel Rigger & Zhendong Su)](#4-deep-forensic-breakdown-sqlancer-manuel-rigger--zhendong-su)
5. [Deep Forensic Breakdown: SQLRight & Squirrel (AST-Guided Coverage Fuzzers)](#5-deep-forensic-breakdown-sqlright--squirrel-ast-guided-coverage-fuzzers)
6. [Deep Forensic Breakdown: SQLsmith (Andreas Seltenreich)](#6-deep-forensic-breakdown-sqlsmith-andreas-seltenreich)
7. [Deep Forensic Breakdown: DAST & Commercial Scanner Engines](#7-deep-forensic-breakdown-dast--commercial-scanner-engines)
8. [Deep Forensic Breakdown: SQL Grammars, Parsers & Parser Differentials](#8-deep-forensic-breakdown-sql-grammars-parsers--parser-differentials)
9. [Systematic 22-Dimension Architectural Capability Matrix](#9-systematic-22-dimension-architectural-capability-matrix)
10. [Deep Failure Mode, Evasion & Blind Spot Catalog](#10-deep-failure-mode-evasion--blind-spot-catalog)
11. [Architectural Synthesis: What to Extract, Modernize, and Discard](#11-architectural-synthesis-what-to-extract-modernize-and-discard)
12. [Formal Specifications & Principles for the Next-Gen Evidence Engine](#12-formal-specifications--principles-for-the-next-gen-evidence-engine)

---

## 1. EXECUTIVE SUMMARY: OPEN-SOURCE TOOLS & DETECTION PARADIGMS

The landscape of SQL injection detection and database security testing has evolved across four distinct historical eras, each defined by a fundamental underlying philosophy, mathematical model, and set of systemic trade-offs:

```
+---------------------------------------------------------------------------------------------------------+
|                                    FOUR ERAS OF SQL INJECTION TOOLING                                   |
+---------------------------------------------------------------------------------------------------------+
| Era 1: Heuristic Dictionary Fuzzing & Static Boundary Injection (2006-2015)                             |
| Tools: sqlmap, OWASP ZAP, early Burp Scanner, Arachni                                                   |
| Paradigm: Static regex matching, string-interpolated prefix/suffix boundaries, fixed sleep thresholds. |
| Core Flaw: Zero query AST understanding; exponential combinatorial explosion; high false positive rate.|
+---------------------------------------------------------------------------------------------------------+
| Era 2: Deterministic Lexical Tokenization & Fingerprint Folding (2012-2018)                             |
| Tools: libinjection, ModSecurity Rulesets (CRS)                                                         |
| Paradigm: Ultra-fast (<1µs) C state machines, 5-char token fingerprint abstraction (s&1c).              |
| Core Flaw: Token window exhaustion (32 tokens); comment exploits; state machine desync vs backend DBMS. |
+---------------------------------------------------------------------------------------------------------+
| Era 3: Metamorphic Testing & Relational Invariance Verification (2019-2023)                             |
| Tools: SQLancer (PQS, NoREC, TLP, DQP)                                                                  |
| Paradigm: Generating semantically valid queries to verify relational algebra invariants (count, null).  |
| Core Insight: Invariance verification eliminates false positives; transforms probing from error-hunting |
|               into rigorous mathematical relation checking.                                             |
+---------------------------------------------------------------------------------------------------------+
| Era 4: Semantic AST-Guided Mutation & Feedback Fuzzing (2020-2026)                                      |
| Tools: Squirrel, SQLRight, SMT-based constraint solvers                                                 |
| Paradigm: AST Intermediate Representation (IR), type-aware clause mutation, schema-guided synthesis.    |
| Core Insight: Grammar-guided boundary closure and semantic-preserving payload synthesis beat brute-     |
|               force dictionary blasting by orders of magnitude in request efficiency.                   |
+---------------------------------------------------------------------------------------------------------+
```

### 1.1 The Fundamental Dilemma in Current DAST Tooling
Contemporary application security testing tools suffer from a fundamental disconnect:
1. **Scanners (sqlmap, Burp, ZAP)** treat the remote database query as an **opaque, unknown black-box string**, attempting to inject syntactic errors or arbitrary boolean expressions through static string concatenation.
2. **Database Engine Fuzzers (SQLancer, Squirrel, SQLsmith)** understand the full **relational AST and DBMS grammar**, but operate under the assumption of full, unauthenticated query console access against an isolated database process.
3. **WAF Tokenizers (libinjection)** attempt to parse SQL grammar **in isolation from the query context**, unaware of whether the input is deposited inside a string literal, integer literal, identifier, `ORDER BY` clause, `JSON` path expression, or stored procedure argument.

### 1.2 Mission of this Forensic Study
To design a truly next-generation, evidence-driven SQLi detection engine, we must reverse-engineer the internal mechanics of these tools, rigorously identify where and why they fail, extract their genuine mathematical and architectural innovations, and synthesize them into a unified, causal, AST-guided, multi-oracle detection framework.

---

## 2. DEEP FORENSIC BREAKDOWN: SQLMAP (BERNARDO DAMELE & MIROSLAV STAMPAR)

`sqlmap` remains the most widely deployed open-source SQL injection automation tool. A deep reverse-engineering of its Python codebase (specifically `lib/core/`, `lib/request/`, `lib/techniques/`, and `xml/`) reveals the exact mechanisms of its generation, detection, comparison, and scheduling subsystems.

```
+---------------------------------------------------------------------------------------------------------+
|                                    SQLMAP ARCHITECTURAL ANATOMY                                         |
+---------------------------------------------------------------------------------------------------------+
|  +---------------------------------------------------------------------------------------------------+  |
|  | Target Request & Parameter Parser (URI, GET, POST, Cookie, Header, JSON, SOAP, Multipart)          |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | Injection Boundary Matrix Engine (xml/boundaries.xml)                                             |  |
|  | Combines: <prefix> + <payload> + <suffix> across Risk (1-3) & Level (1-5)                         |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | 6 Detection Technique Subsystems (xml/payloads/*.xml)                                             |  |
|  | 1. Boolean-blind  2. Error-based  3. UNION-query  4. Stacked-query  5. Time-blind  6. Inline-query |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | Dynamic Response Comparison Engine (lib/core/checks.py & fuzzy.py)                                |  |
|  | - SequenceMatcher ratio threshold (default 0.98)                                                  |  |
|  | - Dynamic page content stabilization (removeDynamicContent)                                       |  |
|  | - Reflected parameter string filtering                                                           |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | DBMS Fingerprint & Extraction Engine                                                              |  |
|  | - Error Regex Table (xml/errors.xml)                                                              |  |
|  | - Bisection / Bitwise Extraction Algorithms                                                       |  |
|  +---------------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1 Request Generation Architecture & Boundary Schema

`sqlmap` models SQL injection boundaries using static XML definitions located in `xml/boundaries.xml`. A boundary defines how user input is escaped and how the remaining original query is neutralized.

#### XML Boundary Definition Mechanics:
```xml
<boundary>
    <level>1</level>
    <risk>1</risk>
    <clause>1</clause>
    <where>1,2</where>
    <ptype>1</ptype>
    <prefix>'</prefix>
    <suffix> AND '[RANDSTR]'='[RANDSTR]</suffix>
</boundary>
```
* **`level` (1–5)**: Controls test breadth (higher levels test HTTP headers, cookies, and rarer boundary permutations).
* **`risk` (1–3)**: Controls payload aggressiveness (risk 3 includes heavy `UPDATE`/`OR`-based payloads that could corrupt database state).
* **`clause` (1–8)**: Bitmask mapping where the input lands in the SQL grammar:
  * `1`: `WHERE` / `HAVING` clause
  * `2`: `GROUP BY` clause
  * `3`: `ORDER BY` clause
  * `4`: `LIMIT` / `OFFSET` clause
  * `5`: `OFFSET` clause
  * `6`: `TOP` / `FETCH` clause
  * `7`: Column name / Table name
  * `8`: `SET` (in `UPDATE`)
* **`ptype`**: Parameter data type (e.g., 1: numeric, 2: string, 3: date/time).
* **`prefix` / `suffix`**: Fixed literal strings prepended and appended to the injection payload.

#### The Cartesian Explosion Vulnerability:
For a target URL with $P$ parameters:
$$\text{Total Requests} = P \times \sum_{\text{tech}=1}^{6} \left( |\text{Boundaries}_{\text{level,risk}}| \times |\text{Payloads}_{\text{tech,dbms}}| \right)$$
When scanning at Level 5 / Risk 3 across 10 parameters, `sqlmap` generates between **15,000 and 60,000 HTTP requests**, leading to WAF rate-limiting, server denial of service, or scanner timeout.

### 2.2 Deep Forensic Analysis of the 6 Detection Techniques

#### 1. Boolean-Based Blind Detection (`lib/techniques/blind/`)
* **Mechanism**: Injects a condition $C_{\text{true}}$ and a condition $C_{\text{false}}$.
  * $P_{\text{true}} = \text{prefix} + \text{ AND } (R_1=R_1) + \text{suffix}$
  * $P_{\text{false}} = \text{prefix} + \text{ AND } (R_1=R_2) + \text{suffix}$ (where $R_1 \neq R_2$).
* **Decision Logic**:
  $$\text{Ratio}(R_{\text{true}}, R_{\text{orig}}) \ge \theta \quad \land \quad \text{Ratio}(R_{\text{false}}, R_{\text{orig}}) < \theta \quad \land \quad \text{Ratio}(R_{\text{true}}, R_{\text{false}}) < \theta$$
  where $\theta$ is the calibrated dynamic threshold (default $0.98$).
* **Critical Flaws**:
  * If the page contains dynamic nonces, advertising widgets, user session timers, or stochastic recommendations, `Ratio(R_orig, R_orig)` fluctuates between $0.85$ and $0.95$, completely breaking the threshold.
  * `sqlmap` attempts `removeDynamicContent()` by stripping numbers and dynamic words, but fails on structural HTML/JSON layout mutations.

#### 2. Error-Based Detection (`lib/techniques/error/`)
* **Mechanism**: Injects mathematical or dialect functions designed to intentionally trigger database runtime errors that leak query results or prove execution:
  * *MySQL*: `EXTRACTVALUE(1, CONCAT(0x7e, (SELECT ...), 0x7e))` or `BIGINT UNSIGNED` overflow: `(SELECT 2*((SELECT 1e308)+0))`.
  * *PostgreSQL*: `CAST((SELECT ...) AS INT)`.
  * *MSSQL*: `CONVERT(INT, (SELECT ...))`.
  * *Oracle*: `CTXSYS.DRITHSX.SN(1, (SELECT ...))`.
* **Decision Logic**: Tests response text against ~300 hardcoded regular expressions in `xml/errors.xml`.
* **Critical Flaws**:
  * Rigid Regex Matching: Modern frameworks (Spring Boot, Django, ASP.NET Core, Laravel) catch database exceptions and return generic `500 Internal Server Error` or custom JSON `{"error": "Internal Error"}` with the actual DBMS message suppressed. `sqlmap` reports **FALSE NEGATIVE**.
  * Spurious Error Reflection: If a WAF or API gateway echoes input containing `syntax error` in a validation message, `sqlmap` triggers a **FALSE POSITIVE**.

#### 3. UNION Query-Based Detection (`lib/techniques/union/`)
* **Mechanism**:
  1. *Column Count Discovery*: Iteratively injects `ORDER BY N--` or `UNION SELECT NULL, NULL, ...` until an error occurs (or page changes).
  2. *Data Type Matching*: Injects unique string tokens (e.g., `'[RANDSTR]'`) into each column position to find which columns reflect into the output without type mismatch exceptions.
* **Critical Flaws**:
  * Fails completely on strongly-typed DBMS dialects (e.g., PostgreSQL) if the column being injected is of type `UUID`, `TIMESTAMP`, `BOOLEAN`, or `INTEGER`, and `NULL` coercion fails.
  * Ineffective if the application limits results to a single row (`LIMIT 1` or `SingleRowHandler`), or if results are consumed by backend ORM mappings without rendering to the HTTP response.

#### 4. Stacked Queries Detection (`lib/techniques/stacked/`)
* **Mechanism**: Injects a query terminating semicolon followed by an auxiliary SQL statement:
  * `; WAITFOR DELAY '0:0:5'--`
  * `; SELECT pg_sleep(5)--`
* **Critical Flaws**:
  * Execution Driver Blind Spot: PHP PDO (with default MySQL settings), Node.js `mysql2`, Python `psycopg2` (in default mode), and Go `database/sql` disable multi-statement query execution (`MYSQL_ATTR_MULTI_STATEMENTS = false`). `sqlmap` cannot detect SQLi in these applications via stacked queries even if the database supports it.

#### 5. Time-Based Blind Detection (`lib/techniques/time/`)
* **Mechanism**: Injects sleep/delay functions:
  * *MySQL*: `SLEEP(5)`
  * *PostgreSQL*: `pg_sleep(5)`
  * *MSSQL*: `WAITFOR DELAY '0:0:5'`
  * *Oracle*: `DBMS_PIPE.RECEIVE_MESSAGE('x', 5)`
  * *SQLite*: Heavy computation `LIKE` loops: `randomblob(100000000/2)`.
* **Decision Logic**:
  $$\text{Elapsed}(R_{\text{probe}}) \ge \text{Baseline} + \text{DelaySeconds} - \epsilon$$
* **Critical Flaws**:
  * Vulnerable to network latency spikes, proxy buffering, and server resource starvation.
  * `sqlmap` repeats the test 2–3 times with varying delays, but lacks formal sequential statistical hypothesis testing (such as Wald's Sequential Probability Ratio Test or Student's/Welch's $t$-test), leading to either excessive request counts or false positives under jitter.

#### 6. Inline Queries Detection (`lib/techniques/inline/`)
* **Mechanism**: Injects subqueries directly into expressions: `SELECT (SELECT '[RANDSTR]')`.
* **Critical Flaws**: Only valid when input lands within a subquery-capable scalar expression context (e.g. arithmetic, string concatenation).

---

### 2.3 Dynamic Comparison Engine (`checks.py`, `fuzzy.py`)

`sqlmap` computes similarity between responses using Python's standard `difflib.SequenceMatcher`:
```python
def checkRatio(first, second):
    matcher = SequenceMatcher(None, first, second)
    return matcher.quick_ratio()
```

#### Detailed Mathematical Vulnerabilities in SequenceMatcher:
1. **$O(N^2)$ Complexity**: For large HTML/JSON responses (e.g., >500 KB), `SequenceMatcher` causes CPU stalls in the scanner process.
2. **Structural Blindness**: `difflib` operates on flat string sequences (characters or lines), ignoring DOM AST and JSON tree hierarchy. A dynamic timestamp `<span class="time">12:04:05</span>` has the same lexical weight as a dynamic data row `<tr><td>Item 1</td></tr>`.
3. **Upper Ratio Ceiling Compression**: When a small 2-row table is injected into a massive 200 KB enterprise web page, the textual difference is $<0.1\%$ of the total byte stream. `SequenceMatcher.ratio()` returns `0.9992`, exceeding the `0.98` threshold and registering as **IDENTICAL** (False Negative).

---

### 2.4 DBMS Fingerprinting Logic & Session Management

1. **Active Query Fingerprinting**:
   * Runs dialect-specific boolean/error queries:
     * MySQL: `CONCAT('a', 'b') = 'ab'`, `VERSION() LIKE '%MySQL%'`, `CONNECTION_ID()`
     * PostgreSQL: `LENGTH('a'::text) = 1`, `VERSION() LIKE '%PostgreSQL%'`
     * MSSQL: `CHAR(97)+CHAR(98) = 'ab'`, `@@VERSION`
     * Oracle: `LENGTH('a'||'b') = 2`, `SELECT 1 FROM dual`
     * SQLite: `sqlite_version()`
2. **Session Caching (`--flush-session`, `.sqlmap/session/`)**:
   * Uses local SQLite database or text pickle files to store session targets, tested parameters, boundaries, and inferred DBMS.
   * **Flaw**: Stale session entries cause `sqlmap` to skip parameters or assume outdated schemas if the target application updates or modifies its routing logic.

---

### 2.5 Tamper Scripts Architecture & WAF Evasion Limitations

`sqlmap` includes ~60 tamper scripts (`tamper/*.py`) that modify generated payloads before transmission:
* `space2comment.py`: Replaces `' '` with `/**/`.
* `between.py`: Replaces `>` and `=` with `BETWEEN AND`.
* `charencode.py`: URL-encodes characters.
* `equaltolike.py`: Replaces `=` with `LIKE`.

#### Architectural Flaw of Tamper Scripts:
* **Token-Unaware String Replacement**: Tamper scripts use flat regular expressions (`re.sub`). They cannot construct context-aware semantic transformations (e.g., converting a boolean expression into a nested arithmetic predicate with type casting).
* **Static Signature Predictability**: Modern commercial WAFs (Cloudflare, AWS WAF, Imperva, F5 ASM) write token-based and ML-based signatures specifically against `sqlmap`'s known tamper scripts (e.g., catching `/*!50000SELECT*/` or `CONCAT(0x7e, ...)`).

---

## 3. DEEP FORENSIC BREAKDOWN: LIBINJECTION (NICK GALBREATH)

`libinjection` is an ultra-high-speed C library ($<1\mu\text{s}$ per scan, 0 heap allocations) widely embedded in WAFs (ModSecurity, Envoy, NGINX plugins, Cloudflare edge) to detect SQL injection payloads without regular expressions.

```
+---------------------------------------------------------------------------------------------------------+
|                                  LIBINJECTION PIPELINE FORENSICS                                        |
+---------------------------------------------------------------------------------------------------------+
|  User Input String (e.g. "admin' OR 1=1-- ")                                                            |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | Deterministic Lexer State Machine (libinjection_sqli.c)                                          |  |
|  | - Classifies characters into abstract token types:                                                |  |
|  |   's' = String, 'v' = Variable, '1' = Number, 'k' = Keyword, 'o' = Operator, 'c' = Comment, etc. |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | Token Folding Engine (libinjection_sqli_fold)                                                     |  |
|  | - Collapses consecutive tokens using semantic equivalence rules:                                  |  |
|  |   "1=1" -> '1'  |  "'a'='a'" -> '1'  |  "1 AND 1" -> '1'  |  "SELECT ... FROM" -> 'U'            |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | 5-Character Fingerprint Abstraction                                                              |  |
|  | - Extracts first 5 folded tokens: e.g. "s&1c" or "s&1v" or "1k&1"                                 |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | Binary Search over Sorted Fingerprint Table (sql_fingerprints.h)                                  |  |
|  | - ~8,000 pre-compiled dangerous fingerprints. If match found -> SQLI DETECTED                     |  |
|  +---------------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
```

### 3.1 Token Folding State Machine Mechanics

The core engine in `libinjection_sqli.c` transforms a raw character stream into a token stream:
1. `CHAR_STRING`: `'...'` or `"..."` $\rightarrow$ `s`
2. `CHAR_NUMBER`: `1234` or `0x1f` $\rightarrow$ `1`
3. `CHAR_WORD`: SQL keywords (`SELECT`, `UNION`, `WHERE`, `AND`, `OR`) $\rightarrow$ `k`, `U`, `&`
4. `CHAR_OP`: Operators (`=`, `<>`, `+`, `-`, `||`, `LIKE`) $\rightarrow$ `o`
5. `CHAR_COMMENT`: `/* ... */`, `-- ...`, `#` $\rightarrow$ `c`

#### The Folding Transformation:
When `libinjection` encounters logical tautologies, it collapses them:
* `admin' OR 1=1-- `
* Token stream: `v` (admin), `s` ('), `&` (OR), `1` (1), `o` (=), `1` (1), `c` (--)
* Folding step 1: `1 o 1` $\rightarrow$ `1`
* Folding step 2: `s & 1 c` $\rightarrow$ Fingerprint: `s&1c`
* Lookup: `s&1c` is present in `sql_fingerprints.h` $\rightarrow$ **FLAGGED AS SQLI**.

---

### 3.2 Critical Architectural Flaws & Evasion Modes

Because `libinjection` was optimized for microsecond speed and zero memory allocation, it made critical architectural compromises that enable reliable evasion:

#### Evasion Mode 1: Token Length Window Exhaustion (32-Token Limit)
`libinjection` allocates a fixed array `st_token_t tokens[32]`. If an input produces more than 32 tokens before the malicious SQL injection expression occurs, the tokenizer stops parsing or ignores subsequent tokens.
* **Exploit Payload**:
  ```sql
  /*a*//*b*//*c*//*d*//*e*//*f*//*g*//*h*//*i*//*j*//*k*//*l*//*m*//*n*//*o*//*p*//*q*//*r*//*s*//*t*//*u*//*v*//*w*//*x*//*y*//*z*//*1*//*2*//*3*//*4*//*5*//*6*/' OR 1=1--
  ```
  The 32 comment tokens consume the entire token window. The trailing `' OR 1=1--` is never processed into the fingerprint $\rightarrow$ **COMPLETE BYPASS**.

#### Evasion Mode 2: Dialect Syntax Gaps & Lexer Desynchronization
`libinjection` implements an approximate ANSI-SQL grammar and fails on vendor-specific syntactic constructs:
* **PostgreSQL Dollar Quoting**:
  ```sql
  $$; SELECT pg_sleep(5);--$$
  ```
  `libinjection` does not recognize `$$` as a string boundary in default modes, misclassifying it as operators or variables and generating an unflagged fingerprint $\rightarrow$ **BYPASS**.
* **PostgreSQL JSONB Operators**:
  ```sql
  ' OR data->>'role' = 'admin'--
  ```
  `->>` is tokenized incorrectly, yielding an unknown fingerprint not in the static lookup table.
* **MySQL Inline Whitespace String Concatenation**:
  ```sql
  ' OR 'a' 'b' = 'ab'--
  ```
  MySQL treats `'a' 'b'` as `'ab'`. `libinjection` tokenizes this as `s s o s`, which does not fold into `s o s` and fails fingerprint lookup.
* **SQLite Blob Literals**:
  ```sql
  X'414243'
  ```
  Tokenized as variable `X` followed by string literal, causing folding desync.

#### Evasion Mode 3: Zero Query Context Awareness
`libinjection` only sees the payload in isolation. It cannot determine:
* Did this input land inside a `WHERE id = [INPUT]` (numeric context)?
* Did it land inside an `ORDER BY [INPUT]` (identifier/expression context)?
* Did it land inside a `SELECT * FROM [INPUT]` (table name context)?
Because of this, an input like `1, (SELECT 1 FROM users)` may be flagged as benign if formatted atypically, yet completely alters the query AST when executed.

---

## 4. DEEP FORENSIC BREAKDOWN: SQLANCER (MANUEL RIGGER & ZHENDONG SU)

`SQLancer` (Testing Database Management Systems via Automatic Query Generation) revolutionized DBMS vulnerability and logic bug detection. Its fundamental contribution is **Metamorphic Testing (MT)** over relational database invariants.

```
+---------------------------------------------------------------------------------------------------------+
|                                    SQLANCER METAMORPHIC TESTING PARADIGMS                               |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  1. PQS (Pivoted Query Synthesis)                                                                       |
|     Pivot Row (R)  ---> Synthesize Predicate P where P(R) = TRUE ---> Query Q with WHERE P              |
|     Invariant: Result(Q) MUST CONTAIN Pivot Row R.                                                      |
|                                                                                                         |
|  2. NoREC (Non-optimizing Reference Engine Construction)                                                |
|     Optimized Query:   SELECT count(*) FROM T WHERE P;         (Uses Optimizer & Indexes)               |
|     Reference Query:   SELECT sum(P IS TRUE) FROM T;           (Bypasses Optimizer via Projection)     |
|     Invariant: count(*) == sum(P IS TRUE).                                                              |
|                                                                                                         |
|  3. TLP (Ternary Logic Partitioning)                                                                    |
|     Q1 = SELECT * FROM T WHERE P;                                                                       |
|     Q2 = SELECT * FROM T WHERE NOT(P);                                                                  |
|     Q3 = SELECT * FROM T WHERE P IS NULL;                                                               |
|     Q_all = SELECT * FROM T;                                                                            |
|     Invariant: Result(Q_all) == Result(Q1) UNION ALL Result(Q2) UNION ALL Result(Q3).                  |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

### 4.1 Metamorphic Testing Algorithms: Deep Mathematical Formulation

#### 1. Pivoted Query Synthesis (PQS)
* **Goal**: Detect logic bugs where an optimizer incorrectly prunes rows satisfying a predicate.
* **Algorithm**:
  1. Pick a randomly selected existing database row $R = \langle v_1, v_2, \dots, v_n \rangle$ from table $T$.
  2. Recursively generate a boolean expression tree $P$ containing column references, function calls, arithmetic operations, and subqueries.
  3. Evaluate $P(R)$ under three-valued SQL logic ($\{\text{TRUE}, \text{FALSE}, \text{NULL}\}$).
  4. If $P(R) = \text{FALSE}$, mutate $P \rightarrow \text{NOT}(P)$. If $P(R) = \text{NULL}$, mutate $P \rightarrow P \text{ IS NULL}$.
  5. Execute `SELECT * FROM T WHERE P;`.
  6. **Oracle**: If $R \notin \text{ResultSet}$, a bug is proven.

#### 2. Non-optimizing Reference Engine Construction (NoREC)
* **Goal**: Find optimizer bugs without building a separate reference database engine.
* **Algorithm**:
  * Evaluates predicate $P$ in two mathematically equivalent execution paths:
    $$\text{Path 1 (Optimized Filter): } Q_{\text{opt}} = \text{SELECT count(*) FROM } T \text{ WHERE } P$$
    $$\text{Path 2 (Unoptimized Projection): } Q_{\text{ref}} = \text{SELECT sum(CASE WHEN } P \text{ THEN 1 ELSE 0 END) FROM } T$$
  * In $Q_{\text{opt}}$, the query optimizer pushes $P$ into index scans, partition pruning, and join filters.
  * In $Q_{\text{ref}}$, the database executes a full table scan, evaluating $P$ row-by-row in the `SELECT` projection list.
  * **Oracle**: $Q_{\text{opt}} \equiv Q_{\text{ref}}$. If counts differ, the optimizer contains a soundness bug.

#### 3. Ternary Logic Partitioning (TLP)
* **Goal**: Partition the domain of any predicate into three disjoint sets based on SQL ternary logic ($\text{TRUE}, \text{FALSE}, \text{NULL}$).
* **Theorem**: For any table $T$ and arbitrary boolean predicate $P$:
  $$T = \{ r \in T \mid P(r) = \text{TRUE} \} \uplus \{ r \in T \mid P(r) = \text{FALSE} \} \uplus \{ r \in T \mid P(r) = \text{NULL} \}$$
* **Multiset Invariant**:
  $$\text{Bag}(Q_{\text{orig}}) = \text{Bag}(Q_1) + \text{Bag}(Q_2) + \text{Bag}(Q_3)$$
  where:
  * $Q_1 = \text{SELECT * FROM } T \text{ WHERE } P$
  * $Q_2 = \text{SELECT * FROM } T \text{ WHERE NOT}(P)$
  * $Q_3 = \text{SELECT * FROM } T \text{ WHERE } P \text{ IS NULL}$
  * $Q_{\text{orig}} = \text{SELECT * FROM } T$

---

### 4.2 Transforming SQLancer Metamorphic Invariance into DAST Probing

Conventional DAST tools probe for SQL injection by trying to break queries (looking for syntax errors or fixed string differences). By adapting SQLancer's metamorphic testing to remote web applications, we can probe for **relational invariance over HTTP**:

```
+---------------------------------------------------------------------------------------------------------+
|                                ADAPTING METAMORPHIC TESTING TO DAST PROBING                             |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  Probe 1: Baseline Request (B)          ---> Parameter = V                                              |
|  Probe 2: True Invariance Probe (T)     ---> Parameter = V' AND (1337=1337) [Or AST equivalent]         |
|  Probe 3: False Invariance Probe (F)    ---> Parameter = V' AND (1337=1338)                             |
|  Probe 4: Null Invariance Probe (N)     ---> Parameter = V' AND (NULL IS NULL)                          |
|  Probe 5: Identity Mutation (I)         ---> Parameter = V' AND NOT(NOT(1337=1337))                     |
|                                                                                                         |
|  RELATIONAL INVARIANCE ORACLE:                                                                          |
|  1. If Response(B) == Response(T) == Response(N) == Response(I)                                         |
|     AND Response(B) != Response(F)                                                                      |
|     ---> SQL INJECTION IS PROVEN MATHEMATICALLY WITH ZERO FALSE POSITIVES.                              |
|                                                                                                         |
|  2. If Response(T) != Response(I)                                                                       |
|     ---> Target is performing literal string matching on the parameter (BENIGN/NOT VULNERABLE).         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 5. DEEP FORENSIC BREAKDOWN: SQLRIGHT & SQUIRREL (AST-GUIDED COVERAGE FUZZERS)

Database fuzzers like **Squirrel** (USENIX Security 2020) and **SQLRight** (ACM CCS 2022) solved the problem of generating syntactically valid yet semantically rich SQL statements using **AST-guided Intermediate Representation (IR)** mutation.

```
+---------------------------------------------------------------------------------------------------------+
|                               SQUIRREL / SQLRIGHT AST MUTATION PIPELINE                                 |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  SQL Statement Seed (e.g. "SELECT a FROM t WHERE b > 10")                                               |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | AST Parser & Intermediate Representation (IR) Decomposition                                       |  |
|  | Root: QueryStmt                                                                                   |  |
|  | ├── SelectList: [ColumnRef(a)]                                                                    |  |
|  | ├── FromClause: [TableRef(t)]                                                                     |  |
|  | └── WhereClause: BinaryExpr('>', ColumnRef(b), Literal(10))                                       |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | Type-Aware & Semantic-Preserving Subtree Mutator                                                  |  |
|  | - Replaces BinaryExpr with type-compatible subtree from Pool:                                     |  |
|  |   BinaryExpr('IN', ColumnRef(b), Subquery("SELECT id FROM u WHERE active=1"))                    |  |
|  | - Preserves schema scope, column data types, and enclosing syntactic delimiters                   |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +-------------------------------------------------+-------------------------------------------------+  |
|  | AST Serializer (Emits dialect-perfect SQL query string for execution)                            |  |
|  +---------------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
```

### 5.1 Lessons for Next-Generation SQLi Detection
1. **Dynamic Boundary Closure**: Instead of trying static prefixes (`'`, `")`, `')`), parse the expected AST context and synthesize the exact closing token sequence required to balance the AST.
2. **Subtree Splicing for Polyglot Syntheses**: Instead of blind fuzzing, dynamically construct an AST subtree that is valid across multiple dialect grammars simultaneously.

---

## 6. DEEP FORENSIC BREAKDOWN: SQLSMITH (ANDREAS SELTENREICH)

`SQLsmith` generates random SQL queries from a live database schema catalog to trigger execution errors and optimizer crashes.

### 6.1 Architecture & Production Grammar
* Reads system catalog tables (`pg_catalog`, `information_schema`, `sqlite_master`).
* Recursively expands grammar productions:
  $$\text{Query} \to \text{SELECT } \text{ProjList} \text{ FROM } \text{TableRef} \text{ WHERE } \text{Expr}$$
  $$\text{Expr} \to \text{Expr} \oplus \text{Expr} \mid \text{FuncCall}(\text{Expr}^k) \mid \text{CaseExpr} \mid \text{Subquery}$$

### 6.2 Limitations for Remote SQLi Probing
* `SQLsmith` generates *complete, standalone queries*, whereas SQL injection requires generating *syntactically balanced AST fragments* that seamlessly splice into an unseen, partially constructed backend query.

---

## 7. DEEP FORENSIC BREAKDOWN: DAST & COMMERCIAL SCANNER ENGINES

A comparative forensic analysis of commercial and enterprise DAST engines reveals how they balance speed, coverage, and false positives.

```
+--------------------+-------------------------+-------------------------+-------------------------+
| SCANNER / ENGINE   | DETECTION MECHANISMS    | PARAMETER HANDLING      | MAJOR BLIND SPOTS       |
+--------------------+-------------------------+-------------------------+-------------------------+
| Burp Suite Pro     | - Differential Probing  | - URL, Body, Cookie,    | - Dynamic noise jitter  |
| (PortSwigger)      | - OAST (Collaborator)   |   JSON, XML, Multipart, | - No formal AST solver  |
|                    | - Heuristic Error Regex |   REST path params      | - High request counts   |
+--------------------+-------------------------+-------------------------+-------------------------+
| OWASP ZAP          | - Error Regex Matching  | - URL, Form POST,       | - Extreme FP on noisy   |
|                    | - Fixed Delay Timing    |   Basic JSON            |   applications          |
|                    | - Static Diffing        |                         | - No OAST correlation   |
+--------------------+-------------------------+-------------------------+-------------------------+
| Nuclei             | - Declarative YAML      | - Raw HTTP templates,   | - Cannot do adaptive,   |
| (ProjectDiscovery) |   Matching (Regex,      |   Static payload lists  |   multi-step hypothesis |
|                    |   Status Codes, DSL)    |                         |   refinement or AST-gen |
+--------------------+-------------------------+-------------------------+-------------------------+
| Arachni            | - Differential Trainer  | - Recursive DOM/JSON/   | - Unmaintained; slow;   |
|                    | - Code Injection Audits |   XML extraction        |   high memory usage     |
+--------------------+-------------------------+-------------------------+-------------------------+
| Acunetix /         | - DeepScan DOM crawler  | - JSON, GraphQL, REST,  | - Requires agent for    |
| Invicti            | - IAST AcuSensor Agent  |   SOAP, WebSockets      |   high accuracy (IAST)  |
+--------------------+-------------------------+-------------------------+-------------------------+
```

### 7.1 Key Insights from DAST Forensics
1. **Out-of-Band Application Security Testing (OAST)**: Burp Collaborator / Interactsh is the most definitive oracle for second-order or asynchronous blind SQLi (e.g. `LOAD_FILE('\\\\collab\\x')`, `UTL_HTTP.REQUEST`, `xp_dirtree`), because external DNS/HTTP callbacks provide $100\%$ causal confirmation.
2. **Differential Response Scoring**: Burp's arithmetic probes (e.g. `id=1337-1330` vs `id=7`) provide high-confidence evidence in numeric contexts without triggering WAF keyword filters.

---

## 8. DEEP FORENSIC BREAKDOWN: SQL GRAMMARS, PARSERS & PARSER DIFFERENTIALS

A critical vulnerability in modern detection and defense tooling is **Parser Differential**: the structural divergence between how a scanner or WAF parses SQL versus how the backend database server executes it.

```
+---------------------------------------------------------------------------------------------------------+
|                                    PARSER DIFFERENTIAL ARCHITECTURE                                     |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|                      Raw HTTP Request Payload: "1 /*!50000OR*/ 1=1"                                     |
|                                     |                                                                   |
|                  +------------------+------------------+                                                |
|                  |                                     |                                                |
|                  v                                     v                                                |
|     +-------------------------+           +-------------------------+                                   |
|     | Scanner / WAF Parser    |           | Backend DBMS Lexer      |                                   |
|     | (e.g. sqlparser-rs /    |           | (e.g. MySQL 8.0 Engine) |                                   |
|     | libinjection)           |           |                         |                                   |
|     | - Treats /*!...*/ as a  |           | - Executes conditional  |                                   |
|     |   benign block comment. |           |   comment as active     |                                   |
|     | - AST: Literal(1)       |           |   SQL tokens!           |                                   |
|     |                         |           | - AST: Expr(1 OR 1=1)   |                                   |
|     +-------------------------+           +-------------------------+                                   |
|                  |                                     |                                                |
|                  v                                     v                                                |
|     Verdict: BENIGN (PASS)               Verdict: EXECUTED MALICIOUSLY                                  |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

### 8.1 Comparative Analysis of SQL Parser Libraries

| Parser Library | Language | Dialect Fidelity | Strengths | Critical Gaps |
|---|---|---|---|---|
| `sqlparser-rs` | Rust | High (Generic, Postgres, MySQL, SQLite, MSSQL, BigQuery, Snowflake) | Fast, safe, native Rust AST, extensible dialect traits | Strict syntax enforcement; rejects incomplete injection fragments |
| `pg_query` / `libpg_query` | C / Rust | $100\%$ (Actual PostgreSQL 16 server C parser) | Identical lexical and syntactic behavior to real PostgreSQL server | Postgres-only; heavyweight C bindings |
| `sqlfluff` | Python | Broad dialect coverage | Linter-friendly flexible grammar | Slow execution; poor suitability for high-throughput scanning |
| `Tree-sitter SQL` | C / WASM | Moderate | Fault-tolerant incremental parsing; handles partial syntax | Incomplete coverage of vendor-specific dialect edge cases |

### 8.2 Database Dialect Syntax Variants Matrix

```
+---------------+------------------------+------------------------+------------------------+------------------------+
| DIALECT       | STRING DELIMITERS      | IDENTIFIER ESCAPES     | COMMENT SYNTAXES       | CONCATENATION          |
+---------------+------------------------+------------------------+------------------------+------------------------+
| PostgreSQL    | '...', $$...$$, $tag$  | "ident"                | -- ..., /* ... */      | 'a' || 'b'             |
+---------------+------------------------+------------------------+------------------------+------------------------+
| MySQL/MariaDB | '...', "...", `...`    | `ident`, "ident"       | -- ..., #, /*...*/,    | CONCAT('a','b'),       |
|               |                        |                        | /*!50000...*/          | 'a' 'b' (whitespace)   |
+---------------+------------------------+------------------------+------------------------+------------------------+
| SQLite        | '...', "..." (fallback)| "ident", [ident], `id` | -- ..., /* ... */      | 'a' || 'b'             |
+---------------+------------------------+------------------------+------------------------+------------------------+
| MSSQL         | '...', N'...'          | [ident], "ident"       | -- ..., /* ... */      | 'a' + 'b'              |
+---------------+------------------------+------------------------+------------------------+------------------------+
| Oracle        | '...', q'[...]', N'...'| "ident"                | -- ..., /* ... */      | 'a' || 'b'             |
+---------------+------------------------+------------------------+------------------------+------------------------+
```

---

## 9. SYSTEMATIC 22-DIMENSION ARCHITECTURAL CAPABILITY MATRIX

The following comprehensive matrix benchmarks all surveyed tools and paradigms across 22 fundamental architectural dimensions:

```
+=========================================================================================================================================+
| DIMENSION                           | sqlmap    | libinjection | SQLancer  | Squirrel/SQLRight | Burp Pro  | OWASP ZAP | Next-Gen Target |
+=========================================================================================================================================+
| 1. Query AST Awareness              | None      | Lexical only | Complete  | Complete (IR)     | None      | None      | Full Dynamic IR |
| 2. Relational Invariance Testing    | No        | No           | Yes (MT)  | No                | Partial   | No        | Complete (TLP)  |
| 3. Dynamic Content Stabilization    | Weak      | N/A          | N/A       | N/A               | Moderate  | Weak      | DOM/JSON CTE    |
| 4. Statistical Timing (SPRT/Welch)  | No (Fixed)| N/A          | N/A       | N/A               | No (Fixed)| No (Fixed)| Rigorous SPRT   |
| 5. Dialect Parser Fidelity          | Heuristic | Partial      | Native    | Native            | Heuristic | Heuristic | Multi-Dialect   |
| 6. Boundary Closure Solving         | Static XML| N/A          | Generator | AST Mutator       | Static    | Static    | Dynamic Solver  |
| 7. Causal Confirmation Logic        | No        | N/A          | Formal    | Coverage          | Partial   | No        | Formal DAG      |
| 8. Execution Speed per Probe        | Medium    | <1µs (Fast)  | Fast      | Fast              | Medium    | Medium    | Native Rust     |
| 9. Out-of-Band (OAST) Integration   | Weak      | No           | No        | No                | Yes       | No        | Native AES-OAST |
| 10. Memory Allocation Overhead      | High      | Zero (Stack) | Moderate  | Moderate          | High      | High      | Zero-Copy Arena |
| 11. Multi-Step / Stored SQLi        | Manual    | No           | No        | No                | Partial   | No        | State Machine   |
| 12. JSON / GraphQL / REST Handling  | Basic     | No           | No        | No                | Advanced  | Moderate  | AST Insertion   |
| 13. WAF Evading Semantic Synthesis  | Static    | N/A          | N/A       | Grammar Pool      | Heuristic | Weak      | SMT & AST Mut   |
| 14. Second-Order Confirmation       | No        | No           | No        | No                | Partial   | No        | Graph Tracing   |
| 15. Combinatorial Explosion Control | Poor      | N/A          | N/A       | MCTS / Feedback   | Moderate  | Poor      | Bayesian InfoGain|
| 16. Evidence Provenance & Cryptography| None    | None         | Test Case | Seed Corpus       | Log only  | Log only  | SHA-256 CAS Merkle|
| 17. Error Message Oracle Type       | Regex Dict| None         | Crash Log | Crash Log         | Regex Dict| Regex Dict| AST Error Class |
| 18. Strongly-Typed UNION Solving    | BruteForce| No           | Generator | Generator         | BruteForce| BruteForce| Type Coercion   |
| 19. Stacked Query Driver Awareness  | No        | No           | N/A       | N/A               | No        | No        | Driver Matrix   |
| 20. Zero-False-Positive Guarantee   | No        | No           | Yes (Math)| Yes (Coverage)    | No        | No        | Fail-Closed SEC |
| 21. Schema Discovery via Fuzzing    | Dump query| No           | Catalog   | Schema Graph      | No        | No        | Differential Ext|
| 22. Fail-Closed Scope Safety Gate   | CLI Flag  | N/A          | N/A       | N/A               | Scope UI  | Scope UI  | SEC-01 Hard Gate|
+=========================================================================================================================================+
```

---

## 10. DEEP FAILURE MODE, EVASION & BLIND SPOT CATALOG

A forensic catalog of the 14 primary architectural failure modes across existing open-source and commercial engines:

### FM-01: Rigid Regex-Based Error Parsing
* **Root Cause**: Reliance on static regular expression dictionaries (`xml/errors.xml`).
* **Failure Mechanic**: When backend frameworks (ASP.NET Core, Spring, Django) intercept SQL exceptions and return custom error envelopes (e.g. HTTP 500 with generic JSON), regex parsers find zero matches, producing a **False Negative**. Conversely, if an application reflects user input on validation error pages containing terms like "syntax error", a **False Positive** is triggered.

### FM-02: Static Boundary Template Explosion & Context Mismatch
* **Root Cause**: Using hardcoded prefix/suffix strings from static XML files.
* **Failure Mechanic**: If user input lands inside a complex nested subquery, e.g.:
  ```sql
  SELECT * FROM items WHERE id = (SELECT item_id FROM orders WHERE user_id = [INPUT] AND status = 1)
  ```
  A static boundary like `' OR '1'='1` fails because it does not close the enclosing parenthesis of the subquery `(SELECT ...)`. Testing all possible nested parenthesis combinations ($1$ to $10$ parens $\times$ quotes $\times$ comments) leads to exponential request volume.

### FM-03: Lack of Semantic Query AST Understanding
* **Root Cause**: Treating target parameters as opaque string interpolations.
* **Failure Mechanic**: Scanners cannot determine whether an input is injected into an identifier (table/column name), a literal, an `ORDER BY` expression, or a `LIMIT` clause. In `ORDER BY`, boolean operators (`AND 1=1`) cause syntax errors on PostgreSQL and SQLite unless written as conditional expressions: `ORDER BY (CASE WHEN 1=1 THEN id ELSE name END)`.

### FM-04: Vulnerability to Stochastic Response Jitter
* **Root Cause**: Relying on flat string similarity metrics (e.g. `difflib.SequenceMatcher`).
* **Failure Mechanic**: Modern Single-Page Applications (SPAs) and API endpoints frequently return dynamic timestamps, anti-CSRF nonces, random advertisement banners, or varying JSON array order. These dynamic variations drop the sequence similarity below fixed thresholds (e.g., $<0.98$), causing false blind SQLi detections or masking genuine vulnerability differentials.

### FM-05: Token Window Exhaustion in WAF State Machines (libinjection)
* **Root Cause**: Hardcoded maximum token count array (`tokens[32]`).
* **Failure Mechanic**: Prepending 32 comment tokens `/*pad*/` exhausts the parser's internal capacity, causing the actual injection payload to be skipped completely.

### FM-06: Lexer / Parser Desynchronization
* **Root Cause**: Scanner/WAF parsers implementing subset ANSI-SQL grammars that diverge from dialect-specific DBMS lexers.
* **Failure Mechanic**: Constructs such as MySQL conditional comments (`/*!50000SELECT*/`), PostgreSQL dollar quotes (`$$...$$`), or MSSQL bracket quoting (`[user]`) are parsed as comments or operators by the scanner/WAF but executed as valid SQL queries by the backend DBMS.

### FM-07: Strongly-Typed Dialect UNION Incompatibility
* **Root Cause**: Blindly injecting `NULL` or string literals during UNION column exploration.
* **Failure Mechanic**: PostgreSQL and strict Oracle configurations reject `UNION SELECT 'a', 'b'` if the underlying columns are `INTEGER`, `UUID`, or `BOOLEAN`, resulting in silent query termination without clear reflection.

### FM-08: Timing Inference Corruption via Network Contention
* **Root Cause**: Using fixed sleep durations (e.g., 5 seconds) and comparing against simple threshold offsets.
* **Failure Mechanic**: Shared hosting, database connection pool exhaustion, or transient network delays cause a benign request to take $>5\text{s}$, triggering a False Positive. Conversely, WAF request timeout killing long queries causes a False Negative.

### FM-09: Second-Order & Asynchronous Workflow Disconnect
* **Root Cause**: Assuming immediate HTTP response reflection for injected payloads.
* **Failure Mechanic**: Payloads stored in a profile name, user agent log, or webhook queue execute hours later in a background report generator or admin dashboard. Stateless scanners cannot track stateful multi-step causal execution.

### FM-10: Serialization & Encoding Blindness (JSON, GraphQL, Protobuf)
* **Root Cause**: Treating input streams as flat URL-encoded key-value pairs.
* **Failure Mechanic**: Payloads embedded inside deeply nested JSON trees, GraphQL variables, or binary Protobuf messages are not properly parsed, escaped, or injected with valid syntactic delimiters.

### FM-11: Lack of Causal Confirmation (Spurious Correlation)
* **Root Cause**: Inferring vulnerability from a single anomalous response without verifying bidirectional causal control.
* **Failure Mechanic**: A server transient error or rate-limiting response coinciding with an injection probe is logged as a finding without running positive/negative control verification cycles.

### FM-12: ORM & Query Builder Blind Spots
* **Root Cause**: Testing only for classic raw SQL concatenation.
* **Failure Mechanic**: Object-Relational Mappers (Hibernate, Prisma, Sequelize, Django ORM, ActiveRecord) introduce unique injection vectors (e.g., JSON key injections, HQL/JPQL injections, column name ordering injections) that do not respond to generic SQL-92 payloads.

### FM-13: WAF Heuristic Trapping & IP Banning
* **Root Cause**: Firing known, high-entropy signature payloads (`UNION SELECT`, `CONCAT(0x7e)`, `SLEEP(5)`).
* **Failure Mechanic**: The scanner gets blocked after 10 requests, leaving $99\%$ of the application surface untested.

### FM-14: Exponential Request Budget Exhaustion
* **Root Cause**: Brute-force permutation of parameters $\times$ boundaries $\times$ payloads $\times$ techniques.
* **Failure Mechanic**: Enterprise scans on modern microservice APIs with hundreds of endpoints run for days, hitting rate limits and consuming excessive computing resources.

---

## 11. ARCHITECTURAL SYNTHESIS: WHAT TO EXTRACT, MODERNIZE, AND DISCARD

To architect the Next-Generation Evidence-Driven SQL Injection Detection Engine, we establish a definitive policy regarding existing tools and research techniques:

```
+---------------------------------------------------------------------------------------------------------+
|                                  ARCHITECTURAL SYNTHESIS DIRECTIVE                                      |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [EXTRACT & INTEGRATE]                                                                                  |
|  1. Metamorphic Invariance Verification (from SQLancer): TLP, NoREC, and PQS adapted to DAST.           |
|  2. AST Intermediate Representation & Mutation (from Squirrel/SQLRight): Type-aware subtree splicing.   |
|  3. Micro-Tokenizer Principles (from libinjection): High-speed pre-filtering without regex bottlenecks.  |
|  4. Dialect-Specific Schema Intelligence (from SQLsmith): Grammatical production expansion.             |
|  5. Out-of-Band Callback Cryptography (from Burp/Interactsh): Unique token correlation.                 |
|                                                                                                         |
|  [MODERNIZE & RE-ENGINEER]                                                                              |
|  1. Replace SequenceMatcher with Structural DOM/JSON AST Invariant Diffing.                             |
|  2. Replace Fixed Sleep Delays with Wald's Sequential Probability Ratio Test (SPRT) & Welch's t-Test.  |
|  3. Replace Static XML Boundaries with Dynamic SMT-Guided AST Boundary Solvers.                        |
|  4. Replace Heuristic Error Regex with Dialect-Specific Grammar Exception AST Classifiers.              |
|  5. Replace Linear Parameter Scanning with Bayesian Active Learning & Information-Gain Scheduling.     |
|                                                                                                         |
|  [COMPLETELY DISCARD]                                                                                   |
|  1. Flat regular-expression error matching dictionaries.                                                |
|  2. Brute-force 100,000-payload dictionary blasting.                                                   |
|  3. Static, token-unaware WAF tamper scripts.                                                           |
|  4. Uncalibrated single-request timing checks.                                                          |
|  5. Assumption of unauthenticated root query console access.                                           |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 12. FORMAL SPECIFICATIONS & PRINCIPLES FOR THE NEXT-GEN EVIDENCE ENGINE

The next-generation engine must be constructed upon eight non-negotiable architectural subsystems:

1. **Deterministic Multi-Oracle Verification Engine**:
   * Findings are only promoted if confirmed by at least two independent oracles (e.g., Metamorphic Relational Invariance Oracle + Differential Arithmetic Oracle, or Error AST Oracle + OAST Cryptographic Callback).
2. **Dynamic AST Grammar & Boundary Solver**:
   * Employs native Rust SQL dialect parsers (`sqlparser-rs` extended with dialect grammar plugins) to dynamically solve the minimal enclosing syntactic boundary for any injection point.
3. **Statistical Sequential Hypothesis Engine (SPRT & Welch $t$-Test)**:
   * Replaces arbitrary sleep thresholds with continuous statistical hypothesis testing:
     $$H_0: \mu_{\text{probe}} = \mu_{\text{baseline}} \quad \text{vs} \quad H_1: \mu_{\text{probe}} \ge \mu_{\text{baseline}} + \Delta$$
     Guarantees mathematically bounded false-positive ($\alpha \le 0.001$) and false-negative ($\beta \le 0.01$) rates under severe network jitter.
4. **Metamorphic Invariance DAST Oracle (TLP / NoREC for Web)**:
   * Probes for SQL injection by verifying logical and relational invariants ($P \land \text{TRUE} \equiv P$, $P \lor \text{FALSE} \equiv P$, Ternary Logic Partitioning) rather than attempting to induce crashes.
5. **Causal Evidence DAG & Merkle Proof Chain**:
   * Every finding is backed by a directed acyclic graph (DAG) of verified hypotheses, observations, and bit-level reproducible raw HTTP transactions stored in a Content-Addressable Storage (CAS) Merkle tree.
6. **Bayesian Adaptive Test Planner**:
   * Computes expected information gain (EIG) per request to prioritize high-probability parameters and prune unviable injection paths, minimizing target request budget.
7. **Dialect-Aware Parser Differential Mitigator**:
   * Maintains accurate lexer/parser specifications for all major database engines (PostgreSQL, MySQL, SQLite, MSSQL, Oracle, CockroachDB, Snowflake) to prevent WAF and scanner desynchronization.
8. **Fail-Closed Security & Target Authorization Gate**:
   * Strictly enforces scope validation (SEC-01) and destructive action safety gates (SEC-02/SEC-03) before dispatching active probes.

---
*End of Dossier `RESEARCH_OPEN_SOURCE_STUDY.md` — Authoritative Open-Source Forensics Complete.*
