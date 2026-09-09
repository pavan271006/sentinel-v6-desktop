import { CandidateParameter } from '../../types/sqlScanner';

export interface ParsedHttpRequest {
  method: string;
  url: string;
  host: string;
  path: string;
  protocol: string;
  headers: { name: string; value: string; enabled: boolean }[];
  body: string;
  parameters: CandidateParameter[];
  isMultipart?: boolean;
  multipartBoundary?: string;
  isXml?: boolean;
  isJson?: boolean;
  isGraphQL?: boolean;
}

export function isAntiCsrfOrSecurityToken(name: string, scanAuthTokens = false): boolean {
  const lower = name.toLowerCase();
  if (scanAuthTokens) {
    return (
      lower.startsWith('xsrf') ||
      lower.startsWith('csrf') ||
      lower.includes('_csrf') ||
      lower.includes('_xsrf') ||
      lower.includes('antiforgery') ||
      lower.includes('requestverificationtoken') ||
      lower.includes('authenticity_token')
    );
  }
  return (
    lower.startsWith('xsrf') ||
    lower.startsWith('csrf') ||
    lower.includes('_csrf') ||
    lower.includes('_xsrf') ||
    lower.includes('antiforgery') ||
    lower.includes('requestverificationtoken') ||
    lower.includes('authenticity_token') ||
    lower.startsWith('_ga') ||
    lower.startsWith('_gid') ||
    lower.startsWith('_gat') ||
    lower.startsWith('cf_') ||
    lower.startsWith('__cf') ||
    lower.startsWith('_clck') ||
    lower.startsWith('_clsk') ||
    lower.startsWith('intercom') ||
    lower.startsWith('ajs_') ||
    lower.startsWith('mp_') ||
    lower.startsWith('hubspot') ||
    lower.startsWith('sb-') ||
    lower === 'connect.sid' ||
    lower === '__cfduid' ||
    lower === 'authorization'
  );
}

/**
 * Parses raw HTTP text into structured request components and candidate parameters across:
 * - Query Parameters
 * - Form URL-encoded Body
 * - Multipart Form-data
 * - JSON Payloads
 * - XML Nodes & Attributes
 * - URL REST Path Segments
 * - GraphQL Variables
 * - Cookie Parameters
 * - Custom Request Headers
 */
