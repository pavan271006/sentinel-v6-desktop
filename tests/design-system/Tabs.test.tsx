import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from '../../src/design-system/Tabs';

describe('Tabs Component', () => {
  it('renders tabs and fires onChange on click', () => {
    const handleChange = vi.fn();
    const tabs = [
      { id: 'req', label: 'Request' },
      { id: 'res', label: 'Response' },
      { id: 'diff', label: 'Diff' },
    ];

    render(<Tabs tabs={tabs} activeTab="req" onChange={handleChange} />);

    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText('Response')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Response'));
    expect(handleChange).toHaveBeenCalledWith('res');
  });

  it('renders editor tabs with closable buttons', () => {
    const handleClose = vi.fn();
    const tabs = [
      { id: 'tab1', label: 'Tab #1', closable: true },
      { id: 'tab2', label: 'Tab #2', closable: true },
    ];

    render(
      <Tabs
        tabs={tabs}
        activeTab="tab1"
        onChange={() => {}}
        onCloseTab={handleClose}
        variant="editor"
      />
    );

    const closeButtons = screen.getAllByRole('button', { name: /Close Tab/i });
    expect(closeButtons.length).toBe(2);
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledWith('tab1');
  });
});
