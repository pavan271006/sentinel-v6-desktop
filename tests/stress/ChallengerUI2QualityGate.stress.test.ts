import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../../src/stores/projectStore';
import { useScopeStore, ScopeRuleDef } from '../../src/stores/scopeStore';
import { useAppShellStore } from '../../src/stores/appShellStore';
import { mockBackendBridge } from '../../src/ipc/mockBridge';
import { ipcClient } from '../../src/ipc/client';

describe('Challenger UI-2 Empirical Quality Gate: Concurrency, Scale & Memory Bounds', () => {
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
      scopeId: 'scope-test-init',
      version: 1,
      timestamp: new Date().toISOString(),
      rules: [
        { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Target apex' },
        { id: 'rule-02', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: '*.target.local', enabled: true, notes: 'Subdomain wildcard' },
        { id: 'rule-03', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/*', enabled: true, notes: 'API' },
        { id: 'rule-04', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'Cloud SSRF' },
        { id: 'rule-05', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true, notes: 'Intranet' },
        { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '127.0.0.1/32', enabled: true, notes: 'Loopback' },
        { id: 'rule-07', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|delete-account|terminate|drop-db).*', enabled: true, notes: 'Destructive' },
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
      scopeRulesCount: 3,
    });
  });

  // =========================================================================
  // 1. ASYNC CONCURRENCY & ZUSTAND HERMETICITY UNDER RAPID TRIGGERS
  // =========================================================================
  describe('1. Async Concurrency & Zustand Hermeticity', () => {
    it('maintains hermetic Zustand state under 100 rapid concurrent create/open/close triggers', async () => {
      const pStore = useProjectStore.getState();
      const operations: Promise<any>[] = [];

      for (let i = 0; i < 100; i++) {
        const mode = i % 4;
        if (mode === 0) {
          operations.push(pStore.createProject(`Concurrent-${i}`, `C:/engagements/proj_${i}`, [`sub${i}.target.local`]));
        } else if (mode === 1) {
          operations.push(pStore.openProject(`C:/engagements/proj_${Math.max(0, i - 1)}`));
        } else if (mode === 2) {
          operations.push(pStore.commitWalCheckpoint());
        } else {
          operations.push(pStore.closeProject());
        }
      }

      // Execute all 100 concurrent promises simultaneously
      const results = await Promise.allSettled(operations);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected.length).toBe(0);

      // Verify final store state integrity
      const finalState = useProjectStore.getState();
      expect(finalState.isLoading).toBe(false);
      expect(finalState.error).toBeNull();
      
      // If currentProject is active, appShellStore must mirror its name exactly
      const appShell = useAppShellStore.getState();
      if (finalState.currentProject) {
        expect(appShell.activeProjectName).toBe(finalState.currentProject.name);
      } else {
        expect(appShell.activeProjectName).toBe('');
      }
    });

    it('handles interleaved race conditions between createProject and closeProject cleanly', async () => {
      const pStore = useProjectStore.getState();

      // Trigger create and close almost simultaneously in alternating order
      for (let cycle = 0; cycle < 10; cycle++) {
        const p1 = pStore.createProject(`Race-${cycle}`, `C:/engagements/race_${cycle}`);
        const p2 = pStore.closeProject();
        await Promise.allSettled([p1, p2]);

        const state = useProjectStore.getState();
        expect(state.isLoading).toBe(false);
        // Current project must be either null (if close won) or valid ProjectMetadata (if create won)
        if (state.currentProject !== null) {
          expect(typeof state.currentProject.name).toBe('string');
          expect(state.currentProject.wal_journal_mode).toBe('WAL');
        }
      }
    });

    it('atomically synchronizes useScopeStore when openProject loads project with scope rules', async () => {
      const pStore = useProjectStore.getState();

      // Open a project that returns a project state with scope definitions
      await pStore.openProject('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');

      const scopeState = useScopeStore.getState();
      expect(scopeState.scopeId).toBeDefined();
      expect(scopeState.rules.length).toBeGreaterThan(0);

      const appShellState = useAppShellStore.getState();
      const expectedIncludeCount = scopeState.rules.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length;
      expect(appShellState.scopeRulesCount).toBe(expectedIncludeCount);
    });

    it('survives simulated IPC error burst and allows subsequent operations without deadlock', async () => {
      const pStore = useProjectStore.getState();

      // Inject temporary simulated IPC failures
      const originalCreate = ipcClient.createProject;
      let failCount = 3;
      ipcClient.createProject = vi.fn().mockImplementation(async (name: string, path: string) => {
        if (failCount > 0) {
          failCount--;
          throw new Error('Simulated SQLite disk I/O failure');
        }
        return originalCreate.call(ipcClient, name, path);
      });

      // Attempt 3 failing calls
      for (let i = 0; i < 3; i++) {
        await expect(pStore.createProject(`Fail-${i}`, `C:/fail/${i}`)).rejects.toThrow('Simulated SQLite disk I/O failure');
        expect(useProjectStore.getState().isLoading).toBe(false);
        expect(useProjectStore.getState().error).toContain('Simulated SQLite disk I/O failure');
      }

      // Subsequent 4th call should succeed cleanly
      const recovered = await pStore.createProject('Recovered Project', 'C:/engagements/recovered');
      expect(recovered.name).toBe('Recovered Project');
      expect(useProjectStore.getState().isLoading).toBe(false);
      expect(useProjectStore.getState().error).toBeNull();
      expect(useProjectStore.getState().currentProject?.name).toBe('Recovered Project');

      // Restore
      ipcClient.createProject = originalCreate;
    });
  });

  // =========================================================================
  // 2. 1000+ SCOPE RULES EVALUATION LATENCY (<1ms) & BENCHMARKING
  // =========================================================================
  describe('2. 1000+ Scope Rules Scalability & <1ms Latency Benchmark', () => {
    it('evaluates single URL against 1,000+ rules in <1ms latency (frontend checkSafetyGate)', () => {
      const store = useScopeStore.getState();

      // Generate 1,500 heterogeneous scope rules
      const rules: ScopeRuleDef[] = [];
      
      // Add 500 HOST rules
      for (let i = 0; i < 500; i++) {
        rules.push({
          id: `rule-host-${i}`,
          rule_type: i % 5 === 0 ? 'EXCLUDE' : 'INCLUDE',
          pattern_type: 'HOST',
          pattern: i % 10 === 0 ? `*.sub${i}.corp.net` : `api-${i}.service.internal`,
          enabled: true,
          notes: `Host rule ${i}`,
        });
      }

      // Add 400 URL_PREFIX rules
      for (let i = 0; i < 400; i++) {
        rules.push({
          id: `rule-prefix-${i}`,
          rule_type: i % 4 === 0 ? 'EXCLUDE' : 'INCLUDE',
          pattern_type: 'URL_PREFIX',
          pattern: `https://api-${i}.service.internal/v${i % 3}/*`,
          enabled: true,
          notes: `Prefix rule ${i}`,
        });
      }

      // Add 300 IP_CIDR rules
      for (let i = 0; i < 300; i++) {
        rules.push({
          id: `rule-cidr-${i}`,
          rule_type: 'EXCLUDE',
          pattern_type: 'IP_CIDR',
          pattern: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
          enabled: true,
          notes: `CIDR rule ${i}`,
        });
      }

      // Add 300 REGEX rules
      for (let i = 0; i < 300; i++) {
        rules.push({
          id: `rule-regex-${i}`,
          rule_type: i % 2 === 0 ? 'EXCLUDE' : 'INCLUDE',
          pattern_type: 'REGEX',
          pattern: `.*[/\\.](action_${i}|token_${i}|secret_${i}).*`,
          enabled: true,
          notes: `Regex rule ${i}`,
        });
      }

      // Total: 1,500 rules
      expect(rules.length).toBe(1500);
      useScopeStore.setState({ rules });

      const testUris = [
        'https://api-100.service.internal/v1/resource',
        'https://api-499.service.internal/v2/items',
        'https://unknown-attacker.com/leak',
        'http://169.254.169.254/latest/meta-data/',
        'https://sub20.corp.net/admin',
        'https://api-50.service.internal/v0/action_50',
      ];

      // Warm up JIT
      for (let w = 0; w < 30; w++) {
        store.checkSafetyGate(testUris[w % testUris.length], 'Warmup', () => {});
      }

      // Measure latency over 100 evaluations on different URLs
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const uri = testUris[i % testUris.length];
        const t0 = performance.now();
        store.checkSafetyGate(uri, 'StressGate', () => {});
        const t1 = performance.now();
        latencies.push(t1 - t0);
      }

      latencies.sort((a, b) => a - b);
      const avgLatency = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      const maxLatency = latencies[latencies.length - 1];

      console.log(`[1500 Rules Scalability Benchmark] avg: ${avgLatency.toFixed(4)}ms, p50: ${p50.toFixed(4)}ms, p95: ${p95.toFixed(4)}ms, p99: ${p99.toFixed(4)}ms, max: ${maxLatency.toFixed(4)}ms`);

      // Strict Quality Gate Requirement: average latency < 1ms
      expect(avgLatency).toBeLessThan(1.0);
      expect(p50).toBeLessThan(1.0);
      expect(p95).toBeLessThan(3.0);
    });

    it('evaluates single URL against 1,000+ rules in mockBackendBridge with <1ms per evaluation', async () => {
      const generatedRules: ScopeRuleDef[] = [];
      for (let i = 0; i < 1000; i++) {
        generatedRules.push({
          id: `backend-rule-${i}`,
          rule_type: i % 3 === 0 ? 'EXCLUDE' : 'INCLUDE',
          pattern_type: i % 4 === 0 ? 'HOST' : i % 4 === 1 ? 'URL_PREFIX' : i % 4 === 2 ? 'IP_CIDR' : 'REGEX',
          pattern: i % 4 === 0 ? `host-${i}.target.local` : i % 4 === 1 ? `https://target.local/path_${i}/*` : i % 4 === 2 ? `192.168.${Math.floor(i / 256)}.${i % 256}/32` : `.*auth_${i}.*`,
          enabled: true,
        });
      }

      const includes = generatedRules.filter((r) => r.rule_type === 'INCLUDE').map((r) => r.pattern);
      const excludes = generatedRules.filter((r) => r.rule_type === 'EXCLUDE').map((r) => r.pattern);
      await ipcClient.updateScope(includes, excludes, generatedRules);

      // Warm up
      await mockBackendBridge.testScopeUri('https://host-0.target.local/');

      const latencies: number[] = [];
      const testUris = [
        'https://host-300.target.local/api',
        'https://target.local/path_501/data',
        'http://192.168.0.100/',
        'https://target.local/auth_999/token',
        'https://unregistered-domain.com/',
      ];

      for (let i = 0; i < 50; i++) {
        const uri = testUris[i % testUris.length];
        const t0 = performance.now();
        const res = await mockBackendBridge.testScopeUri(uri);
        const t1 = performance.now();
        expect(res).toBeDefined();
        latencies.push(t1 - t0);
      }

      const avgLatency = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
      console.log(`[Backend Bridge 1000 Rules Benchmark] avg: ${avgLatency.toFixed(4)}ms, min: ${Math.min(...latencies).toFixed(4)}ms, max: ${Math.max(...latencies).toFixed(4)}ms`);

      expect(avgLatency).toBeLessThan(1.0);
    });

    it('scales to 5,000 rules with linear evaluation overhead and 100% fail-closed default deny', () => {
      const store = useScopeStore.getState();
      const rules: ScopeRuleDef[] = [];

      for (let i = 0; i < 5000; i++) {
        rules.push({
          id: `rule-scale-${i}`,
          rule_type: 'INCLUDE',
          pattern_type: 'HOST',
          pattern: `target-${i}.local`,
          enabled: true,
        });
      }

      useScopeStore.setState({ rules });

      // Out of scope URL must trigger safety gate (fail closed)
      let executed = false;
      const allowed = store.checkSafetyGate('https://random-attacker.xyz/exploit', 'StressCheck', () => {
        executed = true;
      });

      expect(allowed).toBe(false);
      expect(executed).toBe(false);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
    });
  });

  // =========================================================================
  // 3. ZERO MEMORY LEAKS & BOUNDS PROFILING
  // =========================================================================
  describe('3. Memory Bounds & Zero Leaks Verification', () => {
    it('retains zero unbounded memory growth across 10,000 scope evaluations', () => {
      const store = useScopeStore.getState();

      // Trigger GC if available, otherwise record heapUsed
      const initialMem = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10000; i++) {
        store.checkSafetyGate(`https://sub-${i % 10}.target.local/api`, 'MemoryProbe', () => {});
      }

      const postMem = process.memoryUsage().heapUsed;
      const memDeltaMb = (postMem - initialMem) / (1024 * 1024);

      console.log(`[Memory Growth Probe - 10,000 Evaluations] initial: ${(initialMem / (1024 * 1024)).toFixed(2)}MB, post: ${(postMem / (1024 * 1024)).toFixed(2)}MB, delta: ${memDeltaMb.toFixed(2)}MB`);

      // Delta should be bounded (< 30MB in Node/V8 testing context for 10k calls)
      expect(memDeltaMb).toBeLessThan(30);
    });

    it('enforces ring buffer limit (500 items max) on violation logs preventing memory leak', () => {
      const store = useScopeStore.getState();

      // Record 2,000 violations
      for (let i = 0; i < 2000; i++) {
        store.recordViolation({
          timestamp: `20:00:${i % 60}`,
          uri: `http://10.0.0.${i % 256}/internal`,
          clientIp: '127.0.0.1',
          matchedRuleId: 'rule-05',
          reason: 'RFC1918 leak',
          actionTaken: 'DROPPED_PRE_SOCKET',
        });
      }

      // Violations must be capped at exactly 500
      const violations = useScopeStore.getState().violations;
      expect(violations.length).toBe(500);

      // Most recent violation should be at index 0
      expect(violations[0].uri).toBe('http://10.0.0.207/internal'); // (1999 % 256 = 207)
    });

    it('handles repeated JSON import/export cycles (200 cycles of 1,000 rules) without leaking objects', () => {
      const store = useScopeStore.getState();
      const generatedRules: ScopeRuleDef[] = [];
      for (let i = 0; i < 1000; i++) {
        generatedRules.push({
          id: `cycle-rule-${i}`,
          rule_type: i % 2 === 0 ? 'INCLUDE' : 'EXCLUDE',
          pattern_type: 'HOST',
          pattern: `domain-${i}.com`,
          enabled: true,
        });
      }
      const jsonStr = JSON.stringify(generatedRules);

      const memStart = process.memoryUsage().heapUsed;

      for (let c = 0; c < 200; c++) {
        store.importRulesJson(jsonStr);
        store.exportRulesJson();
      }

      const memEnd = process.memoryUsage().heapUsed;
      const deltaMb = (memEnd - memStart) / (1024 * 1024);

      console.log(`[JSON 200 Cycles Memory Delta] delta: ${deltaMb.toFixed(2)}MB`);
      expect(useScopeStore.getState().rules.length).toBe(1000);
      expect(deltaMb).toBeLessThan(40);
    });
  });

  // =========================================================================
  // 4. ADVERSARIAL EDGE CASES & INVARIANTS (SEC-01, ReDoS, HOST BOUNDARIES)
  // =========================================================================
  describe('4. Adversarial Edge Cases & Security Invariants', () => {
    it('resists ReDoS attacks with pathological regex input patterns without hanging', () => {
      const store = useScopeStore.getState();

      // Pathological regex: (a+)+$ on 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab'
      store.addRule('EXCLUDE', 'REGEX', '^(a+)+$', 'ReDoS Test');

      const t0 = performance.now();
      const allowed = store.checkSafetyGate('https://target.local/aaaaaaaaaaaaaaaaaaaaaaaaaaaaab', 'ReDoS Check', () => {});
      const elapsed = performance.now() - t0;

      console.log(`[ReDoS Probe Execution Time] ${elapsed.toFixed(4)}ms`);
      expect(elapsed).toBeLessThan(100); // Must not hang
      expect(typeof allowed).toBe('boolean');
    });

    it('handles uppercase URL schemes, ports, and trailing domain dots consistently', () => {
      const store = useScopeStore.getState();

      // Uppercase URL
      let cb1 = false;
      const a1 = store.checkSafetyGate('HTTPS://TARGET.LOCAL/API/V1', 'Upper', () => { cb1 = true; });
      expect(a1).toBe(true);
      expect(cb1).toBe(true);

      // Trailing dot in FQDN: target.local.
      let cb2 = false;
      const a2 = store.checkSafetyGate('https://target.local./api/v1', 'TrailingDot', () => { cb2 = true; });
      expect(a2).toBe(true);
      expect(cb2).toBe(true);

      // Custom Port: target.local:8443
      let cb3 = false;
      const a3 = store.checkSafetyGate('https://target.local:8443/api/v1', 'CustomPort', () => { cb3 = true; });
      expect(a3).toBe(true);
      expect(cb3).toBe(true);
    });

    it('guarantees SEC-01 fail-closed exclusion when 500 inclusion rules overlap with 1 matching exclusion rule', () => {
      const store = useScopeStore.getState();
      const rules: ScopeRuleDef[] = [];

      // Add 500 matching inclusion rules
      for (let i = 0; i < 500; i++) {
        rules.push({
          id: `inc-${i}`,
          rule_type: 'INCLUDE',
          pattern_type: 'HOST',
          pattern: 'target.local',
          enabled: true,
        });
      }

      // Add 1 exclusion rule for /auth/logout
      rules.push({
        id: 'ex-01',
        rule_type: 'EXCLUDE',
        pattern_type: 'REGEX',
        pattern: '.*[/\\.](logout|signout).*',
        enabled: true,
      });

      useScopeStore.setState({ rules });

      let cbExecuted = false;
      const allowed = store.checkSafetyGate('https://target.local/api/auth/logout', 'Destructive Call', () => {
        cbExecuted = true;
      });

      // Must strictly be DENIED
      expect(allowed).toBe(false);
      expect(cbExecuted).toBe(false);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
    });
  });
});
