# Scanner Runtime Call Graph & Execution Tracing

This document traces the exact step-by-step execution path when an operator triggers a scan or sends a request to the SQL Scanner.

---

## 1. App Scanner Live Execution Trace (Current GUI Runtime)

```
[Operator Action: Click "Start Live Deep Scan"]
       │
       ▼
[UI Layer: SqlScannerWorkspaceView.tsx]
       │  Calls `startScan()` action
       ▼
[Store Layer: sqlScannerStore.ts (Zustand)]
       │  Validates safetyConfig.authorizedTestingConfirmed
       │  Sets tab state: `scanState: 'running'`, `scanVerdict: 'IN_PROGRESS'`
       │  Instantiates `SqlScanOrchestrator`
       │  Attaches callbacks: `onLog`, `onProgress`, `onFinding`, `onCatalog`
       ▼
[Orchestrator Layer: SqlScanOrchestrator.ts]
       │
       ├─► Step 1: Baseline Establishment (`executeProbe`)
       │     └─► Sends 3 identical baseline requests via `ipcClient.sendRepeaterRequest`
       │     └─► Computes median latency, body length, status, and baseline hash
       │
       ├─► Step 2: Context & Parameter Detection (`RequestParser.ts`, `ContextDetector.ts`)
       │     └─► Discovers parameters (Query, Path, Cookie, Form, JSON, XML, GraphQL, Headers)
       │     └─► Classifies injection contexts (Numeric, Single Quote String, Double Quote, Like Clause)
       │
       ├─► Step 3: WAF & Defense Probing (`WafDetector.ts`)
       │     └─► Tests passive WAF signatures and active probe blocking responses
       │
       ├─► Step 4: Parameter Probing Loop (For each candidate parameter)
       │     │
       │     ├─► 4a. Error-Based Probing (`ErrorTester.ts`)
       │     │     └─► Injects error delimiters (`'`, `"`, `')`, `CAST(...)`)
       │     │     └─► Evaluates responses against 30+ DBMS syntax & conversion regexes
       │     │     └─► Calls 3x reproduction loop (`verifyReproduction`)
       │     │
       │     ├─► 4b. Boolean-Based Differential (`BooleanTester.ts`)
       │     │     └─► Evaluates TRUE vs FALSE pairs (`' AND '1'='1` vs `' AND '1'='2`)
       │     │     └─► Checks body length delta and marker stability
       │     │
       │     ├─► 4c. Time-Based Blind (`TimeBasedTester.ts`)
       │     │     └─► Injects `pg_sleep()`, `SLEEP()`, `WAITFOR DELAY`
       │     │     └─► Measures latency vs baseline median + threshold
       │     │
       │     ├─► 4d. Stacked Query Probing (`StackedTester.ts`)
       │     │     └─► Injects `; SELECT pg_sleep(3)--`
       │     │
       │     └─► 4e. ORDER BY & UNION Canary Probing (`UnionTester.ts`)
       │           └─► Probes column boundaries (1..12) via ORDER BY
       │           └─► Injects NULL-based UNION canary markers (`canary_X_Y`)
       │
       ├─► Step 5: Finding Registration & Confidence Fusion (`ConfidenceEngine.ts`)
       │     └─► Calculates confidence score (0-100) and registers `SqlScanFinding`
       │
       ├─► Step 6: Dynamic DBMS Version Extraction (`DatabaseAdapters.ts`)
       │     └─► Queries `version()`, `@@version`, `banner FROM v$version`
       │
       ├─► Step 7: Adaptive Calibration & Schema Discovery (`AdaptivePayloadEngine.ts`)
       │     │
       │     ├─► Path A: Direct UNION information_schema Extraction
       │     │     └─► Injects `UNION SELECT table_name FROM information_schema.tables`
       │     │
       │     ├─► Path B: UNION Bruteforce Querying
       │     │     └─► Iterates known high/medium priority table lists
       │     │
       │     ├─► Path C: Direct Error-Based CAST Schema Extraction (`MetadataExtractor.ts`)
       │     │     └─► Injects `' AND 1=CAST((SELECT table_name FROM ... LIMIT 1 OFFSET n) AS int)--`
       │     │     └─► Regex-extracts leaked table names from conversion error messages
       │     │
       │     └─► Path D: Adaptive Boolean Blind Inference
       │           └─► Infers table existence character-by-character or via candidate probes
       │
       ├─► Step 8: Progressive Column & Value Extraction (`MetadataExtractor.ts`)
       │     └─► Direct error CAST / UNION queries extract columns and credentials (`administrator`, passwords)
       │     └─► Emits live updates via `onCatalog` directly to Database Explorer
       │
       ├─► Step 9: Correlation & Final Verdict (`EvidenceCorrelator.ts`)
       │     └─► Computes `VULNERABLE` vs `NOT CONFIRMED VULNERABLE` with evidence provenance
       │
       └─► Step 10: Report Generation (`ReportGenerator.ts`)
             └─► Generates Executive and Technical markdown reports
