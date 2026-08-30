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

export function generateRenderablePreviewHtml(
  bodyOrRawResponse: string,
  searchQuery?: string,
  urlOrHost?: string
): string {
  let rawContent = (bodyOrRawResponse || '').trim();

  // If a full HTTP response with status line & headers was passed, extract the body
  if (rawContent.startsWith('HTTP/') || rawContent.includes('\r\n\r\n') || rawContent.includes('\n\n')) {
    const doubleNl = rawContent.indexOf('\r\n\r\n');
    if (doubleNl !== -1) {
      rawContent = rawContent.substring(doubleNl + 4).trim();
    } else {
      const singleNl = rawContent.indexOf('\n\n');
      if (singleNl !== -1) {
        rawContent = rawContent.substring(singleNl + 2).trim();
      }
    }
  }

  const trimmed = cleanHttpBody(rawContent);

  let htmlResult = '';

  // 1. Real captured HTML documents rendered directly
  const isHtml =
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<svg') ||
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<form') ||
    trimmed.startsWith('<table') ||
    trimmed.includes('<html') ||
    trimmed.includes('<!DOCTYPE') ||
    trimmed.includes('<head') ||
    trimmed.includes('<body') ||
    trimmed.includes('</title>');

  if (isHtml) {
    let baseTag = '';
    if (urlOrHost && urlOrHost.startsWith('http')) {
      try {
        const u = new URL(urlOrHost);
        baseTag = `<base href="${u.origin}${u.pathname}">`;
      } catch {}
    }

    if (!trimmed.includes('<html') && !trimmed.startsWith('<!DOCTYPE')) {
      htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${baseTag}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #1e293b; padding: 16px; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
${trimmed}
</body>
</html>`;
    } else {
      if (baseTag && trimmed.includes('<head>')) {
        htmlResult = trimmed.replace('<head>', `<head>\n  ${baseTag}`);
      } else if (baseTag && /<head[^>]*>/i.test(trimmed)) {
        htmlResult = trimmed.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`);
      } else if (baseTag) {
        htmlResult = `${baseTag}\n${trimmed}`;
      } else {
        htmlResult = trimmed;
      }
    }
  } else if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    // 2. Real JSON response rendered cleanly (Burp Suite theme: Gold keys, Green strings, Orange booleans, Blue numbers)
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

      htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background-color: #1e1f22; color: #dfdfdf; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.6; padding: 16px; margin: 0; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
    .key { color: #e5c07b; }
    .string { color: #98c379; }
    .number { color: #61afef; }
    .boolean { color: #d19a66; font-weight: bold; }
    .null { color: #e06c75; font-weight: bold; }
  </style>
</head>
<body>
  <pre>${highlighted}</pre>
</body>
</html>`;
    } catch {
      // Fall through
    }
  } else if (trimmed) {
    // 3. Plain text response
    const escaped = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background-color: #1e1f22; color: #dfdfdf; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.6; padding: 16px; margin: 0; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
  } else {
    // 4. Empty Response
    htmlResult = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background-color: #1e1f22; color: #6f737a; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-size: 13px; }
  </style>
</head>
<body>
  <div>(No response body captured)</div>
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