export class RequestParser {
  public static parse(rawHttp: string, fallbackUrl?: string, scanAuthTokens = false): ParsedHttpRequest {
    if (!rawHttp || !rawHttp.trim()) {
      const cleanUrl = fallbackUrl || 'https://target.local/';
      let host = 'target.local';
      try {
        host = new URL(cleanUrl).host;
      } catch {}

      return {
        method: 'GET',
        url: cleanUrl,
        host,
        path: '/',
        protocol: 'HTTP/1.1',
        headers: [{ name: 'Host', value: host, enabled: true }],
        body: '',
        parameters: [],
      };
    }

    const normalized = rawHttp.replace(/\r\n/g, '\n');
    const headerBodySplit = normalized.indexOf('\n\n');
    const headSection = headerBodySplit !== -1 ? normalized.substring(0, headerBodySplit) : normalized;
    const bodySection = headerBodySplit !== -1 ? normalized.substring(headerBodySplit + 2) : '';

    const lines = headSection.split('\n').filter((l) => l.trim().length > 0);
    const reqLine = lines[0] || 'GET / HTTP/1.1';
    const reqParts = reqLine.trim().split(/\s+/);
    const method = reqParts[0] ? reqParts[0].toUpperCase() : 'GET';
    const rawPath = reqParts[1] || '/';
    const protocol = reqParts[2] || 'HTTP/1.1';

    const headers: { name: string; value: string; enabled: boolean }[] = [];
    let hostHeader = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const name = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        headers.push({ name, value, enabled: true });
        if (name.toLowerCase() === 'host') {
          hostHeader = value;
        }
      }
    }

    // Determine absolute target URL
    let fullUrl = rawPath;
    if (!rawPath.startsWith('http://') && !rawPath.startsWith('https://')) {
      let proto = 'https';
      if (fallbackUrl && fallbackUrl.startsWith('http://')) {
        proto = 'http';
      } else if ((hostHeader.startsWith('127.0.0.1') || hostHeader.startsWith('localhost')) && !hostHeader.includes(':443')) {
        proto = 'http';
      }
      const host = hostHeader || 'target.local';
      const p = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
      fullUrl = `${proto}://${host}${p}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fullUrl);
    } catch {
      parsedUrl = new URL('https://target.local/');
    }

    const parameters: CandidateParameter[] = [];
    const contentTypeHeader = headers.find((h) => h.name.toLowerCase() === 'content-type')?.value.toLowerCase() || '';

    // 1. Query Parameters
    parsedUrl.searchParams.forEach((val, key) => {
      parameters.push({
        id: `query_${key}`,
        name: key,
        location: 'query',
        originalValue: val,
        enabled: true,
      });
    });

    // 2. REST Path Segment Parameters (e.g. /api/users/123/profile -> segment 123)
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    pathSegments.forEach((seg, idx) => {
      // If segment is numeric or looks like an identifier/UUID, mark as candidate path parameter
      if (/^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg) || (seg.length > 0 && !['api', 'v1', 'v2', 'v3', 'index', 'app', 'static', 'assets'].includes(seg.toLowerCase()) && idx > 0)) {
        parameters.push({
          id: `path_seg_${idx}`,
          name: `Path[${idx}]:${pathSegments[idx - 1] || 'seg'}`,
          location: 'path',
          originalValue: seg,
          pathIndex: idx,
          enabled: true,
        });
      }
    });

    // 3. Cookie Parameters
    const cookieHeader = headers.find((h) => h.name.toLowerCase() === 'cookie');
    if (cookieHeader && cookieHeader.value) {
      cookieHeader.value.split(';').forEach((pair) => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
          const k = pair.substring(0, eqIdx).trim();
          const v = pair.substring(eqIdx + 1).trim();
          if (k) {
            const isSecurityOrTrackingToken = isAntiCsrfOrSecurityToken(k, scanAuthTokens);
            parameters.push({
              id: `cookie_${k}`,
              name: k,
              location: 'cookie',
              originalValue: v,
              enabled: !isSecurityOrTrackingToken,
            });
          }
        }
      });
    }

    // 4. Body Parameters
    let isMultipart = false;
    let multipartBoundary = '';
    let isXml = false;
    let isJson = false;
    let isGraphQL = false;

    if (bodySection.trim()) {
      // 4A. Multipart Form-data
      if (contentTypeHeader.includes('multipart/form-data')) {
        isMultipart = true;
        const bMatch = contentTypeHeader.match(/boundary=([^\s;]+)/i);
        multipartBoundary = bMatch ? bMatch[1].replace(/^["']|["']$/g, '') : '';

        if (!multipartBoundary) {
          const firstLine = bodySection.trim().split('\n')[0];
          if (firstLine.startsWith('--')) {
            multipartBoundary = firstLine.substring(2).trim();
          }
        }

        if (multipartBoundary) {
          const parts = bodySection.split(`--${multipartBoundary}`);
          parts.forEach((part, pIdx) => {
            const trimmedPart = part.trim();
            if (!trimmedPart || trimmedPart === '--') return;
            const cdMatch = part.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
            if (cdMatch) {
              const fieldName = cdMatch[1];
              const filename = cdMatch[2];
              const bodyStart = part.indexOf('\n\n') !== -1 ? part.indexOf('\n\n') + 2 : part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') + 4 : -1;
              if (bodyStart !== -1) {
                const fieldValue = part.substring(bodyStart).replace(/\r?\n$/, '');
                parameters.push({
                  id: `multipart_${fieldName}_${pIdx}`,
                  name: fieldName,
                  location: 'body_multipart',
                  originalValue: fieldValue,
                  multipartField: fieldName,
                  multipartFilename: filename,
                  enabled: true,
                });
              }
            }
          });
        }
      }
      // 4B. JSON & GraphQL
      else if (contentTypeHeader.includes('json') || (bodySection.trim().startsWith('{') && bodySection.trim().endsWith('}'))) {
        isJson = true;
        try {
          const parsedJson = JSON.parse(bodySection);

          // Detect GraphQL
          if (parsedJson.query || parsedJson.variables) {
            isGraphQL = true;
            if (parsedJson.variables && typeof parsedJson.variables === 'object') {
              for (const [k, v] of Object.entries(parsedJson.variables)) {
                parameters.push({
                  id: `graphql_var_${k}`,
                  name: `var.${k}`,
                  location: 'graphql',
                  originalValue: String(v),
                  graphqlVar: k,
                  enabled: true,
                });
              }
            }
          }

          const extractJsonParams = (obj: any, prefix = '') => {
            if (typeof obj === 'object' && obj !== null) {
              for (const [k, v] of Object.entries(obj)) {
                const path = prefix ? `${prefix}.${k}` : k;
                if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                  parameters.push({
                    id: `json_${path}`,
                    name: path,
                    location: 'body_json',
                    originalValue: String(v),
                    jsonPath: path,
                    enabled: true,
                  });
                } else if (typeof v === 'object' && v !== null) {
                  extractJsonParams(v, path);
                }
              }
            }
          };
          extractJsonParams(parsedJson);
        } catch {
          // Fallback
        }
      }
      // 4C. XML Payloads (Enhanced: handles attributes, CDATA sections, and nested elements)
      else if (contentTypeHeader.includes('xml') || bodySection.trim().startsWith('<')) {
        isXml = true;
        
        // Extract XML attributes e.g. <user id="123" role="admin">
        const attrRegex = /<([a-zA-Z0-9_\-:]+)([^>]+)>/g;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(bodySection)) !== null) {
          const tagName = attrMatch[1];
          const attrBlock = attrMatch[2];
          const attrKvRegex = /([a-zA-Z0-9_\-:]+)=["']([^"']*)["']/g;
          let kvMatch: RegExpExecArray | null;
          while ((kvMatch = attrKvRegex.exec(attrBlock)) !== null) {
            const attrName = kvMatch[1];
            const attrValue = kvMatch[2];
            parameters.push({
              id: `xml_attr_${tagName}_${attrName}`,
              name: `@${attrName} (${tagName})`,
              location: 'body_xml',
              originalValue: attrValue,
              xmlPath: `${tagName}/@${attrName}`,
              enabled: true,
            });
          }
        }

        // Extract CDATA sections e.g. <data><![CDATA[value]]></data>
        const cdataRegex = /<([a-zA-Z0-9_\-:]+)[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/\1>/g;
        let cdataMatch: RegExpExecArray | null;
        while ((cdataMatch = cdataRegex.exec(bodySection)) !== null) {
          const tagName = cdataMatch[1];
          const cdataValue = cdataMatch[2];
          parameters.push({
            id: `xml_cdata_${tagName}`,
            name: `${tagName} (CDATA)`,
            location: 'body_xml',
            originalValue: cdataValue,
            xmlPath: tagName,
            enabled: true,
          });
        }

        // Extract Standard Tag Text Nodes
        const tagRegex = /<([a-zA-Z0-9_\-:]+)([^>]*)>([^<]*)<\/\1>/g;
        let match: RegExpExecArray | null;
        while ((match = tagRegex.exec(bodySection)) !== null) {
          const tagName = match[1];
          const tagValue = match[3];
          if (tagValue.trim() && !tagValue.includes('<![CDATA[')) {
            parameters.push({
              id: `xml_${tagName}`,
              name: tagName,
              location: 'body_xml',
              originalValue: tagValue,
              xmlPath: tagName,
              enabled: true,
            });
          }
        }
      }
      // 4D. Standard Form URL-Encoded
      else if (
        contentTypeHeader.includes('x-www-form-urlencoded') ||
        bodySection.includes('=')
      ) {
        const bodyParams = new URLSearchParams(bodySection);
        bodyParams.forEach((val, key) => {
          parameters.push({
            id: `body_${key}`,
            name: key,
            location: 'body_form',
            originalValue: val,
            enabled: true,
          });
        });
      }
    }

    // 5. Custom Request Headers
    const testableHeaderNames = [
      'x-forwarded-for', 'x-real-ip', 'x-custom-token', 'user-agent', 'referer',
      'origin', 'true-client-ip', 'client-ip', 'x-client-ip', 'x-remote-ip',
      'x-remote-addr', 'x-originating-ip', 'cf-connecting-ip', 'x-original-url',
      'x-rewrite-url', 'x-host', 'forwarded', 'authorization'
    ];
    headers.forEach((h) => {
      if (testableHeaderNames.includes(h.name.toLowerCase())) {
        parameters.push({
          id: `header_${h.name.toLowerCase()}`,
          name: h.name,
          location: 'header',
          originalValue: h.value,
          detectedContext: 'single_quote_string',
          enabled: true,
        });
      }
    });

    return {
      method,
      url: fullUrl,
      host: parsedUrl.host,
      path: parsedUrl.pathname + parsedUrl.search,
      protocol,
      headers,
      body: bodySection,
      parameters,
      isMultipart,
      multipartBoundary,
      isXml,
      isJson,
      isGraphQL,
    };
  }

  /**
   * Replaces a candidate parameter value inside the raw HTTP request with a specific payload
   */
  public static injectPayload(
    parsed: ParsedHttpRequest,
    param: CandidateParameter,
    payload: string,
    append: boolean = false
  ): { rawRequest: string; targetUrl: string; bodyText: string; headers: { name: string; value: string }[] } {
    const injectedValue = append ? `${param.originalValue}${payload}` : payload;
    let newUrl = parsed.url;
    let newBody = parsed.body;
    let newHeaders = parsed.headers.map((h) => ({ name: h.name, value: h.value }));

    if (param.location === 'query') {
      try {
        const u = new URL(parsed.url);
        u.searchParams.set(param.name, injectedValue);
        newUrl = u.toString();
      } catch {}
    } else if (param.location === 'path') {
      try {
        const u = new URL(parsed.url);
        const segments = u.pathname.split('/').filter(Boolean);
        if (param.pathIndex !== undefined && segments[param.pathIndex] !== undefined) {
          segments[param.pathIndex] = encodeURIComponent(injectedValue);
          u.pathname = '/' + segments.join('/');
          newUrl = u.toString();
        }
      } catch {}
    } else if (param.location === 'body_form') {
      try {
        const sp = new URLSearchParams(parsed.body);
        sp.set(param.name, injectedValue);
        newBody = sp.toString();
      } catch {
        newBody = parsed.body.replace(
          new RegExp(`(^|&)(${encodeURIComponent(param.name)}=)([^&]*)`, 'i'),
          `$1$2${encodeURIComponent(injectedValue)}`
        );
      }
    } else if (param.location === 'body_multipart') {
      if (parsed.multipartBoundary) {
        const parts = parsed.body.split(`--${parsed.multipartBoundary}`);
        const updatedParts = parts.map((part) => {
          if (part.includes(`name="${param.multipartField || param.name}"`)) {
            const bodySplit = part.indexOf('\r\n\r\n') !== -1 ? '\r\n\r\n' : part.indexOf('\n\n') !== -1 ? '\n\n' : '';
            if (bodySplit) {
              const [headerPart] = part.split(bodySplit);
              return `${headerPart}${bodySplit}${injectedValue}\r\n`;
            }
          }
          return part;
        });
        newBody = updatedParts.join(`--${parsed.multipartBoundary}`);
      }
    } else if (param.location === 'body_json') {
      try {
        const parsedJson = JSON.parse(parsed.body);
        const setJsonVal = (obj: any, path: string, val: string) => {
          const parts = path.split('.');
          let curr = obj;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = val;
        };
        setJsonVal(parsedJson, param.jsonPath || param.name, injectedValue);
        newBody = JSON.stringify(parsedJson);
      } catch {}
    } else if (param.location === 'graphql') {
      try {
        const parsedJson = JSON.parse(parsed.body);
        if (parsedJson.variables && param.graphqlVar) {
          parsedJson.variables[param.graphqlVar] = injectedValue;
          newBody = JSON.stringify(parsedJson);
        }
      } catch {}
    } else if (param.location === 'body_xml') {
      const tag = param.xmlPath || param.name;
      const tagRegex = new RegExp(`(<${tag}[^>]*>)([^<]*)(<\\/${tag}>)`, 'i');
      newBody = parsed.body.replace(tagRegex, `$1${injectedValue}$3`);
    } else if (param.location === 'cookie') {
      // 1. Semicolons in cookie values MUST be encoded as %3b to avoid truncating or splitting cookies
      let cookieSafeValue = injectedValue.replace(/;/g, '%3b');
      // 2. Protect unencoded '%' from causing Java Tomcat URLDecoder IllegalArgumentException (e.g. %remote -> %25remote)
      cookieSafeValue = cookieSafeValue.replace(/%(?![0-9a-fA-F]{2})/g, '%25');
      // 3. In HTTP cookies, spaces are invalid per RFC 6265 and cause truncation/rejection in Tomcat/Java; encode as '+'
      cookieSafeValue = cookieSafeValue.replace(/ /g, '+');
      const cookieIdx = newHeaders.findIndex((h) => h.name.toLowerCase() === 'cookie');
      if (cookieIdx !== -1) {
        const oldVal = newHeaders[cookieIdx].value;
        let found = false;
        const pairs = oldVal
          .split(';')
          .map((p) => {
            const trimmed = p.trim();
            const eq = trimmed.indexOf('=');
            if (eq !== -1) {
              const k = trimmed.substring(0, eq).trim();
              if (k.toLowerCase() === param.name.toLowerCase()) {
                found = true;
                return `${k}=${cookieSafeValue}`;
              }
            }
            return trimmed;
          })
          .filter(Boolean);
        if (!found) {
          pairs.push(`${param.name}=${cookieSafeValue}`);
        }
        newHeaders[cookieIdx].value = pairs.join('; ');
      } else {
        newHeaders.push({ name: 'Cookie', value: `${param.name}=${cookieSafeValue}` });
      }
    } else if (param.location === 'header') {
      const hIdx = newHeaders.findIndex((h) => h.name.toLowerCase() === param.name.toLowerCase());
      if (hIdx !== -1) {
        newHeaders[hIdx].value = injectedValue;
      } else {
        newHeaders.push({ name: param.name, value: injectedValue });
      }
    }

    // Strip all 24 internal, scanner, and reverse-proxy leakage headers unless explicitly targeted
    const LEAKAGE_HEADERS = [
      'x-scanner',
      'x-sentinel-worker',
      'x-sentinel-id',
      'x-sentinel-trace',
      'postman-token',
      'x-wap-profile',
      'x-forwarded-for',
      'x-real-ip',
      'client-ip',
      'x-client-ip',
      'x-originating-ip',
      'true-client-ip',
      'cf-connecting-ip',
      'fastly-client-ip',
      'x-cluster-client-ip',
      'forwarded-for',
      'forwarded',
      'x-forwarded',
      'x-custom-ip-authorization',
      'x-remote-ip',
      'x-remote-addr',
      'x-proxyuser-ip',
      'x-original-url',
      'x-rewrite-url',
    ];
    newHeaders = newHeaders.filter(
      (h) => !LEAKAGE_HEADERS.includes(h.name.toLowerCase()) || (param.location === 'header' && param.name.toLowerCase() === h.name.toLowerCase())
    );

    // Auto update Content-Length if body changed
    if (newBody !== parsed.body) {
      const clIdx = newHeaders.findIndex((h) => h.name.toLowerCase() === 'content-length');
      const byteLen = new TextEncoder().encode(newBody).length;
      if (clIdx !== -1) {
        newHeaders[clIdx].value = String(byteLen);
      } else if (parsed.method !== 'GET' && parsed.method !== 'HEAD') {
        newHeaders.push({ name: 'Content-Length', value: String(byteLen) });
      }
    }

    // Construct raw HTTP wire format
    let targetPath = '/';
    try {
      const u = new URL(newUrl);
      targetPath = u.pathname + u.search;
    } catch {}

    const headerBlock = newHeaders.map((h) => `${h.name}: ${h.value}`).join('\r\n');
    const rawRequest = `${parsed.method} ${targetPath} ${parsed.protocol}\r\n${headerBlock}\r\n\r\n${newBody}`;

    return {
      rawRequest,
      targetUrl: newUrl,
      bodyText: newBody,
      headers: newHeaders,
    };
  }
}
