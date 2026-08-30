import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore } from '../../src/stores/scopeStore';
import { mockBackendBridge } from '../../src/ipc/mockBridge';
import { ipcClient } from '../../src/ipc/client';

describe('Adversarial Challenge: Scope Engine Invariants & Edge Case Stress Testing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // =========================================================================
  // 1. ADVANCED SSRF & IP ENCODING EVASIONS
  // =========================================================================
  describe('1. Advanced SSRF & IP Evasions', () => {
    it('evaluates IPv6 localhost [::1] and fails closed when not in scope', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://[::1]:8080/admin');
      expect(decision.in_scope).toBe(false);
    });

    it('evaluates link-local IPv6 [fe80::1] and fails closed', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://[fe80::1]/');
      expect(decision.in_scope).toBe(false);
    });

    it('evaluates zero-network 0.0.0.0 and fails closed', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://0.0.0.0:3000/');
      expect(decision.in_scope).toBe(false);
    });

    it('evaluates uppercase IPv6 IPv4-mapped metadata [::FFFF:169.254.169.254]', async () => {
      const store = useScopeStore.getState();
      const decision = await store.evaluateTestUrl('http://[::FFFF:169.254.169.254]/latest/meta-data/');
      expect(decision.in_scope).toBe(false);
    });

    it('evaluates cloud metadata with non-standard ports (8080, 8443, 443)', async () => {
      const store = useScopeStore.getState();
      const ports = [80, 443, 8080, 8443, 9000];
      for (const port of ports) {
        const decision = await store.evaluateTestUrl(`http://169.254.169.254:${port}/latest/meta-data/`);
        expect(decision.in_scope).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. DOMAIN BOUNDARY & SUBSTRING SPOOFING EVASIONS
  // =========================================================================
  describe('2. Domain Boundary & Substring Spoofing Evasions', () => {
    it('prevents attacker domain with target name as subdomain prefix or suffix', async () => {
      // Inclusions: exact 'target.local'
      await ipcClient.updateScope(
        ['target.local'],
        ['169.254.169.254/32', '127.0.0.1/32']
      );

      // Substring attack 1: target.local.attacker.com
      const subSuffix = await mockBackendBridge.testScopeUri('https://target.local.attacker.com/steal');
      // Substring attack 2: evil-target.local
      const prefixAttack = await mockBackendBridge.testScopeUri('https://evil-target.local/');
      // Substring attack 3: attacker.com/target.local
      const pathAttack = await mockBackendBridge.testScopeUri('https://attacker.com/target.local');
      // Substring attack 4: attacker.com/?q=target.local
      const queryAttack = await mockBackendBridge.testScopeUri('https://attacker.com/?q=target.local');

      // Note: Test what mockBackendBridge produces on these adversarial inputs
      expect(subSuffix.in_scope).toBe(false);
      expect(prefixAttack.in_scope).toBe(false);
      expect(pathAttack.in_scope).toBe(false);
      expect(queryAttack.in_scope).toBe(false);
    });

    it('enforces regex boundaries on exact URLs to prevent path extensions', async () => {
      // Regex targeting exact items id
      await ipcClient.updateScope(
        ['^https:\\/\\/target\\.local\\/items\\/\\d+$'],
        []
      );

      const exactMatch = await mockBackendBridge.testScopeUri('https://target.local/items/123');
      expect(exactMatch.in_scope).toBe(true);

      const pathExtension = await mockBackendBridge.testScopeUri('https://target.local/items/123/delete');
      expect(pathExtension.in_scope).toBe(false);
    });
  });

  // =========================================================================
  // 3. MALFORMED JSON RULES & ROBUSTNESS
  // =========================================================================
  describe('3. Malformed JSON Rules & Robustness', () => {
    it('handles null and undefined values in import array gracefully without throwing uncaught errors', () => {
      const store = useScopeStore.getState();

      // Import JSON containing null element
      expect(() => {
        store.importRulesJson('[null]');
      }).not.toThrow();

      // Import JSON containing empty object
      expect(() => {
        store.importRulesJson('[{}]');
      }).not.toThrow();

      // Import JSON containing invalid types
      expect(() => {
        store.importRulesJson('[1, "invalid", true]');
      }).not.toThrow();
    });

    it('handles 1,000 generated rules imported and exported in JSON format without lag', () => {
      const store = useScopeStore.getState();
      const generatedRules: any[] = [];
      for (let i = 0; i < 1000; i++) {
        generatedRules.push({
          id: `bench-rule-${i}`,
          rule_type: i % 2 === 0 ? 'INCLUDE' : 'EXCLUDE',
          pattern_type: 'HOST',
          pattern: `sub${i}.target.local`,
          enabled: true,
          notes: `Benchmark rule ${i}`,
        });
      }

      const jsonStr = JSON.stringify(generatedRules);
      const startImport = performance.now();
      store.importRulesJson(jsonStr);
      const importDuration = performance.now() - startImport;

      expect(importDuration).toBeLessThan(200); // Must be fast
      expect(useScopeStore.getState().rules.length).toBe(1000);

      const startExport = performance.now();
      const exported = store.exportRulesJson();
      const exportDuration = performance.now() - startExport;

      expect(exportDuration).toBeLessThan(200);
      expect(exported.length).toBeGreaterThan(10000);
    });
  });
});
