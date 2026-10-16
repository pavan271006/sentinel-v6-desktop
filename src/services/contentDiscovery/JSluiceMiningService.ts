/**
 * Sentinel V6 - JSluice Deep JavaScript AST & Endpoint Extraction Service
 *
 * Modeled after BishopFox's jsluice (github.com/BishopFox/jsluice) and xnLinkFinder.
 * Analyzes JavaScript bundles and inline scripts to extract:
 * - Hidden REST & GraphQL API Endpoints
 * - HTTP Methods and Route Patterns (React Router, Next.js, Express)
 * - Hidden Query & Body Parameters
 * - Leaked Secrets, API Keys, Tokens, and Internal Subdomains
 */

import ts from 'typescript';
import { ipcClient } from '../../ipc/client';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';

export interface JSluiceDiscoveredEndpoint {
  url: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params: string[];
  sourceScript: string;
  category: 'API' | 'Route' | 'GraphQL' | 'Static' | 'Secret';
  rawSnippet?: string;
}

export interface JSluiceDiscoveredSecret {
  type: string;
  value: string;
  sourceScript: string;
  snippet: string;
}

export interface JSluiceMiningResult {
  endpoints: JSluiceDiscoveredEndpoint[];
  secrets: JSluiceDiscoveredSecret[];
}

export interface JSluiceMiningConfig {
  targetHost: string;
  scriptUrls: string[];
  inlineScripts?: string[];
  fetchFn?: (url: string) => Promise<string | null>;
  onProgress?: (count: number, currentScript: string) => void;
  onItemDiscovered?: (item: SiteMapRequest) => void;
}

