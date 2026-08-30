import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  IntruderCaptureFilterModal,
  DEFAULT_INTRUDER_CAPTURE_FILTER,
} from '../../../src/components/fuzzer/IntruderCaptureFilterModal';

describe('IntruderCaptureFilterModal Component', () => {
  it('renders all filter sections matching Burp Suite specification', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <IntruderCaptureFilterModal
        isOpen={true}
        onClose={handleClose}
        filterState={DEFAULT_INTRUDER_CAPTURE_FILTER}
        onSave={handleSave}
      />
    );

    expect(screen.getByText('Intruder capture filter')).toBeDefined();
    expect(screen.getByText('Capture by response type')).toBeDefined();
    expect(screen.getByText('Capture by search term [Pro only]')).toBeDefined();
    expect(screen.getByText('Capture by status code')).toBeDefined();
    expect(screen.getByText('Capture by annotation')).toBeDefined();

    expect(screen.getByText('Discard items without responses')).toBeDefined();
    expect(screen.getByText('2xx [success]')).toBeDefined();
    expect(screen.getByText('3xx [redirection]')).toBeDefined();
    expect(screen.getByText('4xx [request error]')).toBeDefined();
    expect(screen.getByText('5xx [server error]')).toBeDefined();
    expect(screen.getByText('Show only items with notes')).toBeDefined();
    expect(screen.getByText('Show only highlighted items')).toBeDefined();
  });

  it('updates draft filter state and invokes onSave with new settings', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <IntruderCaptureFilterModal
        isOpen={true}
        onClose={handleClose}
        filterState={DEFAULT_INTRUDER_CAPTURE_FILTER}
        onSave={handleSave}
      />
    );

    const saveButton = screen.getByText('Save settings');
    fireEvent.click(saveButton);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('supports Hide all and Show all quick buttons', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <IntruderCaptureFilterModal
        isOpen={true}
        onClose={handleClose}
        filterState={DEFAULT_INTRUDER_CAPTURE_FILTER}
        onSave={handleSave}
      />
    );

    const hideAllButton = screen.getByText('Hide all');
    fireEvent.click(hideAllButton);

    const saveButton = screen.getByText('Save settings');
    fireEvent.click(saveButton);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        status2xx: false,
        status3xx: false,
        status4xx: false,
        status5xx: false,
      })
    );
  });
});
