# SENTINEL V6: Local Deliberately Vulnerable Lab & Negative Control Verification Report
**Document ID**: `SENTINEL-VAL-M6-LAB-001`  
**Classification**: Authoritative Empirical Validation Report  
**Lab Suite**: `tests/vulnerable_lab/app.ts` & `tests/vulnerable_lab/vulnerable_lab.test.ts`  
**Ground Truth**: `tests/vulnerable_lab/VULNERABILITY_REGISTRY.yaml`  
**Results**: 16 / 16 Tests Passed (100% Detection, 0% False Positives)  

---

## 1. Executive Summary

To guarantee that SENTINEL V6 detects real-world security vulnerabilities without generating spurious false positives or relying on superficial status codes, the team engineered a standalone, locally isolated validation laboratory (`tests/vulnerable_lab/app.ts`). 

Every test case was executed in dual mode:
1. **Positive Fixture (Vulnerable Endpoint)**: Verifies that the detection engine flags the vulnerability and generates cryptographic CAS evidence.
2. **Negative Control (Safe Endpoint)**: Verifies that safe, parameterized, or remediated endpoints produce **ZERO confirmed findings** and **ZERO false positives**.

---

## 2. Vulnerability-by-Vulnerability Empirical Validation Table

| Registry ID | Vulnerability Category | Tested Endpoint | Positive Test (Vulnerable) | Negative Control (Safe) | Evidence Model | Finding Severity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LAB-SQLI-001` | **SQL Injection** | `/api/v1/search` | Extracted database records (`SQLI_EXTRACTED_DATA_SUCCESS`) | Parameterized query returned standard dataset (0 false alerts) | Cryptographic CAS SHA-256 | **HIGH** | ✅ **PASS** |
| `LAB-BOLA-001` | **BOLA / IDOR** | `/api/v1/documents/:id` | Alice accessed Admin master key (`doc-101`) | Safe endpoint returned 403 Forbidden with ownership check | Session diff matrix | **CRITICAL** | ✅ **PASS** |
| `LAB-BFLA-001` | **BFLA** | `/api/v1/admin/backup` | Standard user Bob triggered admin backup | Safe endpoint returned 403 Forbidden: Admin role required | Role divergence table | **HIGH** | ✅ **PASS** |
| `LAB-TRAV-001` | **Path Traversal** | `/api/v1/read_file` | Extracted system `/etc/passwd` contents | Safe endpoint returned 400 Bad Request: Traversal detected | File payload CAS | **HIGH** | ✅ **PASS** |
| `LAB-SSRF-001` | **SSRF Cloud Metadata** | `/api/v1/fetch_url` | Cloud metadata extracted (`admin-secrets-access`) | Safe endpoint dropped socket (403 SEC-01 Safety Gate) | Metadata JSON signature | **CRITICAL** | ✅ **PASS** |
| `LAB-RACE-001` | **Concurrency Race** | `/api/v1/coupon/redeem` | Concurrent requests redeemed coupon multiple times | Safe endpoint enforced atomic mutex (1 single redemption) | Concurrent trace log | **MEDIUM** | ✅ **PASS** |
| `LAB-OAST-001` | **OAST Callback** | `/api/v1/ping_webhook` | Callback token correlated by OAST listener | Uncorrelated tokens cleanly ignored | Stateless AES-256 CAS | **HIGH** | ✅ **PASS** |
| `LAB-SESS-001` | **Session Lifecycle** | `/api/v1/auth/session` | Expired and locked tokens correctly rejected | Active tokens validated cleanly | Token state machine | **MEDIUM** | ✅ **PASS** |

---

## 3. False-Positive & Verification Integrity Rules
* **Rule 1**: A status code 500 or 200 alone never triggers a confirmed finding.
* **Rule 2**: Reflected strings without syntax breakout never trigger an XSS finding.
* **Rule 3**: Timing noise without statistical confidence threshold ($p < 0.01$) never triggers a time-based blind finding.
* **Rule 4**: Remediated endpoints retested via the Security Regression Graph transition to `FIXED` state with zero residual alerts.
