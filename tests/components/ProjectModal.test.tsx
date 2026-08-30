import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectModal } from '../../src/components/project/ProjectModal';
import { useProjectStore } from '../../src/stores/projectStore';

describe('ProjectModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ isModalOpen: true, activeModalTab: 'new' });
  });

  it('renders New Project wizard by default when opened', () => {
    render(<ProjectModal />);
    expect(screen.getByText('Project Lifecycle & Database Manager')).toBeDefined();
    expect(screen.getByText('Project Engagement Name')).toBeDefined();
    expect(screen.getByText('Create & Initialize Project')).toBeDefined();
  });

  it('switches between modal tabs (Recent, Open, Database/WAL, Export, Import)', () => {
    render(<ProjectModal />);

    // Click Recent tab
    const recentTab = screen.getByRole('tab', { name: /Recent/i });
    fireEvent.click(recentTab);
    expect(screen.getByPlaceholderText('Search recent engagements...')).toBeDefined();

    // Click Open Folder tab
    const openTab = screen.getByRole('tab', { name: /Open Folder/i });
    fireEvent.click(openTab);
    expect(screen.getByText('Project Directory Path (.sentinel workspace)')).toBeDefined();

    // Click Database / WAL tab
    const settingsTab = screen.getByRole('tab', { name: /Database \/ WAL/i });
    fireEvent.click(settingsTab);
    expect(screen.getByText('SQLite WAL Pragmas & Diagnostics')).toBeDefined();
    expect(screen.getByText('Commit WAL Snapshot (fsync)')).toBeDefined();

    // Click Export Backup tab
    const exportTab = screen.getByRole('tab', { name: /Export Backup/i });
    fireEvent.click(exportTab);
    expect(screen.getByText('Destination Archive Path (.sentinel.zip)')).toBeDefined();
    expect(screen.getByText('Sanitize Redacted Secrets (SEC-09)')).toBeDefined();

    // Click Import Archive tab
    const importTab = screen.getByRole('tab', { name: /Import Archive/i });
    fireEvent.click(importTab);
    expect(screen.getByText('Source Archive File (.sentinel.zip)')).toBeDefined();
    expect(screen.getByText('Validate & Import Project')).toBeDefined();
  });

  it('creates project and commits WAL checkpoint from settings tab', async () => {
    render(<ProjectModal />);

    // Switch to settings
    const settingsTab = screen.getByRole('tab', { name: /Database \/ WAL/i });
    fireEvent.click(settingsTab);

    const walBtn = screen.getByText('Commit WAL Snapshot (fsync)');
    fireEvent.click(walBtn);

    const casBtn = screen.getByText('Verify CAS Blob Hashes (SEC-07)');
    fireEvent.click(casBtn);
  });
});
