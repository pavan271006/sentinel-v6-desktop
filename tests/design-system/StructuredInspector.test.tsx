import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StructuredInspector } from '../../src/design-system/StructuredInspector';

describe('StructuredInspector Component', () => {
  const sampleObject = {
    user: 'security_auditor',
    roles: ['admin', 'tester'],
    metadata: {
      scopeVerified: true,
      statusCode: 200,
    },
  };

  it('renders structured keys and primitive values', () => {
    render(<StructuredInspector data={sampleObject} title="JSON Inspector" />);

    expect(screen.getByText('JSON Inspector')).toBeInTheDocument();
    expect(screen.getByText('user:')).toBeInTheDocument();
    expect(screen.getByText('"security_auditor"')).toBeInTheDocument();
  });

  it('filters keys based on search input', () => {
    render(<StructuredInspector data={sampleObject} />);

    const searchInput = screen.getByPlaceholderText('Filter keys/values...');
    fireEvent.change(searchInput, { target: { value: 'scopeVerified' } });

    expect(screen.getByText('scopeVerified:')).toBeInTheDocument();
  });
});
