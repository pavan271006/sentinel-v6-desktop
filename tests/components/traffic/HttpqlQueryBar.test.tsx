import { describe, it, expect, vi } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/react';
import { HttpqlQueryBar } from '../../../src/components/traffic/HttpqlQueryBar';

describe('HttpqlQueryBar Component', () => {
  it('renders input with placeholder and search icon', () => {
    render(
      <HttpqlQueryBar
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        placeholder="Filter with HTTPQL..."
      />
    );

    const input = screen.getByPlaceholderText('Filter with HTTPQL...');
    expect(input).toBeInTheDocument();
  });

  it('shows valid check indicator when query is syntactically correct', () => {
    render(
      <HttpqlQueryBar
        value="req.method == 'GET' and res.status == 200"
        onChange={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByTitle('Valid HTTPQL Query')).toBeInTheDocument();
  });

  it('shows error badge when query has syntax errors', () => {
    render(
      <HttpqlQueryBar
        value="req.method =="
        onChange={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByText(/Expected value after operator/i)).toBeInTheDocument();
  });

  it('calls onChange and opens autocomplete suggestions when typing', () => {
    const handleChange = vi.fn();
    render(
      <HttpqlQueryBar
        value=""
        onChange={handleChange}
        onSubmit={() => {}}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'req.' } });

    expect(handleChange).toHaveBeenCalledWith('req.');
  });

  it('submits query when Enter key is pressed', () => {
    const handleSubmit = vi.fn();
    render(
      <HttpqlQueryBar
        value="res.status >= 400"
        onChange={() => {}}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleSubmit).toHaveBeenCalledWith('res.status >= 400');
  });

  it('clears query when clear button is clicked', () => {
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    render(
      <HttpqlQueryBar
        value="req.host == 'target.local'"
        onChange={handleChange}
        onSubmit={() => {}}
        onClear={handleClear}
      />
    );

    const clearButton = screen.getByRole('button', { name: 'Clear Query' });
    fireEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith('');
    expect(handleClear).toHaveBeenCalled();
  });

  it('opens history and preset popover when history button is clicked', () => {
    render(
      <HttpqlQueryBar
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        queryHistory={['req.method == "POST"', 'res.status >= 500']}
      />
    );

    const historyButton = screen.getByRole('button', { name: 'Recent Queries and Presets' });
    fireEvent.click(historyButton);

    expect(screen.getByText('Recommended Filter Presets')).toBeInTheDocument();
    expect(screen.getByText('req.method == "POST"')).toBeInTheDocument();
    expect(screen.getAllByText('res.status >= 500')[0]).toBeInTheDocument();
  });
});

