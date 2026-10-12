import { HttpMethod, HttpProtocol, HeaderRowItem, QueryParamItem } from '../types/repeater';
import { HttpHeaderItem } from '../types/traffic';

/**
 * Robust UUIDv4 generator without external dependencies.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const uuidv4 = generateUuid;

/**
 * Parses raw HTTP request text compliant with RFC 9112.
 */
export function parseRawHttpRequest(raw: string): {
  method: HttpMethod;
  path: string;
  protocol: HttpProtocol;
  headers: HeaderRowItem[];
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, '\n');
  const doubleNewlineIdx = normalized.indexOf('\n\n');
  let headPart = normalized;
  let bodyPart = '';

  if (doubleNewlineIdx !== -1) {
    headPart = normalized.substring(0, doubleNewlineIdx);
    bodyPart = normalized.substring(doubleNewlineIdx + 2);
  }

  const lines = headPart.split('\n');
  const requestLine = lines[0]?.trim() || 'GET / HTTP/1.1';
  const parts = requestLine.split(/\s+/);

  const methodCandidate = (parts[0] || 'GET').toUpperCase();
  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];
  const method: HttpMethod = validMethods.includes(methodCandidate as HttpMethod)
    ? (methodCandidate as HttpMethod)
    : 'GET';

  const path = parts[1] || '/';
  const protocolCandidate = parts[2]?.toUpperCase();
  const protocol: HttpProtocol = protocolCandidate === 'HTTP/2' || protocolCandidate === 'HTTP/2.0' ? 'HTTP/2' : 'HTTP/1.1';

  const headers: HeaderRowItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      headers.push({
        id: generateUuid(),
        name: line.substring(0, colonIdx).trim(),
        value: line.substring(colonIdx + 1).trim(),
        enabled: true,
      });
    }
  }

  return {
    method,
    path,
    protocol,
    headers,
    body: bodyPart,
  };
}

/**
 * Serializes request components to raw RFC 9112 HTTP text.
 */
export function serializeHttpRequest(
  method: HttpMethod,
  pathOrUrl: string,
  protocol: HttpProtocol,
  headers: HeaderRowItem[],
  body: string
): string {
  let path = pathOrUrl;
  try {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const u = new URL(pathOrUrl);
      path = (u.pathname || '/') + (u.search || '');
    }
  } catch {}

  if (!path.startsWith('/') && !path.startsWith('http')) {
    path = '/' + path;
  }

  const activeHeaders = headers.filter((h) => h.enabled && h.name.trim().length > 0);
  const headerLines = activeHeaders.map((h) => `${h.name.trim()}: ${h.value}`).join('\r\n');

  if (headerLines.length > 0) {
    return `${method} ${path} ${protocol}\r\n${headerLines}\r\n\r\n${body}`;
  }
  return `${method} ${path} ${protocol}\r\n\r\n${body}`;
}

/**
 * Parses raw HTTP response text into status, headers, and body.
 */
export function parseRawHttpResponse(raw: string): {
  statusCode: number;
  statusText: string;
  protocol: string;
  headers: HttpHeaderItem[];
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, '\n');
  const doubleNewlineIdx = normalized.indexOf('\n\n');
  let headPart = normalized;
  let bodyPart = '';

  if (doubleNewlineIdx !== -1) {
    headPart = normalized.substring(0, doubleNewlineIdx);
    bodyPart = normalized.substring(doubleNewlineIdx + 2);
  }

  const lines = headPart.split('\n');
  const statusLine = lines[0]?.trim() || 'HTTP/1.1 200 OK';
  const match = statusLine.match(/^(\S+)\s+(\d{3})(?:\s+(.*))?$/);

  const protocol = match ? match[1] : 'HTTP/1.1';
  const statusCode = match ? parseInt(match[2], 10) : 200;
  const statusText = match && match[3] ? match[3].trim() : 'OK';

  const headers: HttpHeaderItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      headers.push({
        name: line.substring(0, colonIdx).trim(),
        value: line.substring(colonIdx + 1).trim(),
      });
    }
  }

  return {
    statusCode,
    statusText,
    protocol,
    headers,
    body: bodyPart,
  };
}

/**
 * Computes UTF-8 byte length of a string.
 */
