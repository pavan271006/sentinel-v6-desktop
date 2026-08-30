import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore } from '../../src/stores/scopeStore';

describe('Targeted Empirical Audit: checkSafetyGate Vulnerability Surface', () => {
  beforeEach(() => {
    localStorage.clear();
    useScopeStore.setState({
      rules: [
        { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Primary target' },
        { id: 'rule-02', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/*', enabled: true, notes: 'API prefix' },
        { id: 'rule-03', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'SSRF Cloud metadata' },
        { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*(logout|signout|delete-account).*', enabled: true, notes: 'Destructive endpoints' },
        { id: 'rule-07', rule_type: 'EXCLUDE', pattern_type: 'HOST', pattern: 'admin.target.local', enabled: true, notes: 'Exclude admin host' },
      ],
      violations: [],
      safetyWarningModal: {
        isOpen: false,
        targetUri: '',
        actionName: '',
      },
    });
  });

  it('Verifies Fix A: Exclude rule takes absolute precedence over Include in checkSafetyGate', () => {
    const store = useScopeStore.getState();
    let callbackExecuted = false;

    // targetUri matches EXCLUDE rule-07 ('admin.target.local') AND INCLUDE rule-01 ('target.local')
    const targetUri = 'https://admin.target.local/dashboard';

    const allowed = store.checkSafetyGate(targetUri, 'Fuzzer Attack', () => {
      callbackExecuted = true;
    });

    console.log(`[Fix A Result] target: ${targetUri}, allowed: ${allowed}, callbackExecuted: ${callbackExecuted}`);

    // Fix enforces that EXCLUDE blocks immediately without being overridden by subsequent INCLUDE
    expect(allowed).toBe(false);
    expect(callbackExecuted).toBe(false);
    expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
  });

  it('Verifies Fix B: Exact host match in checkSafetyGate rejects arbitrary malicious domains', () => {
    const store = useScopeStore.getState();
    let callbackExecuted = false;

    // Attacker domain has 'target.local' in the path or query string
    const maliciousUri = 'https://attacker-c2.com/exfiltrate?origin=target.local';

    const allowed = store.checkSafetyGate(maliciousUri, 'Scan Orchestrator', () => {
      callbackExecuted = true;
    });

    console.log(`[Fix B Result] target: ${maliciousUri}, allowed: ${allowed}, callbackExecuted: ${callbackExecuted}`);

    // Exact host matching rejects attacker-c2.com because host is attacker-c2.com, not target.local
    expect(allowed).toBe(false);
    expect(callbackExecuted).toBe(false);
    expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
  });

  it('Verifies Fix C: Destructive endpoint regex catches logout routes', () => {
    useScopeStore.setState({
      rules: [
        { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true },
        { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*(logout|signout|delete-account).*', enabled: true },
      ],
    });

    const store = useScopeStore.getState();
    let callbackExecuted = false;

    const uri = 'https://target.local/api/v1/auth/logout';
    const allowed = store.checkSafetyGate(uri, 'Replay', () => {
      callbackExecuted = true;
    });

    console.log(`[Fix C Result] target: ${uri}, allowed: ${allowed}, callbackExecuted: ${callbackExecuted}`);
    expect(allowed).toBe(false);
    expect(callbackExecuted).toBe(false);
  });
});
