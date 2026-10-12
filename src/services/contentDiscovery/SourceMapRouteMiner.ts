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
   * Attempts to discover, download, and unpack source maps for a given script URL.
   * If source maps are unavailable (standard in production), automatically falls back
   * to deep JSluice AST and regex route mining directly on the script bundle.
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

    // 1. Try discovering standard .map file
    const candidateMapUrl = scriptUrl.split('?')[0] + '.map';

    try {
      const mapContent = await stealthCdpBrowserDriver.fetchInBrowser(candidateMapUrl);
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

          const discoveredRoutes: Array<{ url: string; method: string; sourceFile: string }> = [];
          const routeRegex = /['"](\/(?:api|v[0-9]+|admin|ajax|graphql|internal|user|auth|dashboard|settings|upload|export)[a-zA-Z0-9_\-\.\/\?=&%#]*)['"]/gi;
          const seenRoutes = new Set<string>();

          // Scan un-minified original developer source files
          for (let i = 0; i < sourcesContent.length; i++) {
            const fileContent = sourcesContent[i];
            const sourcePath = sources[i] || `source_${i}.ts`;
            if (typeof fileContent !== 'string') continue;

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

                // Convert to SiteMapRequest
                const cleanPath = rawRoute.startsWith('/') ? rawRoute : '/' + rawRoute;
                const item: SiteMapRequest = {
                  id: `sourcemap-${cleanHost}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-${method}`,
                  host: cleanHost,
                  method,
                  url: cleanPath,
                  path: cleanPath,
                  params: cleanPath.includes('?'),
                  status: 0,
                  length: 0,
                  mime: 'endpoint',
                  title: `Source Map: ${cleanPath}`,
                  notes: `Extracted from unminified developer source: ${sourcePath.slice(-50)} (${method})`,
                  requestRaw: `${method} ${cleanPath} HTTP/1.1\r\nHost: ${cleanHost}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
                  responseRaw: `HTTP/1.1 (Not requested yet - discovered via JavaScript Source Map)\r\n\r\nSource file: ${sourcePath}`,
                  reqAttributes: { Method: method, Path: cleanPath, Source: 'SourceMap' },
                  reqHeaders: { Host: cleanHost },
                  resAttributes: { Status: 'Discovered', SourceFile: sourcePath },
                  resHeaders: {},
                  isDiscovered: true,
                };

                if (onItemDiscovered) {
                  onItemDiscovered(item);
                }
              }
            }
          }

          if (discoveredRoutes.length > 0) {
            return {
              scriptUrl,
              sourceMapUrl: candidateMapUrl,
              sourceFilesCount: sources.length,
              extractedRoutes: discoveredRoutes
            };
          }
        }
      }
    } catch {}

    // 2. Fallback: Source map not published. Mine the script bundle directly with JSluice!
    try {
      const scriptContent = await stealthCdpBrowserDriver.fetchInBrowser(scriptUrl);
      if (scriptContent && scriptContent.trim().length > 30 && !scriptContent.includes('<!DOCTYPE')) {
        const jsluiceRes = jsluiceMiningService.parseScriptContent(scriptContent, scriptUrl, cleanHost);
        const discoveredRoutes: Array<{ url: string; method: string; sourceFile: string }> = [];

        for (const ep of jsluiceRes.endpoints) {
          const cleanPath = ep.path.startsWith('/') ? ep.path : '/' + ep.path;
          discoveredRoutes.push({
            url: cleanPath,
            method: ep.method,
            sourceFile: scriptUrl
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

        if (discoveredRoutes.length > 0) {
          return {
            scriptUrl,
            sourceFilesCount: 1,
            extractedRoutes: discoveredRoutes
          };
        }
      }
    } catch {}

    return null;
  }
}

export const sourceMapRouteMiner = new SourceMapRouteMiner();
