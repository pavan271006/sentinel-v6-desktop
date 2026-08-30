import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from '../../src/components/shell/AppShell';

describe('AppShell Layout Component', () => {
  it('renders header, activity bar, sidebar, and status bar', () => {
    render(<AppShell />);

    // Header elements
    expect(screen.getByText('Sentinel')).toBeInTheDocument();
    expect(screen.getByText('V6')).toBeInTheDocument();
    expect(screen.getByText(/Scope: Active/)).toBeInTheDocument();

    // Activity bar workspace buttons
    expect(screen.getByRole('button', { name: /^Traffic History$/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Repeater/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Scanner/i })[0]).toBeInTheDocument();


    // Status bar metrics
    expect(screen.getByText(/Sentinel V6.0.0/i)).toBeInTheDocument();
    expect(screen.getByText(/FAIL-CLOSED/i)).toBeInTheDocument();
  });

  it('switches active workspace when activity bar button is clicked', () => {
    render(<AppShell />);

    const repeaterBtn = screen.getAllByRole('button', { name: /Repeater/i })[0];
    fireEvent.click(repeaterBtn);

    expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument();
  });
});

