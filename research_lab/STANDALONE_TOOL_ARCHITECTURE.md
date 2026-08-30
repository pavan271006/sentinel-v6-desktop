# Standalone Tool Architecture & Implementation: TSDE

**Tool Name:** Temporal State Desynchronization Engine (`TSDE`)  
**File:** `research_lab/tools/tsde_scanner.py`  

---

## 1. Architectural Pipeline

```
[ Target URL ] ───► [ Observer ] ───► [ Multi-Identity Prober ] ───► [ Differential Engine ] ───► [ Finding Report ]
```

1. **Step 1 (Initiate):** Dispatches initiation probe under Identity A.
2. **Step 2 (Baseline):** Asserts unauthorized access denial under Identity B (HTTP 403).
3. **Step 3 (Compensation Rollback):** Triggers intermediate rollback under Identity A.
4. **Step 4 (Commit Probe):** Re-attempts commit under Identity B and flags unauthorized state promotion.

---

## 2. CLI Usage
```bash
python tools/tsde_scanner.py --url http://127.0.0.1:8802 --token-a <TOKEN_A> --token-b <TOKEN_B>
```
