import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectScopeWorkspaceView } from '../../src/workspaces/ProjectScopeWorkspaceView';
import { useScopeStore } from '../../src/stores/scopeStore';

describe('ProjectScopeWorkspaceView Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useScopeStore.getState().fetchScope();
  });

  it('renders Target workspace with target input, Stealth Mode button, and Site map filter', () => {
    render(<ProjectScopeWorkspaceView />);
    expect(screen.getByPlaceholderText(/e.g. example.com or portswigger.net/i)).toBeInTheDocument();
    expect(screen.getByText(/Stealth Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Site map filter:/i)).toBeInTheDocument();
  });

  it('opens Site map filter modal when clicking filter bar', () => {
    render(<ProjectScopeWorkspaceView />);

    const filterBar = screen.getByText(/Site map filter:/i);
    fireEvent.click(filterBar);

    expect(screen.getByText('Site map filter')).toBeInTheDocument();
  });

  it('normalizes target input value when user types full URL to domain', () => {
    render(<ProjectScopeWorkspaceView />);

    const targetInput = screen.getByPlaceholderText(/e.g. example.com or portswigger.net/i) as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: 'https://example.com' } });

    expect(targetInput.value).toBe('example.com');
  });

  it('renders OpenAPI 3.1 specification synthesis button', () => {
    render(<ProjectScopeWorkspaceView />);
    expect(screen.getByText(/OpenAPI 3.1/i)).toBeInTheDocument();
  });
});