export function getUtf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Updates or appends Content-Length header to match body byte length.
 */
export function updateContentLengthHeader(headers: HeaderRowItem[], body: string): HeaderRowItem[] {
  const byteLen = getUtf8ByteLength(body);
  const next = [...headers];
  const existingIdx = next.findIndex((h) => h.name.toLowerCase() === 'content-length');

  if (existingIdx !== -1) {
    next[existingIdx] = {
      ...next[existingIdx],
      value: byteLen.toString(),
    };
  } else if (body.length > 0) {
    next.push({
      id: generateUuid(),
      name: 'Content-Length',
      value: byteLen.toString(),
      enabled: true,
    });
  }

  return next;
}

/**
 * Extracts query parameters from URL string into structured array.
 */
export function extractQueryParamsFromUrl(urlStr: string): QueryParamItem[] {
  try {
    const queryIdx = urlStr.indexOf('?');
    if (queryIdx === -1) return [];

    const search = urlStr.substring(queryIdx + 1);
    const searchParams = new URLSearchParams(search);
    const result: QueryParamItem[] = [];

    searchParams.forEach((value, key) => {
      result.push({
        id: generateUuid(),
        key,
        value,
        enabled: true,
      });
    });

    return result;
  } catch {
    return [];
  }
}

/**
 * Reconstructs URL string with updated query parameters.
 */
export function updateUrlQueryParams(urlStr: string, params: QueryParamItem[]): string {
  try {
    const queryIdx = urlStr.indexOf('?');
    const baseUrl = queryIdx !== -1 ? urlStr.substring(0, queryIdx) : urlStr;

    const activeParams = params.filter((p) => p.enabled && p.key.trim().length > 0);
    if (activeParams.length === 0) return baseUrl;

    const sp = new URLSearchParams();
    activeParams.forEach((p) => {
      sp.append(p.key.trim(), p.value);
    });

    const queryString = sp.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  } catch {
    return urlStr;
  }
}

/**
 * Interpolates custom variables and built-in dynamic generators.
 * Supported built-ins: {{$uuid}}, {{$timestamp}}, {{$random_int}}, {{$random_str}}, {{$iso_date}}
 */
export function interpolateVariables(template: string, vars: Record<string, string>): string {
  if (!template) return '';

  return template.replace(/\{\{([a-zA-Z0-9_\$]+)\}\}/g, (match, varName) => {
    if (varName === '$uuid') return generateUuid();
    if (varName === '$timestamp') return Math.floor(Date.now() / 1000).toString();
    if (varName === '$random_int') return Math.floor(1000 + Math.random() * 9000).toString();
    if (varName === '$random_str') return Math.random().toString(36).substring(2, 8);
    if (varName === '$iso_date') return new Date().toISOString();

    if (vars[varName] !== undefined) {
      return vars[varName];
    }
    return match;
  });
}

/**
 * Scans text and returns list of variable keys used (e.g. ['host', '$uuid', 'token']).
 */
export function findUsedVariables(text: string): string[] {
  if (!text) return [];
  const regex = /\{\{([a-zA-Z0-9_\$]+)\}\}/g;
  const matches = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) {
      matches.add(m[1]);
    }
  }
  return Array.from(matches);
}

/**
 * Navigates a JSON string with dot notation and array index paths (e.g. "auth.token", "items[0].id", "users.0.name").
 */
export function extractJsonPath(jsonText: string, path: string): string | null {
  try {
    const obj = JSON.parse(jsonText);
    if (!path || !path.trim()) {
      return typeof obj === 'string' ? obj : JSON.stringify(obj);
    }

    const cleanPath = path.trim().replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
    const segments = cleanPath.split('.');

    let current: any = obj;
    for (const segment of segments) {
      if (current === null || current === undefined) return null;
      current = current[segment];
    }

    if (current === undefined || current === null) return null;
    return typeof current === 'object' ? JSON.stringify(current) : String(current);
  } catch {
    return null;
  }
}

/**
 * Extracts a header value from header array or raw header block, optionally running a regex capture group.
 */
