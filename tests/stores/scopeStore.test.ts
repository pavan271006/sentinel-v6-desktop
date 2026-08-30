import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore } from '../../src/stores/scopeStore';

describe('ScopeStore (useScopeStore)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default rules and SSRF metadata exclusions (SEC-01)', () => {
    const store = useScopeStore.getState();
    expect(store.rules.length).toBeGreaterThan(0);
    const ssrfRule = store.rules.find((r) => r.pattern.includes('169.254.169.254'));
    expect(ssrfRule).toBeDefined();
    expect(ssrfRule?.rule_type).toBe('EXCLUDE');
  });

  it('adds, toggles, updates, and deletes scope rules', () => {
    const store = useScopeStore.getState();
    const initialCount = store.rules.length;

    store.addRule('INCLUDE', 'HOST', 'subdomain.target.local', 'Subdomain testing');
    const updated = useScopeStore.getState().rules;
    expect(updated.length).toBe(initialCount + 1);

    const added = updated.find((r) => r.pattern === 'subdomain.target.local');
    expect(added).toBeDefined();
    expect(added?.enabled).toBe(true);

    if (added) {
      store.toggleRule(added.id);
      expect(useScopeStore.getState().rules.find((r) => r.id === added.id)?.enabled).toBe(false);

      store.updateRule(added.id, { notes: 'Updated notes' });
      expect(useScopeStore.getState().rules.find((r) => r.id === added.id)?.notes).toBe('Updated notes');

      store.deleteRule(added.id);
      expect(useScopeStore.getState().rules.find((r) => r.id === added.id)).toBeUndefined();
    }
  });

  it('evaluates in-scope targets with step-by-step provenance', async () => {
    const store = useScopeStore.getState();
    const decision = await store.evaluateTestUrl('https://target.local/api/v1/users');

    expect(decision.in_scope).toBe(true);
    expect(decision.matched_rule).toBeDefined();
    expect(decision.provenance_steps).toBeDefined();
    expect(decision.provenance_steps?.some((s) => s.matched && s.outcome === 'ALLOW')).toBe(true);
  });

  it('enforces fail-closed denial on out-of-scope targets (SEC-01)', async () => {
    const store = useScopeStore.getState();
    const decision = await store.evaluateTestUrl('https://unauthorized-domain.com/secret');

    expect(decision.in_scope).toBe(false);
    expect(decision.rule_type).toBe('DEFAULT_DENY');
    expect(decision.provenance_steps?.some((s) => s.rule_type === 'DEFAULT_DENY' && s.outcome === 'DENY')).toBe(true);
  });

  it('enforces pre-socket drop on SSRF cloud metadata targets', async () => {
    const store = useScopeStore.getState();
    const decision = await store.evaluateTestUrl('http://169.254.169.254/latest/meta-data/');

    expect(decision.in_scope).toBe(false);
    expect(decision.reason).toContain('SSRF');
  });

  it('applies built-in presets (Standard Web, Intranet SSRF, Strict Deny, Destructive Exclude)', () => {
    const store = useScopeStore.getState();
    const countBefore = store.rules.length;

    store.applyPreset('intranet_ssrf');
    const countAfter = useScopeStore.getState().rules.length;
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  it('records and clears scope violation events', () => {
    const store = useScopeStore.getState();
    store.recordViolation({
      timestamp: '20:15:00',
      uri: 'http://evil.com/leak',
      clientIp: '127.0.0.1',
      matchedRuleId: null,
      reason: 'Out of scope boundary',
      actionTaken: 'DROPPED_PRE_SOCKET',
    });

    const viols = useScopeStore.getState().violations;
    expect(viols.some((v) => v.uri === 'http://evil.com/leak')).toBe(true);

    store.clearViolations();
    expect(useScopeStore.getState().violations.length).toBe(0);
  });

  it('triggers SEC-02/SEC-03 safety warning modal for out-of-scope actions', () => {
    const store = useScopeStore.getState();
    let actionExecuted = false;

    const allowed = store.checkSafetyGate(
      'https://out-of-scope-target.com/admin',
      'Active Vulnerability Scanner',
      () => {
        actionExecuted = true;
      }
    );

    expect(allowed).toBe(false);
    expect(actionExecuted).toBe(false);
    expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
    expect(useScopeStore.getState().safetyWarningModal.actionName).toBe('Active Vulnerability Scanner');

    store.closeSafetyWarning();
    expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(false);
  });

  it('exports and imports rules JSON format', () => {
    const store = useScopeStore.getState();
    const exportedJson = store.exportRulesJson();
    expect(exportedJson).toContain('target.local');

    const customRules = [
      { id: 'custom-1', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'custom.local', enabled: true },
    ];
    store.importRulesJson(JSON.stringify(customRules));
    expect(useScopeStore.getState().rules.length).toBe(1);
    expect(useScopeStore.getState().rules[0].pattern).toBe('custom.local');
  });
});
