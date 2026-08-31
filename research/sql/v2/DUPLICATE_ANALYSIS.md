# Deduplication & Variant Consolidation Analysis V2

**Document Reference:** SENTINEL-V2-DUP-07  
**Classification:** Catalog Deduplication, Variant Normalization & Redundancy Elimination  

---

## 1. Deduplication Principles

In V1, technique counts were inflated by treating cosmetic string variations, comment styles, and dialect-specific functions as separate top-level techniques.

V2 enforces **Strict Hierarchical Deduplication**:
* **Parent Technique**: Defined by the abstract relational intent and grammar mutation strategy.
* **Subtechnique**: Dialect-specific or context-specific realization of the parent technique.
* **Transformation**: Transport encoding or comment style variation (attached as attributes, not separate techniques).

---

## 2. Merged Techniques & Redundancy Resolution Table

| V1 Draft Entries | Root Redundancy | V2 Consolidated Resolution | Resulting Node in V2 |
|:---|:---|:---|:---|
| `TECH-001` (Single Quote `--`), `TECH-002` (Single Quote `/* */`), `TECH-003` (Single Quote `#`), `TECH-004` (Balancing Quote) | Same grammar mechanism (`MECH-01`) and context (`CTX-01`), differing only in trailing comment marker. | Consolidated into single technique with comment styles mapped as transformation attributes. | **`TECH-V2-01` (Single-Quote Delimiter Breakout)** |
| `TECH-027` (PostgreSQL `pg_sleep`), `TECH-028` (MySQL `SLEEP`), `TECH-029` (MSSQL `WAITFOR`), `TECH-030` (Oracle `DBMS_LOCK.SLEEP`), `TECH-032` (Snowflake `SYSTEM$WAIT`) | Identical statistical timing delay strategy (`MECH-04`), differing only in engine built-in function name. | Consolidated into a single statistical delay technique with dialect-specific function compilation. | **`TECH-V2-21` (Wald SPRT Statistical Latency Delay)** |
| `TECH-017` (PostgreSQL `CAST`), `TECH-018` (MSSQL `CONVERT`), `TECH-019` (MySQL `EXTRACTVALUE`), `TECH-021` (Oracle `CTXSYS`), `TECH-022` (Oracle `UTL_INADDR`) | Identical explicit error-induction strategy (`MECH-04`), differing only in engine error leakage function. | Consolidated into general and XPath error leakage techniques with dialect mappings. | **`TECH-V2-17` & `TECH-V2-18`** |
| `TECH-037` (MSSQL `xp_dirtree`), `TECH-038` (`xp_fileexist`), `TECH-039` (Oracle `UTL_HTTP`), `TECH-040` (Oracle `UTL_INADDR`), `TECH-042` (PG `dblink`), `TECH-043` (MySQL `LOAD_FILE`) | Identical out-of-band network callback strategy (`MECH-04`), differing only in engine network procedure. | Consolidated into out-of-band network procedure probing technique with dialect mappings. | **`TECH-V2-23` (Out-of-Band Network Procedure Probe)** |
| `TECH-045` (Register to Profile), `TECH-046` (Ticket to Admin), `TECH-047` (Comment to Audit), `TECH-048` (Config to Job) | Identical second-order stored dataflow pattern, differing only in illustrative application entity names. | Reclassified to the Execution Lifecycle dimension (`LIFE-02: SECOND_ORDER_STORED`). | **`LIFE-V2-02` (Second-Order Stored Lifecycle)** |
| `TECH-076` (`pgvector` `<=>`), `TECH-077` (`pgvector` `<->`) | Identical vector metric injection intent, differing only in distance operator symbol. | Consolidated into vector metric distance injection technique. | **`TECH-V2-49` (pgvector Metric Distance Injection)** |
