import { describe, it, expect, beforeEach } from 'vitest';
import { ipcClient } from '../../src/ipc/client';

describe('Project & Scope IPC Bridge Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates project via IPC client bridge', async () => {
    const proj = await ipcClient.createProject(
      'IPC Integration Test Target',
      'C:/test/ipc_target',
      ['target.local', '10.0.0.0/8']
    );

    expect(proj.id).toBeDefined();
    expect(proj.name).toBe('IPC Integration Test Target');
    expect(proj.wal_journal_mode).toBe('WAL');
  });

  it('retrieves current project and lists recent projects', async () => {
    await ipcClient.createProject('Project A', 'C:/test/proj_a');
    const current = await ipcClient.getCurrentProject();
    expect(current?.name).toBe('Project A');

    const recents = await ipcClient.listRecentProjects();
    expect(recents.some((r) => r.name === 'Project A')).toBe(true);
  });

  it('opens and closes project via IPC client bridge', async () => {
    const opened = await ipcClient.openProject('C:/test/proj_a');
    expect(opened.metadata).toBeDefined();
    expect(opened.scope).toBeDefined();

    await ipcClient.closeProject();
  });

  it('executes project export, import, and WAL checkpoint', async () => {
    const exp = await ipcClient.exportProject('C:/test/proj_a', 'C:/test/proj_a.zip', true);
    expect(exp.success).toBe(true);
    expect(exp.sha256_checksum).toBeDefined();

    const imp = await ipcClient.importProject('C:/test/proj_a.zip', 'C:/test/imported_a');
    expect(imp.success).toBe(true);
    expect(imp.metadata.path).toBe('C:/test/imported_a');

    const wal = await ipcClient.walCheckpoint();
    expect(wal.journal_mode).toBe('WAL');
    expect(wal.checkpoint_applied).toBe(true);
  });

  it('updates scope and evaluates URI targets with SEC-01 fail-closed protection', async () => {
    const initialScope = await ipcClient.getScope();
    expect(initialScope.id).toBeDefined();
    expect(initialScope.includes.length).toBeGreaterThan(0);

    const updated = await ipcClient.updateScope(
      ['api.defense.local', '192.168.1.0/24'],
      ['169.254.169.254/32', '10.0.0.0/8']
    );
    expect(updated.version).toBeGreaterThan(1);
    expect(updated.includes).toContain('api.defense.local');

    // In scope match
    const allowRes = await ipcClient.testScopeUri('https://api.defense.local/v1/auth');
    expect(allowRes.in_scope).toBe(true);

    // SSRF match
    const ssrfRes = await ipcClient.testScopeUri('http://169.254.169.254/latest');
    expect(ssrfRes.in_scope).toBe(false);

    // Fail-Closed default deny
    const denyRes = await ipcClient.testScopeUri('https://unrelated-domain.org');
    expect(denyRes.in_scope).toBe(false);
  });
});
