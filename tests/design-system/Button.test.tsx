import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../../src/design-system/Button';

describe('Button Component', () => {
  it('renders correctly with children and handles click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Replay Attack</Button>);

    const button = screen.getByRole('button', { name: /Replay Attack/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders disabled state with disabledReason tooltip wrapper', () => {
    render(
      <Button disabledReason="Backend Deferred: SMT Solver not available">
        Solve Constraints
      </Button>
    );

    const button = screen.getByRole('button', { name: /Solve Constraints/i });
    expect(button).toBeDisabled();
  });

  it('renders loading spinner when loading is true', () => {
    render(<Button loading>Scanning</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
