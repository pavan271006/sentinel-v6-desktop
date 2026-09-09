# SENTINEL V6 — FRONTIER EVIDENCE & CAS PROVENANCE RESEARCH
**Document ID**: `SENTINEL-SPEC-EVIDENCE-001`  
**Date**: 2026-08-23  
**Status**: AUTHORITATIVE EVIDENCE & REPRODUCIBILITY SPECIFICATION  
**Classification**: Content-Addressed Storage, Merkle DAGs & SARIF v2.1.0

---

## 1. Cryptographic Chain of Custody Architecture

Every finding discovered by Sentinel V6 is backed by an immutable, content-addressed Merkle Proof DAG.

```
                  [Vulnerability Finding Root Node]
                  SHA-256(FindingMetadata || MerkleRoot)
                             /                \
                            /                  \
            [Hypothesis Branch: H_L]            [Evidence Branch: H_R]
             /            \                      /            \
            /              \                    /              \
      [Baseline Tx]   [Probe Tx]          [Control Tx]    [AST Diff Proof]
      SHA-256(CAS)    SHA-256(CAS)        SHA-256(CAS)    SHA-256(CAS)
```

---

## 2. Delta Debugging (ddmin) Exploit Minimization

- **Algorithm**: Zeller's $ddmin$ reduces multi-step exploit chains and large payloads to 1-minimal reproducing artifacts:
  $$\text{test}(c_{\text{min}}) = \text{FAIL} \quad \land \quad \forall e \in c_{\text{min}}, \quad \text{test}(c_{\text{min}} \setminus \{e\}) = \text{PASS}$$
- **Dependency-Preserving Chain Slicing**: Slices complex multi-request sequences (e.g. CSRF token extraction $\rightarrow$ state modification $\rightarrow$ privilege escalation) while preserving dynamic token variables.

---

## 3. OASIS SARIF v2.1.0 Attestation & CAS Blob Storage
- **Two-Tier Fan-out Directory**: `blobs/xx/xxxx...blob` stored with zstd compression and SHA-256 content addressing.
- **SARIF v2.1.0 Export**: Full cryptographic attestation containing CAS Merkle root hashes, execution transcripts, CVSS v4.0 metrics, and CWE classifications.
