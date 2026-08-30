import React, { useMemo, useEffect } from 'react';
import { decodeChunkedTransferEncoding } from '../../utils/repeaterUtils';

export interface HttpSyntaxHighlighterProps {
  content: string;
  isResponse?: boolean;
  searchQuery?: string;
  activeMatchIndex?: number;
  className?: string;
  fontSize?: string;
  showLineNumbers?: boolean;
  autoFormatJson?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

let activeSearchContext: {
  query: string;
  activeMatchIndex: number;
  matchCounter: number;
} = {
  query: '',
  activeMatchIndex: 0,
  matchCounter: 0,
};

/**
 * Highlights tokens in query search matches (Burp Suite styling)
 */
function highlightSearch(text: string, query?: string): React.ReactNode {
  const effectiveQuery = query !== undefined ? query : activeSearchContext.query;
  if (!effectiveQuery || !effectiveQuery.trim() || !text) return text;
  const q = effectiveQuery.toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lower.indexOf(q, lastIndex);

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }
    const currentIdx = activeSearchContext.matchCounter++;
    const isActive = currentIdx === activeSearchContext.activeMatchIndex;

    parts.push(
      <mark
        key={`${index}-${currentIdx}`}
        id={isActive ? 'active-burp-search-match' : undefined}
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
}

/**
 * Parse & highlight URI with query parameters (Burp Suite styling: path in white, query values in olive green #8ea834)
 */
function renderUriWithQueryParams(uri: string, query?: string): React.ReactNode {
  const qIdx = uri.indexOf('?');
  if (qIdx === -1) {
    return <span className="text-[#dfdfdf]">{highlightSearch(uri, query)}</span>;
  }

  const path = uri.substring(0, qIdx);
  const queryString = uri.substring(qIdx + 1);
  const pairs = queryString.split('&');

  return (
    <>
      <span className="text-[#dfdfdf]">{highlightSearch(path, query)}</span>
      <span className="text-[#8c9099]">?</span>
      {pairs.map((pair, pIdx) => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) {
          return (
            <React.Fragment key={pIdx}>
              {pIdx > 0 && <span className="text-[#8c9099]">&</span>}
              <span className="text-[#dfdfdf]">{highlightSearch(pair, query)}</span>
            </React.Fragment>
          );
        }

        const key = pair.substring(0, eqIdx);
        const val = pair.substring(eqIdx + 1);

        return (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && <span className="text-[#8c9099]">&</span>}
            <span className="text-[#dfdfdf]">{highlightSearch(key, query)}</span>
            <span className="text-[#8c9099]">=</span>
            <span className="text-[#8ea834] font-medium">{highlightSearch(val, query)}</span>
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Parse & highlight URL-encoded key=value parameters (Burp Suite: keys in white, values in olive green #8ea834)
 */
function renderUrlEncodedParams(line: string, query?: string): React.ReactNode {
  if (!line.includes('=') && !line.includes('&')) {
    return highlightSearch(line, query);
  }

  const pairs = line.split('&');
  return (
    <>
      {pairs.map((pair, pIdx) => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) {
          return (
            <React.Fragment key={pIdx}>
              {pIdx > 0 && <span className="text-[#8c9099]">&</span>}
              <span className="text-[#dfdfdf]">{highlightSearch(pair, query)}</span>
            </React.Fragment>
          );
        }

        const key = pair.substring(0, eqIdx);
        const val = pair.substring(eqIdx + 1);

        return (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && <span className="text-[#8c9099]">&</span>}
            <span className="text-[#dfdfdf]">{highlightSearch(key, query)}</span>
            <span className="text-[#8c9099]">=</span>
            <span className="text-[#8ea834] font-medium">{highlightSearch(val, query)}</span>
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Highlight Cookie and Set-Cookie header values
 */
function renderCookieHeader(val: string, query?: string): React.ReactNode {
  const parts = val.split(';');
  return (
    <>
      {parts.map((part, idx) => {
        const trimmed = part.trim();
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-[#8c9099]">; </span>}
              <span className="text-[#dfdfdf]">{highlightSearch(trimmed, query)}</span>
            </React.Fragment>
          );
        }
        const k = trimmed.substring(0, eq);
        const v = trimmed.substring(eq + 1);
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-[#8c9099]">; </span>}
            <span className="text-[#dfdfdf]">{highlightSearch(k, query)}</span>
            <span className="text-[#8c9099]">=</span>
            <span className="text-[#8ea834] font-medium">{highlightSearch(v, query)}</span>
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Highlight Header values (including quoted strings and tokens)
 */
function renderHeaderValue(name: string, val: string, query?: string): React.ReactNode {
  const lowerName = name.toLowerCase();
  if (lowerName === 'cookie' || lowerName === 'set-cookie') {
    return renderCookieHeader(val, query);
  }

  if (lowerName === 'authorization' && val.trim().toLowerCase().startsWith('bearer ')) {
    const token = val.trim().substring(7);
    return (
      <>
        <span className="text-[#8c9099]">Bearer </span>
        <span className="text-[#8ea834] font-medium">{highlightSearch(token, query)}</span>
      </>
    );
  }

  if (val.includes('"')) {
    const parts = val.split(/("(\\.|[^"\\])*")/g);
    return (
      <>
        {parts.map((p, idx) => {
          if (!p) return null;
          if (p.startsWith('"') && p.endsWith('"')) {
            return (
              <span key={idx} className="text-[#8ea834] font-medium">
                {highlightSearch(p, query)}
              </span>
            );
          }
          return <span key={idx} className="text-[#abb2bf]">{highlightSearch(p, query)}</span>;
        })}
      </>
    );
  }

  return highlightSearch(val, query);
}

/**
 * Format and highlight JSON line (Burp Suite: Keys in gold #e5c07b, Strings in olive green #8ea834, Booleans in orange #d19a66, Numbers in blue/cyan #61afef)
 * Supports both multi-line pretty JSON and dense single-line JSON with full tokenization.
 */
function renderJsonLine(line: string, query?: string): React.ReactNode {
  const jsonTokenRegex = /("(\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false)|(null)|([\{\}\[\]])|(:)|(,)|(\s+)|([^"0-9a-zA-Z\s\{\}\[\]:,]+)/g;

  const elements: React.ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = jsonTokenRegex.exec(line)) !== null) {
    const rawToken = match[0];
    const isString = !!match[1];
    const isNumber = !!match[3];
    const isBoolean = !!match[4];
    const isNull = !!match[5];
    const isBracket = !!match[6];
    const isColon = !!match[7];
    const isComma = !!match[8];
    const isWhitespace = !!match[9];

    if (isString) {
      const restOfLine = line.substring(jsonTokenRegex.lastIndex);
      const isKey = /^\s*:/.test(restOfLine);

      if (isKey) {
        elements.push(
          <span key={match.index} className="text-[#e5c07b] font-medium">
            {highlightSearch(rawToken, query)}
          </span>
        );
      } else {
        elements.push(
          <span key={match.index} className="text-[#8ea834] font-medium">
            {highlightSearch(rawToken, query)}
          </span>
        );
      }
    } else if (isNumber) {
      elements.push(
        <span key={match.index} className="text-[#61afef]">
          {highlightSearch(rawToken, query)}
        </span>
      );
    } else if (isBoolean) {
      elements.push(
        <span key={match.index} className="text-[#d19a66] font-semibold">
          {highlightSearch(rawToken, query)}
        </span>
      );
    } else if (isNull) {
      elements.push(
        <span key={match.index} className="text-[#e06c75] font-semibold">
          {highlightSearch(rawToken, query)}
        </span>
      );
    } else if (isBracket) {
      elements.push(
        <span key={match.index} className="text-[#dfdfdf]">
          {rawToken}
        </span>
      );
    } else if (isColon) {
      elements.push(
        <span key={match.index} className="text-[#c4c7c5]">
          :
        </span>
      );
    } else if (isComma) {
      elements.push(
        <span key={match.index} className="text-[#8c9099]">
          ,
        </span>
      );
    } else if (isWhitespace) {
      elements.push(<span key={match.index}>{rawToken}</span>);
    } else {
      elements.push(
        <span key={match.index} className="text-[#dfdfdf]">
          {highlightSearch(rawToken, query)}
        </span>
      );
    }
  }

  if (elements.length === 0) {
    return highlightSearch(line, query);
  }

  return <>{elements}</>;
}

function wrapIndentedText(text: string, indentStr: string, maxLen = 75): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((indentStr.length + currentLine.length + 1 + word.length) <= maxLen) {
      currentLine += ' ' + word;
    } else {
      lines.push(`${indentStr}${currentLine}`);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(`${indentStr}${currentLine}`);
  }

  return lines;
}

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
]);

export function formatHtmlForPrettyView(html: string): string {
  if (!html || !html.includes('<')) return html;

  const tab = '    '; // 4 spaces like Burp Suite Pro
  let indent = 0;
  const resultLines: string[] = [];

  // Match comments, script blocks, style blocks, HTML tags, and text content
  const tokenRegex = /(<!--[\s\S]*?-->)|(<script\b[^>]*>[\s\S]*?<\/script>)|(<style\b[^>]*>[\s\S]*?<\/style>)|(<(?:\/)?[a-zA-Z0-9\-:]+(?:\s+[^>]*)?>)|([^<]+)/gi;

  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html)) !== null) {
    const comment = match[1];
    const scriptBlock = match[2];
    const styleBlock = match[3];
    const tag = match[4];
    const text = match[5];

    if (comment) {
      const trimmed = comment.trim();
      if (trimmed) {
        resultLines.push(`${tab.repeat(indent)}${trimmed}`);
      }
    } else if (scriptBlock) {
      const openTagMatch = scriptBlock.match(/^<script\b[^>]*>/i);
      const openTag = openTagMatch ? openTagMatch[0] : '<script>';
      const hasCloseTag = scriptBlock.endsWith('</script>');
      const innerCode = scriptBlock.slice(openTag.length, hasCloseTag ? -9 : undefined).trim();

      if (!innerCode) {
        resultLines.push(`${tab.repeat(indent)}${openTag}</script>`);
      } else {
        resultLines.push(`${tab.repeat(indent)}${openTag}`);
        const codeLines = innerCode.split(/\r?\n/);
        for (const cl of codeLines) {
          const trimmedCl = cl.trim();
          if (trimmedCl) resultLines.push(`${tab.repeat(indent + 1)}${trimmedCl}`);
        }
        resultLines.push(`${tab.repeat(indent)}</script>`);
      }
    } else if (styleBlock) {
      const openTagMatch = styleBlock.match(/^<style\b[^>]*>/i);
      const openTag = openTagMatch ? openTagMatch[0] : '<style>';
      const hasCloseTag = styleBlock.endsWith('</style>');
      const innerCss = styleBlock.slice(openTag.length, hasCloseTag ? -8 : undefined).trim();

      resultLines.push(`${tab.repeat(indent)}${openTag}`);
      if (innerCss) {
        const cssLines = innerCss.split(/\r?\n/);
        for (const cl of cssLines) {
          const trimmedCl = cl.trim();
          if (trimmedCl) resultLines.push(`${tab.repeat(indent + 1)}${trimmedCl}`);
        }
      }
      resultLines.push(`${tab.repeat(indent)}</style>`);
    } else if (tag) {
      const trimmedTag = tag.trim();
      const tagNameMatch = trimmedTag.match(/^<(\/)?([a-zA-Z0-9\-:]+)/i);
      const isClosing = !!tagNameMatch?.[1];
      const tagName = tagNameMatch?.[2]?.toLowerCase() || '';
      const isSelfClosing = trimmedTag.endsWith('/>') || VOID_TAGS.has(tagName);

      if (isClosing) {
        indent = Math.max(0, indent - 1);
        resultLines.push(`${tab.repeat(indent)}${trimmedTag}`);
      } else if (isSelfClosing) {
        resultLines.push(`${tab.repeat(indent)}${trimmedTag}`);
      } else {
        resultLines.push(`${tab.repeat(indent)}${trimmedTag}`);
        indent++;
      }
    } else if (text) {
      const trimmedText = text.trim();
      if (trimmedText) {
        const textLines = trimmedText.split(/\r?\n/);
        for (const tl of textLines) {
          const line = tl.trim();
          if (line) {
            const wrapped = wrapIndentedText(line, tab.repeat(indent), 75);
            resultLines.push(...wrapped);
          }
        }
      }
    }
  }

  return resultLines.length > 0 ? resultLines.join('\n') : html;
}

/**
 * Format and highlight HTML / XML lines (Burp Suite styling: tags in olive green #8ea834, attributes in white #dfdfdf, attr values in green #8ea834, text in crisp white #dfdfdf, comments in grey #6f737a)
 */
function renderHtmlLine(line: string, query?: string): React.ReactNode {
  const trimmed = line.trim();
  if (trimmed.startsWith('<!--') || trimmed.endsWith('-->')) {
    return <span className="text-[#6f737a] italic">{highlightSearch(line, query)}</span>;
  }

  const tokenRegex = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z0-9\-:]+)([^>]*?)(\/?>)|([^<]+)/g;
  const elements: React.ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    const [_, comment, tagOpen, tagAttrs, tagClose, textNode] = match;

    if (comment) {
      elements.push(
        <span key={match.index} className="text-[#6f737a] italic">
          {highlightSearch(comment, query)}
        </span>
      );
    } else if (tagOpen) {
      elements.push(
        <React.Fragment key={match.index}>
          <span className="text-[#8ea834] font-medium">{highlightSearch(tagOpen, query)}</span>
          {tagAttrs && renderHtmlAttributes(tagAttrs, query)}
          <span className="text-[#8ea834] font-medium">{tagClose}</span>
        </React.Fragment>
      );
    } else if (textNode) {
      elements.push(
        <span key={match.index} className="text-[#dfdfdf]">
          {highlightSearch(textNode, query)}
        </span>
      );
    }
  }

  if (elements.length === 0) {
    return <span className="text-[#dfdfdf]">{highlightSearch(line, query)}</span>;
  }

  return <>{elements}</>;
}

function renderHtmlAttributes(attrs: string, query?: string): React.ReactNode {
  const attrRegex = /([a-zA-Z0-9\-:]+)(\s*=\s*)("([^"]*)"|'([^']*)'|[^\s>]+)?|(\s+)/g;
  const elements: React.ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrs)) !== null) {
    const [_, attrName, eq, fullVal, , , space] = match;

    if (space) {
      elements.push(<span key={match.index}>{space}</span>);
    } else if (attrName) {
      elements.push(
        <React.Fragment key={match.index}>
          <span className="text-[#dfdfdf]">{highlightSearch(attrName, query)}</span>
          {eq && <span className="text-[#8c9099]">{eq}</span>}
          {fullVal && (
            <span className="text-[#8ea834] font-medium">
              {highlightSearch(fullVal, query)}
            </span>
          )}
        </React.Fragment>
      );
    }
  }

  return <>{elements}</>;
}

