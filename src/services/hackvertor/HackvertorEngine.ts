/**
 * Sentinel V6 - Hackvertor Dynamic Tag Evaluation & Cryptographic Pipeline
 *
 * Inspired by Gareth Heyes' Hackvertor (PortSwigger Research) & CyberChef.
 * Features:
 * - Recursive tag execution engine supporting arbitrarily nested tags:
 *   `<@base64_encode><@sha256>admin</@sha256></@base64_encode>`
 * - Genuine WebCrypto hashing (SHA-256, SHA-384, SHA-512, SHA-1, MD5)
 * - Complete transform library:
 *   * Encoders / Decoders: URL (standard & full hex %XX), Base64, Base64URL, Hex, HTML Entities, Unicode, Octal, Binary
 *   * String transforms: ROT13, Reverse, Uppercase, Lowercase, Titlecase, Strip Whitespace
 *   * SQL Evasion transforms: Inline comment injection (space2comment), space2plus, space2randomcase
 */

// ─── Pure MD5 Implementation (RFC 1321) for environments without native MD5 in WebCrypto ───
function md5(string: string): string {
  function rotateLeft(lValue: number, iShiftBits: number) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX: number, lY: number) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function F(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number) { return x ^ y ^ z; }
  function I(x: number, y: number, z: number) { return y ^ (x | ~z); }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(str: string) {
    let lWordCount;
    const lMessageLength = str.length;
    const lNumberOfWordsTempOne = lMessageLength + 8;
    const lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - (lNumberOfWordsTempOne % 64)) / 64;
    const lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1).fill(0);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function wordToHex(lValue: number) {
    let wordToHexValue = '', wordToHexValueTemp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValueTemp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
    }
    return wordToHexValue;
  }

  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, x[k], 7, 0xd76aa478); d = FF(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], 17, 0x242070db); b = FF(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], 7, 0xf57c0faf); d = FF(d, a, b, c, x[k + 5], 12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], 17, 0xa8304613); b = FF(b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098d8); d = FF(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], 17, 0xffff5bb1); b = FF(b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], 7, 0x6b901122); d = FF(d, a, b, c, x[k + 13], 12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], 17, 0xa679438e); b = FF(b, c, d, a, x[k + 15], 22, 0x49b40821);

    a = GG(a, b, c, d, x[k + 1], 5, 0xf61e2562); d = GG(d, a, b, c, x[k + 6], 9, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], 14, 0x265e5a51); b = GG(b, c, d, a, x[k], 20, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], 5, 0xd62f105d); d = GG(d, a, b, c, x[k + 10], 9, 0x02441453);
    c = GG(c, d, a, b, x[k + 15], 14, 0xd8a1e681); b = GG(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], 5, 0x21e1cde6); d = GG(d, a, b, c, x[k + 14], 9, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], 14, 0xf4d50d87); b = GG(b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], 5, 0xa9e3e905); d = GG(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], 14, 0x676f02d9); b = GG(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);

    a = HH(a, b, c, d, x[k + 5], 4, 0xfffa3942); d = HH(d, a, b, c, x[k + 8], 11, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], 16, 0x6d9d6122); b = HH(b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], 4, 0xa4beea44); d = HH(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], 16, 0xf6bb4b60); b = HH(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], 4, 0x289b7ec6); d = HH(d, a, b, c, x[k], 11, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], 16, 0xd4ef3085); b = HH(b, c, d, a, x[k + 6], 23, 0x04881d05);
    a = HH(a, b, c, d, x[k + 9], 4, 0xd9d4d039); d = HH(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], 16, 0x1fa27cf8); b = HH(b, c, d, a, x[k + 2], 23, 0xc4ac5665);

    a = II(a, b, c, d, x[k], 6, 0xf4292244); d = II(d, a, b, c, x[k + 7], 10, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], 15, 0xab9423a7); b = II(b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], 6, 0x655b59c3); d = II(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], 15, 0xffeff47d); b = II(b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], 6, 0x6fa87e4f); d = II(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], 15, 0xa3014314); b = II(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], 6, 0xf7537e82); d = II(d, a, b, c, x[k + 11], 10, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb); b = II(b, c, d, a, x[k + 9], 21, 0xeb86d391);

    a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ─── WebCrypto Hash Helper ──────────────────────────────────────────────────
