import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../src/stores/projectStore';
import { useAppShellStore } from '../../src/stores/appShellStore';

describe('ProjectStore (useProjectStore)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default state and opens/closes modal', () => {
    const store = useProjectStore.getState();
    expect(store.isModalOpen).toBe(false);
    expect(store.activeModalTab).toBe('new');

    store.openModal('recent');
    expect(useProjectStore.getState().isModalOpen).toBe(true);
    expect(useProjectStore.getState().activeModalTab).toBe('recent');

    store.closeModal();
    expect(useProjectStore.getState().isModalOpen).toBe(false);
  });

  it('creates a new project and syncs with app shell store', async () => {
    const store = useProjectStore.getState();
    const created = await store.createProject(
      'Enterprise Audit 2026',
      'C:/test/engagements/audit_2026',
      ['target.local', '10.0.0.0/8']
    );

    expect(created.name).toBe('Enterprise Audit 2026');
    expect(created.path).toBe('C:/test/engagements/audit_2026');
    expect(created.wal_journal_mode).toBe('WAL');
    expect(created.is_clean_shutdown).toBe(true);

    const active = useProjectStore.getState().currentProject;
    expect(active?.name).toBe('Enterprise Audit 2026');
    expect(useAppShellStore.getState().activeProjectName).toBe('Enterprise Audit 2026');
  });

  it('opens an existing project and loads metadata', async () => {
    const store = useProjectStore.getState();
    await store.openProject('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');

    const active = useProjectStore.getState().currentProject;
    expect(active).not.toBeNull();
    expect(active?.path).toBe('C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6');
    expect(active?.wal_journal_mode).toBe('WAL');
  });

  it('closes active project cleanly', async () => {
    const store = useProjectStore.getState();
    await store.createProject('Temp Project', 'C:/test/temp');
    expect(useProjectStore.getState().currentProject).not.toBeNull();

    await store.closeProject();
    expect(useProjectStore.getState().currentProject).toBeNull();
    expect(useAppShellStore.getState().activeProjectName).toBe('');
  });

  it('exports and imports project archives with SHA-256 verification', async () => {
    const store = useProjectStore.getState();
    const exportResult = await store.exportProject(
      'C:/test/engagements/audit_2026',
      'C:/backups/audit_2026.sentinel.zip',
      true
    );

    expect(exportResult.success).toBe(true);
    expect(exportResult.archive_path).toContain('audit_2026.sentinel.zip');
    expect(exportResult.sha256_checksum).toBeDefined();

    const importResult = await store.importProject(
      'C:/backups/audit_2026.sentinel.zip',
      'C:/imported/audit_2026'
    );

    expect(importResult.success).toBe(true);
    expect(importResult.metadata.path).toBe('C:/imported/audit_2026');
  });

  it('commits WAL fsync checkpoints and pins recent projects', async () => {
    const store = useProjectStore.getState();
    const walStatus = await store.commitWalCheckpoint();
    expect(walStatus.journal_mode).toBe('WAL');
    expect(walStatus.checkpoint_applied).toBe(true);
    expect(walStatus.page_count).toBeGreaterThan(0);

    await store.fetchRecentProjects();
    const recents = useProjectStore.getState().recentProjects;
    if (recents.length > 0) {
      const firstId = recents[0].id;
      const initialPinned = recents[0].pinned;
      store.pinProject(firstId);
      expect(useProjectStore.getState().recentProjects.find((p) => p.id === firstId)?.pinned).toBe(!initialPinned);

      store.removeRecentProject(firstId);
      expect(useProjectStore.getState().recentProjects.find((p) => p.id === firstId)).toBeUndefined();
    }
  });
});
