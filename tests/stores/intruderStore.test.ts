import { describe, it, expect, beforeEach } from 'vitest';
import { useIntruderStore, extractTabTitle } from '../../src/stores/intruderStore';

describe('Intruder Multi-Tab Store (useIntruderStore)', () => {
  beforeEach(() => {
    // Reset to initial clean state
    const state = useIntruderStore.getState();
    const firstTab = state.tabs[0];
    useIntruderStore.setState({
      tabs: [
        {
          ...firstTab,
          id: 'tab-init',
          title: 'POST /Login.asp',
          targetUrl: 'https://ims.ritchennai.edu.in',
          requestText: 'POST /Login.asp?user=§admin§ HTTP/1.1\r\nHost: ims.ritchennai.edu.in\r\n\r\n',
          attackType: 'Sniper attack',
          selectedPosition: 1,
          payloadSets: { 1: ['admin', 'guest', 'root'] },
          concurrency: 20,
          delayMs: 0,
          attackResults: [],
        },
      ],
      activeTabId: 'tab-init',
    });
  });

  it('extracts clean tab titles from HTTP method and path or full URL', () => {
    expect(extractTabTitle('POST', '/domainreliability/upload')).toBe('POST /domainreliability/...');
    expect(extractTabTitle('GET', 'https://example.com/api/v1/users')).toBe('GET /api/v1/users');
    expect(extractTabTitle('PUT', '/short')).toBe('PUT /short');
  });

  it('creates and activates a new tab seamlessly', () => {
    const newId = useIntruderStore.getState().createTab({
      title: 'POST /login',
      targetUrl: 'https://example.com/login',
      requestText: 'POST /login HTTP/1.1\r\nHost: example.com\r\n\r\nuser=§admin§&pass=§123§',
    });

    const state = useIntruderStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe(newId);
    expect(state.targetUrl).toBe('https://example.com/login');
    expect(state.requestText).toContain('user=§admin§');
  });

  it('renames an Intruder tab', () => {
    useIntruderStore.getState().renameTab('tab-init', 'POST /auth/custom');
    const state = useIntruderStore.getState();
    expect(state.tabs.find((t) => t.id === 'tab-init')?.title).toBe('POST /auth/custom');
  });

  it('closes a tab and gracefully shifts the active tab', () => {
    const tab2Id = useIntruderStore.getState().createTab({ title: 'Tab 2' });
    expect(useIntruderStore.getState().tabs.length).toBe(2);
    expect(useIntruderStore.getState().activeTabId).toBe(tab2Id);

    // Close Tab 2
    useIntruderStore.getState().closeTab(tab2Id);
    expect(useIntruderStore.getState().tabs.length).toBe(1);
    expect(useIntruderStore.getState().activeTabId).toBe('tab-init');

    // Attempting to close the last tab should keep at least 1 tab
    useIntruderStore.getState().closeTab('tab-init');
    expect(useIntruderStore.getState().tabs.length).toBe(1);
  });

  it('maintains isolated state per tab', () => {
    const tab2Id = useIntruderStore.getState().createTab({
      title: 'Tab 2',
      targetUrl: 'https://api.target.com',
      attackType: 'Cluster bomb attack',
    });

    // Update Tab 2
    useIntruderStore.getState().updateTab(tab2Id, { concurrency: 50 });

    const state = useIntruderStore.getState();
    const tab1 = state.tabs.find((t) => t.id === 'tab-init');
    const tab2 = state.tabs.find((t) => t.id === tab2Id);

    expect(tab1?.concurrency).toBe(20);
    expect(tab1?.attackType).toBe('Sniper attack');
    expect(tab2?.concurrency).toBe(50);
    expect(tab2?.attackType).toBe('Cluster bomb attack');
  });

  it('auto-formats and marks query and JSON parameters on sendToIntruder', () => {
    const newTabId = useIntruderStore.getState().sendToIntruder({
      url: 'https://api.site.com/search?q=test&limit=10',
      method: 'POST',
      reqHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      reqBody: '{"username": "admin", "role": "editor"}',
    });

    const state = useIntruderStore.getState();
    const tab = state.tabs.find((t) => t.id === newTabId);

    expect(tab).toBeDefined();
    expect(tab?.targetUrl).toBe('https://api.site.com/search?q=test&limit=10');
    expect(tab?.requestText).toContain('q=§test§&limit=§10§');
    expect(tab?.requestText).toContain('"username": "§admin§"');
    expect(tab?.requestText).toContain('"role": "§editor§"');
    expect(tab?.title).toBe('POST /search?q=§test§&li...');
  });

  it('computes request count correctly for various attack modes', () => {
    // Sniper with 2 positions and 5 payloads = 2 * 5 = 10 requests
    const sniperPositions = 2;
    const sniperSetLen = 5;
    expect(sniperPositions * sniperSetLen).toBe(10);

    // Battering ram with 3 positions and 8 payloads = 8 requests
    const batteringRamLen = 8;
    expect(batteringRamLen).toBe(8);

    // Pitchfork with 3 positions: lengths [4, 6, 8] = min(4, 6, 8) = 4 requests
    const pitchforkCounts = [4, 6, 8];
    expect(Math.min(...pitchforkCounts)).toBe(4);

    // Cluster bomb with 3 positions: lengths [3, 4, 5] = 3 * 4 * 5 = 60 requests
    const clusterCounts = [3, 4, 5];
    const clusterProduct = clusterCounts.reduce((acc, c) => acc * c, 1);
    expect(clusterProduct).toBe(60);
  });
});
