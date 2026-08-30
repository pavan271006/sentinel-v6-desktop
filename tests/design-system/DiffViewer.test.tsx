import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DiffViewer, computeLineDiff } from '../../src/design-system/DiffViewer';

describe('DiffViewer & computeLineDiff', () => {
  it('computes correct add, remove, and equal lines', () => {
    const original = 'line1\nline2\nline3';
    const modified = 'line1\nline2_modified\nline3\nline4_new';

    const diff = computeLineDiff(original, modified);
    expect(diff.lines.length).toBeGreaterThan(0);
    expect(diff.addedCount).toBeGreaterThan(0);
  });

  it('renders diff viewer with side-by-side and inline mode toggles', () => {
    const original = 'Authorization: Bearer token1';
    const modified = 'Authorization: Bearer token2';

    render(
      <DiffViewer
        originalText={original}
        modifiedText={modified}
        originalTitle="Baseline Request"
        modifiedTitle="Replay Request"
      />
    );

    expect(screen.getByText('Side-by-Side')).toBeInTheDocument();
    expect(screen.getByText('Unified Inline')).toBeInTheDocument();
    expect(screen.getByText('Baseline Request')).toBeInTheDocument();
    expect(screen.getByText('Replay Request')).toBeInTheDocument();

    // Toggle inline mode
    fireEvent.click(screen.getByText('Unified Inline'));
    expect(screen.getByText(/token1/)).toBeInTheDocument();
    expect(screen.getByText(/token2/)).toBeInTheDocument();
  });
});
