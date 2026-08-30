import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge, MethodBadge, StatusBadge } from '../../src/design-system/Badge';

describe('Badge Components', () => {
  it('renders severity badges correctly', () => {
    const { rerender } = render(<Badge variant="critical">CRITICAL</Badge>);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();

    rerender(<Badge variant="high">HIGH</Badge>);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('renders HTTP method badges with appropriate color classes', () => {
    const { rerender } = render(<MethodBadge method="POST" />);
    expect(screen.getByText('POST')).toBeInTheDocument();

    rerender(<MethodBadge method="GET" />);
    expect(screen.getByText('GET')).toBeInTheDocument();
  });

  it('renders HTTP status badges for 2xx, 4xx, and 5xx', () => {
    const { rerender } = render(<StatusBadge status={200} />);
    expect(screen.getByText('200')).toBeInTheDocument();

    rerender(<StatusBadge status={404} />);
    expect(screen.getByText('404')).toBeInTheDocument();

    rerender(<StatusBadge status={500} />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });
});