export function extractHeaderValue(
  headers: HttpHeaderItem[] | string,
  headerName: string,
  regexPattern?: string
): string | null {
  let targetVal: string | null = null;

  if (Array.isArray(headers)) {
    const found = headers.find((h) => h.name.toLowerCase() === headerName.toLowerCase());
    if (found) {
      targetVal = found.value;
    }
  } else if (typeof headers === 'string') {
    const lines = headers.split(/\r?\n/);
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const name = line.substring(0, colonIdx).trim();
        if (name.toLowerCase() === headerName.toLowerCase()) {
          targetVal = line.substring(colonIdx + 1).trim();
          break;
        }
      }
    }
  }

  if (targetVal === null) return null;

  if (regexPattern && regexPattern.trim()) {
    try {
      const re = new RegExp(regexPattern);
      const match = targetVal.match(re);
      if (match) {
        return match[1] !== undefined ? match[1] : match[0];
      }
      return null;
    } catch {
      return targetVal;
    }
  }

  return targetVal;
}

/**
 * Command Export Generators: cURL, Python requests, JavaScript fetch, PowerShell
 */

export function generateCurlCommand(
  method: string,
  url: string,
  headers: Array<{ name: string; value: string }>,
  body?: string
): string {
  let curl = `curl -i -s -k -X ${method} '${url}'`;
  for (const h of headers) {
    if (h.name.trim()) {
      curl += ` \\\n  -H '${h.name.replace(/'/g, "'\\''")}: ${h.value.replace(/'/g, "'\\''")}'`;
    }
  }
  if (body && body.length > 0) {
    curl += ` \\\n  --data-raw '${body.replace(/'/g, "'\\''")}'`;
  }
  return curl;
}

export function generatePythonScript(
  method: string,
  url: string,
  headers: Array<{ name: string; value: string }>,
  body?: string
): string {
  let py = 'import requests\n\n';
  py += `url = "${url}"\n`;
  py += 'headers = {\n';
  for (const h of headers) {
    if (h.name.trim()) {
      py += `    "${h.name.replace(/"/g, '\\"')}": "${h.value.replace(/"/g, '\\"')}",\n`;
    }
  }
  py += '}\n';

  if (body && body.length > 0) {
    py += `data = """${body}"""\n\n`;
    py += `response = requests.request("${method}", url, headers=headers, data=data, verify=False)\n`;
  } else {
    py += `\nresponse = requests.request("${method}", url, headers=headers, verify=False)\n`;
  }

  py += 'print(f"Status: {response.status_code}")\n';
  py += 'print(response.text)\n';
  return py;
}

export function generateJavaScriptFetch(
  method: string,
  url: string,
  headers: Array<{ name: string; value: string }>,
  body?: string
): string {
  let js = `const response = await fetch("${url}", {\n`;
  js += `  method: "${method}",\n`;
  js += '  headers: {\n';
  for (const h of headers) {
    if (h.name.trim()) {
      js += `    "${h.name.replace(/"/g, '\\"')}": "${h.value.replace(/"/g, '\\"')}",\n`;
    }
  }
  js += '  },\n';

  if (body && body.length > 0) {
    let bodyFormatted = JSON.stringify(body);
    try {
      JSON.parse(body);
      bodyFormatted = `JSON.stringify(${body.trim()})`;
    } catch {}
    js += `  body: ${bodyFormatted},\n`;
  }

  js += '});\n\n';
  js += 'const data = await response.text();\n';
  js += 'console.log(`Status: ${response.status}`, data);\n';
  return js;
}

export function generatePowerShellCommand(
  method: string,
  url: string,
  headers: Array<{ name: string; value: string }>,
  body?: string
): string {
  let ps = `$uri = "${url}"\n`;
  ps += '$headers = @{\n';
  for (const h of headers) {
    if (h.name.trim()) {
      ps += `    "${h.name.replace(/"/g, '`"')}" = "${h.value.replace(/"/g, '`"')}"\n`;
    }
  }
  ps += '}\n';

  if (body && body.length > 0) {
    ps += `$body = @'\n${body}\n'@\n\n`;
    ps += `Invoke-RestMethod -Uri $uri -Method ${method} -Headers $headers -Body $body\n`;
  } else {
    ps += `\nInvoke-RestMethod -Uri $uri -Method ${method} -Headers $headers\n`;
  }

  return ps;
}

