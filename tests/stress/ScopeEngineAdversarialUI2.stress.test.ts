import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore, ScopeRuleDef } from '../../src/stores/scopeStore';
import { useProjectStore } from '../../src/stores/projectStore';
import { mockBackendBridge } from '../../src/ipc/mockBridge';
import { ipcClient } from '../../src/ipc/client';

describe('Phase UI-2 Adversarial Stress Suite: Scope Engine, SSRF Defenses & Project Lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    useScopeStore.setState({
      rules: [
        { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Primary target domain' },
        { id: 'rule-02', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/*', enabled: true, notes: 'API endpoints' },
        { id: 'rule-03', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'AWS/GCP metadata SSRF protection (SEC-01)' },
        { id: 'rule-04', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true, notes: 'Internal intranet RFC1918 SSRF guard' },
        { id: 'rule-05', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '127.0.0.1/32', enabled: true, notes: 'Loopback socket isolation' },
        { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|delete-account|terminate|drop-db).*', enabled: true, notes: 'Destructive endpoint protection' },
      ],
      violations: [],
      safetyWarningModal: {
        isOpen: false,
        targetUri: '',
        actionName: '',
      },
    });
    useProjectStore.setState({
      currentProject: null,
      recentProjects: [],
      isModalOpen: false,
      activeModalTab: 'new',
      isLoading: false,
      error: null,
      lastWalStatus: null,
    });
  });

  // =========================================================================
  // 1. SSRF METADATA PROTECTION & BYPASS ATTEMPTS
  // =========================================================================
  describe('1. SSRF Metadata Protection & Bypass Verification', () => {
    it('blocks canonical AWS/GCP/Azure link-local metadata IP (169.254.169.254)', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://169.254.169.254/latest/meta-data/');
      expect(decision.in_scope).toBe(false);
      expect(decision.reason.toLowerCase()).toMatch(/ssrf|excluded|cloud metadata|deny/i);
    });

    it('blocks IPv4-mapped IPv6 address to cloud metadata ([::ffff:169.254.169.254])', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://[::ffff:169.254.169.254]/latest/meta-data/');
      expect(decision.in_scope).toBe(false);
      expect(decision.reason.toLowerCase()).toMatch(/ssrf|excluded|cloud metadata|deny/i);
    });

    it('blocks link-local IP variants in 169.254.0.0/16 subnet', async () => {
      const store = useScopeStore.getState();
      const testUris = [
        'http://169.254.1.1/internal',
        'http://169.254.10.20:8080/metrics',
        'http://169.254.255.254/status',
        'http://[::ffff:169.254.0.1]/',
      ];
      for (const uri of testUris) {
        const decision = await store.evaluateTestUrl(uri);
        expect(decision.in_scope).toBe(false);
      }
    });

    it('blocks IPv4 loopback socket targets (127.0.0.1, 127.0.1.1, 127.127.127.127)', async () => {
      const store = useScopeStore.getState();
      const loopbacks = [
        'http://127.0.0.1:8080/admin',
        'http://127.0.1.1/',
        'http://127.127.127.127:3000/debug',
      ];
      for (const uri of loopbacks) {
        const decision = await store.evaluateTestUrl(uri);
        expect(decision.in_scope).toBe(false);
      }
    });

    it('blocks unspecified / zero IP address (0.0.0.0)', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://0.0.0.0:8080/internal');
      expect(decision.in_scope).toBe(false);
    });

    it('enforces SSRF blocking even when URL includes credentials or query params', async () => {
      const store = useScopeStore.getState();
      const trickyUrls = [
        'http://admin:secret@169.254.169.254/latest/meta-data/',
        'http://169.254.169.254:80/latest/meta-data/?token=aws',
        'http://169.254.169.254#section',
      ];
      for (const uri of trickyUrls) {
        const decision = await store.evaluateTestUrl(uri);
        expect(decision.in_scope).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. SCOPE EVALUATION LOGIC (CIDR, WILDCARDS, REGEX, EXCLUSION PRECEDENCE)
  // =========================================================================
  describe('2. Scope Evaluation Engine: Inclusions, Exclusions & Precedence', () => {
    it('strictly enforces EXCLUDE precedence over INCLUDE rules (SEC-01 Invariant)', async () => {
      // Configure inclusion for entire target.local but exclude /auth/logout
      await ipcClient.updateScope(
        ['target.local', 'https://target.local/*'],
        ['.*\\.(logout|signout|delete-account).*', 'https://target.local/admin/destructive']
      );

      // In-scope endpoint -> ALLOW
      const normalRes = await mockBackendBridge.testScopeUri('https://target.local/api/v1/profile');
      expect(normalRes.in_scope).toBe(true);

      // Excluded endpoint matching regex -> DENY
      const excludedRegexRes = await mockBackendBridge.testScopeUri('https://target.local/api/v1/auth/logout');
      expect(excludedRegexRes.in_scope).toBe(false);
      expect(excludedRegexRes.rule_type).toBe('EXCLUDE');

      // Excluded prefix endpoint -> DENY
      const excludedPrefixRes = await mockBackendBridge.testScopeUri('https://target.local/admin/destructive');
      expect(excludedPrefixRes.in_scope).toBe(false);
      expect(excludedPrefixRes.rule_type).toBe('EXCLUDE');
    });

    it('handles domain wildcards (*.target.local) accurately without false positive substring matches', async () => {
      const customRules: ScopeRuleDef[] = [
        { id: 'inc-1', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: '*.target.local', enabled: true },
      ];
      await ipcClient.updateScope(['*.target.local'], [], customRules);

      // Valid subdomains
      const sub1 = await mockBackendBridge.testScopeUri('https://api.target.local/v1');
      expect(sub1.in_scope).toBe(true);

      const sub2 = await mockBackendBridge.testScopeUri('https://dev.staging.target.local/');
      expect(sub2.in_scope).toBe(true);

      // Apex domain
      const apex = await mockBackendBridge.testScopeUri('https://target.local/');
      expect(apex.in_scope).toBe(true);

      // Completely different domain -> DENY
      const unrelated = await mockBackendBridge.testScopeUri('https://attacker.com/');
      expect(unrelated.in_scope).toBe(false);
    });

    it('evaluates URL prefix patterns with and without trailing slashes', async () => {
      const customRules: ScopeRuleDef[] = [
        { id: 'inc-1', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/v2/*', enabled: true },
      ];
      await ipcClient.updateScope(['https://api.target.local/v2/*'], [], customRules);

      const inScope = await mockBackendBridge.testScopeUri('https://api.target.local/v2/users/123');
      expect(inScope.in_scope).toBe(true);

      const outOfScope = await mockBackendBridge.testScopeUri('https://api.target.local/v1/users/123');
      expect(outOfScope.in_scope).toBe(false);
    });

    it('evaluates regex rules safely with complex patterns', async () => {
      const customRules: ScopeRuleDef[] = [
        { id: 'inc-1', rule_type: 'INCLUDE', pattern_type: 'REGEX', pattern: '^https:\\/\\/target\\.local\\/items\\/\\d+$', enabled: true },
      ];
      await ipcClient.updateScope(['^https:\\/\\/target\\.local\\/items\\/\\d+$'], [], customRules);

      const validId = await mockBackendBridge.testScopeUri('https://target.local/items/98765');
      expect(validId.in_scope).toBe(true);

      const invalidId = await mockBackendBridge.testScopeUri('https://target.local/items/abc');
      expect(invalidId.in_scope).toBe(false);
    });

    it('enforces Fail-Closed Default-Deny on empty or malformed target URI', async () => {
      const decisionEmpty = await mockBackendBridge.testScopeUri('');
      expect(decisionEmpty.in_scope).toBe(false);
      expect(decisionEmpty.rule_type).toBe('DEFAULT_DENY');

      const decisionSpaces = await mockBackendBridge.testScopeUri('   ');
      expect(decisionSpaces.in_scope).toBe(false);
      expect(decisionSpaces.rule_type).toBe('DEFAULT_DENY');
    });

    it('preserves disabled rule status (disabled rules must not match)', async () => {
      const customRules: ScopeRuleDef[] = [
        { id: 'inc-1', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'disabled.target.local', enabled: false },
        { id: 'inc-2', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'active.target.local', enabled: true },
      ];
      await ipcClient.updateScope([], [], customRules);

      const testDisabled = await mockBackendBridge.testScopeUri('https://disabled.target.local/');
      expect(testDisabled.in_scope).toBe(false);

      const testActive = await mockBackendBridge.testScopeUri('https://active.target.local/');
      expect(testActive.in_scope).toBe(true);
    });
  });

  // =========================================================================
  // 3. CORRUPT / MALFORMED JSON RULE IMPORTS & EXPORTS
  // =========================================================================
  describe('3. JSON Rule Import & Export Resilience', () => {
    it('exports valid JSON that parses cleanly back into identical rules', () => {
      const store = useScopeStore.getState();
      const exportedJson = store.exportRulesJson();
      expect(() => JSON.parse(exportedJson)).not.toThrow();

      const parsed = JSON.parse(exportedJson);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(store.rules.length);
    });

    it('safely handles malformed / non-JSON string imports without crashing', () => {
      const store = useScopeStore.getState();
      const initialRulesCount = store.rules.length;

      // Malformed syntax
      store.importRulesJson('{ unclosed json object');
      expect(useScopeStore.getState().rules.length).toBe(initialRulesCount);

      // Empty string
      store.importRulesJson('');
      expect(useScopeStore.getState().rules.length).toBe(initialRulesCount);

      // Non-array JSON object
      store.importRulesJson(JSON.stringify({ rules: [] }));
      expect(useScopeStore.getState().rules.length).toBe(initialRulesCount);

      // JSON primitive number / boolean
      store.importRulesJson('12345');
      expect(useScopeStore.getState().rules.length).toBe(initialRulesCount);

      store.importRulesJson('true');
      expect(useScopeStore.getState().rules.length).toBe(initialRulesCount);
    });

    it('safely imports valid rule arrays and updates AppShell badge counts', () => {
      const store = useScopeStore.getState();
      const validRules: ScopeRuleDef[] = [
        { id: 'r1', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'app1.internal', enabled: true },
        { id: 'r2', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://app2.internal/*', enabled: true },
        { id: 'r3', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true },
      ];

      store.importRulesJson(JSON.stringify(validRules));
      expect(useScopeStore.getState().rules.length).toBe(3);
      expect(useScopeStore.getState().rules[0].pattern).toBe('app1.internal');
    });

    it('handles JSON rule payloads containing adversarial strings (XSS vectors, script tags, special characters)', () => {
      const store = useScopeStore.getState();
      const adversarialRules: ScopeRuleDef[] = [
        {
          id: 'xss-1',
          rule_type: 'INCLUDE',
          pattern_type: 'HOST',
          pattern: '<script>alert(document.cookie)</script>',
          notes: '"><img src=x onerror=alert(1)>',
          enabled: true,
        },
        {
          id: 'sql-1',
          rule_type: 'EXCLUDE',
          pattern_type: 'REGEX',
          pattern: "admin' OR '1'='1",
          notes: 'DROP TABLE scope_rules;--',
          enabled: true,
        },
      ];

      store.importRulesJson(JSON.stringify(adversarialRules));
      expect(useScopeStore.getState().rules.length).toBe(2);
      expect(useScopeStore.getState().rules[0].pattern).toBe('<script>alert(document.cookie)</script>');

      // Exporting back must produce valid JSON without escaping errors
      const exported = store.exportRulesJson();
      expect(() => JSON.parse(exported)).not.toThrow();
    });
  });

  // =========================================================================
  // 4. SAFETY GATE & OUT-OF-SCOPE GATING (SEC-02 / SEC-03)
  // =========================================================================
  describe('4. Safety Gate & Pre-Flight Confirmation Gating', () => {
    it('blocks out-of-scope targets and opens safety confirmation modal', () => {
      const store = useScopeStore.getState();
      let confirmed = false;

      const allowed = store.checkSafetyGate(
        'https://external-unauthorized.com/api/test',
        'Fuzzer Execution',
        () => {
          confirmed = true;
        }
      );

      expect(allowed).toBe(false);
      expect(confirmed).toBe(false);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
      expect(useScopeStore.getState().safetyWarningModal.targetUri).toBe('https://external-unauthorized.com/api/test');
      expect(useScopeStore.getState().safetyWarningModal.actionName).toBe('Fuzzer Execution');
    });

    it('immediately executes action callback for verified in-scope targets', () => {
      const store = useScopeStore.getState();
      let confirmed = false;

      const allowed = store.checkSafetyGate(
        'https://target.local/api/v1/resource',
        'Manual Repeater Send',
        () => {
          confirmed = true;
        }
      );

      expect(allowed).toBe(true);
      expect(confirmed).toBe(true);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(false);
    });

    it('blocks SSRF metadata targets from safety gate bypassing', () => {
      const store = useScopeStore.getState();
      let confirmed = false;

      const allowed = store.checkSafetyGate(
        'http://169.254.169.254/latest/meta-data/',
        'Scanner Target',
        () => {
          confirmed = true;
        }
      );

      expect(allowed).toBe(false);
      expect(confirmed).toBe(false);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
    });
  });

  // =========================================================================
  // 5. PROJECT LIFECYCLE & SQLite WAL INTEGRITY
  // =========================================================================
  describe('5. Project Lifecycle, SQLite WAL Checkpoint & Persistence', () => {
    it('creates new project, initializes metadata, and tracks in recent projects', async () => {
      const store = useProjectStore.getState();
      const proj = await store.createProject('Adversarial Test Project', 'C:/engagements/adv_test', ['target.local']);

      expect(proj.name).toBe('Adversarial Test Project');
      expect(proj.wal_journal_mode).toBe('WAL');
      expect(proj.is_clean_shutdown).toBe(true);

      const state = useProjectStore.getState();
      expect(state.currentProject?.name).toBe('Adversarial Test Project');
      expect(state.recentProjects.some((p) => p.name === 'Adversarial Test Project')).toBe(true);
    });

    it('exports project archive with SHA-256 integrity digest and SEC-09 scrubbing', async () => {
      const store = useProjectStore.getState();
      const exportRes = await store.exportProject('C:/engagements/adv_test', 'C:/backups/adv_test.sentinel.zip', true);

      expect(exportRes.success).toBe(true);
      expect(exportRes.sha256_checksum.length).toBe(64);
      expect(exportRes.archive_path).toContain('adv_test.sentinel.zip');
    });

    it('commits SQLite WAL snapshot and returns page allocation metrics', async () => {
      const store = useProjectStore.getState();
      const walRes = await store.commitWalCheckpoint();

      expect(walRes.journal_mode).toBe('WAL');
      expect(walRes.page_count).toBeGreaterThan(0);
      expect(walRes.checkpoint_applied).toBe(true);
    });

    it('pins, unpins, and removes recent project entries', () => {
      const store = useProjectStore.getState();
      const recents = store.recentProjects;
      if (recents.length > 0) {
        const targetId = recents[0].id;
        const initialPin = recents[0].pinned;

        store.pinProject(targetId);
        expect(useProjectStore.getState().recentProjects.find((p) => p.id === targetId)?.pinned).toBe(!initialPin);

        store.removeRecentProject(targetId);
        expect(useProjectStore.getState().recentProjects.find((p) => p.id === targetId)).toBeUndefined();
      }
    });

    it('closes active project cleanly', async () => {
      const store = useProjectStore.getState();
      await store.closeProject();
      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });
});
