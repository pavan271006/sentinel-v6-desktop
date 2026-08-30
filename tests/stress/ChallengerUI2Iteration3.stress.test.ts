import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../src/stores/projectStore';
import { useScopeStore, ScopeRuleDef } from '../../src/stores/scopeStore';
import { useAppShellStore } from '../../src/stores/appShellStore';

describe('Challenger UI-2 Iteration 3 Adversarial Quality Gate: Concurrency, Bounds & Hermeticity', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      currentProject: null,
      recentProjects: [],
      isModalOpen: false,
      activeModalTab: 'new',
      isLoading: false,
      error: null,
      lastWalStatus: null,
    });
    useScopeStore.setState({
      scopeId: 'scope-test-ui2-3',
      version: 1,
      timestamp: new Date().toISOString(),
      rules: [
        { id: 'r-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true },
        { id: 'r-02', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: '*.target.local', enabled: true },
        { id: 'r-03', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true },
        { id: 'r-04', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true },
        { id: 'r-05', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '172.16.0.0/12', enabled: true },
        { id: 'r-06', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '192.168.0.0/16', enabled: true },
        { id: 'r-07', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|delete-account|terminate|drop-db).*', enabled: true },
      ],
      violations: [],
      testUrl: 'https://target.local/api/v1/users',
      testResult: null,
      isLoading: false,
      isSaving: false,
      safetyWarningModal: {
        isOpen: false,
        targetUri: '',
        actionName: '',
      },
    });
    useAppShellStore.setState({
      activeProjectName: '',
      scopeRulesCount: 2,
    });
  });

  // =========================================================================
  // 1. VIOLATION RING BUFFER & ZERO UNBOUNDED MEMORY GROWTH (500 MAX CAP)
  // =========================================================================
  describe('1. Memory Retention & 500-Item Violation Ring Buffer', () => {
    it('strictly caps violations array to exactly 500 records under high-speed 10,000 violation burst', () => {
      const scopeStore = useScopeStore.getState();

      const initialMem = process.memoryUsage().heapUsed;

      // Burst 10,000 violations
      for (let i = 0; i < 10000; i++) {
        scopeStore.recordViolation({
          timestamp: `12:00:${(i % 60).toString().padStart(2, '0')}`,
          uri: `http://10.0.${Math.floor(i / 256)}.${i % 256}/internal-leak-${i}`,
          clientIp: '127.0.0.1',
          matchedRuleId: 'r-04',
          reason: `RFC1918 Deny probe ${i}`,
          actionTaken: 'DROPPED_PRE_SOCKET',
        });
      }

      const finalViolations = useScopeStore.getState().violations;
      expect(finalViolations.length).toBe(500);

      // Verify FIFO/LIFO ordering: newest entry (index 9999) must be at index 0
      expect(finalViolations[0].uri).toBe('http://10.0.39.15/internal-leak-9999');
      // Oldest entry retained must be index (10000 - 500 = 9500)
      expect(finalViolations[499].uri).toBe('http://10.0.37.28/internal-leak-9500');

      const postMem = process.memoryUsage().heapUsed;
      const deltaMb = (postMem - initialMem) / (1024 * 1024);
      console.log(`[Violation Ring Buffer 10,000 Burst] Delta: ${deltaMb.toFixed(2)}MB, Final Count: ${finalViolations.length}`);
      expect(deltaMb).toBeLessThan(35);
    });

    it('bounds internal caches across 20,000 unique randomized domain & CIDR lookups without memory leak', () => {
      const scopeStore = useScopeStore.getState();

      const initialMem = process.memoryUsage().heapUsed;

      // Perform 20,000 evaluations across unique URLs
      for (let i = 0; i < 20000; i++) {
        const uniqueHost = `node-${i % 5000}.dynamic-${i % 200}.internal`;
        scopeStore.checkSafetyGate(`https://${uniqueHost}/resource/${i % 100}`, 'CacheBurst', () => {});
      }

      const postMem = process.memoryUsage().heapUsed;
      const deltaMb = (postMem - initialMem) / (1024 * 1024);
      console.log(`[Cache Eviction & Bounds 20,000 Evaluations] Delta: ${deltaMb.toFixed(2)}MB`);
      expect(deltaMb).toBeLessThan(50);
    });
  });

  // =========================================================================
  // 2. HERMETIC ZUSTAND STATE ON RAPID PROJECT SWITCHING & RULE IMPORTING
  // =========================================================================
  describe('2. Hermetic Zustand State on Rapid Project Switching & Rule Importing', () => {
    it('maintains strict state isolation when switching between projects with different scope profiles', async () => {
      const pStore = useProjectStore.getState();

      // Project A: target_v6
      await pStore.openProject('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');
      expect(useAppShellStore.getState().activeProjectName).toBe('Production Target Assessment');
      const projectAScopeCount = useAppShellStore.getState().scopeRulesCount;
      expect(projectAScopeCount).toBe(2);

      // Close Project A
      await pStore.closeProject();
      expect(useProjectStore.getState().currentProject).toBeNull();
      expect(useAppShellStore.getState().activeProjectName).toBe('');
      expect(useAppShellStore.getState().scopeRulesCount).toBe(0);

      // Create new Project B with 5 seed rules
      const seedRules = [
        'app1.corp.local',
        'app2.corp.local',
        'app3.corp.local',
        'app4.corp.local',
        'app5.corp.local',
      ];
      const projectB = await pStore.createProject('Project-B', 'C:/engagements/proj_b', seedRules);
      expect(projectB.name).toBe('Project-B');
      expect(useAppShellStore.getState().activeProjectName).toBe('Project-B');

      // Now import 10 new rules into Project B
      const importedRules: ScopeRuleDef[] = [];
      for (let i = 0; i < 10; i++) {
        importedRules.push({
          id: `imp-${i}`,
          rule_type: i % 2 === 0 ? 'INCLUDE' : 'EXCLUDE',
          pattern_type: 'HOST',
          pattern: `imported-${i}.org`,
          enabled: true,
        });
      }
      useScopeStore.getState().importRulesJson(JSON.stringify(importedRules));

      // Active includes in Project B should be 5 (5 enabled INCLUDE rules out of 10)
      expect(useAppShellStore.getState().scopeRulesCount).toBe(5);
      expect(useScopeStore.getState().rules.length).toBe(10);

      // Close Project B and re-open Project A
      await pStore.closeProject();
      expect(useAppShellStore.getState().scopeRulesCount).toBe(0);

      await pStore.openProject('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');
      // Rules must be restored to Project A's scope, zero bleed from Project B
      expect(useAppShellStore.getState().activeProjectName).toBe('Production Target Assessment');
      expect(useAppShellStore.getState().scopeRulesCount).toBe(2);
      expect(useScopeStore.getState().rules.some((r) => r.pattern.includes('imported'))).toBe(false);
    });

    it('handles 20 rapid sequential project switching and rule import cycles without state corruption', async () => {
      const pStore = useProjectStore.getState();
      const sStore = useScopeStore.getState();

      for (let cycle = 0; cycle < 20; cycle++) {
        const actionType = cycle % 4;
        if (actionType === 0) {
          await pStore.openProject('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');
        } else if (actionType === 1) {
          await pStore.closeProject();
        } else if (actionType === 2) {
          const rules: ScopeRuleDef[] = [
            { id: `c-rule-${cycle}-1`, rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: `rapid-${cycle}.local`, enabled: true },
            { id: `c-rule-${cycle}-2`, rule_type: 'EXCLUDE', pattern_type: 'HOST', pattern: `bad-${cycle}.local`, enabled: true },
          ];
          sStore.importRulesJson(JSON.stringify(rules));
        } else {
          sStore.applyPreset('standard_web');
        }
      }

      // Store must remain in a stable, non-loading, non-errored state
      const finalProjectState = useProjectStore.getState();
      const finalScopeState = useScopeStore.getState();
      const finalAppShell = useAppShellStore.getState();

      expect(finalProjectState.isLoading).toBe(false);
      expect(finalScopeState.isLoading).toBe(false);

      const activeIncludeCount = finalScopeState.rules.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length;
      expect(finalAppShell.scopeRulesCount).toBe(activeIncludeCount);
    });
  });

  // =========================================================================
  // 3. ADVERSARIAL EDGE CASES, PROTOCOL BYPASSES & BITWISE BOUNDARY PROBES
  // =========================================================================
  describe('3. Adversarial Edge Cases & Boundary Limits', () => {
    it('prevents SSRF bypasses via IPv4-mapped IPv6, loopbacks, and zero addresses', () => {
      const store = useScopeStore.getState();

      const ssrfPayloads = [
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.1.1/info',
        'http://[::ffff:169.254.169.254]/latest/meta-data/',
        'http://[::FFFF:169.254.169.254]/',
        'http://127.0.0.1:8080/admin',
        'http://[::1]:3000/internal',
        'http://0.0.0.0:8000/console',
      ];

      for (const uri of ssrfPayloads) {
        let confirmed = false;
        const allowed = store.checkSafetyGate(uri, 'SSRF Probe', () => {
          confirmed = true;
        });

        expect(allowed).toBe(false);
        expect(confirmed).toBe(false);
        expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
      }
    });

    it('correctly distinguishes RFC1918 subnets (10/8, 172.16/12, 192.168/16) at exact bit boundaries', () => {
      const store = useScopeStore.getState();
      // Add broad include to test CIDR exclusion filter
      store.addRule('INCLUDE', 'HOST', '*', 'All hosts');

      // Test boundary IPs for 172.16.0.0/12 (Valid range: 172.16.0.0 - 172.31.255.255)
      const in172Range = ['http://172.16.0.1/api', 'http://172.31.255.254/api', 'http://172.20.10.5/api'];
      for (const uri of in172Range) {
        let executed = false;
        const allowed = store.checkSafetyGate(uri, '172.16 Probe', () => { executed = true; });
        expect(allowed).toBe(false);
        expect(executed).toBe(false);
      }

      // 172.32.0.1 is OUTSIDE 172.16.0.0/12 (Public IP space) -> Must be ALLOWED by '*'
      let public172Executed = false;
      const allowedPublic = store.checkSafetyGate('http://172.32.0.1/api', 'Public 172', () => {
        public172Executed = true;
      });
      expect(allowedPublic).toBe(true);
      expect(public172Executed).toBe(true);

      // Test boundary IPs for 192.168.0.0/16 (Valid range: 192.168.0.0 - 192.168.255.255)
      const in192Range = ['http://192.168.0.1/', 'http://192.168.255.254/', 'http://192.168.100.50/'];
      for (const uri of in192Range) {
        let executed = false;
        const allowed = store.checkSafetyGate(uri, '192.168 Probe', () => { executed = true; });
        expect(allowed).toBe(false);
        expect(executed).toBe(false);
      }

      // 192.169.0.1 is OUTSIDE 192.168.0.0/16 -> Allowed by '*'
      let public192Executed = false;
      const allowedPublic192 = store.checkSafetyGate('http://192.169.0.1/api', 'Public 192', () => {
        public192Executed = true;
      });
      expect(allowedPublic192).toBe(true);
      expect(public192Executed).toBe(true);
    });

    it('safely handles non-standard, malformed and adversarial URL strings without crashing', () => {
      const store = useScopeStore.getState();

      const malformed = [
        '',
        '   ',
        'http://',
        'https://',
        'not_a_url',
        'ftp://invalid-proto.com',
        'javascript:alert(1)',
        '//double-slash/path',
        'https://target.local:9999999/overflow-port',
        'http://256.256.256.256/invalid-ip',
      ];

      for (const badUri of malformed) {
        expect(() => {
          store.checkSafetyGate(badUri, 'Malformed Probe', () => {});
        }).not.toThrow();
      }
    });

    it('resists complex regex evaluations without blocking the event loop or exceeding latency bounds', () => {
      const store = useScopeStore.getState();

      // Add complex regex rules
      store.addRule('EXCLUDE', 'REGEX', '.*[/\\.](token_[0-9]+|session_[a-z0-9]+|secret_[0-9a-f]{8,32}).*', 'Complex Token Regex');
      store.addRule('EXCLUDE', 'REGEX', '^https?://[a-z0-9.-]+\\.(admin|internal|corp)\\.[a-z]{2,4}/.*$', 'Internal Domain Regex');

      const testTargets = [
        'https://target.local/api/v1/session_abc12345/profile',
        'https://sub.admin.corp.net/dashboard',
        'https://target.local/public/search?q=normal_query',
      ];

      for (const target of testTargets) {
        const t0 = performance.now();
        const allowed = store.checkSafetyGate(target, 'Regex Evaluation', () => {});
        const elapsed = performance.now() - t0;

        console.log(`[Regex Latency] target: ${target}, allowed: ${allowed}, elapsed: ${elapsed.toFixed(4)}ms`);
        expect(elapsed).toBeLessThan(5.0);
      }
    });
  });
});
