import React, { useState, useMemo } from 'react';
import { cn } from './utils';
import { DiffResult, DiffLine } from '../types/models';
import { Button } from './Button';
import { Columns, AlignJustify, Copy, Check } from 'lucide-react';

export interface DiffViewerProps {
  originalText: string;
  modifiedText: string;
  originalTitle?: string;
  modifiedTitle?: string;
  initialMode?: 'side-by-side' | 'inline';
  className?: string;
}

// LCS-based diff calculation engine
export function computeLineDiff(original: string = '', modified: string = ''): DiffResult {
  const origLines = (original || '').split(/\r?\n/);
  const modLines = (modified || '').split(/\r?\n/);

  const n = origLines.length;
  const m = modLines.length;

  // Build LCS matrix
  const matrix: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // Backtrack LCS to reconstruct diff lines
  const lines: DiffLine[] = [];
  let i = n;
  let j = m;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      stack.push({
        type: 'equal',
        oldLineNumber: i,
        newLineNumber: j,
        content: origLines[i - 1],
      });
      unchangedCount++;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      stack.push({
        type: 'add',
        newLineNumber: j,
        content: modLines[j - 1],
      });
      addedCount++;
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      stack.push({
        type: 'remove',
        oldLineNumber: i,
        content: origLines[i - 1],
      });
      removedCount++;
      i--;
    }
  }

  while (stack.length > 0) {
    lines.push(stack.pop()!);
  }

  const totalLines = Math.max(1, n + m);
  const similarityScore = Math.max(0, Math.min(100, Math.round((unchangedCount * 2 * 100) / totalLines)));

  return {
    lines,
    addedCount,
    removedCount,
    unchangedCount,
    similarityScore,
  };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalText,
  modifiedText,
  originalTitle = 'Original',
  modifiedTitle = 'Modified',
  initialMode = 'side-by-side',
  className,
}) => {
  const [mode, setMode] = useState<'side-by-side' | 'inline'>(initialMode);
  const [copied, setCopied] = useState(false);

  const diffResult = useMemo(() => {
    return computeLineDiff(originalText, modifiedText);
  }, [originalText, modifiedText]);

  const handleCopyModified = () => {
    navigator.clipboard.writeText(modifiedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex flex-col w-full h-full bg-bg-app border border-border-subtle rounded overflow-hidden', className)}>
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-panel-elevated border-b border-border-subtle select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-bg-panel p-0.5 rounded border border-border-subtle">
            <button
              onClick={() => setMode('side-by-side')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors',
                mode === 'side-by-side' ? 'bg-accent-cyan text-text-inverse font-semibold' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              Side-by-Side
            </button>
            <button
              onClick={() => setMode('inline')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors',
                mode === 'inline' ? 'bg-accent-cyan text-text-inverse font-semibold' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified Inline
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-severity-low font-bold">+{diffResult.addedCount} lines</span>
            <span className="text-severity-critical font-bold">-{diffResult.removedCount} lines</span>
            <span className="text-text-muted">|</span>
            <span className="text-text-secondary">Similarity: {diffResult.similarityScore}%</span>
          </div>
        </div>

        <Button
          variant="subtle"
          size="xs"
          leftIcon={copied ? <Check className="w-3.5 h-3.5 text-severity-low" /> : <Copy className="w-3.5 h-3.5" />}
          onClick={handleCopyModified}
        >
          {copied ? 'Copied' : 'Copy Modified'}
        </Button>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto font-mono text-xs select-text">
        {mode === 'inline' ? (
          <div className="min-w-full">
            {diffResult.lines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center hover:brightness-105 border-b border-border-subtle/20 px-2 py-0.5',
                  line.type === 'add' && 'bg-severity-low-bg/40 text-[#7ee787]',
                  line.type === 'remove' && 'bg-severity-critical-bg/40 text-[#ffa198]',
                  line.type === 'equal' && 'text-text-primary'
                )}
              >
                {/* Line Numbers */}
                <div className="w-10 text-right pr-2 text-text-muted select-none">
                  {line.oldLineNumber || ''}
                </div>
                <div className="w-10 text-right pr-2 text-text-muted border-r border-border-subtle select-none">
                  {line.newLineNumber || ''}
                </div>

                {/* Diff Symbol */}
                <div className="w-6 text-center select-none font-bold">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </div>

                {/* Line Content */}
                <div className="flex-1 whitespace-pre pl-1">{line.content}</div>
              </div>
            ))}
          </div>
        ) : (
          /* Side-by-side view */
          <div className="flex min-w-full h-full">
            {/* Left Original Pane */}
            <div className="flex-1 border-r border-border-subtle overflow-y-auto">
              <div className="sticky top-0 bg-bg-panel px-3 py-1 text-xs font-semibold text-text-secondary border-b border-border-subtle">
                {originalTitle}
              </div>
              {diffResult.lines
                .filter((l) => l.type !== 'add')
                .map((line, idx) => (
                  <div
                    key={`orig-${idx}`}
                    className={cn(
                      'flex items-center px-2 py-0.5 border-b border-border-subtle/20',
                      line.type === 'remove' ? 'bg-severity-critical-bg/40 text-[#ffa198]' : 'text-text-primary'
                    )}
                  >
                    <div className="w-10 text-right pr-2 text-text-muted border-r border-border-subtle select-none">
                      {line.oldLineNumber}
                    </div>
                    <div className="flex-1 whitespace-pre pl-2">{line.content}</div>
                  </div>
                ))}
            </div>

            {/* Right Modified Pane */}
            <div className="flex-1 overflow-y-auto">
              <div className="sticky top-0 bg-bg-panel px-3 py-1 text-xs font-semibold text-text-secondary border-b border-border-subtle">
                {modifiedTitle}
              </div>
              {diffResult.lines
                .filter((l) => l.type !== 'remove')
                .map((line, idx) => (
                  <div
                    key={`mod-${idx}`}
                    className={cn(
                      'flex items-center px-2 py-0.5 border-b border-border-subtle/20',
                      line.type === 'add' ? 'bg-severity-low-bg/40 text-[#7ee787]' : 'text-text-primary'
                    )}
                  >
                    <div className="w-10 text-right pr-2 text-text-muted border-r border-border-subtle select-none">
                      {line.newLineNumber}
                    </div>
                    <div className="flex-1 whitespace-pre pl-2">{line.content}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
