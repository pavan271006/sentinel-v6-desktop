# SENTINEL V6 — AI ENGINE CONFIGURATION & PROVIDER SPECIFICATION
**Document ID**: `SENTINEL-SPEC-AI-CONFIG-001`  
**Classification**: Local Operational Configuration  
**Status**: ACTIVE / CONFIGURED  
**Enforced Invariants**: `SEC-03` (Host-Side Policy Gate), `SEC-09` (Secret Redaction & Zeroization)

---

## 1. Active Provider Configuration

The Sentinel V6 AI subsystem is configured with the following active OpenAI integration parameters:

```yaml
ai_subsystem:
  active_provider: "openai"
  environment_source: ".env"
  api_key_env_var: "OPENAI_API_KEY"
  default_model: "gpt-4o"
  fallback_model: "gpt-4o-mini"
  request_timeout_ms: 30000
  governance:
    policy_mode: "strict"
    token_budget_per_plan: 32000
    token_budget_per_action: 4096
    human_approval_threshold: "medium_high_risk"
    zero_self_approval_enforced: true
```

---

## 2. API Key Management & Security (SEC-09)

- **Storage Location**: Stored securely in [`c:\Users\Legion 5 pro\Desktop\cyber sec\.env`](file:///c:/Users/Legion%205%20pro/Desktop/cyber%20sec/.env).
- **Git Protection**: Protected by [`.gitignore`](file:///c:/Users/Legion%205%20pro/Desktop/cyber%20sec/.gitignore) to prevent accidental credential leakage in version control.
- **Runtime Handling**: At runtime, `sentinel_ai` reads the key from environment variables via `std::env::var("OPENAI_API_KEY")` and zeroizes sensitive buffers upon deallocation.

---

## 3. Policy-Gated Architecture (SEC-03)

As specified in the **Burp AT Policy Cage** model:
1. **Zero Raw Socket Access**: The OpenAI model interacts only with the typed Rust skill dispatcher.
2. **Context Enrichment**: The engine injects read-only extracts from the Security Context Graph and Observation Store.
3. **Finding Attestation**: Every AI hypothesis must be independently reproduced and hashed to the SHA-256 CAS BlobStore before being flagged as a confirmed finding.

---

## 4. Environment Variables Reference

| Variable | Configured Value | Purpose |
|:---|:---|:---|
| `OPENAI_API_KEY` | `sk-proj-dqlyEQLIY4...` (Configured in `.env`) | OpenAI API Authentication Token |
| `OPENAI_MODEL` | `gpt-4o` | Primary Reasoning & Skill Selection Model |
| `OPENAI_MAX_TOKENS` | `4096` | Token Limit per Skill Request |
| `OPENAI_TEMPERATURE`| `0.2` | Low-entropy deterministic security evaluation |
| `SENTINEL_AI_POLICY_MODE` | `strict` | Mandatory SEC-03 rule enforcement |
