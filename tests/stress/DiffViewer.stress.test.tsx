import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DiffViewer, computeLineDiff } from '../../src/design-system/DiffViewer';

describe('DiffViewer Stress & Adversarial Suite (computeLineDiff & UI)', () => {
  it('handles empty diffs, single line additions, and complete replacements', () => {
    // Both empty
    const emptyDiff = computeLineDiff('', '');
    expect(emptyDiff.similarityScore).toBe(100);
    expect(emptyDiff.addedCount).toBe(0);
    expect(emptyDiff.removedCount).toBe(0);

    // Original empty, modified has content
    const addOnlyDiff = computeLineDiff('', 'line1\nline2\nline3');
    expect(addOnlyDiff.addedCount).toBe(3);
    expect(addOnlyDiff.removedCount).toBe(1); // empty string was 1 line

    // Modified empty, original has content
    const removeOnlyDiff = computeLineDiff('line1\nline2\nline3', '');
    expect(removeOnlyDiff.removedCount).toBe(3);

    // Completely identical
    const same = 'GET /api/v1/users HTTP/1.1\nHost: example.com\nAuthorization: Bearer secret';
    const identicalDiff = computeLineDiff(same, same);
    expect(identicalDiff.similarityScore).toBe(100);
    expect(identicalDiff.addedCount).toBe(0);
    expect(identicalDiff.removedCount).toBe(0);
    expect(identicalDiff.unchangedCount).toBe(3);
  });

  it('handles binary data, null bytes, control characters, and unicode surrogates', () => {
    const origBinary = 'Header: \x00\x01\x02\x03\xFF\xFE\nPayload: \u0000\u0001\u0002';
    const modBinary = 'Header: \x00\x01\x02\x03\xFF\xFD\nPayload: \u0000\u0001\u0002\x04\nEmoji: 🔒⚡🚀';

    const diff = computeLineDiff(origBinary, modBinary);
    expect(diff.lines.length).toBeGreaterThan(0);
    expect(diff.addedCount).toBeGreaterThan(0);

    // Verify rendering does not crash
    render(
      <DiffViewer
        originalText={origBinary}
        modifiedText={modBinary}
        originalTitle="Binary Original"
        modifiedTitle="Binary Modified"
      />
    );

    expect(screen.getByText('Binary Original')).toBeInTheDocument();
    expect(screen.getByText('Binary Modified')).toBeInTheDocument();
  });

  it('handles extreme single lines with 50,000 characters without truncation crash', () => {
    const longLine1 = 'A'.repeat(50_000);
    const longLine2 = 'A'.repeat(25_000) + 'B'.repeat(25_000);

    const diff = computeLineDiff(longLine1, longLine2);
    expect(diff.lines.length).toBe(2);
    expect(diff.removedCount).toBe(1);
    expect(diff.addedCount).toBe(1);

    render(
      <DiffViewer
        originalText={longLine1}
        modifiedText={longLine2}
      />
    );
    expect(screen.getByText('Side-by-Side')).toBeInTheDocument();
  });

  it('computes diffs for 1,000 lines with alternating hunk splits efficiently', () => {
    const count = 1000;
    const origLines: string[] = [];
    const modLines: string[] = [];

    for (let i = 0; i < count; i++) {
      if (i % 3 === 0) {
        origLines.push(`line-${i}-original-value`);
        modLines.push(`line-${i}-modified-value`);
      } else if (i % 3 === 1) {
        origLines.push(`common-shared-line-${i}`);
        modLines.push(`common-shared-line-${i}`);
      } else {
        origLines.push(`line-${i}-deleted`);
        // modified omits this line, and inserts new
        modLines.push(`line-${i}-inserted-new-token`);
      }
    }

    const t0 = performance.now();
    const diff = computeLineDiff(origLines.join('\n'), modLines.join('\n'));
    const t1 = performance.now();

    expect(t1 - t0).toBeLessThan(2000); // Sub-2s execution for 1,000x1,000 LCS matrix
    expect(diff.lines.length).toBeGreaterThan(count);
    expect(diff.addedCount).toBeGreaterThan(100);
    expect(diff.removedCount).toBeGreaterThan(100);
    expect(diff.unchangedCount).toBeGreaterThan(100);
  });

  it('renders large diffs in both Side-by-Side and Unified Inline modes with copy functionality', () => {
    const orig = Array.from({ length: 200 }, (_, i) => `Header-${i}: value-${i}`).join('\n');
    const mod = Array.from({ length: 200 }, (_, i) => i % 5 === 0 ? `Header-${i}: mutated-val` : `Header-${i}: value-${i}`).join('\n');

    render(
      <DiffViewer
        originalText={orig}
        modifiedText={mod}
        initialMode="side-by-side"
      />
    );

    // Verify side-by-side mode buttons
    const sideBySideBtn = screen.getByText('Side-by-Side');
    const inlineBtn = screen.getByText('Unified Inline');
    const copyBtn = screen.getByText('Copy Modified');

    expect(sideBySideBtn).toBeInTheDocument();
    expect(inlineBtn).toBeInTheDocument();
    expect(copyBtn).toBeInTheDocument();

    // Switch to inline mode
    fireEvent.click(inlineBtn);

    // Click copy modified
    fireEvent.click(copyBtn);
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });
});
