import React, { useState, useMemo } from 'react';
import { cn, formatBytes } from './utils';
import { Button } from './Button';
import { Copy, Check, Binary, FileText } from 'lucide-react';

export interface RawByteInspectorProps {
  data: Uint8Array | string;
  className?: string;
  initialMode?: 'hex' | 'raw';
}

interface HexRow {
  offset: number;
  offsetHex: string;
  bytes: number[];
  ascii: string;
}

export function toUint8Array(input: Uint8Array | string): Uint8Array {
  if (typeof input === 'string') {
    return new TextEncoder().encode(input);
  }
  return input;
}

export function formatHexByte(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

export function formatAsciiChar(byte: number): string {
  // Printable ASCII 32 to 126
  if (byte >= 32 && byte <= 126) {
    return String.fromCharCode(byte);
  }
  return '.';
}

export const RawByteInspector: React.FC<RawByteInspectorProps> = ({
  data,
  className,
  initialMode = 'hex',
}) => {
  const [mode, setMode] = useState<'hex' | 'raw'>(initialMode);
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);
  const [selectedByteIndex, setSelectedByteIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const bytes = useMemo(() => toUint8Array(data), [data]);
  const rawString = useMemo(() => {
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return '';
    }
  }, [bytes]);

  const hexRows: HexRow[] = useMemo(() => {
    const rows: HexRow[] = [];
    const bytesPerRow = 16;
    for (let i = 0; i < bytes.length; i += bytesPerRow) {
      const rowBytes: number[] = [];
      let ascii = '';
      for (let j = 0; j < bytesPerRow; j++) {
        if (i + j < bytes.length) {
          const b = bytes[i + j];
          rowBytes.push(b);
          ascii += formatAsciiChar(b);
        }
      }
      rows.push({
        offset: i,
        offsetHex: i.toString(16).padStart(8, '0').toUpperCase(),
        bytes: rowBytes,
        ascii,
      });
    }
    return rows;
  }, [bytes]);

  const handleCopy = () => {
    if (mode === 'raw') {
      navigator.clipboard.writeText(rawString);
    } else {
      const hexDump = hexRows
        .map(
          (r) =>
            `${r.offsetHex}:  ${r.bytes.map((b) => formatHexByte(b)).join(' ').padEnd(48, ' ')}  |${r.ascii}|`
        )
        .join('\n');
      navigator.clipboard.writeText(hexDump);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedByte = selectedByteIndex !== null && selectedByteIndex < bytes.length ? bytes[selectedByteIndex] : null;

  return (
    <div className={cn('flex flex-col w-full h-full bg-bg-app border border-border-subtle rounded overflow-hidden', className)}>
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-panel-elevated border-b border-border-subtle select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-bg-panel p-0.5 rounded border border-border-subtle">
            <button
              onClick={() => setMode('hex')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors',
                mode === 'hex' ? 'bg-accent-cyan text-text-inverse font-semibold' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Binary className="w-3.5 h-3.5" />
              Hex View
            </button>
            <button
              onClick={() => setMode('raw')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors',
                mode === 'raw' ? 'bg-accent-cyan text-text-inverse font-semibold' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Raw Text
            </button>
          </div>

          <div className="text-xs font-mono text-text-secondary">
            Size: <span className="text-text-primary font-bold">{formatBytes(bytes.length)}</span> ({bytes.length} bytes)
          </div>

          {selectedByte !== null && selectedByteIndex !== null && (
            <div className="flex items-center gap-2 text-xs font-mono text-accent-cyan bg-bg-panel px-2 py-0.5 rounded border border-border-subtle">
              <span>Offset: 0x{selectedByteIndex.toString(16).toUpperCase()}</span>
              <span>Hex: 0x{formatHexByte(selectedByte)}</span>
              <span>Dec: {selectedByte}</span>
              <span>Char: '{formatAsciiChar(selectedByte)}'</span>
            </div>
          )}
        </div>

        <Button
          variant="subtle"
          size="xs"
          leftIcon={copied ? <Check className="w-3.5 h-3.5 text-severity-low" /> : <Copy className="w-3.5 h-3.5" />}
          onClick={handleCopy}
        >
          {copied ? 'Copied' : mode === 'hex' ? 'Copy Hex Dump' : 'Copy Text'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-2 font-mono text-xs select-text">
        {mode === 'raw' ? (
          <pre className="whitespace-pre-wrap break-all text-text-primary font-mono text-xs">
            {rawString || <span className="text-text-muted italic">Empty body</span>}
          </pre>
        ) : (
          <div className="inline-block min-w-full">
            {/* Column Guide */}
            <div className="flex items-center text-text-muted font-semibold border-b border-border-subtle/50 pb-1 mb-1 select-none">
              <div className="w-24 text-text-secondary">Offset</div>
              <div className="flex gap-1.5 mr-4 text-text-secondary">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className={cn('w-5 text-center', i === 8 && 'ml-2')}>
                    {i.toString(16).toUpperCase()}
                  </span>
                ))}
              </div>
              <div className="text-text-secondary">Decoded ASCII</div>
            </div>

            {/* Hex Dump Rows */}
            {hexRows.map((row) => (
              <div
                key={row.offset}
                className="flex items-center hover:bg-bg-panel-hover/50 py-0.5 border-b border-border-subtle/10"
              >
                {/* Offset */}
                <div className="w-24 text-accent-cyan/80 select-none">{row.offsetHex}</div>

                {/* Hex Bytes */}
                <div className="flex gap-1.5 mr-4 font-mono">
                  {Array.from({ length: 16 }).map((_, idx) => {
                    const hasByte = idx < row.bytes.length;
                    const byteVal = hasByte ? row.bytes[idx] : null;
                    const absoluteIndex = row.offset + idx;
                    const isHovered = hoveredByteIndex === absoluteIndex;
                    const isSelected = selectedByteIndex === absoluteIndex;

                    return (
                      <span
                        key={idx}
                        onMouseEnter={() => hasByte && setHoveredByteIndex(absoluteIndex)}
                        onMouseLeave={() => setHoveredByteIndex(null)}
                        onClick={() => hasByte && setSelectedByteIndex(absoluteIndex)}
                        className={cn(
                          'w-5 text-center cursor-pointer transition-colors rounded select-none',
                          idx === 8 && 'ml-2',
                          hasByte ? 'text-text-primary' : 'text-text-muted/30',
                          isHovered && 'bg-accent-cyan/30 text-accent-cyan font-bold',
                          isSelected && 'bg-accent-cyan text-text-inverse font-bold'
                        )}
                      >
                        {byteVal !== null ? formatHexByte(byteVal) : '  '}
                      </span>
                    );
                  })}
                </div>

                {/* ASCII */}
                <div className="flex font-mono text-text-secondary border-l border-border-subtle/40 pl-2">
                  {row.bytes.map((b, idx) => {
                    const absoluteIndex = row.offset + idx;
                    const isHovered = hoveredByteIndex === absoluteIndex;
                    const isSelected = selectedByteIndex === absoluteIndex;

                    return (
                      <span
                        key={idx}
                        onMouseEnter={() => setHoveredByteIndex(absoluteIndex)}
                        onMouseLeave={() => setHoveredByteIndex(null)}
                        onClick={() => setSelectedByteIndex(absoluteIndex)}
                        className={cn(
                          'w-2 text-center cursor-pointer transition-colors select-none',
                          isHovered && 'text-accent-cyan font-bold bg-accent-cyan/30',
                          isSelected && 'bg-accent-cyan text-text-inverse font-bold',
                          b === 0 && 'text-text-muted/40'
                        )}
                      >
                        {formatAsciiChar(b)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