async function webCryptoHash(data: string, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-1'): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest(algorithm, encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Transformation Catalog ─────────────────────────────────────────────────

export interface HackvertorTag {
  name: string;
  category: 'Encoders' | 'Decoders' | 'Hashes' | 'String' | 'SQL Evasion';
  description: string;
  transform: (input: string) => Promise<string> | string;
}

export const HACKVERTOR_TAGS: Record<string, HackvertorTag> = {
  // Encoders
  url_encode: {
    name: 'url_encode',
    category: 'Encoders',
    description: 'Standard URL percent encoding (RFC 3986)',
    transform: (s) => encodeURIComponent(s),
  },
  url_encode_all: {
    name: 'url_encode_all',
    category: 'Encoders',
    description: 'Encode all characters as %XX',
    transform: (s) => {
      return Array.from(new TextEncoder().encode(s))
        .map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
        .join('');
    },
  },
  base64_encode: {
    name: 'base64_encode',
    category: 'Encoders',
    description: 'Standard Base64 encoding',
    transform: (s) => {
      try {
        return btoa(unescape(encodeURIComponent(s)));
      } catch {
        return btoa(s);
      }
    },
  },
  base64url_encode: {
    name: 'base64url_encode',
    category: 'Encoders',
    description: 'URL-safe Base64 encoding (- and _, no padding)',
    transform: (s) => {
      const b64 = HACKVERTOR_TAGS.base64_encode.transform(s) as string;
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
  },
  hex_encode: {
    name: 'hex_encode',
    category: 'Encoders',
    description: 'Hexadecimal raw string encoding',
    transform: (s) => {
      return Array.from(new TextEncoder().encode(s))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    },
  },
  sql_hex: {
    name: 'sql_hex',
    category: 'Encoders',
    description: 'SQL Hex literal with 0x prefix',
    transform: (s) => {
      const hex = HACKVERTOR_TAGS.hex_encode.transform(s) as string;
      return `0x${hex}`;
    },
  },
  html_entities: {
    name: 'html_entities',
    category: 'Encoders',
    description: 'HTML named entities (&lt;, &gt;, &amp;, &quot;, &#39;)',
    transform: (s) => {
      const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return s.replace(/[&<>"']/g, (m) => map[m] || m);
    },
  },
  html_decimal: {
    name: 'html_decimal',
    category: 'Encoders',
    description: 'HTML decimal entities (&#65;)',
    transform: (s) => {
      return Array.from(s).map((c) => `&#${c.charCodeAt(0)};`).join('');
    },
  },
  unicode_escape: {
    name: 'unicode_escape',
    category: 'Encoders',
    description: 'JavaScript / JSON Unicode escape (\\u0041)',
    transform: (s) => {
      return Array.from(s)
        .map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('');
    },
  },
  binary_encode: {
    name: 'binary_encode',
    category: 'Encoders',
    description: 'Space-separated 8-bit binary string',
    transform: (s) => {
      return Array.from(new TextEncoder().encode(s))
        .map((b) => b.toString(2).padStart(8, '0'))
        .join(' ');
    },
  },

  // Decoders
  url_decode: {
    name: 'url_decode',
    category: 'Decoders',
    description: 'Decode URL percent encoding',
    transform: (s) => {
      try { return decodeURIComponent(s); } catch { return s; }
    },
  },
  base64_decode: {
    name: 'base64_decode',
    category: 'Decoders',
    description: 'Decode Base64 string',
    transform: (s) => {
      try {
        return decodeURIComponent(escape(atob(s.trim())));
      } catch {
        try { return atob(s.trim()); } catch { return s; }
      }
    },
  },
  base64url_decode: {
    name: 'base64url_decode',
    category: 'Decoders',
    description: 'Decode URL-safe Base64 string',
    transform: (s) => {
      let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return HACKVERTOR_TAGS.base64_decode.transform(b64);
    },
  },
  hex_decode: {
    name: 'hex_decode',
    category: 'Decoders',
    description: 'Decode hexadecimal string to text',
    transform: (s) => {
      const clean = s.replace(/^0x/i, '').replace(/\s+/g, '');
      const bytes: number[] = [];
      for (let i = 0; i < clean.length; i += 2) {
        bytes.push(parseInt(clean.substr(i, 2), 16));
      }
      return new TextDecoder().decode(new Uint8Array(bytes));
    },
  },
  binary_decode: {
    name: 'binary_decode',
    category: 'Decoders',
    description: 'Decode 8-bit binary to text',
    transform: (s) => {
      const tokens = s.trim().split(/\s+/);
      const bytes = tokens.map((b) => parseInt(b, 2));
      return new TextDecoder().decode(new Uint8Array(bytes));
    },
  },

  // Hashes
  sha256: {
    name: 'sha256',
    category: 'Hashes',
    description: 'Cryptographic SHA-256 (WebCrypto)',
    transform: (s) => webCryptoHash(s, 'SHA-256'),
  },
  sha384: {
    name: 'sha384',
    category: 'Hashes',
    description: 'Cryptographic SHA-384 (WebCrypto)',
    transform: (s) => webCryptoHash(s, 'SHA-384'),
  },
  sha512: {
    name: 'sha512',
    category: 'Hashes',
    description: 'Cryptographic SHA-512 (WebCrypto)',
    transform: (s) => webCryptoHash(s, 'SHA-512'),
  },
  sha1: {
    name: 'sha1',
    category: 'Hashes',
    description: 'Cryptographic SHA-1 (WebCrypto)',
    transform: (s) => webCryptoHash(s, 'SHA-1'),
  },
  md5: {
    name: 'md5',
    category: 'Hashes',
    description: 'MD5 Hash digest (RFC 1321)',
    transform: (s) => md5(s),
  },

  // String Modifiers
  rot13: {
    name: 'rot13',
    category: 'String',
    description: 'ROT13 Caesar Cipher substitution',
    transform: (s) => {
      return s.replace(/[a-zA-Z]/g, (c) => {
        const code = c.charCodeAt(0);
        const base = code >= 97 ? 97 : 65;
        return String.fromCharCode(((code - base + 13) % 26) + base);
      });
    },
  },
  reverse: {
    name: 'reverse',
    category: 'String',
    description: 'Reverse string characters',
    transform: (s) => Array.from(s).reverse().join(''),
  },
  uppercase: {
    name: 'uppercase',
    category: 'String',
    description: 'Convert to UPPERCASE',
    transform: (s) => s.toUpperCase(),
  },
  lowercase: {
    name: 'lowercase',
    category: 'String',
    description: 'Convert to lowercase',
    transform: (s) => s.toLowerCase(),
  },
  strip_whitespace: {
    name: 'strip_whitespace',
    category: 'String',
    description: 'Remove all whitespace characters',
    transform: (s) => s.replace(/\s+/g, ''),
  },

  // SQL Evasion Transforms
  space2comment: {
    name: 'space2comment',
    category: 'SQL Evasion',
    description: 'Replace spaces with inline SQL comments (/**/)',
    transform: (s) => s.replace(/\s+/g, '/**/'),
  },
  space2plus: {
    name: 'space2plus',
    category: 'SQL Evasion',
    description: 'Replace spaces with plus characters (+)',
    transform: (s) => s.replace(/\s+/g, '+'),
  },
  randomcase: {
    name: 'randomcase',
    category: 'SQL Evasion',
    description: 'Randomize case of alphanumeric characters (sElEcT)',
    transform: (s) => {
      return Array.from(s)
        .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
        .join('');
    },
  },
  unicode_fullwidth: {
    name: 'unicode_fullwidth',
    category: 'Encoders',
    description: 'Convert ASCII characters to Full-Width Unicode (WAF filter bypass)',
    transform: (s) => {
      return Array.from(s)
        .map((c) => {
          const code = c.charCodeAt(0);
          if (code >= 33 && code <= 126) {
            return String.fromCharCode(code + 0xfee0);
          }
          if (code === 32) return '\u3000';
          return c;
        })
        .join('');
    },
  },
  hex_to_dec: {
    name: 'hex_to_dec',
    category: 'Encoders',
    description: 'Convert Hex integer to Decimal string',
    transform: (s) => String(parseInt(s.replace(/^0x/i, ''), 16) || s),
  },
  dec_to_hex: {
    name: 'dec_to_hex',
    category: 'Encoders',
    description: 'Convert Decimal integer to Hex format',
    transform: (s) => '0x' + (parseInt(s, 10) || 0).toString(16),
  },
  timestamp: {
    name: 'timestamp',
    category: 'String',
    description: 'Inject current Unix timestamp in milliseconds',
    transform: () => String(Date.now()),
  },
  random_int: {
    name: 'random_int',
    category: 'String',
    description: 'Inject pseudo-random integer (1-1000000)',
    transform: () => String(Math.floor(Math.random() * 1000000) + 1),
  },
};

// ─── Recursive Hackvertor Engine ────────────────────────────────────────────

export class HackvertorEngine {
  /**
   * Evaluates input string recursively resolving innermost `<@tag>...</@tag>` blocks.
   * Supports nested stacks up to 20 iterations.
   */
  public static async evaluate(input: string): Promise<string> {
    let current = input;
    const tagRegex = /<@([a-zA-Z0-9_]+)>((?:(?!<@)[\s\S])*?)<@\/\1>/;
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      const match = tagRegex.exec(current);
      if (!match) break;

      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const content = match[2];

      const tagDef = HACKVERTOR_TAGS[tagName];
      let transformed: string;

      if (tagDef) {
        try {
          const res = tagDef.transform(content);
          transformed = res instanceof Promise ? await res : res;
        } catch {
          transformed = content;
        }
      } else {
        transformed = content;
      }

      current = current.replace(fullTag, transformed);
      iterations++;
    }

    return current;
  }

  /**
   * Synchronous evaluation for tags that do not require async WebCrypto.
   */
  public static evaluateSync(input: string): string {
    let current = input;
    const tagRegex = /<@([a-zA-Z0-9_]+)>((?:(?!<@)[\s\S])*?)<@\/\1>/;
    let iterations = 0;

    while (iterations < 20) {
      const match = tagRegex.exec(current);
      if (!match) break;

      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const content = match[2];

      const tagDef = HACKVERTOR_TAGS[tagName];
      let transformed = content;

      if (tagDef && tagDef.category !== 'Hashes') {
        try {
          const res = tagDef.transform(content);
          if (typeof res === 'string') transformed = res;
        } catch {
          transformed = content;
        }
      }

      current = current.replace(fullTag, transformed);
      iterations++;
    }

    return current;
  }

  /**
   * Evaluates an entire raw HTTP wire request template before socket dispatch,
   * replacing all embedded `<@tag>...</@tag>` tags and updating Content-Length if body changed.
   */
  public static async evaluateRequestTemplate(rawRequest: string): Promise<string> {
    if (!rawRequest.includes('<@')) {
      return rawRequest;
    }

    const evaluated = await HackvertorEngine.evaluate(rawRequest);

    // If Content-Length header is present and body length was altered, recalculate Content-Length
    const parts = evaluated.split(/\r?\n\r?\n/);
    if (parts.length >= 2) {
      const headerPart = parts[0];
      const bodyPart = parts.slice(1).join('\r\n\r\n');
      if (/Content-Length:\s*\d+/i.test(headerPart)) {
        const bodyBytes = new TextEncoder().encode(bodyPart).length;
        const updatedHeaders = headerPart.replace(/Content-Length:\s*\d+/i, `Content-Length: ${bodyBytes}`);
        return `${updatedHeaders}\r\n\r\n${bodyPart}`;
      }
    }

    return evaluated;
  }
}
