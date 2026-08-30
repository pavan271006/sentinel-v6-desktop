import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepeaterVariablesModal } from '../../../src/components/repeater/RepeaterVariablesModal';
import { useRepeaterStore, DEFAULT_INITIAL_TAB } from '../../../src/stores/repeaterStore';

describe('RepeaterVariablesModal Component Tests', () => {
  beforeEach(() => {
    useRepeaterStore.setState({
      tabs: [
        {
          ...DEFAULT_INITIAL_TAB,
          id: 'rep-1',
          localVariables: { tab_user: 'tester_01' },
          lastExecutionOutput: {
            revisionId: 'rev-1',
            revisionNumber: 1,
            timestamp: '12:00:00',
            timestampMs: 1720000000000,
            method: 'GET',
            url: 'https://target.local/',
            requestRaw: '',
            requestHeaders: [],
            requestBody: '',
            responseBody: '{"session":{"token":"jwt-extracted-secret"}}',
            statusCode: 200,
            durationMs: 30,
            sizeBytes: 45,
          },
        },
      ],
      activeTabId: 'rep-1',
      globalVariables: { global_host: 'target.local' },
      isVariablesModalOpen: true,
    });
  });

  it('renders active global and tab variables', () => {
    render(<RepeaterVariablesModal />);

    expect(screen.getByText('{{global_host}}')).toBeInTheDocument();
    expect(screen.getByText('target.local')).toBeInTheDocument();
    expect(screen.getByText('{{tab_user}}')).toBeInTheDocument();
    expect(screen.getByText('tester_01')).toBeInTheDocument();
  });

  it('adds a new variable to the store', () => {
    render(<RepeaterVariablesModal />);

    const keyInput = screen.getByPlaceholderText(/variable_name/i);
    const valInput = screen.getByPlaceholderText(/value/i);
    const addBtn = screen.getByRole('button', { name: /^Add$/i });

    fireEvent.change(keyInput, { target: { value: 'custom_var' } });
    fireEvent.change(valInput, { target: { value: 'custom_val' } });
    fireEvent.click(addBtn);

    expect(useRepeaterStore.getState().tabs[0].localVariables.custom_var).toBe('custom_val');
  });

  it('switches to Token Extractor Wizard and extracts variable via JSON-Path', () => {
    render(<RepeaterVariablesModal />);

    // Switch to Wizard Tab
    const wizardTab = screen.getByRole('tab', { name: /Token Extractor Wizard/i });
    fireEvent.click(wizardTab);

    // Enter JSON-path
    const exprInput = screen.getByPlaceholderText('data.user.jwt');
    fireEvent.change(exprInput, { target: { value: 'session.token' } });

    // Verify extraction output preview
    expect(screen.getByText('jwt-extracted-secret')).toBeInTheDocument();

    // Click Save Variable
    const saveBtn = screen.getByRole('button', { name: /Save Variable/i });
    fireEvent.click(saveBtn);

    expect(useRepeaterStore.getState().tabs[0].localVariables.auth_token).toBe('jwt-extracted-secret');
  });
});
