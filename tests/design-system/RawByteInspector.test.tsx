import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RawByteInspector, formatHexByte, formatAsciiChar } from '../../src/design-system/RawByteInspector';

describe('RawByteInspector Component', () => {
  it('formats hex byte and ascii char accurately', () => {
    expect(formatHexByte(65)).toBe('41');
    expect(formatHexByte(255)).toBe('FF');
    expect(formatAsciiChar(65)).toBe('A');
    expect(formatAsciiChar(0)).toBe('.');
  });

  it('renders hex view and allows switching to raw text', () => {
    const rawData = 'GET /api/test HTTP/1.1';
    render(<RawByteInspector data={rawData} />);

    expect(screen.getByText('Hex View')).toBeInTheDocument();
    expect(screen.getByText('Raw Text')).toBeInTheDocument();
    expect(screen.getByText('00000000')).toBeInTheDocument();

    // Switch to raw text mode
    fireEvent.click(screen.getByText('Raw Text'));
    expect(screen.getByText(/GET \/api\/test HTTP\/1.1/)).toBeInTheDocument();
  });
});
