import { describe, it, expect, beforeEach } from 'vitest';
import { useVulnIntelStore } from '../../src/stores/vulnIntelStore';

describe('useVulnIntelStore (Milestone M5)', () => {
  beforeEach(() => {
    useVulnIntelStore.getState().resetStore();
  });

  it('initializes with canonical CVE advisories', () => {
    const state = useVulnIntelStore.getState();
    expect(state.advisories.length).toBeGreaterThanOrEqual(5);
    const log4j = state.advisories.find((a) => a.id === 'CVE-2021-44228');
    expect(log4j).toBeDefined();
    expect(log4j?.isKev).toBe(true);
    expect(log4j?.severity).toBe('CRITICAL');
  });

  it('filters advisories by search query and CISA KEV toggle', () => {
    const store = useVulnIntelStore.getState();
    store.setSearchQuery('Log4j');
    expect(useVulnIntelStore.getState().searchQuery).toBe('Log4j');

    store.toggleKevFilter();
    expect(useVulnIntelStore.getState().filterOnlyKev).toBe(true);

    store.setMinSeverityFilter('CRITICAL');
    expect(useVulnIntelStore.getState().filterMinSeverity).toBe('CRITICAL');
  });

  it('executes safe non-destructive verification probe and promotes to verified finding with CAS proof', async () => {
    const store = useVulnIntelStore.getState();

    // Execute probe on Apache 2.4.49 Traversal (CVE-2021-41773)
    const progress = await store.runVerificationProbe(
      'CVE-2021-41773',
      'https://target.local',
      true, // in scope
      {
        status: 200,
        body: '127.0.0.1 localhost\n',
      }
    );

    expect(progress.stage).toBe('VERIFIED');
    expect(progress.casHash).toBeDefined();
    expect(progress.casHash?.length).toBe(64); // SHA-256
    expect(progress.findingId).toBeDefined();
    expect(progress.log.some((l) => l.includes('Deterministic verification proof succeeded'))).toBe(
      true
    );
  });

  it('negative control: probe returning 404 results in NOT_VULNERABLE with zero finding pollution', async () => {
    const store = useVulnIntelStore.getState();

    const progress = await store.runVerificationProbe(
      'CVE-2021-41773',
      'https://target.local',
      true, // in scope
      {
        status: 404,
        body: '404 Not Found',
      }
    );

    expect(progress.stage).toBe('NOT_VULNERABLE');
    expect(progress.findingId).toBeUndefined(); // ZERO finding pollution
    expect(progress.log.some((l) => l.includes('negative baseline'))).toBe(true);
  });

  it('enforces SEC-01 fail-closed scope gate: aborts probe if target is out of scope', async () => {
    const store = useVulnIntelStore.getState();

    const progress = await store.runVerificationProbe(
      'CVE-2021-41773',
      'https://unauthorized-domain.com',
      false // out of scope!
    );

    expect(progress.stage).toBe('FAILED');
    expect(progress.findingId).toBeUndefined();
    expect(progress.log.some((l) => l.includes('outside configured scope (SEC-01)'))).toBe(true);
  });
});
