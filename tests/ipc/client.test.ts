import { describe, it, expect } from 'vitest';
import { ipcClient } from '../../src/ipc/client';

describe('IPC Client Bridge', () => {
  it('fetches platform information matching Sentinel V6 specifications', async () => {
    const platform = await ipcClient.getPlatformInfo();
    expect(platform.version).toBe('6.0.0');
    expect(platform.capabilities.length).toBeGreaterThan(0);
    expect(platform.capabilities.some((c) => c.subsystem_id === 'SUB-01')).toBe(true);
  });

  it('fetches status metrics and toggles proxy state', async () => {
    const initialStatus = await ipcClient.getStatus();
    expect(initialStatus.backend_version).toContain('6.0.0');

    const toggled = await ipcClient.toggleProxy();
    expect(typeof toggled).toBe('boolean');
  });

  it('evaluates scope uri according to SEC-01 rules', async () => {
    const inScopeResult = await ipcClient.testScopeUri('https://target.local/api');
    expect(inScopeResult.in_scope).toBe(true);
  });

  it('searches command palette entries via productivity bridge', async () => {
    const results = await ipcClient.searchCommands('Traffic');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Traffic');
  });
});