// ─── Regex Intelligence Patterns for Deep JS Route & Endpoint Mining ───
const ENDPOINT_PATTERNS = [
  // 1. Universal relative paths & absolute URLs on any website
  /(?:["'`])((\/[a-zA-Z0-9_\-\.]{1,}(?:\/[a-zA-Z0-9_\-\.\/\?=&%#]*)*)|(?:https?:\/\/[a-zA-Z0-9_\-\.:]+\/[a-zA-Z0-9_\-\.\/\?=&%#]+))(?:["'`])/gi,

  // 2. Fetch / Axios / XHR / HTTP client calls (expanded with modern client libs)
  /(?:fetch|axios(?:\.[a-zA-Z0-9_]+)?|\$\.ajax|\$\.get|\$\.post|xhr\.open|http\.(?:get|post|put|delete|patch)|request|got|ky|superagent|umi\.request|useSWR|useFetch|useQuery)(?:\s*\.?\s*)\(\s*["'`]?([^"'`\s,\)]+)/gi,

  // 3. React / Next.js / Vue / Angular / Svelte route declarations
  /(?:path|route|endpoint|url|href|to|action|target|redirect|component|loadChildren|redirectTo|templateUrl)\s*[:=]\s*["'`]([a-zA-Z0-9_\-\.\/\?=&%#:]{2,})["'`]/gi,

  // 4. Router navigation calls (expanded)
  /(?:router\.(?:push|replace|go|navigate|back)|navigate|redirect|loadPage|openUrl|history\.(?:push|replace)State)\s*\(\s*["'`]([^"'`\s,\)]+)["'`]/gi,

  // 5. Template literals with dynamic variables
  /`([^`]*?\/[a-zA-Z0-9_\-\.]{2,}[^`]*?)`/gi,

  // 6. Variable-assigned endpoints: const endpoint = "/api/v2/users"
  /(?:const|let|var|this\.)\s*(?:endpoint|url|uri|path|route|api|apiUrl|apiEndpoint|baseUrl|baseURL|BASE_URL|API_BASE|API_URL|apiBase|serverUrl|backendUrl)\s*=\s*["'`]([^"'`\s]{2,})["'`]/gi,

  // 7. Object property endpoints: { url: "/api/users", endpoint: "/data" }
  /(?:["'](?:url|uri|href|endpoint|path|route|api|action|src|link|redirect|callback|returnUrl|next|dest|target)["'])\s*:\s*["'`]([^"'`\s,\}]{2,})["'`]/gi,

  // 8. String concatenation: "/api/" + version + "/users"
  /["'`](\/[a-zA-Z0-9_\-\.\/]+)["'`]\s*\+\s*(?:["'`][^"'`]*["'`]|[a-zA-Z0-9_]+)\s*\+?\s*(?:["'`](\/[a-zA-Z0-9_\-\.\/]+)["'`])?/gi,

  // 9. Webpack/Vite dynamic imports: import('/pages/admin'), require('/modules/user')
  /(?:import|require|require\.ensure|__webpack_require__|System\.import)\s*\(\s*["'`]([^"'`\s\)]+)["'`]/gi,

  // 10. GraphQL operation names
  /(?:query|mutation|subscription)\s+([A-Z][a-zA-Z0-9_]+)/gi,

  // 11. WebSocket & EventSource endpoints
  /new\s+(?:WebSocket|EventSource|SockJS|Stomp)\s*\(\s*["'`]([^"'`\s\)]+)["'`]/gi,

  // 12. Service Worker & Worker registration
  /(?:serviceWorker\.register|new\s+Worker|new\s+SharedWorker)\s*\(\s*["'`]([^"'`\s\)]+)["'`]/gi,

  // 13. PostMessage target origins
  /\.postMessage\s*\([^,]+,\s*["'`](https?:\/\/[^"'`\s]+)["'`]/gi,

  // 14. Window.open & location.assign
  /(?:window\.open|location\.(?:assign|replace|href\s*=))\s*["'`]([^"'`\s\)]+)["'`]/gi,

  // 15. REST resource patterns: api.get('/users'), service.post('/data')
  /\.(?:get|post|put|patch|delete|head|options|request)\s*\(\s*["'`]([^"'`\s,\)]+)["'`]/gi,
];

// ─── High-Confidence Secret Signatures (Trufflehog / Gitleaks / JSluice Grade) ───
const SECRET_SIGNATURES: Array<{ type: string; regex: RegExp }> = [
  { type: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/g },
  { type: 'AWS Secret Key', regex: /(?:aws_secret_access_key|secret_key|secretAccessKey)\s*[:=]\s*["']([A-Za-z0-9\/+=]{40})["']/gi },
  { type: 'JWT Token', regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g },
  { type: 'Google API Key', regex: /\b(AIza[0-9A-Za-z-_]{35})\b/g },
  { type: 'GitHub Personal Token', regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/g },
  { type: 'Slack Webhook / Token', regex: /\b(https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z_]{8}\/B[0-9A-Z_]{8}\/[0-9A-Za-z_]{24})\b/g },
  { type: 'Stripe API Key', regex: /\b(sk_(?:live|test)_[0-9a-zA-Z]{24,})\b/g },
  { type: 'Stripe Publishable Key', regex: /\b(pk_(?:live|test)_[0-9a-zA-Z]{24,})\b/g },
  { type: 'Private Key Block', regex: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)/g },
  { type: 'Generic Bearer Token', regex: /["'`](Bearer\s+[a-zA-Z0-9_\-\.]{20,})["'`]/gi },
  { type: 'Twilio API Key', regex: /\b(SK[0-9a-fA-F]{32})\b/g },
  { type: 'SendGrid API Key', regex: /\b(SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43})\b/g },
  { type: 'Mailgun API Key', regex: /\b(key-[a-zA-Z0-9]{32})\b/g },
  { type: 'Firebase Config', regex: /(?:apiKey|authDomain|databaseURL|projectId|storageBucket|messagingSenderId)\s*[:=]\s*["']([^"']+)["']/gi },
  { type: 'Azure Storage Key', regex: /(?:AccountKey|SharedAccessSignature)\s*=\s*([A-Za-z0-9\/+=]{44,})/g },
  { type: 'Hardcoded Password', regex: /(?:password|passwd|secret|token|api_key|apikey|api_secret)\s*[:=]\s*["']([^"'\s]{8,})["']/gi },
];

export class JSluiceMiningService {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
  }

  /**
   * Normalizes a discovered endpoint path against the target host
   */
  private normalizeEndpoint(path: string, host: string): { url: string; cleanPath: string } | null {
    if (!path || path.startsWith('javascript:') || path.startsWith('data:') || path.startsWith('mailto:') || path.startsWith('#')) {
      return null;
    }

    try {
      const base = `https://${host}`;
      const parsed = new URL(path, base);

      // Filter static non-application media assets
      if (/\.(png|jpg|jpeg|gif|svg|ico|css|woff|woff2|ttf|eot)$/i.test(parsed.pathname)) {
        return null;
      }

      // Check host scope
      if (parsed.host === host || parsed.host.endsWith(`.${host}`)) {
        const cleanPath = `${parsed.pathname}${parsed.search}`;
        return {
          url: parsed.href,
          cleanPath: cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts query parameters from a URL or path
   */
  private extractParamsFromPath(path: string): string[] {
    const params: string[] = [];
    const qIndex = path.indexOf('?');
    if (qIndex !== -1) {
      const qs = path.substring(qIndex + 1);
      const parts = qs.split('&');
      for (const p of parts) {
        const k = p.split('=')[0]?.trim();
        if (k && !params.includes(k)) {
          params.push(k);
        }
      }
    }
    return params;
  }

  /**
   * Parses a single JavaScript text buffer for routes, endpoints, methods, and secrets
   */
  public parseScriptContent(content: string, sourceName: string, host: string): JSluiceMiningResult {
    const discoveredEndpoints: JSluiceDiscoveredEndpoint[] = [];
    const discoveredSecrets: JSluiceDiscoveredSecret[] = [];
    const seenPaths = new Set<string>();

    if (!content || typeof content !== 'string') {
      return { endpoints: [], secrets: [] };
    }

    // 1. Extract Endpoints via Multi-Pattern Matching
    for (const pattern of ENDPOINT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const rawPath = match[1];
        if (!rawPath) continue;

        const normalized = this.normalizeEndpoint(rawPath, host);
        if (normalized && !seenPaths.has(normalized.cleanPath)) {
          seenPaths.add(normalized.cleanPath);

          // Infer Method
          let method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET';
          const matchIndex = match.index;
          const contextSlice = content.substring(Math.max(0, matchIndex - 60), Math.min(content.length, matchIndex + 60));
          if (/method\s*:\s*["']POST["']|\.post\(/i.test(contextSlice)) method = 'POST';
          else if (/method\s*:\s*["']PUT["']|\.put\(/i.test(contextSlice)) method = 'PUT';
          else if (/method\s*:\s*["']DELETE["']|\.delete\(/i.test(contextSlice)) method = 'DELETE';
          else if (/method\s*:\s*["']PATCH["']|\.patch\(/i.test(contextSlice)) method = 'PATCH';

          const params = this.extractParamsFromPath(normalized.cleanPath);
          const isGraphql = normalized.cleanPath.includes('graphql');

          discoveredEndpoints.push({
            url: normalized.url,
            path: normalized.cleanPath,
            method,
            params,
            sourceScript: sourceName,
            category: isGraphql ? 'GraphQL' : 'API',
            rawSnippet: contextSlice.trim(),
          });
        }
      }
    }

    // 1b. TypeScript AST Deep Semantic Mining (Constant-Folding, Next.js Server Actions & Parameter Schema Extraction)
    try {
      const sourceFile = ts.createSourceFile(
        sourceName.endsWith('.js') || sourceName.endsWith('.ts') ? sourceName : `${sourceName}.js`,
        content,
        ts.ScriptTarget.Latest,
        false
      );

      const constants = new Map<string, string>();
      const objectProperties = new Map<string, Record<string, string>>();

      // Pass 1: Extract constants and object property mappings
      const visitPass1 = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          const varName = node.name.text;
          if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
            constants.set(varName, node.initializer.text);
          } else if (ts.isObjectLiteralExpression(node.initializer)) {
            const props: Record<string, string> = {};
            for (const prop of node.initializer.properties) {
              if (ts.isPropertyAssignment(prop) && prop.initializer) {
                const propKey = prop.name.getText(sourceFile).replace(/['"]/g, '');
                if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
                  props[propKey] = prop.initializer.text;
                }
              }
            }
            objectProperties.set(varName, props);
          }
        }
        ts.forEachChild(node, visitPass1);
      };
      ts.forEachChild(sourceFile, visitPass1);

      // Helper to evaluate an AST expression into a resolved path
      const resolveExpressionPath = (expr: ts.Expression): string | null => {
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
          return expr.text;
        }
        if (ts.isIdentifier(expr) && constants.has(expr.text)) {
          return constants.get(expr.text)!;
        }
        if (ts.isPropertyAccessExpression(expr)) {
          const objName = expr.expression.getText(sourceFile);
          const propName = expr.name.text;
          if (objectProperties.has(objName) && objectProperties.get(objName)![propName]) {
            return objectProperties.get(objName)![propName];
          }
        }
        if (ts.isTemplateExpression(expr)) {
          let resolved = expr.head.text;
          for (const span of expr.templateSpans) {
            const innerVal = resolveExpressionPath(span.expression);
            if (innerVal !== null) {
              resolved += innerVal;
            } else {
              resolved += '{param}';
            }
            resolved += span.literal.text;
          }
          return resolved;
        }
        if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          const left = resolveExpressionPath(expr.left);
          const right = resolveExpressionPath(expr.right);
          if (left !== null && right !== null) {
            return left + right;
          }
        }
        return null;
      };

      // Pass 2: Extract endpoints, Next.js Server Actions, and body schema keys
      const visitPass2 = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const callText = node.expression.getText(sourceFile);

          // Next.js Server Actions: createServerReference("40-char-sha1")
          if (callText.includes('createServerReference') || callText.includes('$ACTION_ID_')) {
            if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
              const actionHash = node.arguments[0].text;
              if (actionHash && actionHash.length >= 20) {
                const actionPath = `/_next/action/${actionHash}`;
                discoveredEndpoints.push({
                  url: `https://${host}${actionPath}`,
                  path: actionPath,
                  method: 'POST',
                  params: ['Next-Action: ' + actionHash],
                  sourceScript: sourceName,
                  category: 'API',
                  rawSnippet: `Next.js Server Action [${actionHash}]`,
                });
              }
            }
          }

          // HTTP Client Calls (fetch, axios, $.ajax, $.get, $.post, request)
          const isFetch = callText === 'fetch' || callText === 'window.fetch';
          const isAxios = callText.startsWith('axios') || callText.includes('.get') || callText.includes('.post') || callText.includes('.put') || callText.includes('.delete') || callText.includes('.patch');
          const isJQuery = callText.startsWith('$.') || callText.startsWith('jQuery.');

          if ((isFetch || isAxios || isJQuery) && node.arguments.length > 0) {
            const pathCandidate = resolveExpressionPath(node.arguments[0]);
            if (pathCandidate && (pathCandidate.startsWith('/') || pathCandidate.startsWith('http://') || pathCandidate.startsWith('https://'))) {
              const normalized = this.normalizeEndpoint(pathCandidate, host);
              if (normalized && !seenPaths.has(normalized.cleanPath)) {
                seenPaths.add(normalized.cleanPath);

                let method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET';
                if (callText.includes('post') || callText.includes('Post')) method = 'POST';
                else if (callText.includes('put') || callText.includes('Put')) method = 'PUT';
                else if (callText.includes('delete') || callText.includes('Delete')) method = 'DELETE';
                else if (callText.includes('patch') || callText.includes('Patch')) method = 'PATCH';

                // Extract body parameters from options object / body argument
                const discoveredParams = this.extractParamsFromPath(normalized.cleanPath);
                for (let i = 1; i < node.arguments.length; i++) {
                  const arg = node.arguments[i];
                  if (ts.isObjectLiteralExpression(arg)) {
                    for (const prop of arg.properties) {
                      if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                        const key = prop.name.getText(sourceFile).replace(/['"]/g, '');
                        if (key.toLowerCase() === 'method' && ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer)) {
                          const mUpper = prop.initializer.text.toUpperCase();
                          if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(mUpper)) {
                            method = mUpper as any;
                          }
                        } else if (!['headers', 'mode', 'credentials', 'cache'].includes(key.toLowerCase())) {
                          if (!discoveredParams.includes(key)) {
                            discoveredParams.push(key);
                          }
                        }
                      }
                    }
                  }
                }

                discoveredEndpoints.push({
                  url: normalized.url,
                  path: normalized.cleanPath,
                  method,
                  params: discoveredParams,
                  sourceScript: sourceName,
                  category: normalized.cleanPath.includes('graphql') ? 'GraphQL' : 'API',
                  rawSnippet: node.getText(sourceFile).slice(0, 120),
                });
              }
            }
          }
        }
        ts.forEachChild(node, visitPass2);
      };
      ts.forEachChild(sourceFile, visitPass2);
    } catch {}

    // 2. Extract High-Confidence Secrets
    for (const sig of SECRET_SIGNATURES) {
      sig.regex.lastIndex = 0;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = sig.regex.exec(content)) !== null) {
        const val = sMatch[1];
        if (val) {
          const sIndex = sMatch.index;
          const snippet = content.substring(Math.max(0, sIndex - 30), Math.min(content.length, sIndex + val.length + 30)).replace(/\s+/g, ' ');
          discoveredSecrets.push({
            type: sig.type,
            value: val,
            sourceScript: sourceName,
            snippet,
          });
        }
      }
    }

    return {
      endpoints: discoveredEndpoints,
      secrets: discoveredSecrets,
    };
  }

  /**
   * Main Execution: Fetches all remote script URLs and analyzes scripts for endpoints
   */
  public async runJSluiceMining(config: JSluiceMiningConfig): Promise<SiteMapRequest[]> {
    this.isAborted = false;
    const { targetHost, scriptUrls, inlineScripts = [], onProgress, onItemDiscovered } = config;

    const discoveredMap = new Map<string, SiteMapRequest>();
    let totalFound = 0;

    const pushItem = (ep: JSluiceDiscoveredEndpoint) => {
      const key = `${ep.method}:${targetHost}${ep.path}`;
      if (!discoveredMap.has(key)) {
        const sitemapItem: SiteMapRequest = {
          id: `jsluice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          host: targetHost,
          method: ep.method,
          url: ep.path,
          path: ep.path,
          params: ep.params.length > 0,
          status: 200,
          length: 0,
          mime: ep.path.includes('.json') ? 'JSON' : 'API',
          title: ep.path,
          notes: `Extracted from JS AST (${ep.sourceScript}) [${ep.method}] [Params: ${ep.params.join(', ') || 'none'}]`,
          requestRaw: `${ep.method} ${ep.path} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 JSluice-Miner\r\nAccept: application/json, text/plain, */*\r\n\r\n`,
          responseRaw: `HTTP/1.1 200 JSluice AST Extracted\r\nX-Source-Script: ${ep.sourceScript}\r\n\r\n<!-- Discovered via JSluice Deep JavaScript Route Extractor -->`,
          reqAttributes: { Method: ep.method, Path: ep.path, Source: 'JSluice Miner' },
          reqHeaders: { Host: targetHost },
          resAttributes: { Status: 'Discovered', Source: 'JSluice Miner' },
          resHeaders: {},
          isDiscovered: true,
        };

        discoveredMap.set(key, sitemapItem);
        totalFound++;

        if (onProgress) onProgress(totalFound, ep.sourceScript);
        if (onItemDiscovered) onItemDiscovered(sitemapItem);
      }
    };

    // 1. Parse inline scripts first
    inlineScripts.forEach((code, idx) => {
      if (this.isAborted) return;
      const res = this.parseScriptContent(code, `inline-script-${idx + 1}`, targetHost);
      res.endpoints.forEach(pushItem);
    });

    // 2. Fetch and parse external script files
    const uniqueScripts = Array.from(new Set(scriptUrls));
    for (let i = 0; i < uniqueScripts.length; i++) {
      if (this.isAborted) break;

      const scriptUrl = uniqueScripts[i];
      const scriptName = scriptUrl.split('/').pop()?.split('?')[0] || `script-${i + 1}.js`;

      if (onProgress) onProgress(totalFound, `Fetching ${scriptName}...`);

      try {
        let scriptBody = '';
        if (config.fetchFn) {
          try {
            const fetched = await config.fetchFn(scriptUrl.startsWith('http') ? scriptUrl : `https://${targetHost}${scriptUrl}`);
            if (fetched) scriptBody = fetched;
          } catch {}
        }

        if (!scriptBody) {
          const reqPath = scriptUrl.startsWith('http') ? new URL(scriptUrl).pathname : scriptUrl;
          const rawReq = `GET ${reqPath} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 JSluice-Miner\r\nAccept: */*\r\nConnection: close\r\n\r\n`;

          const res = await ipcClient.sendRepeaterRequest({
            tabId: `jsluice-${Date.now()}-${i}`,
            targetUrl: scriptUrl.startsWith('http') ? scriptUrl : `https://${targetHost}${scriptUrl}`,
            rawRequest: rawReq,
          });

          scriptBody = res?.body || res?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        }

        if (scriptBody) {
          const parsed = this.parseScriptContent(scriptBody, scriptName, targetHost);
          parsed.endpoints.forEach(pushItem);

          // Check for source maps (unminified code & route definitions)
          const smMatch = scriptBody.match(/\/\/[#@]\s*sourceMappingURL=([^\s'"]+)/i);
          if (smMatch && smMatch[1] && !smMatch[1].startsWith('data:')) {
            try {
              let mapUrl = smMatch[1].trim();
              if (!mapUrl.startsWith('http')) {
                const base = scriptUrl.startsWith('http') ? scriptUrl : `https://${targetHost}${scriptUrl}`;
                mapUrl = new URL(mapUrl, base).href;
              }
              let mapBody = '';
              if (config.fetchFn) {
                mapBody = (await config.fetchFn(mapUrl)) || '';
              }
              if (!mapBody) {
                const mParsed = new URL(mapUrl);
                const mRes = await ipcClient.sendRepeaterRequest({
                  tabId: `jsluice-map-${Date.now()}`,
                  targetUrl: mapUrl,
                  rawRequest: `GET ${mParsed.pathname} HTTP/1.1\r\nHost: ${mParsed.host}\r\n\r\n`,
                });
                mapBody = mRes?.body || '';
              }
              if (mapBody) {
                const mapJson = JSON.parse(mapBody);
                if (Array.isArray(mapJson.sources)) {
                  for (const src of mapJson.sources) {
                    const cleanSrc = src.replace(/^(?:webpack:\/\/\/|\.\.\/)+/, '/');
                    pushItem({
                      url: cleanSrc,
                      path: cleanSrc.startsWith('/') ? cleanSrc : `/${cleanSrc}`,
                      method: 'GET',
                      params: [],
                      sourceScript: `${scriptName}.map`,
                      category: 'Route',
                      rawSnippet: `SourceMap: ${src}`,
                    });
                  }
                }
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn(`JSluice: Failed to fetch script ${scriptUrl}:`, err);
      }
    }

    return Array.from(discoveredMap.values());
  }

  /**
   * Synthesizes all lazy Webpack/Vite/Next.js chunk URLs from client runtime chunk maps,
   * enabling deep automated discovery of admin, staff, and unvisited feature bundles.
   */
  public synthesizeUnloadedChunkUrls(mainScriptContent: string, baseUrl: string): string[] {
    const chunkUrls: string[] = [];
    if (!mainScriptContent) return chunkUrls;

    try {
      // 1. Webpack chunk map: { 101: "a8f9b", 102: "c7d2e" }
      const mapMatch = mainScriptContent.match(/\{(?:\s*['"]?[0-9a-zA-Z_\-]+['"]?\s*:\s*['"][0-9a-f]{8,32}['"]\s*,?)+\}/);
      if (mapMatch) {
        const objStr = mapMatch[0];
        const entryRegex = /['"]?([0-9a-zA-Z_\-]+)['"]?\s*:\s*['"]([0-9a-f]{8,32})['"]/g;
        let m: RegExpExecArray | null;
        while ((m = entryRegex.exec(objStr)) !== null) {
          const chunkId = m[1];
          const hash = m[2];
          const path = `/static/js/${chunkId}.${hash}.chunk.js`;
          try {
            chunkUrls.push(new URL(path, baseUrl).href);
          } catch {}
        }
      }

      // 2. Next.js __BUILD_MANIFEST chunk arrays
      const nextChunkMatches = mainScriptContent.matchAll(/['"]static\/chunks\/([a-zA-Z0-9_\-\.\/]+\.js)['"]/g);
      for (const cm of nextChunkMatches) {
        try {
          chunkUrls.push(new URL(`/_next/static/chunks/${cm[1]}`, baseUrl).href);
        } catch {}
      }
    } catch {}

    return Array.from(new Set(chunkUrls));
  }
}

export const jsluiceMiningService = new JSluiceMiningService();
