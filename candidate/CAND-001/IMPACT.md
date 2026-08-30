# Impact Analysis: CAND-001

## Security Impact Assessment

| Dimension | Severity | Technical Impact Assessment |
|---|---|---|
| **Confidentiality** | High | Attacker gains visibility into victim workflow payload metadata upon claiming. |
| **Integrity** | Critical | Attacker forces final execution and approval of high-value operations under victim tenant's organizational authority. |
| **Availability** | Medium | State machine is advanced to terminal `APPROVED_AND_EXECUTED` state, preventing legitimate victim retries. |
| **Privilege Scope** | High | Complete bypass of tenant boundaries without credential theft or brute force. |

## CVSS 4.0 Score Vector
- **Vector:** `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N`
- **Calculated Base Score:** **8.3 (High)**