export function decodeChunkedTransferEncoding(rawBody: string): string {
  if (!rawBody || !rawBody.includes('\n')) return rawBody;

  const chunkRegex = /^([0-9a-fA-F]{1,8})\r?\n/m;
  if (!chunkRegex.test(rawBody.trim())) {
    return rawBody;
  }

  let text = rawBody.trim();
  let decoded = '';
  let cursor = 0;

  while (cursor < text.length) {
    const slice = text.substring(cursor);
    const nlIdx = slice.indexOf('\n');
    if (nlIdx === -1) break;

    const line = slice.substring(0, nlIdx).trim();
    const chunkSize = parseInt(line, 16);

    if (isNaN(chunkSize)) {
      if (decoded.length > 0) return decoded;
      return rawBody;
    }

    if (chunkSize === 0) {
      break;
    }

    const dataStart = cursor + nlIdx + 1;
    const chunkData = text.substring(dataStart, dataStart + chunkSize);
    decoded += chunkData;

    cursor = dataStart + chunkSize;
    if (text.substring(cursor, cursor + 2) === '\r\n') {
      cursor += 2;
    } else if (text[cursor] === '\n') {
      cursor += 1;
    }
  }

  return decoded.length > 0 ? decoded : rawBody;
}

function cleanHttpBody(bodyText: string): string {
  let text = decodeChunkedTransferEncoding(bodyText || '').trim();
  const chunkMatch = text.match(/^[0-9a-fA-F]+\r?\n([\s\S]*?)(?:\r?\n0(?:\r?\n)?)?$/);
  if (chunkMatch && chunkMatch[1]) {
    text = chunkMatch[1].trim();
  }
  return text;
}

const SCROLLBAR_DARK_CSS = `
  html, body {
    color-scheme: dark !important;
  }
  * {
    scrollbar-width: thin !important;
    scrollbar-color: #3e4249 #141517 !important;
  }
  ::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
  }
  ::-webkit-scrollbar-track {
    background: #141517 !important;
  }
  ::-webkit-scrollbar-thumb {
    background: #3e4249 !important;
    border-radius: 4px !important;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #525866 !important;
  }
  ::-webkit-scrollbar-corner {
    background: #141517 !important;
  }
`;

