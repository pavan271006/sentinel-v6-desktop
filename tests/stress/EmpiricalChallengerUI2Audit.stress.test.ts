import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore } from '../../src/stores/scopeStore';
import { useProjectStore } from '../../src/stores/projectStore';
import { useAppShellStore } from '../../src/stores/appShellStore';

describe('Empirical Challenger UI-2 Audit: Deep Stress & Vulnerability Reproduction', () => {
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
      scopeId: 'scope-default-001',
      version: 1,
      timestamp: new Date().toISOString(),
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
    useAppShellStore.setState({
      activeProjectName: '',
      scopeRulesCount: 2,
    });
  });

  // =========================================================================
  // Finding 1: False-Positive Denial on Legitimate URL Paths with "10." (Remediated)
  // =========================================================================
  describe('Finding 1: Path False Positive Remediation for 10.0.0.0/8 CIDR', () => {
    it('verifies that legitimate URLs containing "10." in path or query are correctly ALLOWED for in-scope target', () => {
      const store = useScopeStore.getState();
      let confirmed = false;

      // URL on target.local with version /v10.1/
      const apiV10Uri = 'https://target.local/api/v10.1/users';

      const allowed = store.checkSafetyGate(apiV10Uri, 'API Request', () => {
        confirmed = true;
      });

      console.log(`[Path 10. Fix] URL: ${apiV10Uri}, allowed: ${allowed}, confirmed: ${confirmed}`);
      expect(allowed).toBe(true);
      expect(confirmed).toBe(true);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(false);
    });

    it('verifies query parameter "page=10.5" does not trigger false positive exclude', () => {
      const store = useScopeStore.getState();
      let confirmed = false;

      const queryUri = 'https://target.local/items?page=10.5';
      const allowed = store.checkSafetyGate(queryUri, 'Query Request', () => {
        confirmed = true;
      });

      expect(allowed).toBe(true);
      expect(confirmed).toBe(true);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(false);
    });
  });

  // =========================================================================
  // Finding 2: RFC1918 CIDR Subnet Bypass on 192.168.0.0/16 and 172.16.0.0/12 (Remediated)
  // =========================================================================
  describe('Finding 2: RFC1918 CIDR Subnet Exclusion Enforcement in Scope Presets', () => {
    it('verifies that 192.168.1.50 is properly BLOCKED by 192.168.0.0/16 exclusion rule', async () => {
      const store = useScopeStore.getState();
      store.applyPreset('intranet_ssrf');

      // Add a broad wildcard inclusion
      store.addRule('INCLUDE', 'HOST', '*', 'Wildcard test');

      let confirmed = false;
      // Target is in 192.168.0.0/16 subnet
      const privateIpUri = 'http://192.168.1.50/admin';
      const allowed = store.checkSafetyGate(privateIpUri, 'Intranet Probe', () => {
        confirmed = true;
      });

      console.log(`[192.168 CIDR Enforcement] URL: ${privateIpUri}, allowed: ${allowed}, confirmed: ${confirmed}`);
      expect(allowed).toBe(false);
      expect(confirmed).toBe(false);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
    });

    it('verifies that 172.16.5.10 is properly BLOCKED by 172.16.0.0/12 exclusion rule', async () => {
      const store = useScopeStore.getState();
      store.applyPreset('intranet_ssrf');
      store.addRule('INCLUDE', 'HOST', '*', 'Wildcard test');

      let confirmed = false;
      const privateIpUri = 'http://172.16.5.10:8080/metrics';
      const allowed = store.checkSafetyGate(privateIpUri, 'Intranet Probe', () => {
        confirmed = true;
      });

      console.log(`[172.16 CIDR Enforcement] URL: ${privateIpUri}, allowed: ${allowed}, confirmed: ${confirmed}`);
      expect(allowed).toBe(false);
      expect(confirmed).toBe(false);
      expect(useScopeStore.getState().safetyWarningModal.isOpen).toBe(true);
    });
  });

  // =========================================================================
  // Finding 3: AppShell Scope Rule Count Overwrite in openProject (Remediated)
  // =========================================================================
  describe('Finding 3: AppShell Scope Rule Count State Synchronization', () => {
    it('verifies openProject preserves active INCLUDE count in AppShell badge', async () => {
      const pStore = useProjectStore.getState();

      // Open project target_v6 (has 2 INCLUDE rules and 4 EXCLUDE rules = 6 total)
      await pStore.openProject('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');

      const appShell = useAppShellStore.getState();
      const scopeRules = useScopeStore.getState().rules;
      const activeIncludes = scopeRules.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length;

      console.log(`[Scope Count State Synchronized] appShellCount: ${appShell.scopeRulesCount}, activeIncludes: ${activeIncludes}, totalRules: ${scopeRules.length}`);
      
      expect(activeIncludes).toBe(2);
      expect(appShell.scopeRulesCount).toBe(2);
    });
  });
});
