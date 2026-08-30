import { describe, it, expect, beforeEach } from 'vitest';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../src/stores/repeaterStore';
import { useAppShellStore } from '../../src/stores/appShellStore';

describe('useRepeaterStore Zustand Unit Tests', () => {
  beforeEach(() => {
    // Reset store to initial state
    useRepeaterStore.setState({
      tabs: [{ ...DEFAULT_INITIAL_TAB, id: 'rep-tab-1', history: [], isDirty: false }],
      activeTabId: 'rep-tab-1',
      closedTabsStack: [],
      globalVariables: {
        host: 'target.local',
        token: 'secret_token_123',
      },
      isHistoryDrawerOpen: false,
      isVariablesModalOpen: false,
      isDiffModalOpen: false,
      diffRevisionA: null,
      diffRevisionB: null,
      splitOrientation: 'horizontal',
    });
  });

  describe('Tab Management', () => {
    it('creates a new tab and sets it active', () => {
      const tabId = useRepeaterStore.getState().createTab({
        title: 'Custom Tab',
        method: 'POST',
        url: 'https://target.local/api/v1/custom',
      });

      const state = useRepeaterStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe(tabId);
      const created = state.tabs.find((t) => t.id === tabId);
      expect(created?.title).toBe('Custom Tab');
      expect(created?.method).toBe('POST');
      expect(created?.url).toBe('https://target.local/api/v1/custom');
    });

    it('creates a tab from transaction and switches active workspace to repeater', () => {
      const tx = {
        id: 'tx-001',
        method: 'PUT',
        url: 'https://api.target.local/orders/99',
        headers: [
          { name: 'Host', value: 'api.target.local' },
          { name: 'Authorization', value: 'Bearer jwt_abc' },
        ],
        bodyText: '{"status":"paid"}',
      };

      const tabId = useRepeaterStore.getState().createTabFromTransaction({
        request: tx as any,
      });

      const state = useRepeaterStore.getState();
      expect(state.activeTabId).toBe(tabId);
      const tab = state.tabs.find((t) => t.id === tabId);
      expect(tab).toBeDefined();
      expect(tab?.method).toBe('PUT');
      expect(tab?.url).toBe('https://api.target.local/orders/99');
      expect(tab?.body).toBe('{"status":"paid"}');
      expect(useAppShellStore.getState().activeWorkspace).toBe('repeater');
    });

    it('closes a tab and pushes it to closedTabsStack', () => {
      const tab2Id = useRepeaterStore.getState().createTab({ title: 'Tab 2' });
      expect(useRepeaterStore.getState().tabs).toHaveLength(2);

      useRepeaterStore.getState().closeTab(tab2Id);
      const state = useRepeaterStore.getState();

      expect(state.tabs).toHaveLength(1);
      expect(state.activeTabId).toBe('rep-tab-1');
      expect(state.closedTabsStack).toHaveLength(1);
      expect(state.closedTabsStack[0].id).toBe(tab2Id);
    });

    it('reopens the last closed tab (Ctrl+Shift+T)', () => {
      const tab2Id = useRepeaterStore.getState().createTab({ title: 'Tab 2' });
      useRepeaterStore.getState().closeTab(tab2Id);

      expect(useRepeaterStore.getState().tabs).toHaveLength(1);
      useRepeaterStore.getState().reopenClosedTab();

      const state = useRepeaterStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe(tab2Id);
      expect(state.closedTabsStack).toHaveLength(0);
    });

    it('duplicates an existing tab with independent state and history clone', () => {
      const sourceTabId = 'rep-tab-1';
      useRepeaterStore.getState().updateTabBody(sourceTabId, '{"key":"original"}');

      const cloneId = useRepeaterStore.getState().duplicateTab(sourceTabId);
      const state = useRepeaterStore.getState();

      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe(cloneId);
      const clone = state.tabs.find((t) => t.id === cloneId);
      expect(clone?.title).toBe('Copy of Request #1');
      expect(clone?.body).toBe('{"key":"original"}');
    });

    it('renames and reorders tabs', () => {
      const tab2Id = useRepeaterStore.getState().createTab({ title: 'Tab 2' });
      useRepeaterStore.getState().renameTab(tab2Id, 'Renamed Tab 2');

      expect(useRepeaterStore.getState().tabs.find((t) => t.id === tab2Id)?.title).toBe('Renamed Tab 2');

      // Reorder
      useRepeaterStore.getState().reorderTabs(0, 1);
      expect(useRepeaterStore.getState().tabs[0].id).toBe(tab2Id);
      expect(useRepeaterStore.getState().tabs[1].id).toBe('rep-tab-1');
    });

    it('cycles next and previous tab', () => {
      const tab2Id = useRepeaterStore.getState().createTab({ title: 'Tab 2' });
      useRepeaterStore.getState().setActiveTabId('rep-tab-1');

      useRepeaterStore.getState().nextTab();
      expect(useRepeaterStore.getState().activeTabId).toBe(tab2Id);

      useRepeaterStore.getState().prevTab();
      expect(useRepeaterStore.getState().activeTabId).toBe('rep-tab-1');
    });
  });

  describe('Request Mutation & Dirty Tracking', () => {
    it('sets isDirty: true when request parameters are modified', () => {
      const tabId = 'rep-tab-1';
      expect(useRepeaterStore.getState().tabs[0].isDirty).toBe(false);

      useRepeaterStore.getState().updateTabMethod(tabId, 'POST');
      expect(useRepeaterStore.getState().tabs[0].isDirty).toBe(true);

      useRepeaterStore.getState().updateTabUrl(tabId, 'https://target.local/api/v2/new');
      expect(useRepeaterStore.getState().tabs[0].url).toBe('https://target.local/api/v2/new');

      useRepeaterStore.getState().updateTabBody(tabId, '{"action":"mutate"}');
      expect(useRepeaterStore.getState().tabs[0].body).toBe('{"action":"mutate"}');
    });
  });

  describe('Dynamic Variables', () => {
    it('manages global and tab-local variables', () => {
      useRepeaterStore.getState().setGlobalVariable('env', 'production');
      expect(useRepeaterStore.getState().globalVariables.env).toBe('production');

      useRepeaterStore.getState().setLocalVariable('rep-tab-1', 'user_id', '1001');
      const tab = useRepeaterStore.getState().tabs.find((t) => t.id === 'rep-tab-1');
      expect(tab?.localVariables.user_id).toBe('1001');

      const interpolated = useRepeaterStore.getState().interpolateRequest(
        'rep-tab-1',
        'Target: {{env}}, User: {{user_id}}, Host: {{host}}'
      );
      expect(interpolated).toBe('Target: production, User: 1001, Host: target.local');
    });
  });

  describe('Execution Pipeline & History Stack', () => {
    it('executes request, appends revision to history, and resets isDirty', async () => {
      const tabId = 'rep-tab-1';
      useRepeaterStore.getState().updateTabBody(tabId, '{"test":true}');
      expect(useRepeaterStore.getState().tabs[0].isDirty).toBe(true);

      await useRepeaterStore.getState().sendRequest(tabId);

      const updatedTab = useRepeaterStore.getState().tabs.find((t) => t.id === tabId);
      expect(updatedTab?.isExecuting).toBe(false);
      expect(updatedTab?.isDirty).toBe(false);
      expect(updatedTab?.history).toHaveLength(1);
      expect(updatedTab?.history[0].statusCode).toBe(200);
      expect(updatedTab?.lastExecutionOutput).toBeDefined();
    });

    it('restores a past revision to the active editor state', async () => {
      const tabId = 'rep-tab-1';
      useRepeaterStore.getState().updateTabUrl(tabId, 'https://target.local/api/v1/rev1');
      await useRepeaterStore.getState().sendRequest(tabId);

      useRepeaterStore.getState().updateTabUrl(tabId, 'https://target.local/api/v1/rev2');
      await useRepeaterStore.getState().sendRequest(tabId);

      expect(useRepeaterStore.getState().tabs[0].history).toHaveLength(2);

      // Restore Rev #1 (index 0)
      useRepeaterStore.getState().restoreRevision(tabId, 0);

      const tab = useRepeaterStore.getState().tabs[0];
      expect(tab.url).toBe('https://target.local/api/v1/rev1');
      expect(tab.activeRevisionIndex).toBe(0);
    });

    it('sets and unsets baseline revision for differential comparison', () => {
      const tabId = 'rep-tab-1';
      useRepeaterStore.getState().setBaselineRevision(tabId, 0);
      expect(useRepeaterStore.getState().tabs[0].baselineRevisionIndex).toBe(0);

      useRepeaterStore.getState().setBaselineRevision(tabId, null);
      expect(useRepeaterStore.getState().tabs[0].baselineRevisionIndex).toBeNull();
    });
  });

  describe('Modals & Layout Actions', () => {
    it('toggles history drawer, variables modal, and diff modal', () => {
      useRepeaterStore.getState().toggleHistoryDrawer();
      expect(useRepeaterStore.getState().isHistoryDrawerOpen).toBe(true);

      useRepeaterStore.getState().toggleVariablesModal();
      expect(useRepeaterStore.getState().isVariablesModalOpen).toBe(true);

      useRepeaterStore.getState().openDiffModal();
      expect(useRepeaterStore.getState().isDiffModalOpen).toBe(true);
      useRepeaterStore.getState().closeDiffModal();
      expect(useRepeaterStore.getState().isDiffModalOpen).toBe(false);

      useRepeaterStore.getState().toggleSplitOrientation();
      expect(useRepeaterStore.getState().splitOrientation).toBe('vertical');
    });
  });
});
