import { describe, it, expect, beforeEach } from 'vitest';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../src/stores/repeaterStore';
import { getUtf8ByteLength } from '../../src/utils/repeaterUtils';

describe('Repeater Scale, Memory & Adversarial Stress Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [{ ...DEFAULT_INITIAL_TAB, id: 'rep-tab-1', history: [], isDirty: false }],
      activeTabId: 'rep-tab-1',
      closedTabsStack: [],
      globalVariables: { host: 'target.local' },
    });
  });

  it('handles 1MB payload serialization and execution without degradation', async () => {
    const largeJsonObj: Record<string, string> = {};
    for (let i = 0; i < 10000; i++) {
      largeJsonObj[`param_field_${i}`] = `payload_entropy_sample_value_string_token_${i}`;
    }
    const largeBody = JSON.stringify(largeJsonObj);
    const sizeBytes = getUtf8ByteLength(largeBody);

    expect(sizeBytes).toBeGreaterThan(500 * 1024); // > 500KB

    const tabId = 'rep-tab-1';
    useRepeaterStore.getState().updateTabBody(tabId, largeBody);

    const start = performance.now();
    await useRepeaterStore.getState().sendRequest(tabId);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // executed under 1s
    const tab = useRepeaterStore.getState().tabs[0];
    expect(tab.history).toHaveLength(1);
    expect(tab.history[0].statusCode).toBe(200);
  });

  it('records 100 sequential revisions on a single tab with time-travel stability', async () => {
    const tabId = 'rep-tab-1';

    for (let i = 1; i <= 100; i++) {
      useRepeaterStore.getState().updateTabUrl(tabId, `https://target.local/api/v1/resource/${i}`);
      useRepeaterStore.getState().updateTabBody(tabId, `{"iteration":${i}}`);
      await useRepeaterStore.getState().sendRequest(tabId);
    }

    const tab = useRepeaterStore.getState().tabs[0];
    expect(tab.history).toHaveLength(100);
    expect(tab.activeRevisionIndex).toBe(99);
    expect(tab.history[99].revisionNumber).toBe(100);

    // Instant time-travel to revision #42
    useRepeaterStore.getState().restoreRevision(tabId, 41);
    const timeTraveledTab = useRepeaterStore.getState().tabs[0];
    expect(timeTraveledTab.url).toBe('https://target.local/api/v1/resource/42');
    expect(timeTraveledTab.body).toBe('{"iteration":42}');
    expect(timeTraveledTab.activeRevisionIndex).toBe(41);
  });

  it('performs 50 rapid tab creation, close, and undo restore cycles without leaks', () => {
    for (let i = 1; i <= 50; i++) {
      const createdId = useRepeaterStore.getState().createTab({ title: `Stress Tab ${i}` });
      useRepeaterStore.getState().closeTab(createdId);
    }

    expect(useRepeaterStore.getState().tabs).toHaveLength(1);
    expect(useRepeaterStore.getState().closedTabsStack.length).toBeLessThanOrEqual(20); // bounded stack

    // Reopen 5 closed tabs
    for (let i = 0; i < 5; i++) {
      useRepeaterStore.getState().reopenClosedTab();
    }

    expect(useRepeaterStore.getState().tabs).toHaveLength(6);
  });

  it('enforces SEC-01 fail-closed scope rejection on malicious SSRF & out-of-scope targets', async () => {
    const tabId = 'rep-tab-1';

    // 1. AWS Cloud Metadata SSRF probe
    useRepeaterStore.getState().updateTabUrl(tabId, 'http://169.254.169.254/latest/meta-data/iam');
    await useRepeaterStore.getState().sendRequest(tabId);

    let tab = useRepeaterStore.getState().tabs[0];
    expect(tab.history[0].error).toContain('SEC-01 Scope Violation');

    // 2. Private RFC1918 Intranet probe
    useRepeaterStore.getState().updateTabUrl(tabId, 'http://10.0.0.1/admin');
    await useRepeaterStore.getState().sendRequest(tabId);

    tab = useRepeaterStore.getState().tabs[0];
    expect(tab.history[1].error).toContain('SEC-01 Scope Violation');

    // 3. External unauthorized target
    useRepeaterStore.getState().updateTabUrl(tabId, 'https://attacker.evil.com/exfiltrate');
    await useRepeaterStore.getState().sendRequest(tabId);

    tab = useRepeaterStore.getState().tabs[0];
    expect(tab.history[2].error).toContain('SEC-01 Scope Violation');
  });
});
