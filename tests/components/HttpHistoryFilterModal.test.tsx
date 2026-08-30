import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  HttpHistoryFilterModal,
  DEFAULT_FILTER_CONFIG,
} from '../../src/components/traffic/HttpHistoryFilterModal';

describe('HttpHistoryFilterModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <HttpHistoryFilterModal
        isOpen={false}
        onClose={vi.fn()}
        config={DEFAULT_FILTER_CONFIG}
        onApply={vi.fn()}
      />
    );

    expect(screen.queryByText('HTTP history filter')).not.toBeInTheDocument();
  });

  it('renders all filter fieldsets and controls when open', () => {
    render(
      <HttpHistoryFilterModal
        isOpen={true}
        onClose={vi.fn()}
        config={DEFAULT_FILTER_CONFIG}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText('HTTP history filter')).toBeInTheDocument();
    expect(screen.getByText('Filter by request type')).toBeInTheDocument();
    expect(screen.getByText('Filter by MIME type')).toBeInTheDocument();
    expect(screen.getByText('Filter by status code')).toBeInTheDocument();
    expect(screen.getByText('Filter by search term')).toBeInTheDocument();
    expect(screen.getByText('Filter by file extension')).toBeInTheDocument();
    expect(screen.getByText('Filter by annotation')).toBeInTheDocument();
    expect(screen.getByText('Filter by listener')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply & close/i })).toBeInTheDocument();
  });

  it('handles Show all, Hide all, and Apply & close', () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    render(
      <HttpHistoryFilterModal
        isOpen={true}
        onClose={handleClose}
        config={DEFAULT_FILTER_CONFIG}
        onApply={handleApply}
      />
    );

    // Click Show all
    fireEvent.click(screen.getByRole('button', { name: /Show all/i }));

    // Click Apply & close
    fireEvent.click(screen.getByRole('button', { name: /Apply & close/i }));

    expect(handleApply).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
