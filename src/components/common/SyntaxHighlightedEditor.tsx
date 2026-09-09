import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

export interface SyntaxHighlightedEditorRef {
  focus: () => void;
  getTextarea: () => HTMLTextAreaElement | null;
  getSelection: () => { start: number; end: number; text: string };
  setSelection: (start: number, end: number) => void;
}

export interface SyntaxHighlightedEditorProps {
  value: string;
  onChange: (value: string) => void;
  isIntruder?: boolean;
  searchQuery?: string;
  activeMatchIndex?: number;
  placeholder?: string;
  className?: string;
  wordWrap?: boolean;
  hideUninterestingHeaders?: boolean;
  showNonPrintable?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onSelectionChange?: (sel: { text: string; start: number; end: number }) => void;
}

const renderCrlfBadges = () => (
  <span className="inline-flex items-center ml-1 select-none font-mono text-[9px] text-[#9da5b4] align-baseline">
    <span className="bg-[#3c4048]/80 text-[#9da5b4] px-1 py-0.5 rounded font-mono mr-0.5">\r</span>
    <span className="bg-[#3c4048]/80 text-[#9da5b4] px-1 py-0.5 rounded font-mono">\n</span>
  </span>
);

export const SyntaxHighlightedEditor = forwardRef<SyntaxHighlightedEditorRef, SyntaxHighlightedEditorProps>(
  (
    {
      value,
      onChange,
      isIntruder = false,
      searchQuery = '',
      activeMatchIndex = 0,
      placeholder = '',
      className = '',
      wordWrap = false,
      hideUninterestingHeaders: _hideUninterestingHeaders = false,
      showNonPrintable = false,
      onContextMenu,
      onSelectionChange,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);

    const handleSelection = () => {
      if (onSelectionChange && textareaRef.current) {
        const el = textareaRef.current;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = el.value.substring(start, end);
        onSelectionChange({ text, start, end });
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      getTextarea: () => textareaRef.current,
      getSelection: () => {
        const el = textareaRef.current;
        if (!el) return { start: 0, end: 0, text: '' };
        return {
          start: el.selectionStart,
          end: el.selectionEnd,
          text: el.value.substring(el.selectionStart, el.selectionEnd),
        };
      },
      setSelection: (start: number, end: number) => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(start, end);
        }
      },
    }));

    const syncScroll = () => {
      const ta = textareaRef.current;
      if (!ta) return;
      if (backdropRef.current) {
        backdropRef.current.scrollTop = ta.scrollTop;
        backdropRef.current.scrollLeft = ta.scrollLeft;
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = ta.scrollTop;
      }
    };

    // Scroll to active search match on Enter / arrow click
    useEffect(() => {
      if (!searchQuery || !searchQuery.trim() || !textareaRef.current) return;
      const q = searchQuery.toLowerCase();
      const lower = (value || '').toLowerCase();
      let count = 0;
      let pos = lower.indexOf(q);

      while (pos !== -1) {
        if (count === activeMatchIndex) {
          const ta = textareaRef.current;
          ta.setSelectionRange(pos, pos + q.length);
          const linesBefore = value.substring(0, pos).split('\n').length - 1;
          const targetScroll = Math.max(0, linesBefore * 20 - 80);
          ta.scrollTop = targetScroll;
          if (backdropRef.current) backdropRef.current.scrollTop = targetScroll;
          if (gutterRef.current) gutterRef.current.scrollTop = targetScroll;
          break;
        }
        count++;
        pos = lower.indexOf(q, pos + q.length);
      }
    }, [searchQuery, activeMatchIndex, value]);

    const lines = (value || '').split(/\r?\n/);
    const matchCounterRef = { current: 0 };

    const highlightSearchTokens = (text: string): React.ReactNode => {
      if (!searchQuery || !searchQuery.trim() || !text) return text;
      const q = searchQuery.toLowerCase();
      const lower = text.toLowerCase();
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let index = lower.indexOf(q, lastIndex);

      while (index !== -1) {
        if (index > lastIndex) {
          parts.push(text.substring(lastIndex, index));
        }
        const currentIdx = matchCounterRef.current++;
        const isActive = currentIdx === activeMatchIndex;

        parts.push(
          <mark
            key={`${index}-${currentIdx}`}
            className={
              isActive
                ? 'bg-[#2563eb] text-white font-bold px-0.5 outline outline-1 outline-white shadow-sm rounded-[1px]'
                : 'bg-[#1e3a8a] text-white font-semibold px-0.5 rounded-[1px]'
            }
          >
            {text.substring(index, index + q.length)}
          </mark>
        );
        lastIndex = index + q.length;
        index = lower.indexOf(q, lastIndex);
      }

      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      return parts.length > 0 ? <>{parts}</> : text;
    };

    const renderTokens = (content: string) => {
      if (!content) return null;
      if (!isIntruder) return highlightSearchTokens(content);

      const parts = content.split(/(§[^§]*§)/g);
      return parts.map((part, pIdx) => {
        if (part.startsWith('§') && part.endsWith('§') && part.length >= 2) {
          return (
            <span
              key={pIdx}
              className="bg-[#f37021]/30 text-[#f37021] font-bold"
              style={{ padding: '0 2px' }}
            >
              {highlightSearchTokens(part)}
            </span>
          );
        }
        return <React.Fragment key={pIdx}>{highlightSearchTokens(part)}</React.Fragment>;
      });
    };

    const renderHighlightedLine = (line: string, idx: number, inBody: boolean) => {
      if (idx === 0) {
        const parts = line.split(' ');
        const method = parts[0] || '';
        const uri = parts[1] || '';
        const proto = parts.slice(2).join(' ');

        const qIdx = uri.indexOf('?');
        const lineStyle: React.CSSProperties = {
          minHeight: '20px',
          lineHeight: '20px',
          whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
          wordBreak: wordWrap ? 'break-all' : 'normal',
        };

        return (
          <div key={idx} style={lineStyle}>
            <span className="text-[#dfdfdf] font-bold">{renderTokens(method)}</span>
            {parts.length > 1 && ' '}
            {parts.length > 1 && (
              qIdx === -1 ? (
                <span className="text-[#38bdf8] font-medium">{renderTokens(uri)}</span>
              ) : (
                <>
                  <span className="text-[#38bdf8] font-medium">{renderTokens(uri.substring(0, qIdx))}</span>
                  <span className="text-[#8ea834] font-medium">{renderTokens(uri.substring(qIdx))}</span>
                </>
              )
            )}
            {parts.length > 2 && ' '}
            {parts.length > 2 && <span className="text-[#8c9099]">{renderTokens(proto)}</span>}
            {showNonPrintable && renderCrlfBadges()}
          </div>
        );
      }

      const lineStyle: React.CSSProperties = {
        minHeight: '20px',
        lineHeight: '20px',
        whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
        wordBreak: wordWrap ? 'break-all' : 'normal',
      };

      if (!inBody) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const hName = line.substring(0, colonIdx);
          const hVal = line.substring(colonIdx + 1);
          return (
            <div key={idx} style={lineStyle}>
              <span className="text-[#dfdfdf] font-semibold">{renderTokens(hName)}</span>
              <span className="text-[#8c9099]">:</span>
              <span className="text-[#8ea834] font-medium">{renderTokens(hVal)}</span>
              {showNonPrintable && renderCrlfBadges()}
            </div>
          );
        }
      }

      return (
        <div key={idx} style={lineStyle} className="text-[#dfdfdf]">
          {renderTokens(line)}
          {showNonPrintable && renderCrlfBadges()}
        </div>
      );
    };

    let foundEmptyLine = false;

    return (
      <div className={`relative flex w-full h-full bg-[#1e1f22] border border-border-subtle rounded overflow-hidden select-text ${className}`}>
        {/* Left Gutter: Line Numbers */}
        <div
          ref={gutterRef}
          className="w-10 bg-[#1a1b1e] border-r border-[#2b2d30] select-none text-right pr-2 text-[#6f737a] font-mono text-[11px] overflow-hidden flex-shrink-0"
          style={{
            paddingTop: '10px',
            paddingBottom: '10px',
            fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {lines.map((_, idx) => (
            <div key={idx} style={{ height: '20px', lineHeight: '20px' }}>
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Right Canvas: Synchronized Syntax Colors + Active Textarea */}
        <div className="relative flex-1 h-full overflow-hidden">
          {/* Background Layer: Syntax Colored Tokens */}
          <div
            ref={backdropRef}
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden font-mono text-[11px] pointer-events-none select-none"
            style={{
              padding: '10px',
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              letterSpacing: 'normal',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-all' : 'normal',
            }}
          >
            {lines.map((line, idx) => {
              const inBody = foundEmptyLine;
              if (!foundEmptyLine && line.trim() === '') {
                foundEmptyLine = true;
              }
              return renderHighlightedLine(line, idx, inBody);
            })}
          </div>

          {/* Foreground Layer: Fully Editable Textarea with Exact Same Font, Line-Height, & Padding */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleSelection}
            onKeyUp={handleSelection}
            onMouseUp={handleSelection}
            onScroll={syncScroll}
            onContextMenu={onContextMenu}
            placeholder={placeholder}
            spellCheck={false}
            className="absolute inset-0 w-full h-full bg-transparent font-mono text-[11px] resize-none outline-none border-0 caret-white selection:bg-[#f37021]/30 selection:text-white overflow-auto"
            style={{
              padding: '10px',
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: '20px',
              letterSpacing: 'normal',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-all' : 'normal',
              color: 'transparent',
              caretColor: '#ffffff',
              WebkitTextFillColor: 'transparent',
            }}
          />
        </div>
      </div>
    );
  }
);

SyntaxHighlightedEditor.displayName = 'SyntaxHighlightedEditor';
