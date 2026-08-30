import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestEditorPanel } from '../../../src/components/repeater/RequestEditorPanel';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../../src/stores/repeaterStore';

describe('RequestEditorPanel Component Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        {
          ...DEFAULT_INITIAL_TAB,
          id: 'rep-1',
          title: 'Request #1',
          method: 'GET',
          url: 'https://target.local/api/v1/users?page=1',
          headers: [
            { id: 'h1', name: 'Host', value: 'target.local', enabled: true },
            { id: 'h2', name: 'Authorization', value: 'Bearer {{token}}', enabled: true },
          ],
          body: '{"username":"pentester"}',
          rawRequest: 'GET /api/v1/users?page=1 HTTP/1.1\r\nHost: target.local\r\n\r\n{"username":"pentester"}',
          requestViewMode: 'raw',
          isDirty: false,
          isExecuting: false,
        },
      ],
      activeTabId: 'rep-1',
      globalVariables: { token: 'jwt_123' },
    });
  });

  it('renders target URL, method, protocol, and Send button', () => {
    render(<RequestEditorPanel />);

    expect(screen.getByDisplayValue('https://target.local/api/v1/users?page=1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument();
    expect(screen.getByText('HTTP/1.1')).toBeInTheDocument();
  });

  it('updates URL and marks tab dirty', () => {
    render(<RequestEditorPanel />);
    const urlInput = screen.getByDisplayValue('https://target.local/api/v1/users?page=1');
    fireEvent.change(urlInput, { target: { value: 'https://target.local/api/v1/admins' } });

    expect(useRepeaterStore.getState().tabs[0].url).toBe('https://target.local/api/v1/admins');
    expect(useRepeaterStore.getState().tabs[0].isDirty).toBe(true);
  });

  it('switches editor sub-views (Pretty, Raw, Hex)', () => {
    render(<RequestEditorPanel />);

    // Switch to Pretty
    const prettyTab = screen.getByRole('tab', { name: /Pretty/i });
    fireEvent.click(prettyTab);
    expect(useRepeaterStore.getState().tabs[0].requestViewMode).toBe('pretty');

    // Switch to Raw
    const rawTab = screen.getByRole('tab', { name: /Raw/i });
    fireEvent.click(rawTab);
    expect(useRepeaterStore.getState().tabs[0].requestViewMode).toBe('raw');

    // Switch to Hex
    const hexTab = screen.getByRole('tab', { name: /Hex/i });
    fireEvent.click(hexTab);
    expect(useRepeaterStore.getState().tabs[0].requestViewMode).toBe('hex');
  });

  it('displays used variable chips in bottom status bar', () => {
    render(<RequestEditorPanel />);
    expect(screen.getByText('{{token}}')).toBeInTheDocument();
  });

  it('shows Cancel button when isExecuting is true', () => {
    useRepeaterStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, isExecuting: true })),
    }));
    render(<RequestEditorPanel />);

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });
});
