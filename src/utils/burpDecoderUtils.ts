/**
 * Smart Auto-Decoder & Codec Engine for Burp Suite Inspector
 * Supports automatic format detection, multi-codec transformations,
 * and live encoding/decoding.
 */

export type CodecType =
  | 'url'
  | 'html'
  | 'base64'
  | 'hex'
  | 'jwt'
  | 'json_escape'
  | 'unicode';

export interface CodecOption {
  id: CodecType;
  label: string;
}

export const CODEC_OPTIONS: CodecOption[] = [
  { id: 'url', label: 'URL encoding' },
  { id: 'html', label: 'HTML entities' },
  { id: 'base64', label: 'Base64' },
  { id: 'hex', label: 'Hex / ASCII' },
  { id: 'jwt', label: 'JWT / JSON Web Token' },
  { id: 'json_escape', label: 'JSON escape' },
  { id: 'unicode', label: 'Unicode escape' },
];

/**
 * Format string length in decimal and hex notation: e.g. "31 (0x1f)"
 */
export function formatSelectionLength(text: string): string {
  if (!text) return '0 (0x0)';
  const len = text.length;
  const hex = len.toString(16).toLowerCase();
  return `${len} (0x${hex})`;
}

/**
 * Heuristically auto-detects the most likely encoding of a selected text string.
 */
export function autoDetectCodec(text: string): CodecType {
  if (!text || text.trim() === '') return 'url';
  const trimmed = text.trim();

  // 1. JWT Token (3 base64url segments separated by dots)
  if (/^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*$/.test(trimmed)) {
    return 'jwt';
  }

  // 2. HTML Entities (&amp;, &#x27;, &#39;, &lt;, etc.)
  if (/&[a-zA-Z0-9#x]+;/.test(text)) {
    return 'html';
  }

  // 3. Hex ASCII (\x41\x42 or 41424344)
  if (/^(\\x[0-9a-fA-F]{2})+$/.test(trimmed) || /^(0x[0-9a-fA-F]{2}\s*)+$/.test(trimmed)) {
    return 'hex';
  }

  // 4. URL Encoding (%20, %27, +, %3D, %26, etc.)
  if (/%[0-9a-fA-F]{2}/.test(text) || (text.includes('+') && !text.includes(' ') && text.length > 5)) {
    return 'url';
  }

  // 5. Unicode escape (\u0041, \u0020)
  if (/\\u[0-9a-fA-F]{4}/.test(text)) {
    return 'unicode';
  }

  // 6. JSON escape (\", \n, \r, \t)
  if (/\\n|\\r|\\t|\\"|\\\\'/.test(text)) {
    return 'json_escape';
  }

  // 7. Base64 standard (length >= 8, valid base64 chars, divisible by 4 or padded)
  if (/^[A-Za-z0-9+/=]{8,}$/.test(trimmed) && (trimmed.length % 4 === 0 || trimmed.includes('='))) {
    try {
      const decoded = atob(trimmed);
      if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) {
        return 'base64';
      }
    } catch {}
  }

  return 'url';
}

/**
 * Decode text using specified codec type
 */
export function decodeText(text: string, codec: CodecType): string {
  if (!text) return '';

  try {
    switch (codec) {
      case 'url': {
        // Replace + with space, then decodeURIComponent
        const plusReplaced = text.replace(/\+/g, ' ');
        try {
          return decodeURIComponent(plusReplaced);
        } catch {
          // If malformed URI sequence, fallback to safe regex decode
          return plusReplaced.replace(/%([0-9A-Fa-f]{2})/g, (_, p1) =>
            String.fromCharCode(parseInt(p1, 16))
          );
        }
      }

      case 'html': {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
      }

      case 'base64': {
        const clean = text.trim().replace(/-/g, '+').replace(/_/g, '/');
        const padded = clean.padEnd(clean.length + ((4 - (clean.length % 4)) % 4), '=');
        return atob(padded);
      }

      case 'hex': {
        const clean = text.replace(/\\x|0x|\s+/gi, '');
        let result = '';
        for (let i = 0; i < clean.length; i += 2) {
          const byte = parseInt(clean.substring(i, i + 2), 16);
          if (!isNaN(byte)) result += String.fromCharCode(byte);
        }
        return result || text;
      }

      case 'jwt': {
        const parts = text.trim().split('.');
        if (parts.length >= 2) {
          try {
            const headerStr = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
            const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            const parsedHeader = JSON.parse(headerStr);
            const parsedPayload = JSON.parse(payloadStr);
            return `// Header\n${JSON.stringify(parsedHeader, null, 2)}\n\n// Payload\n${JSON.stringify(parsedPayload, null, 2)}`;
          } catch {}
        }
        return text;
      }

      case 'json_escape': {
        try {
          return JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
        } catch {
          return text.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        }
      }

      case 'unicode': {
        return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16))
        );
      }

      default:
        return text;
    }
  } catch (err: any) {
    return text;
  }
}

/**
 * Encode text back using specified codec type (for roundtrip editing)
 */
export function encodeText(text: string, codec: CodecType): string {
  if (!text) return '';

  try {
    switch (codec) {
      case 'url':
        return encodeURIComponent(text).replace(/%20/g, '+');

      case 'html':
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      case 'base64':
        return btoa(text);

      case 'hex':
        return Array.from(text)
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('');

      case 'json_escape':
        return JSON.stringify(text).slice(1, -1);

      case 'unicode':
        return Array.from(text)
          .map((c) => {
            const code = c.charCodeAt(0);
            return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : c;
          })
          .join('');

      default:
        return text;
    }
  } catch {
    return text;
  }
}

/**
 * Universal Decoder format transformations matching Burp Suite Decoder Workbench
 */
export async function decodeBurpText(text: string, format: string): Promise<string> {
  switch (format) {
    case 'Plain':
      return text;
    case 'URL':
      try {
        return decodeURIComponent(text.replace(/\+/g, ' '));
      } catch {
        return text.replace(/%([0-9A-Fa-f]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        );
      }
    case 'HTML': {
      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
      }
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x20;/g, ' ');
    }
    case 'Base64': {
      const clean = text.trim().replace(/-/g, '+').replace(/_/g, '/');
      const padded = clean.padEnd(clean.length + ((4 - (clean.length % 4)) % 4), '=');
      return atob(padded);
    }
    case 'ASCII hex':
    case 'Hex': {
      const clean = text.replace(/[^0-9a-fA-F]/g, '');
      const bytes: number[] = [];
      for (let i = 0; i < clean.length; i += 2) {
        bytes.push(parseInt(clean.slice(i, i + 2), 16));
      }
      return new TextDecoder().decode(new Uint8Array(bytes));
    }
    default:
      return text;
  }
}

export async function encodeBurpText(text: string, format: string): Promise<string> {
  switch (format) {
    case 'Plain':
      return text;
    case 'URL':
      return encodeURIComponent(text);
    case 'HTML':
      return text.replace(/[&<>"']/g, (m) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m)
      );
    case 'Base64': {
      const utf8 = new TextEncoder().encode(text);
      let bin = '';
      for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i]);
      return btoa(bin);
    }
    case 'ASCII hex':
      return Array.from(new TextEncoder().encode(text))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
    case 'Hex':
      return Array.from(new TextEncoder().encode(text))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    default:
      return text;
  }
}