```

---

## 2. UCMA-X Native Rust Execution Trace (`ucma-x`)

```
[Target URL / Request Spec]
       │
       ▼
[Scope Guard: ucma-scope]
       │  Enforces authorization capability token
       │  Blocks loopback (127.0.0.0/8), RFC1918 private IPs, link-local
       │  Applies DNS pinning to prevent rebinding
       ▼
[Authorized HTTP Client: ucma-http]
       │  Wraps reqwest with strict timeout, response size limits, and hop revalidation
       │  Produces immutable `ResponseSnapshot`
       ▼
[Parameter & Context Engine: ucma-parameter]
       │  Discovers parameters across query/headers/body
       │  Classifies SQL AST context (Numeric, String, Like, OrderBy, Json)
       ▼
[SQL Semantic IR & AST Mutator: ucma-sql-ir & ucma-ast]
       │  Constructs AST representation of test queries
       │  Applies dialect-aware mutations (Postgres, MySQL, MSSQL, Oracle, SQLite)
       ▼
[Adaptive Planner: ucma-planner]
       │  Bayesian optimization computes Expected Information Gain ($EIG$) / Cost
       │  Selects optimal next strategy (Boolean, Error, Timing, Metamorphic)
       ▼
[Multi-Oracle Verification: ucma-oracles & ucma-causal]
       │
       ├─► Metamorphic Oracle (TLP / NoREC)
       ├─► Statistical Timing Oracle (Wald's SPRT, Mann-Whitney U test)
       ├─► Structural AST Differ Oracle
       └─► 5-Step Causal Engine:
             1. Baseline Control ($s_0$)
             2. Positive Probe ($s_1$)
             3. Negative Probe ($s_2$)
             4. Noise Control (Filter string reflection false positives)
             5. Clean-Room Proof (BLAKE3 evidence hash)
       ▼
[Detection & Promotion: ucma-detection]
       │  Promotes hypothesis to Confirmed Finding
       ▼
[Recursive Database Explorer: ucma-db & ucma-explorer]
       │  Traverses Database $\to$ Schema $\to$ Table $\to$ Column $\to$ Rows
       ▼
[Evidence & Merkle Provenance: ucma-evidence]
       │  Stores immutable raw requests/responses in BLAKE3 CAS
       ▼
[Final Report: ucma-bench / ucma-cli]
```

---

## 3. Runtime Bridge (How GUI Interacts with Rust Core)

- When the GUI runs live scans, `SqlScanOrchestrator.ts` drives request transmission via Tauri IPC (`cmd_repeater_send_request`).
- `SqlScanOrchestrator.ts` calls `ipcClient.ucmaxAnalyzeBoolean()` and `ipcClient.ucmaxPlanNextStep()` to utilize the Rust-accelerated UCMA-X decision and causal verification engines.
- Standalone headless benchmarking executes directly through `ucma-cli` and `ucma-bench`.
