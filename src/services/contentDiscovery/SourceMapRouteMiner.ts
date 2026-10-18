/**
 * Sentinel Sovereign Ω - Client-Side Source Map & Bundle Route Miner
 *
 * Automatically inspects loaded JavaScript bundles for `.map` files,
 * unpacks the original developer source code tree, and extracts hidden API routes.
 */

import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';
import { jsluiceMiningService } from './JSluiceMiningService';

export interface SourceMapDiscoveryResult {
  scriptUrl: string;
  sourceMapUrl?: string;
  sourceFilesCount: number;
  extractedRoutes: Array<{
    url: string;
    method: string;
    sourceFile: string;
    params?: string[];
  }>;
  extractedSecrets?: Array<{
    type: string;
    value: string;
    sourceFile: string;
  }>;
  extractedSchemas?: Array<{
    name: string;
    fields: string[];
    sourceFile: string;
  }>;
  synthesizedLazyChunks?: string[];
  nextServerActions?: Array<{
    url: string;
    method: string;
    sourceFile: string;
  }>;
}

export class SourceMapRouteMiner {
  private minedScriptUrls = new Set<string>();

  /**
   * Resets the miner cache for a fresh crawl session
   */
  public reset(): void {
    this.minedScriptUrls.clear();
  }

  /**
   * Extracts TypeScript interfaces and Zod object schemas from source or bundle text
   */
  public extractSchemasFromSource(
    content: string,
    sourcePath: string
  ): Array<{ name: string; fields: string[]; sourceFile: string }> {
    const extractedSchemas: Array<{ name: string; fields: string[]; sourceFile: string }> = [];
    if (!content || typeof content !== 'string') return extractedSchemas;

    const interfaceRegex = /(?:interface|type)\s+([A-Za-z0-9_]+(?:Request|Payload|Input|Dto|Params|Body|Schema))\s*=?\s*\{([^}]{5,600})\}/g;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = interfaceRegex.exec(content)) !== null) {
      const schemaName = iMatch[1];
      const bodyBlock = iMatch[2];
      const fields = Array.from(bodyBlock.matchAll(/([a-zA-Z0-9_]+)\s*\??\s*:/g)).map((m) => m[1]);
      if (fields.length > 0) {
        extractedSchemas.push({ name: schemaName, fields, sourceFile: sourcePath });
      }
    }

    const zodRegex = /(?:const|let|var|export\s+const)\s+([A-Za-z0-9_]+)\s*=\s*z\.object\s*\(\s*\{([^}]{5,600})\}\s*\)/g;
    let zMatch: RegExpExecArray | null;
    while ((zMatch = zodRegex.exec(content)) !== null) {
      const schemaName = zMatch[1];
      const bodyBlock = zMatch[2];
      const fields = Array.from(bodyBlock.matchAll(/([a-zA-Z0-9_]+)\s*:\s*z\./g)).map((m) => m[1]);
      if (fields.length > 0) {
        extractedSchemas.push({ name: schemaName, fields, sourceFile: sourcePath });
      }
    }

    return extractedSchemas;
  }

  /**
   * Parses OpenAPI 3.x / Swagger 2.0 JSON specifications, OIDC .well-known configs,
   * Apple/Android deep-link manifests, and SPA build manifests (asset-manifest.json, ngsw.json)
   * into individual endpoints and bundle chunk URLs.
   */
  public parseApiSpecificationOrManifest(
    specUrl: string,
    rawBody: string,
    targetHost: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): {
    endpoints: SiteMapRequest[];
    discoveredChunkUrls: string[];
    extractedSchemas: Array<{ name: string; fields: string[]; sourceFile: string }>;
  } {
    const endpoints: SiteMapRequest[] = [];
    const discoveredChunkUrls: string[] = [];
    const extractedSchemas: Array<{ name: string; fields: string[]; sourceFile: string }> = [];
    const cleanHost = targetHost.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    if (!rawBody || rawBody.trim().length < 2) {
      return { endpoints, discoveredChunkUrls, extractedSchemas };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { endpoints, discoveredChunkUrls, extractedSchemas };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { endpoints, discoveredChunkUrls, extractedSchemas };
    }

    const pushEndpoint = (pathStr: string, method: string, title: string, notes: string, paramNames: string[] = []) => {
      if (!pathStr || typeof pathStr !== 'string') return;
      let cleanPath = pathStr.trim();
      if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        try {
          const u = new URL(cleanPath);
          if (!u.hostname.toLowerCase().endsWith(cleanHost) && !cleanHost.endsWith(u.hostname.toLowerCase())) {
            return;
          }
          cleanPath = u.pathname + u.search;
        } catch {
          return;
        }
      }
      if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
      if (paramNames.length > 0 && !cleanPath.includes('?') && method.toUpperCase() === 'GET') {
        cleanPath = `${cleanPath}?${paramNames.slice(0, 6).map((p) => `${p}=1`).join('&')}`;
      }

      const normMethod = method.toUpperCase();
      const bodyStr =
        normMethod !== 'GET' && normMethod !== 'HEAD' && paramNames.length > 0
          ? JSON.stringify(Object.fromEntries(paramNames.slice(0, 10).map((p) => [p, 'sample'])))
          : '';

      const item: SiteMapRequest = {
        id: `spec-${cleanHost}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-${normMethod}`,
        host: cleanHost,
        method: normMethod,
        url: cleanPath,
        path: cleanPath,
        params: cleanPath.includes('?') || paramNames.length > 0,
        status: 200,
        length: bodyStr.length,
        mime: 'JSON',
        title,
        notes,
        requestRaw:
          `${normMethod} ${cleanPath} HTTP/1.1\r\nHost: ${cleanHost}\r\nAccept: application/json\r\n` +
          (bodyStr ? `Content-Type: application/json\r\nContent-Length: ${bodyStr.length}\r\n\r\n${bodyStr}` : `\r\n`),
        responseRaw: `HTTP/1.1 200 OK (Synthesized from ${specUrl})\r\nContent-Type: application/json\r\n\r\n{"source": "${specUrl}", "parameters": ${JSON.stringify(paramNames)}}`,
        reqAttributes: { Method: normMethod, Path: cleanPath, Source: 'Specification-Parser' },
        reqHeaders: { Host: cleanHost, Accept: 'application/json' },
        resAttributes: { Status: '200 (Spec)', Source: specUrl },
        resHeaders: {},
        isDiscovered: true,
      };
      endpoints.push(item);
      if (onItemDiscovered) onItemDiscovered(item);
    };

    // 1. OpenAPI 3.x / Swagger 2.0 specification (`paths` + `components.schemas` / `definitions`)
    if (parsed.paths && typeof parsed.paths === 'object') {
      const basePath = typeof parsed.basePath === 'string' && parsed.basePath !== '/' ? parsed.basePath.replace(/\/$/, '') : '';
      const validMethods = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

      for (const [rawRoute, pathItem] of Object.entries(parsed.paths)) {
        if (!pathItem || typeof pathItem !== 'object') continue;
        const fullRoute = `${basePath}${rawRoute.startsWith('/') ? rawRoute : '/' + rawRoute}`;

        for (const [mKey, opObj] of Object.entries(pathItem as Record<string, any>)) {
          if (!validMethods.has(mKey.toLowerCase()) || !opObj || typeof opObj !== 'object') continue;
          const paramNames: string[] = [];

          if (Array.isArray(opObj.parameters)) {
            for (const p of opObj.parameters) {
              if (p && typeof p.name === 'string') paramNames.push(p.name);
            }
          }
          const reqProps = opObj?.requestBody?.content?.['application/json']?.schema?.properties;
          if (reqProps && typeof reqProps === 'object') {
            paramNames.push(...Object.keys(reqProps));
          }

          const summary = opObj.summary || opObj.operationId || `${mKey.toUpperCase()} ${fullRoute}`;
          pushEndpoint(fullRoute, mKey.toUpperCase(), `[OpenAPI] ${summary}`, `Extracted from OpenAPI spec (${specUrl})`, paramNames);
        }
      }

      const schemasObj = parsed?.components?.schemas || parsed?.definitions;
      if (schemasObj && typeof schemasObj === 'object') {
        for (const [sName, sDef] of Object.entries(schemasObj as Record<string, any>)) {
          if (sDef && typeof sDef.properties === 'object') {
            const fields = Object.keys(sDef.properties);
            if (fields.length > 0) {
              extractedSchemas.push({ name: sName, fields, sourceFile: specUrl });
            }
          }
        }
      }
    }

    // 2. OIDC / OAuth2 `.well-known/openid-configuration`
    const oidcKeys = [
      'authorization_endpoint',
      'token_endpoint',
      'userinfo_endpoint',
      'jwks_uri',
      'registration_endpoint',
      'revocation_endpoint',
      'introspection_endpoint',
      'end_session_endpoint',
      'device_authorization_endpoint',
    ];
    for (const k of oidcKeys) {
      if (typeof parsed[k] === 'string') {
        const method = k.includes('token') || k.includes('registration') || k.includes('revocation') || k.includes('introspection') ? 'POST' : 'GET';
        pushEndpoint(parsed[k], method, `[OIDC] ${k}`, `Extracted from OIDC discovery configuration (${specUrl})`);
      }
    }

    // 3. Apple Universal Links (`apple-app-site-association`)
    if (parsed.applinks && Array.isArray(parsed.applinks.details)) {
      for (const detail of parsed.applinks.details) {
        if (Array.isArray(detail.paths)) {
          for (const p of detail.paths) {
            if (typeof p === 'string') {
              const cleanP = p.replace(/^NOT\s+/i, '').replace(/\*/g, '1');
              if (cleanP.startsWith('/')) {
                pushEndpoint(cleanP, 'GET', `[Universal Link] ${cleanP}`, `Extracted from apple-app-site-association`);
              }
            }
          }
        }
        if (Array.isArray(detail.components)) {
          for (const comp of detail.components) {
            if (comp && typeof comp['/'] === 'string') {
              const cleanP = comp['/'].replace(/\*/g, '1');
              pushEndpoint(cleanP, 'GET', `[Universal Link] ${cleanP}`, `Extracted from apple-app-site-association`);
            }
          }
        }
      }
    }

    // 4. Create-React-App / Webpack `asset-manifest.json` & Vite `manifest.json`
    const filesObj = parsed.files || parsed;
    if (filesObj && typeof filesObj === 'object') {
      for (const val of Object.values(filesObj)) {
        if (typeof val === 'string' && (val.endsWith('.js') || val.endsWith('.mjs'))) {
          const fullChunk = val.startsWith('http') ? val : `https://${cleanHost}${val.startsWith('/') ? val : '/' + val}`;
          discoveredChunkUrls.push(fullChunk);
        } else if (val && typeof val === 'object' && typeof (val as any).file === 'string') {
          const f = (val as any).file;
          if (f.endsWith('.js') || f.endsWith('.mjs')) {
            discoveredChunkUrls.push(`https://${cleanHost}${f.startsWith('/') ? f : '/' + f}`);
          }
        }
      }
    }

    // 5. Angular Service Worker `ngsw.json`
    if (Array.isArray(parsed.assetGroups)) {
      for (const group of parsed.assetGroups) {
        if (Array.isArray(group.urls)) {
          for (const u of group.urls) {
            if (typeof u === 'string' && u.endsWith('.js')) {
              discoveredChunkUrls.push(u.startsWith('http') ? u : `https://${cleanHost}${u.startsWith('/') ? u : '/' + u}`);
            } else if (typeof u === 'string' && u.startsWith('/')) {
              pushEndpoint(u, 'GET', `[NGSW Asset] ${u}`, `Extracted from Angular ngsw.json`);
            }
          }
        }
      }
    }
    if (Array.isArray(parsed.dataGroups)) {
      for (const dg of parsed.dataGroups) {
        if (Array.isArray(dg.patterns)) {
          for (const pat of dg.patterns) {
            if (typeof pat === 'string') {
              const cleanPat = pat.replace(/\\/g, '').replace(/\.\*/g, '');
              if (cleanPat.startsWith('/')) {
                pushEndpoint(cleanPat, 'GET', `[NGSW API Pattern] ${cleanPat}`, `Extracted from Angular ngsw.json dataGroups`);
              }
            }
          }
        }
      }
    }

    return { endpoints, discoveredChunkUrls, extractedSchemas };
  }

  /**
   * Attempts to discover, download, and unpack source maps for a given script URL.
   * Supports:
   * - Standard `<script>.map` probing
   * - `SourceMap` / `X-SourceMap` HTTP response headers
   * - `//# sourceMappingURL=...` directives (both relative URLs and inline `data:application/json;base64,...`)
   * - Full TypeScript AST & Constant-Folding + Zod/TS Interface schema extraction across unpacked developer files
   */
  public async probeAndMineScript(
    scriptUrl: string,
    targetHost: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): Promise<SourceMapDiscoveryResult | null> {
    if (!scriptUrl || this.minedScriptUrls.has(scriptUrl)) return null;
    this.minedScriptUrls.add(scriptUrl);

    // Filter non-http and external third-party tracker scripts (Google Analytics, etc.)
    if (!scriptUrl.startsWith('http://') && !scriptUrl.startsWith('https://')) return null;
    if (
      scriptUrl.includes('google-analytics') ||
      scriptUrl.includes('gtag') ||
      scriptUrl.includes('facebook.net') ||
      scriptUrl.includes('clarity.ms') ||
      scriptUrl.includes('doubleclick')
    ) {
      return null;
    }

    const cleanHost = targetHost.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    // 1. Try discovering standard .map file, SourceMap header, or inline base64 sourceMappingURL
    let candidateMapUrl = scriptUrl.split('?')[0] + '.map';
    let scriptBodyCache: string | null = null;

    try {
      let mapContent = await stealthCdpBrowserDriver.fetchInBrowser(candidateMapUrl);

      // If standard .map 404s, inspect script body for //# sourceMappingURL= or inline base64 map
      if (!mapContent || mapContent.trim().length <= 50 || mapContent.includes('<html') || mapContent.includes('<!DOCTYPE')) {
        const scriptDetails = await stealthCdpBrowserDriver.fetchInBrowserDetails(scriptUrl);
        if (scriptDetails && scriptDetails.body) {
          scriptBodyCache = scriptDetails.body;
          const headerMap =
            scriptDetails.headers?.['sourcemap'] ||
            scriptDetails.headers?.['SourceMap'] ||
            scriptDetails.headers?.['x-sourcemap'] ||
            scriptDetails.headers?.['X-SourceMap'];

          const directiveMatch = /\/\/[#@]\s*sourceMappingURL=([^\s'"]+)/i.exec(scriptDetails.body);
          const rawMapRef = headerMap || (directiveMatch ? directiveMatch[1].trim() : null);

          if (rawMapRef) {
            if (rawMapRef.startsWith('data:application/json') && rawMapRef.includes('base64,')) {
              const b64Part = rawMapRef.split('base64,')[1];
              if (b64Part) {
                mapContent = typeof atob === 'function' ? atob(b64Part) : Buffer.from(b64Part, 'base64').toString('utf-8');
                candidateMapUrl = `${scriptUrl} (inline-base64-map)`;
              }
            } else {
              candidateMapUrl = new URL(rawMapRef, scriptUrl).href;
              mapContent = await stealthCdpBrowserDriver.fetchInBrowser(candidateMapUrl);
            }
          }
        }
      }

      if (mapContent && mapContent.trim().length > 50 && !mapContent.includes('<html') && !mapContent.includes('<!DOCTYPE')) {
        let parsed: any;
        try {
          parsed = JSON.parse(mapContent);
        } catch {
          parsed = null;
        }

        if (parsed && (parsed.sources || parsed.sourcesContent)) {
          const sources: string[] = Array.isArray(parsed.sources) ? parsed.sources : [];
          const sourcesContent: string[] = Array.isArray(parsed.sourcesContent) ? parsed.sourcesContent : [];

          const discoveredRoutes: Array<{ url: string; method: string; sourceFile: string; params?: string[] }> = [];
          const extractedSecrets: Array<{ type: string; value: string; sourceFile: string }> = [];
          const extractedSchemas: Array<{ name: string; fields: string[]; sourceFile: string }> = [];
          const nextServerActions: Array<{ url: string; method: string; sourceFile: string }> = [];
          const routeRegex = /['"](\/(?:api|v[0-9]+|admin|ajax|graphql|internal|user|auth|dashboard|settings|upload|export)[a-zA-Z0-9_\-\.\/\?=&%#]*)['"]/gi;
          const seenRoutes = new Set<string>();

          // Scan un-minified original developer source files using both Regex and JSluice TypeScript AST!
          for (let i = 0; i < sourcesContent.length; i++) {
            const fileContent = sourcesContent[i];
            const sourcePath = sources[i] || `source_${i}.ts`;
            if (typeof fileContent !== 'string') continue;

            // A) Deep AST + Constant-Folding + Secret Mining on original developer source file
            const astRes = jsluiceMiningService.parseScriptContent(fileContent, sourcePath, cleanHost);
            for (const astEp of astRes.endpoints) {
              if (astEp.path.startsWith('/_next/action/')) {
                nextServerActions.push({ url: astEp.path, method: astEp.method, sourceFile: sourcePath });
              }
              if (!seenRoutes.has(astEp.path)) {
                seenRoutes.add(astEp.path);
                discoveredRoutes.push({
                  url: astEp.path,
                  method: astEp.method,
                  sourceFile: sourcePath,
                  params: astEp.params,
                });
              }
            }
            for (const sec of astRes.secrets) {
              extractedSecrets.push({
                type: sec.type,
                value: sec.value,
                sourceFile: sourcePath,
              });
            }

            // B) Extract TypeScript Interfaces & Zod Validation Schemas
            extractedSchemas.push(...this.extractSchemasFromSource(fileContent, sourcePath));

            // C) Direct regex route sweep
            let match: RegExpExecArray | null;
            while ((match = routeRegex.exec(fileContent)) !== null) {
              const rawRoute = match[1];
              if (!rawRoute.startsWith('//') && !rawRoute.startsWith('/*') && rawRoute.length > 2 && !seenRoutes.has(rawRoute)) {
                seenRoutes.add(rawRoute);

                // Infer HTTP method if near axios / fetch calls
                let method = 'GET';
                const index = match.index;
                const snippet = fileContent.slice(Math.max(0, index - 60), index + rawRoute.length + 30).toLowerCase();
                if (snippet.includes('.post(') || snippet.includes("method: 'post'") || snippet.includes('method: "post"')) {
                  method = 'POST';
                } else if (snippet.includes('.put(') || snippet.includes("method: 'put'")) {
                  method = 'PUT';
                } else if (snippet.includes('.delete(') || snippet.includes("method: 'delete'")) {
                  method = 'DELETE';
                } else if (snippet.includes('.patch(') || snippet.includes("method: 'patch'")) {
                  method = 'PATCH';
                }

                discoveredRoutes.push({
                  url: rawRoute,
                  method,
                  sourceFile: sourcePath
                });
              }
            }
          }

          for (const dr of discoveredRoutes) {
            const cleanPath = dr.url.startsWith('/') ? dr.url : '/' + dr.url;
            const item: SiteMapRequest = {
              id: `sourcemap-${cleanHost}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-${dr.method}`,
              host: cleanHost,
              method: dr.method,
              url: cleanPath,
              path: cleanPath,
              params: cleanPath.includes('?') || Boolean(dr.params && dr.params.length > 0),
              status: 0,
              length: 0,
              mime: 'endpoint',
              title: `Source Map: ${cleanPath}`,
              notes: `Extracted from unminified developer source: ${dr.sourceFile.slice(-50)} (${dr.method})`,
              requestRaw: `${dr.method} ${cleanPath} HTTP/1.1\r\nHost: ${cleanHost}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
              responseRaw: `HTTP/1.1 (Not requested yet - discovered via JavaScript Source Map)\r\n\r\nSource file: ${dr.sourceFile}`,
              reqAttributes: { Method: dr.method, Path: cleanPath, Source: 'SourceMap' },
              reqHeaders: { Host: cleanHost },
              resAttributes: { Status: 'Discovered', SourceFile: dr.sourceFile },
              resHeaders: {},
              isDiscovered: true,
            };

            if (onItemDiscovered) {
              onItemDiscovered(item);
            }
          }

          const lazyChunks = scriptBodyCache
            ? jsluiceMiningService.synthesizeUnloadedChunkUrls(scriptBodyCache, `https://${cleanHost}`)
            : [];

          if (discoveredRoutes.length > 0 || extractedSecrets.length > 0 || extractedSchemas.length > 0 || lazyChunks.length > 0) {
            return {
              scriptUrl,
              sourceMapUrl: candidateMapUrl,
              sourceFilesCount: sources.length,
              extractedRoutes: discoveredRoutes,
              extractedSecrets,
              extractedSchemas,
              synthesizedLazyChunks: lazyChunks,
              nextServerActions,
            };
          }
        }
      }
    } catch {}

    // 2. Fallback: Source map not published. Mine the script bundle directly with JSluice + Lazy Chunk Synthesizer!
    try {
      const scriptContent = scriptBodyCache || (await stealthCdpBrowserDriver.fetchInBrowser(scriptUrl));
      if (scriptContent && scriptContent.trim().length > 30 && !scriptContent.includes('<!DOCTYPE')) {
        const jsluiceRes = jsluiceMiningService.parseScriptContent(scriptContent, scriptUrl, cleanHost);
        const lazyChunks = jsluiceMiningService.synthesizeUnloadedChunkUrls(scriptContent, `https://${cleanHost}`);
        const extractedSchemas = this.extractSchemasFromSource(scriptContent, scriptUrl);
        const discoveredRoutes: Array<{ url: string; method: string; sourceFile: string; params?: string[] }> = [];
        const nextServerActions: Array<{ url: string; method: string; sourceFile: string }> = [];
        const extractedSecrets = jsluiceRes.secrets.map((s) => ({
          type: s.type,
          value: s.value,
          sourceFile: scriptUrl,
        }));

        for (const ep of jsluiceRes.endpoints) {
          const cleanPath = ep.path.startsWith('/') ? ep.path : '/' + ep.path;
          if (cleanPath.startsWith('/_next/action/')) {
            nextServerActions.push({ url: cleanPath, method: ep.method, sourceFile: scriptUrl });
          }
          discoveredRoutes.push({
            url: cleanPath,
            method: ep.method,
            sourceFile: scriptUrl,
            params: ep.params,
          });

          const item: SiteMapRequest = {
            id: `bundle-jsluice-${cleanHost}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-${ep.method}`,
            host: cleanHost,
            method: ep.method,
            url: cleanPath,
            path: cleanPath,
            params: ep.params.length > 0 || cleanPath.includes('?'),
            status: 0,
            length: 0,
            mime: ep.category === 'GraphQL' ? 'GraphQL' : 'endpoint',
            title: `Bundle Route: ${ep.method} ${cleanPath}`,
            notes: `Discovered by JSluice from script ${scriptUrl.slice(-40)} [${ep.category}]`,
            requestRaw: `${ep.method} ${cleanPath} HTTP/1.1\r\nHost: ${cleanHost}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
            responseRaw: `HTTP/1.1 0 Unrequested\r\n\r\n(Discovered via JSluice Bundle Mining — click '⚡ Request item' to fetch live response)`,
            reqAttributes: { Method: ep.method, Path: cleanPath, Source: 'JSluice-Bundle' },
            reqHeaders: { Host: cleanHost },
            resAttributes: { Status: '0 (Unrequested)', Source: 'JSluice-Bundle' },
            resHeaders: {},
            isDiscovered: true,
          };

          if (onItemDiscovered) {
            onItemDiscovered(item);
          }
        }

        if (discoveredRoutes.length > 0 || extractedSecrets.length > 0 || extractedSchemas.length > 0 || lazyChunks.length > 0) {
          return {
            scriptUrl,
            sourceFilesCount: 1,
            extractedRoutes: discoveredRoutes,
            extractedSecrets,
            extractedSchemas,
            synthesizedLazyChunks: lazyChunks,
            nextServerActions,
          };
        }
      }
    } catch {}

    return null;
  }
}

export const sourceMapRouteMiner = new SourceMapRouteMiner();
