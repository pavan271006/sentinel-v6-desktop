import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SqlScannerWorkspaceView } from '../../src/workspaces/SqlScannerWorkspaceView';
import { useSqlScannerStore } from '../../src/stores/sqlScannerStore';

describe('SqlScannerWorkspaceView Mount and Tab Switching Test', () => {
  const tabs = [
    'trigraph',
    'belief',
    'knowledge',
    'ai_copilot',
    'database',
    'coverage',
    'logs',
    'vulnerabilities',
    'causal',
    'report',
  ] as const;

  it('mounts cleanly and switches to every single tab without crashing', () => {
    const { container } = render(<SqlScannerWorkspaceView />);
    expect(container).toBeDefined();

    for (const tab of tabs) {
      act(() => {
        useSqlScannerStore.getState().setActiveTab(tab as any);
      });
      expect(container.firstChild).toBeDefined();
    }
  });
});