/**
 * Full Burp Suite HTTP Syntax Highlighting Component
 */
export const HttpSyntaxHighlighter: React.FC<HttpSyntaxHighlighterProps> = ({
  content,
  isResponse = false,
  searchQuery = '',
  activeMatchIndex = 0,
  className = '',
  fontSize = 'text-[11px]',
  showLineNumbers = true,
  autoFormatJson = true,
  onContextMenu,
}) => {
  // Initialize match counter for this render cycle
  activeSearchContext = {
    query: searchQuery,
    activeMatchIndex,
    matchCounter: 0,
  };

  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      const el = document.getElementById('active-burp-search-match');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [searchQuery, activeMatchIndex]);

  const lines = useMemo(() => {
    if (!content) return [];
    const normalized = content.replace(/\r\n/g, '\n');
    
    // Auto-prettify JSON/HTML body and dechunk if applicable
    if (autoFormatJson) {
      const doubleNewlineIdx = normalized.indexOf('\n\n');
      if (doubleNewlineIdx !== -1) {
        const head = normalized.substring(0, doubleNewlineIdx);
        let body = normalized.substring(doubleNewlineIdx + 2).trim();

        if (head.toLowerCase().includes('transfer-encoding: chunked') || /^[0-9a-fA-F]{1,8}\n/m.test(body)) {
          body = decodeChunkedTransferEncoding(body);
        }

        if ((body.startsWith('{') && body.endsWith('}')) || (body.startsWith('[') && body.endsWith(']'))) {
          try {
            const parsed = JSON.parse(body);
            const formatted = JSON.stringify(parsed, null, 2);
            const cleanHead = head
              .replace(/transfer-encoding:\s*chunked\n?/gi, '')
              .replace(/content-encoding:\s*gzip\n?/gi, '')
              .trim();
            return `${cleanHead}\n\n${formatted}`.split('\n');
          } catch {}
        }

        const isHtml = head.toLowerCase().includes('text/html') || 
          body.startsWith('<!DOCTYPE') || 
          body.startsWith('<html') || 
          body.startsWith('<!--') || 
          (body.includes('<') && (body.includes('</') || body.includes('/>') || body.includes('<div') || body.includes('<span') || body.includes('<head') || body.includes('<body')));
        if (isHtml) {
          const formatted = formatHtmlForPrettyView(body);
          const cleanHead = head
            .replace(/transfer-encoding:\s*chunked\n?/gi, '')
            .replace(/content-encoding:\s*gzip\n?/gi, '')
            .trim();
          return `${cleanHead}\n\n${formatted}`.split('\n');
        }
      } else {
        let trimmed = normalized.trim();
        if (/^[0-9a-fA-F]{1,8}\n/m.test(trimmed)) {
          trimmed = decodeChunkedTransferEncoding(trimmed);
        }
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            const parsed = JSON.parse(trimmed);
            return JSON.stringify(parsed, null, 2).split('\n');
          } catch {}
        }
        const isHtml = trimmed.startsWith('<!DOCTYPE') || 
          trimmed.startsWith('<html') || 
          trimmed.startsWith('<!--') || 
          (trimmed.includes('<') && (trimmed.includes('</') || trimmed.includes('/>') || trimmed.includes('<div') || trimmed.includes('<span')));
        if (isHtml) {
          return formatHtmlForPrettyView(trimmed).split('\n');
        }
      }
    }

    return normalized.split('\n');
  }, [content, autoFormatJson]);

  // Track header section vs body section
  let inBody = false;
  let isJsonBody = false;
  let isUrlEncodedBody = false;
  let isHtmlBody = false;

  return (
    <div
      onContextMenu={onContextMenu}
      className={`table w-full font-mono select-text leading-5 ${fontSize} text-[#dfdfdf] ${className}`}
      style={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
    >
      {lines.map((line, idx) => {
        // Line number formatting (Burp Suite styling: grey muted on left)
        const lineNum = idx + 1;

        if (!inBody && line.trim() === '') {
          inBody = true;
          return (
            <div key={idx} className="table-row hover:bg-[#282b30]/50">
              {showLineNumbers && (
                <span className="table-cell select-none text-right pr-3 text-[#6f737a] w-8 font-mono text-[10px]">
                  {lineNum}
                </span>
              )}
              <span className="table-cell whitespace-pre">&nbsp;</span>
            </div>
          );
        }

        // Line 1: Request / Response status line
        if (idx === 0) {
          if (!isResponse) {
            // e.g. POST /api/v1/auth/login?key=123 HTTP/1.1
            const parts = line.split(' ');
            const method = parts[0] || 'GET';
            const uri = parts[1] || '/';
            const proto = parts.slice(2).join(' ') || 'HTTP/1.1';

            return (
              <div key={idx} className="table-row hover:bg-[#282b30]/50">
                {showLineNumbers && (
                  <span className="table-cell select-none text-right pr-3 text-[#6f737a] w-8 font-mono text-[10px]">
                    {lineNum}
                  </span>
                )}
                <span className="table-cell whitespace-pre">
                  <span className="text-[#dfdfdf] font-bold">{highlightSearch(method, searchQuery)}</span>{' '}
                  {renderUriWithQueryParams(uri, searchQuery)}{' '}
                  <span className="text-[#8c9099]">{highlightSearch(proto, searchQuery)}</span>
                </span>
              </div>
            );
          } else {
            // e.g. HTTP/1.1 200 OK or HTTP/2 400 Bad Request
            const parts = line.split(' ');
            const proto = parts[0] || 'HTTP/1.1';
            const code = parts[1] || '200';
            const reason = parts.slice(2).join(' ') || 'OK';

            const codeNum = parseInt(code, 10);
            const codeColor =
              codeNum >= 200 && codeNum < 300
                ? 'text-[#98c379]'
                : codeNum >= 300 && codeNum < 400
                ? 'text-[#61afef]'
                : codeNum >= 400 && codeNum < 500
                ? 'text-[#e5c07b]'
                : 'text-[#e06c75]';

            return (
              <div key={idx} className="table-row hover:bg-[#282b30]/50">
                {showLineNumbers && (
                  <span className="table-cell select-none text-right pr-3 text-[#6f737a] w-8 font-mono text-[10px]">
                    {lineNum}
                  </span>
                )}
                <span className="table-cell whitespace-pre">
                  <span className="text-[#8c9099]">{highlightSearch(proto, searchQuery)}</span>{' '}
                  <span className={`${codeColor} font-bold`}>{highlightSearch(code, searchQuery)}</span>{' '}
                  <span className="text-[#dfdfdf] font-medium">{highlightSearch(reason, searchQuery)}</span>
                </span>
              </div>
            );
          }
        }

        // Headers Section
        if (!inBody) {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const hName = line.substring(0, colonIdx);
            const hVal = line.substring(colonIdx + 1);

            // Detect content-type for body parser
            const lowerName = hName.toLowerCase();
            if (lowerName === 'content-type') {
              if (hVal.includes('json')) isJsonBody = true;
              if (hVal.includes('x-www-form-urlencoded')) isUrlEncodedBody = true;
              if (hVal.includes('html') || hVal.includes('xml')) isHtmlBody = true;
            }

            const valContent = renderHeaderValue(hName, hVal.trim(), searchQuery);

            return (
              <div key={idx} className="table-row hover:bg-[#282b30]/50">
                {showLineNumbers && (
                  <span className="table-cell select-none text-right pr-3 text-[#6f737a] w-8 font-mono text-[10px]">
                    {lineNum}
                  </span>
                )}
                <span className="table-cell whitespace-pre">
                  <span className="text-[#dfdfdf] font-semibold">{highlightSearch(hName, searchQuery)}</span>
                  <span className="text-[#8c9099]">: </span>
                  <span className="text-[#abb2bf]">{valContent}</span>
                </span>
              </div>
            );
          }
        }

        // Body Section (Highlighted according to payload type)
        let bodyLineNode: React.ReactNode;
        const trimmed = line.trim();

        if (isJsonBody || (trimmed.startsWith('{') && !trimmed.startsWith('<!--')) || trimmed.startsWith('[') || trimmed.startsWith('"') || trimmed.includes('":')) {
          bodyLineNode = renderJsonLine(line, searchQuery);
        } else if (isHtmlBody || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<!--') || trimmed.startsWith('<') || trimmed.includes('</') || (trimmed.endsWith('>') && trimmed.includes('<'))) {
          bodyLineNode = renderHtmlLine(line, searchQuery);
        } else if (isUrlEncodedBody || line.includes('=')) {
          bodyLineNode = renderUrlEncodedParams(line, searchQuery);
        } else {
          bodyLineNode = <span className="text-[#dfdfdf]">{highlightSearch(line, searchQuery)}</span>;
        }

        return (
          <div key={idx} className="table-row hover:bg-[#282b30]/50">
            {showLineNumbers && (
              <span className="table-cell select-none text-right pr-3 text-[#6f737a] w-8 font-mono text-[10px]">
                {lineNum}
              </span>
            )}
            <span className="table-cell whitespace-pre">{line === '' ? '\u00A0' : bodyLineNode}</span>
          </div>
        );
      })}
    </div>
  );
};

