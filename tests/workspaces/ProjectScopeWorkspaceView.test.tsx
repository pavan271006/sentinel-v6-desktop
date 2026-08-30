import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectScopeWorkspaceView } from '../../src/workspaces/ProjectScopeWorkspaceView';
import { useScopeStore } from '../../src/stores/scopeStore';

describe('ProjectScopeWorkspaceView Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useScopeStore.getState().fetchScope();
  });

  it('renders Target workspace with Site map, Scope, and Issues tabs', () => {
    render(<ProjectScopeWorkspaceView />);
    expect(screen.getByText('Site map')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText(/Auto-Discover Hidden Content/i)).toBeInTheDocument();
  });

  it('switches to Scope sub-tab and renders ACL rules and Scope Boundary view', () => {
    render(<ProjectScopeWorkspaceView />);

    const scopeTab = screen.getByText('Scope');
    fireEvent.click(scopeTab);

    expect(screen.getAllByText(/Scope Boundary/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Issues sub-tab and renders Target issues table', () => {
    render(<ProjectScopeWorkspaceView />);

    const issuesTab = screen.getByText('Issues');
    fireEvent.click(issuesTab);

    expect(screen.getByText(/Discovered Target Vulnerabilities/i)).toBeInTheDocument();
  });

  it('opens Site map filter modal when clicking filter bar', () => {
    render(<ProjectScopeWorkspaceView />);

    const filterBar = screen.getByText(/Site map filter:/i);
    fireEvent.click(filterBar);

    expect(screen.getByText(/Site Map Display Filter Settings/i)).toBeInTheDocument();
  });
});