export function generateRenderablePreviewHtml(
  bodyOrRawResponse: string,
  searchQuery?: string,
  urlOrHost?: string
): string {
  let fullRaw = (bodyOrRawResponse || '').trim();
  let rawContent = fullRaw;
  let statusCode = 200;
  let statusText = 'OK';
  let contentType = '';
  let locationHeader = '';
  const headersMap: Record<string, string> = {};

  // If a full HTTP response with status line & headers was passed, parse metadata & extract the body
  if (rawContent.startsWith('HTTP/') || rawContent.includes('\r\n\r\n') || rawContent.includes('\n\n')) {
    const doubleNl = rawContent.indexOf('\r\n\r\n');
    let headPart = '';
    if (doubleNl !== -1) {
      headPart = rawContent.substring(0, doubleNl);
      rawContent = rawContent.substring(doubleNl + 4).trim();
    } else {
      const singleNl = rawContent.indexOf('\n\n');
      if (singleNl !== -1) {
        headPart = rawContent.substring(0, singleNl);
        rawContent = rawContent.substring(singleNl + 2).trim();
      } else if (rawContent.startsWith('HTTP/')) {
        headPart = rawContent;
        rawContent = '';
      }
    }

    if (headPart) {
      const lines = headPart.split(/\r?\n/);
      const statusLineMatch = lines[0].match(/HTTP\/[\d.]+\s+(\d+)(?:\s+(.*))?/i);
      if (statusLineMatch) {
        statusCode = parseInt(statusLineMatch[1], 10);
        statusText = (statusLineMatch[2] || 'OK').trim();
      }
      for (let i = 1; i < lines.length; i++) {
        const colonIdx = lines[i].indexOf(':');
        if (colonIdx !== -1) {
          const k = lines[i].substring(0, colonIdx).trim().toLowerCase();
          const v = lines[i].substring(colonIdx + 1).trim();
          headersMap[k] = v;
          if (k === 'content-type') contentType = v.toLowerCase();
          if (k === 'location') locationHeader = v;
        }
      }
    }
  }

  const trimmed = cleanHttpBody(rawContent);

  // 1. Unrequested / Discovered Link Placeholders: render interactive on-demand request card
  const isUnrequested =
    statusCode === 0 ||
    trimmed.includes('Unrequested') ||
    trimmed.includes('Not requested yet') ||
    trimmed.includes('Discovered via');

  if (isUnrequested) {
    const targetUrlDisplay = urlOrHost || 'Target Endpoint';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${SCROLLBAR_DARK_CSS}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1117; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { max-width: 580px; width: 100%; background: #181c27; border: 1px solid #2a3142; border-radius: 12px; padding: 32px 28px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; background: rgba(243, 112, 33, 0.15); color: #f37021; border: 1px solid rgba(243, 112, 33, 0.3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
    h2 { font-size: 18px; margin: 0 0 8px; color: #ffffff; font-weight: 700; }
    p { font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 0 0 18px; }
    .url-box { background: #0b0d13; border: 1px solid #222838; border-radius: 8px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #38bdf8; word-break: break-all; margin-bottom: 22px; text-align: left; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #f37021, #e05e0f); color: #ffffff; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; transition: transform 0.1s, box-shadow 0.2s; box-shadow: 0 4px 14px rgba(243, 112, 33, 0.4); }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(243, 112, 33, 0.6); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">⚡ Discovered Endpoint</div>
    <h2>Live Request Available</h2>
    <p>This endpoint was identified during automated crawler reconnaissance. Click below to execute an immediate live request upstream and render the server's response:</p>
    <div class="url-box">${targetUrlDisplay}</div>
    <button class="btn" onclick="window.parent.postMessage({ type: 'SENTINEL_IFRAME_FETCH', url: ${JSON.stringify(urlOrHost || '')} }, '*')">
      ⚡ Request Item &amp; Render Page
    </button>
  </div>
</body>
</html>`;
  }

  // 2. HTTP Redirects (301, 302, 303, 307, 308)
  const isRedirect = (statusCode >= 300 && statusCode < 400) || (locationHeader.length > 0) || /Redirecting to/i.test(trimmed);
  if (isRedirect && (trimmed.length < 500 || !trimmed.includes('<body'))) {
    const dest = locationHeader || (trimmed.match(/href=["']([^"']+)["']/i)?.[1] || trimmed.match(/https?:\/\/[^\s<]+/)?.[0] || 'Destination');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${SCROLLBAR_DARK_CSS}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b111e; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { max-width: 560px; width: 100%; background: #111a2e; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
    .icon { font-size: 32px; margin-bottom: 12px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; font-weight: 700; margin-bottom: 10px; }
    h2 { font-size: 18px; margin: 0 0 8px; color: #ffffff; font-weight: 700; }
    p { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0 0 18px; }
    .url-box { background: #0d1524; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #7dd3fc; word-break: break-all; margin-bottom: 22px; text-align: left; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: #0284c7; color: #ffffff; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); }
    .btn:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔀</div>
    <div class="badge">HTTP ${statusCode} ${statusText}</div>
    <h2>Server Redirect Response</h2>
    <p>The upstream server redirected this request to a new location:</p>
    <div class="url-box">${dest}</div>
    <button class="btn" onclick="window.parent.postMessage({ type: 'SENTINEL_IFRAME_NAVIGATE', url: ${JSON.stringify(dest)} }, '*')">
      Follow Redirect ➔
    </button>
  </div>
</body>
</html>`;
  }

  // 3. Images / SVG / Media Assets
  const isImageMime = contentType.startsWith('image/');
  const isImageUrl = /\.(png|jpe?g|gif|webp|avif|ico|svg)(\?|$)/i.test(urlOrHost || '');
  if ((isImageMime || isImageUrl) && !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
    let imgSrc = '';
    if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) {
      imgSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(trimmed);
    } else if (trimmed.startsWith('data:image/')) {
      imgSrc = trimmed;
    } else if (urlOrHost) {
      imgSrc = urlOrHost.startsWith('http') ? urlOrHost : `https://${urlOrHost}`;
    }

    if (imgSrc) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0; padding: 20px; box-sizing: border-box; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background-color: #12141a;
      background-image: linear-gradient(45deg, #181b24 25%, transparent 25%), linear-gradient(-45deg, #181b24 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181b24 75%), linear-gradient(-45deg, transparent 75%, #181b24 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .img-card {
      background: #1e222d; border: 1px solid #2e3445; border-radius: 12px; padding: 20px;
      display: flex; flex-direction: column; align-items: center; box-shadow: 0 12px 30px rgba(0,0,0,0.5);
      max-width: 90%;
    }
    img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 6px; }
    .meta { margin-top: 14px; font-size: 11px; color: #94a3b8; font-family: monospace; display: flex; gap: 12px; }
    .badge { background: #0284c720; color: #38bdf8; border: 1px solid #0284c740; padding: 2px 8px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="img-card">
    <img src="${imgSrc}" alt="Rendered Response" />
    <div class="meta">
      <span class="badge">${contentType || 'image'}</span>
      <span>${urlOrHost ? new URL(urlOrHost.startsWith('http') ? urlOrHost : 'https://' + urlOrHost).pathname.split('/').pop() : 'Image Asset'}</span>
    </div>
  </div>
</body>
</html>`;
    }
  }

  // 4. JSON REST API Response
  const isJson =
    contentType.includes('json') ||
    ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')));

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      const prettyJson = JSON.stringify(parsed, null, 2);
      const highlighted = prettyJson
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
          let cls = 'number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'key';
            } else {
              cls = 'string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'boolean';
          } else if (/null/.test(match)) {
            cls = 'null';
          }
          return `<span class="${cls}">${match}</span>`;
        });

      const itemCount = Array.isArray(parsed) ? `${parsed.length} items` : `${Object.keys(parsed).length} keys`;
      const sizeFormatted = `${trimmed.length.toLocaleString()} bytes`;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${SCROLLBAR_DARK_CSS}
    body {
      background-color: #141517; color: #dfdfdf;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px; line-height: 1.6; margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh;
    }
    .topbar {
      background: #1e1f22; border-bottom: 1px solid #2b2d30; padding: 8px 16px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .badge {
      display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #10b981;
      background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 3px 10px; border-radius: 6px; font-size: 11px;
    }
    .info { font-size: 11px; color: #8c9099; display: flex; gap: 14px; align-items: center; }
    .copy-btn {
      background: #2b2d30; color: #e2e8f0; border: 1px solid #3e4249; border-radius: 4px;
      padding: 3px 10px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s;
    }
    .copy-btn:hover { background: #35383f; color: #ffffff; border-color: #525866; }
    .content { flex: 1; overflow: auto; padding: 16px; box-sizing: border-box; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
    .key { color: #e5c07b; }
    .string { color: #98c379; }
    .number { color: #61afef; }
    .boolean { color: #d19a66; font-weight: bold; }
    .null { color: #e06c75; font-weight: bold; }
  </style>
</head>
<body>
  <div class="topbar">
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="badge">{ } JSON API Response (${statusCode} ${statusText})</span>
      <span class="info"><span>${itemCount}</span> • <span>${sizeFormatted}</span></span>
    </div>
    <button class="copy-btn" id="copyBtn" onclick="copyJson()">📋 Copy JSON</button>
  </div>
  <div class="content">
    <pre id="jsonPre">${highlighted}</pre>
  </div>
  <script>
    const rawJson = ${JSON.stringify(prettyJson)};
    function copyJson() {
      navigator.clipboard.writeText(rawJson).then(function() {
        var btn = document.getElementById('copyBtn');
        btn.textContent = '✓ Copied!';
        btn.style.color = '#10b981';
        setTimeout(function() {
          btn.textContent = '📋 Copy JSON';
          btn.style.color = '';
        }, 1500);
      });
    }
  </script>
</body>
</html>`;
    } catch {}
  }

  // 5. Header-Only / Empty Response Bodies (e.g. 204 No Content, 304 Not Modified)
  if (!trimmed || trimmed.length === 0) {
    const headerRows = Object.entries(headersMap)
      .map(([k, v]) => `<tr><td style="color:#94a3b8;padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600;width:35%;">${k}</td><td style="color:#e2e8f0;padding:6px 12px;border-bottom:1px solid #1e293b;word-break:break-all;">${v}</td></tr>`)
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${SCROLLBAR_DARK_CSS}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1117; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { max-width: 620px; width: 100%; background: #181c27; border: 1px solid #2a3142; border-radius: 12px; padding: 26px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; font-weight: 700; margin-bottom: 12px; }
    h2 { font-size: 16px; margin: 0 0 6px; color: #ffffff; font-weight: 700; }
    p { font-size: 12px; color: #94a3b8; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; background: #0b0d13; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">HTTP ${statusCode} ${statusText}</div>
    <h2>Header-Only Server Response</h2>
    <p>The server responded successfully with standard HTTP response headers (0-byte payload body):</p>
    ${headerRows ? `<table>${headerRows}</table>` : `<div style="font-family:monospace;font-size:11px;color:#64748b;">(No response headers captured)</div>`}
  </div>
</body>
</html>`;
  }

  // 6. Real Captured HTML Documents or Interactive Fragments
  const isHtml =
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<svg') ||
    trimmed.includes('<html') ||
    trimmed.includes('<!DOCTYPE') ||
    trimmed.includes('<head') ||
    trimmed.includes('<body') ||
    trimmed.includes('</title>') ||
    trimmed.includes('</form>') ||
    trimmed.includes('</div>') ||
    trimmed.includes('</span>') ||
    trimmed.includes('</p>') ||
    trimmed.includes('</table>') ||
    trimmed.includes('</section>') ||
    trimmed.includes('</main>') ||
    trimmed.includes('</nav>') ||
    /<(div|form|table|p|h[1-6]|span|input|select|textarea|button|section|main|article|header|footer|nav|ul|ol|li)\b[^>]*>/i.test(trimmed);

  let htmlResult = '';

  if (isHtml) {
    let displayBody = trimmed;

    // 1. Strip CSP, frame-restriction, and auto-refresh meta tags so external stylesheets, images, and fonts load freely
    displayBody = displayBody
      .replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '')
      .replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '')
      .replace(/<meta[^>]*http-equiv=["']?X-Content-Type-Options["']?[^>]*>/gi, '')
      .replace(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*>/gi, '');

    // 2. Strip Subresource Integrity (SRI) hashes which fail when loading subresources from rewritten preview origins
    displayBody = displayBody.replace(/\s+integrity=["'][^"']*["']/gi, '');

    // 3. Strip script preloads to prevent downloading megabytes of unused JS bundles
    displayBody = displayBody
      .replace(/<link\b[^>]*\bas=["']?script["']?[^>]*\/?>/gi, '')
      .replace(/<link\b[^>]*\brel=["']?modulepreload["']?[^>]*\/?>/gi, '');

    // 4. Neutralize executable application scripts to prevent client-side hydration crashes
    // (e.g. Next.js / React / Nuxt "Application error: a client-side exception has occurred while loading").
    // This provides Burp Suite Pro parity where HTML layout, styles, fonts, and images render authentically
    // without executing client-side scripts that fail inside sandboxed preview contexts.
    // Preserve data/JSON scripts like application/json, application/ld+json (e.g. schema or state metadata)
    displayBody = displayBody.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs) => {
      const isDataJson = /type=["']?(application\/json|application\/ld\+json|text\/template|text\/html)["']?/i.test(attrs);
      if (isDataJson) return match;
      return `<!-- [SENTINEL SAFE PREVIEW: Script neutralized] -->`;
    });
    displayBody = displayBody.replace(/<script\b([^>]*)\/?>/gi, (match, attrs) => {
      const isDataJson = /type=["']?(application\/json|application\/ld\+json|text\/template|text\/html)["']?/i.test(attrs);
      if (isDataJson) return match;
      return `<!-- [SENTINEL SAFE PREVIEW: Script neutralized] -->`;
    });
    // Neutralize inline event handlers that could execute scripts
    displayBody = displayBody.replace(/\s+on(load|error|click|submit|focus|blur|change|mouseover|keydown|keyup)\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

    // 5. Remove any existing conflicting <base> tags so our canonical base takes full precedence
    displayBody = displayBody.replace(/<base\b[^>]*\/?>/gi, '');

    // 6. Compute accurate canonical <base href="...">
    let baseTag = '';
    if (urlOrHost) {
      try {
        const fullUrl = urlOrHost.startsWith('http://') || urlOrHost.startsWith('https://')
          ? urlOrHost
          : `https://${urlOrHost.replace(/^\/+/, '')}`;
        const u = new URL(fullUrl);
        let basePath = u.pathname;
        if (!basePath.endsWith('/') && !basePath.split('/').pop()?.includes('.')) {
          basePath += '/';
        }
        baseTag = `<base href="${u.origin}${basePath}">`;
      } catch {}
    }

    // 7. Safe Referrer Policy & CSS preamble (Preserves authentic website layout and styling)
    const FRAME_SAFE_PREAMBLE = `
<meta name="referrer" content="no-referrer-when-downgrade">
<style>
  ${SCROLLBAR_DARK_CSS}
  /* Ensure clean scrollbars and transparent base */
  html, body {
    min-height: 100%;
    -webkit-font-smoothing: antialiased;
  }
  /* Prevent noscript overlays from blocking authentic rendered content */
  noscript {
    position: static !important;
    max-height: 48px !important;
    overflow: hidden !important;
    font-size: 11px !important;
    opacity: 0.85 !important;
    display: block !important;
  }
</style>`;

    if (!displayBody.includes('<html') && !displayBody.startsWith('<!DOCTYPE')) {
      htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${baseTag}
  ${FRAME_SAFE_PREAMBLE}
</head>
<body>
${displayBody}
</body>
</html>`;
    } else {
      let augmented = displayBody;
      const injectedSnippets = `\n  ${baseTag}\n  ${FRAME_SAFE_PREAMBLE}`;
      if (augmented.includes('<head>')) {
        augmented = augmented.replace('<head>', `<head>${injectedSnippets}`);
      } else if (/<head[^>]*>/i.test(augmented)) {
        augmented = augmented.replace(/(<head[^>]*>)/i, `$1${injectedSnippets}`);
      } else {
        augmented = `${injectedSnippets}\n${augmented}`;
      }
      htmlResult = augmented;
    }
  } else if (urlOrHost?.endsWith('.css') || trimmed.startsWith('@charset') || trimmed.startsWith('@import')) {
    // 7. Pure CSS Stylesheet
    htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${SCROLLBAR_DARK_CSS}
    body { background-color: #12151c; color: #a5b4fc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.5; padding: 16px; margin: 0; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <pre>${trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
  } else {
    // 8. Plain text or code fallback
    const escaped = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${SCROLLBAR_DARK_CSS}
    body { background-color: #141517; color: #dfdfdf; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.6; padding: 16px; margin: 0; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
  }


  // Inject search highlighter if searchQuery provided
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim();
    const highlightInjector = `<style>
mark.highlight-match {
  background-color: #f37021 !important;
  color: #ffffff !important;
  padding: 1px 3px !important;
  border-radius: 2px !important;
  font-weight: bold !important;
}
</style>
<script>
(function() {
  const query = ${JSON.stringify(q)};
  if (!query) return;
  function markText(node) {
    if (node.nodeType === 3) {
      const val = node.nodeValue;
      const idx = val.toLowerCase().indexOf(query.toLowerCase());
      if (idx !== -1) {
        const span = document.createElement('span');
        span.innerHTML = val.substring(0, idx) +
          '<mark class="highlight-match">' + val.substring(idx, idx + query.length) + '</mark>' +
          val.substring(idx + query.length);
        node.parentNode.replaceChild(span, node);
      }
    } else if (node.nodeType === 1 && node.childNodes && !/^(script|style)$/i.test(node.tagName)) {
      Array.from(node.childNodes).forEach(markText);
    }
  }
  markText(document.body);
})();
</script>`;

    if (htmlResult.includes('</body>')) {
      htmlResult = htmlResult.replace('</body>', `${highlightInjector}</body>`);
    } else {
      htmlResult += highlightInjector;
    }
  }

  return htmlResult;
}

export function exportRepeaterRequest(
  format: 'curl' | 'python' | 'javascript' | 'powershell',
  method: string,
  url: string,
  headers: Array<{ name: string; value: string }>,
  body?: string
): string {
  switch (format) {
    case 'python':
      return generatePythonScript(method, url, headers, body);
    case 'javascript':
      return generateJavaScriptFetch(method, url, headers, body);
    case 'powershell':
      return generatePowerShellCommand(method, url, headers, body);
    case 'curl':
    default:
      return generateCurlCommand(method, url, headers, body);
  }
}
