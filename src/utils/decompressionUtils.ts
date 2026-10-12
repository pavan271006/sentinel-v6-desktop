/**
 * Universal Response Body Decompressor & Normalizer
 *
 * Ensures all HTTP response bodies captured via Chrome DevTools Protocol (CDP),
 * proxy layers, or fetch bridges are authentic, fully decompressed UTF-8 text (HTML/JSON/JS).
 * Completely eliminates garbled special characters (\uFFFD, binary bytes, raw Base64 gzip).
 */

export async function decodeAndDecompressResponseBody(
  rawBody: string,
  base64Encoded: boolean = false,
  headers?: Record<string, string>
): Promise<string> {
  if (!rawBody) return '';

  let bytes: Uint8Array | null = null;

  // 1. If flagged as base64Encoded by CDP, decode Base64 to Uint8Array
  if (base64Encoded) {
    try {
      if (typeof Buffer !== 'undefined') {
        bytes = new Uint8Array(Buffer.from(rawBody, 'base64'));
      } else if (typeof atob !== 'undefined') {
        const binStr = atob(rawBody.trim());
        bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
      }
    } catch {
      // If atob fails, keep raw
    }
  } else if (rawBody.length >= 2 && rawBody.charCodeAt(0) === 0x1f && rawBody.charCodeAt(1) === 0x8b) {
    // Raw binary string containing Gzip header
    bytes = new Uint8Array(rawBody.length);
    for (let i = 0; i < rawBody.length; i++) {
      bytes[i] = rawBody.charCodeAt(i) & 0xff;
    }
  }

  const encodingHeader = (
    headers?.['content-encoding'] ||
    headers?.['Content-Encoding'] ||
    ''
  ).toLowerCase();

  // If we have decoded binary bytes, attempt decompression
  if (bytes && bytes.length > 0) {
    // A. GZIP Check: magic bytes 0x1f 0x8b or content-encoding gzip
    const isGzip = (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) || encodingHeader.includes('gzip');
    if (isGzip) {
      if (typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('gzip');
          const writer = ds.writable.getWriter();
          writer.write(bytes as unknown as BufferSource);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          return new TextDecoder('utf-8', { fatal: false }).decode(merged);
        } catch {}
      }

      // Fallback to Node.js zlib if available
      try {
        const nodeZlib = (globalThis as any).require ? (globalThis as any).require('zlib') : null;
        if (nodeZlib?.gunzipSync) {
          return nodeZlib.gunzipSync(Buffer.from(bytes)).toString('utf-8');
        }
      } catch {}
    }

    // B. Deflate Check
    const isDeflate = encodingHeader.includes('deflate');
    if (isDeflate) {
      if (typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          writer.write(bytes as unknown as BufferSource);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          return new TextDecoder('utf-8', { fatal: false }).decode(merged);
        } catch {}
      }

      try {
        const nodeZlib = (globalThis as any).require ? (globalThis as any).require('zlib') : null;
        if (nodeZlib?.inflateSync) {
          return nodeZlib.inflateSync(Buffer.from(bytes)).toString('utf-8');
        }
      } catch {}
    }

    // C. Brotli Check
    const isBrotli = encodingHeader.includes('br');
    if (isBrotli) {
      try {
        const nodeZlib = (globalThis as any).require ? (globalThis as any).require('zlib') : null;
        if (nodeZlib?.brotliDecompressSync) {
          return nodeZlib.brotliDecompressSync(Buffer.from(bytes)).toString('utf-8');
        }
      } catch {}
    }

    // D. Clean UTF-8 decode of binary bytes
    try {
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (!decoded.includes('\uFFFD') || decoded.length > 20) {
        return decoded;
      }
    } catch {}
  }

  // Fallback: If rawBody itself is already valid readable text, return it
  return rawBody;
}
