import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '../../src/design-system/Modal';

describe('Modal Component', () => {
  it('renders title and content when open', () => {
    const handleClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Scope Rule Editor"
        subtitle="Configure CIDR and Regex Inclusion Rules"
      >
        <p>Rule Form Content</p>
      </Modal>
    );

    expect(screen.getByText('Scope Rule Editor')).toBeInTheDocument();
    expect(screen.getByText('Rule Form Content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden Dialog">
        <p>Hidden Content</p>
      </Modal>
    );

    expect(screen.queryByText('Hidden Dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on ESC key press', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Test">
        <p>Escape Content</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
