/**
 * Sentinel Sovereign Ω - Unified Dual-Mode Recon Orchestrator
 *
 * Streamlined into exactly two industry-leading pipelines:
 * 1. 🥷 STEALTH MODE — Sovereign Browser Engine (CDP + FSM State-Flow Graph + Native Anti-Bot Bypass)
 *    - Real system Chrome with native C++ PluginArray & WebIDL bindings
 *    - Solves wsidchk and modern fingerprint challenges natively without detection
 *    - Crawljax-inspired DOM State-Flow Graph (SFG) navigation
 *    - Strict Destructive Action Safety Kernel (blocks /logout, delete, pay, drop actions)
 *    - Transparent MITM proxy stream interception + in-memory JS AST analysis
 *
 * 2. ⚡ NORMAL MODE — Titan High-Throughput HTTP Recon Pipeline
 *    - 1/4: GAU (Wayback Machine + AlienVault OTX + URLScan historical archive mining)
 *    - 2/4: Katana (Next-Gen BFS HTML spider, DOM surface & form/button mining)
 *    - 3/4: JSluice (BishopFox Tree-Sitter AST JavaScript route & secret extractor)
 *    - 4/4: Arjun (Differential hidden HTTP parameter discovery)
 */

import { katanaCrawlerService } from './KatanaCrawlerService';
import { gauArchiveService } from './GauArchiveService';
import { jsluiceMiningService } from './JSluiceMiningService';
import { arjunParamDiscoveryService, DiscoveredParameter } from './ArjunParamDiscoveryService';
import { stateFlowGraphCrawler } from './StateFlowGraphCrawler';
import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { idorAndHiddenEndpointHunter } from './IdorAndHiddenEndpointHunter';
import { WORDLIST_ADMIN, WORDLIST_SENSITIVE_FILES, WORDLIST_BACKUPS } from './ContentDiscoveryEngine';
import { TargetSiteCrawler } from '../sqlScanner/crawler/TargetSiteCrawler';
import { robotsTxtDiscoveryService } from './RobotsTxtDiscoveryService';
import { GraphQLEngine } from '../graphql/GraphQLEngine';

export type ReconEngineType = 'normal' | 'stealth' | 'hidden_endpoints';

export interface UnifiedReconProgress {
  activePhase: string;
  activeEngine: ReconEngineType;
  totalDiscovered: number;
  engineCounts: {
    katana: number;
    gau: number;
    jsluice: number;
    arjun: number;
    ffuf: number;
    stealth: number;
  };
  currentActivity: string;
}

export interface UnifiedReconConfig {
  targetHost: string;
  targetUrl: string;
  seedUrls?: string[];
  engine?: ReconEngineType | 'all' | 'hybrid'; // accepts 'all'/'hybrid' as alias to normal
  maxDepth?: number;
  interactionDelayMs?: number;
  runArjunOnDiscovered?: boolean;
  authHeaders?: Record<string, string>;
  onProgress?: (progress: UnifiedReconProgress) => void;
  onItemDiscovered?: (item: SiteMapRequest, engine: 'katana' | 'gau' | 'jsluice' | 'arjun' | 'ffuf' | 'stealth') => void;
}

export class UnifiedReconOrchestrator {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
    stateFlowGraphCrawler.abort();
    katanaCrawlerService.abort();
    gauArchiveService.abort();
    jsluiceMiningService.abort();
    arjunParamDiscoveryService.abort();
  }

  /**
   * Executes either Stealth Mode, Normal Mode, or Hidden Endpoints Hunter
   */
  public async runRecon(config: UnifiedReconConfig): Promise<SiteMapRequest[]> {
    this.isAborted = false;
    const {
      targetHost,
      targetUrl,
      engine = 'normal',
      maxDepth = 2,
      runArjunOnDiscovered = false,
      authHeaders,
      onProgress,
      onItemDiscovered,
    } = config;

    const normalizedEngine: ReconEngineType =
      engine === 'stealth' ? 'stealth' : engine === 'hidden_endpoints' ? 'hidden_endpoints' : 'normal';

    const discoveredMap = new Map<string, SiteMapRequest>();
    const engineCounts = {
      katana: 0,
      gau: 0,
      jsluice: 0,
      arjun: 0,
      ffuf: 0,
      stealth: 0,
    };

    const scriptUrlsFound: string[] = [];
    const dynamicSeedUrls: string[] = [...(config.seedUrls || [])];

    const updateStatus = (phase: string, activity: string) => {
      if (onProgress) {
        onProgress({
          activePhase: phase,
          activeEngine: normalizedEngine,
          totalDiscovered: discoveredMap.size,
          engineCounts: { ...engineCounts },
          currentActivity: activity,
        });
      }
    };

    const pushItem = (item: SiteMapRequest, eng: 'katana' | 'gau' | 'jsluice' | 'arjun' | 'ffuf' | 'stealth') => {
      const key = `${item.method}:${item.host}${item.path}`;
      if (!discoveredMap.has(key)) {
        discoveredMap.set(key, item);
        engineCounts[eng]++;
        if (onItemDiscovered) onItemDiscovered(item, eng);
        updateStatus(`Discovered ${item.path}`, `+1 endpoint via ${eng.toUpperCase()}`);
      }
    };

    // ═════════════════════════════════════════════════════════════════
    // MODE 1: 🥷 SOVEREIGN STEALTH MODE (Browser CDP + State-Flow Graph)
    // ═════════════════════════════════════════════════════════════════
    if (normalizedEngine === 'stealth') {
      updateStatus('Stealth Browser Crawl', 'Launching live Chrome via CDP, scrolling, clicking buttons & typing queries...');
      try {
        const stealthItems = await stateFlowGraphCrawler.runStealthCrawl({
          targetHost,
          targetUrl,
          seedUrls: dynamicSeedUrls,
          maxStates: 80,
          maxClicksPerState: 40,
          interactionDelayMs: config.interactionDelayMs || 500,
          onProgress: (states, _total, cur) =>
            updateStatus(`Stealth Crawl (${states} states)`, cur),
          onItemDiscovered: (item) => {
            pushItem(item, 'stealth');
            const full = item.url.startsWith('http') ? item.url : `https://${targetHost}${item.path}`;
            if (!dynamicSeedUrls.includes(full)) {
              dynamicSeedUrls.push(full);
            }
          },
        });
        engineCounts.stealth = stealthItems.length;
      } catch (err) {
        console.warn('Stealth SFG Phase error:', err);
        updateStatus('Stealth SFG Error', err instanceof Error ? err.message : String(err));
        throw err;
      }

      updateStatus('Stealth Recon Completed', `Finished. Mapped ${discoveredMap.size} surfaces without detection.`);
      return Array.from(discoveredMap.values());
    }

    // ═════════════════════════════════════════════════════════════════
    // MODE 3: 🔍 DEDICATED HIDDEN ENDPOINTS & API HUNTER PIPELINE
    // ═════════════════════════════════════════════════════════════════
    if (normalizedEngine === 'hidden_endpoints') {
      updateStatus('1/4: API Entrypoints & Schemas', 'Probing standard OpenAPI, Swagger, GraphQL, and .well-known routes...');
      try {
        await stealthCdpBrowserDriver.connect(targetUrl, targetHost);
      } catch {}

      // Stage 1: API Entrypoints & Specifications
      const apiEntrypoints = [
        '/.well-known/openid-configuration',
        '/.well-known/assetlinks.json',
        '/.well-known/security.txt',
        '/swagger.json',
        '/swagger/v1/swagger.json',
        '/openapi.json',
        '/v2/api-docs',
        '/v3/api-docs',
        '/api-docs',
        '/swagger-ui.html',
        '/docs',
        '/api/v1',
        '/api/v2',
        '/graphql',
        '/graphiql',
        '/altair',
        '/actuator',
        '/actuator/health'
      ];

      for (const ep of apiEntrypoints) {
        if (this.isAborted) break;
        const epUrl = `https://${targetHost}${ep}`;
        try {
          const resp = await stealthCdpBrowserDriver.fetchInBrowserDetails(epUrl);
          if (resp && resp.status >= 200 && resp.status < 400 && !TargetSiteCrawler.isNotFoundResponse(resp.status, resp.body) && !TargetSiteCrawler.isChallengeOrWafResponse(resp.status, resp.body)) {
            const mimeType = ep.endsWith('.json') ? 'JSON' : ep.includes('graphql') ? 'JSON' : 'HTML';
            const item: SiteMapRequest = {
              id: `hidden-api-${targetHost}-${ep.replace(/[^a-zA-Z0-9]/g, '_')}`,
              host: targetHost,
              method: 'GET',
              url: ep,
              path: ep,
              params: false,
              status: resp.status,
              length: resp.body ? resp.body.length : 0,
              mime: mimeType,
              title: `[API Schema] ${ep}`,
              notes: `Discovered via Hidden Endpoints Hunter (${resp.status} ${resp.statusText})`,
              requestRaw: `GET ${ep} HTTP/1.1\r\nHost: ${targetHost}\r\n`,
              responseRaw: `HTTP/1.1 ${resp.status} ${resp.statusText}\r\n\r\n${resp.body}`,
              reqAttributes: { Method: 'GET', Path: ep, Source: 'HiddenEndpoint-API' },
              reqHeaders: { Host: targetHost },
              resAttributes: { Status: `${resp.status}`, Source: 'API Entrypoint' },
              resHeaders: resp.headers || {},
              isDiscovered: true,
            };
            pushItem(item, 'ffuf');

            // If GraphQL endpoint was discovered, automatically run schema introspection
            if (ep === '/graphql' || ep.includes('graphql')) {
              try {
                const gql = new GraphQLEngine(epUrl, authHeaders || {});
                const schema = await gql.fetchIntrospection();
                if (schema && (schema.queries.length > 0 || schema.mutations.length > 0)) {
                  updateStatus('GraphQL Schema Extracted', `Introspected ${schema.queries.length} queries & ${schema.mutations.length} mutations on ${ep}`);
                  for (const q of schema.queries) {
                    const qPath = `${ep}?query=${encodeURIComponent(`{ ${q.name} }`)}`;
                    pushItem({
                      id: `gql-q-${targetHost}-${q.name}`,
                      host: targetHost,
                      method: 'POST',
                      url: qPath,
                      path: qPath,
                      params: true,
                      status: 200,
                      length: 0,
                      mime: 'JSON',
                      title: `[GraphQL Query] ${q.name}`,
                      notes: `Discovered via Schema Introspection (${q.isSensitive ? '🚨 Sensitive Field' : 'Query'})`,
                      requestRaw: `POST ${ep} HTTP/1.1\r\nHost: ${targetHost}\r\nContent-Type: application/json\r\n\r\n{"query":"query { ${q.name} }"}\r\n`,
                      responseRaw: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"data":{}}',
                      reqAttributes: { Method: 'POST', Path: qPath, Source: 'GraphQL-Introspection' },
                      reqHeaders: { Host: targetHost, 'Content-Type': 'application/json' },
                      resAttributes: { Status: '200', GraphQL: 'Query' },
                      resHeaders: {},
                      isDiscovered: true,
                    }, 'ffuf');
                  }
                  for (const m of schema.mutations) {
                    const mPath = `${ep}?mutation=${encodeURIComponent(`mutation { ${m.name} }`)}`;
                    pushItem({
                      id: `gql-m-${targetHost}-${m.name}`,
                      host: targetHost,
                      method: 'POST',
                      url: mPath,
                      path: mPath,
                      params: true,
                      status: 200,
                      length: 0,
                      mime: 'JSON',
                      title: `[GraphQL Mutation] ${m.name}`,
                      notes: `Discovered via Schema Introspection (${m.isSensitive ? '🚨 Sensitive Mutation' : 'Mutation'})`,
                      requestRaw: `POST ${ep} HTTP/1.1\r\nHost: ${targetHost}\r\nContent-Type: application/json\r\n\r\n{"query":"mutation { ${m.name} }"}\r\n`,
                      responseRaw: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"data":{}}',
                      reqAttributes: { Method: 'POST', Path: mPath, Source: 'GraphQL-Introspection' },
                      reqHeaders: { Host: targetHost, 'Content-Type': 'application/json' },
                      resAttributes: { Status: '200', GraphQL: 'Mutation' },
                      resHeaders: {},
                      isDiscovered: true,
                    }, 'ffuf');
                  }
                }
              } catch (gqlErr) {
                console.warn('GraphQL introspection probe error:', gqlErr);
              }
            }
          }
        } catch {}
      }

      // Stage 2: Curated Sensitive Paths & Wordlist Fuzzing
      updateStatus('2/4: Hidden Configurations & Backups', 'Auditing sensitive configuration, env, and archive endpoints...');
      const sensitiveList = [
        ...WORDLIST_SENSITIVE_FILES.slice(0, 15),
        ...WORDLIST_BACKUPS.slice(0, 10),
        ...WORDLIST_ADMIN.slice(0, 10)
      ];
      for (const sPath of sensitiveList) {
        if (this.isAborted) break;
        const probeUrl = `https://${targetHost}${sPath}`;
        try {
          const resp = await stealthCdpBrowserDriver.fetchInBrowserDetails(probeUrl);
          if (resp && (resp.status === 200 || resp.status === 401 || resp.status === 403) && !TargetSiteCrawler.isNotFoundResponse(resp.status, resp.body) && !TargetSiteCrawler.isChallengeOrWafResponse(resp.status, resp.body)) {
            const item: SiteMapRequest = {
              id: `hidden-config-${targetHost}-${sPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
              host: targetHost,
              method: 'GET',
              url: sPath,
              path: sPath,
              params: false,
              status: resp.status,
              length: resp.body ? resp.body.length : 0,
              mime: sPath.endsWith('.json') ? 'JSON' : sPath.endsWith('.zip') || sPath.endsWith('.sql') ? 'other' : 'HTML',
              title: `[Hidden Path] ${sPath}`,
              notes: `Discovered via Hidden Endpoints Hunter (${resp.status} ${resp.statusText})`,
              requestRaw: `GET ${sPath} HTTP/1.1\r\nHost: ${targetHost}\r\n`,
              responseRaw: `HTTP/1.1 ${resp.status} ${resp.statusText}\r\n\r\n${resp.body.slice(0, 2000)}`,
              reqAttributes: { Method: 'GET', Path: sPath, Source: 'HiddenEndpoint-Sensitive' },
              reqHeaders: { Host: targetHost },
              resAttributes: { Status: `${resp.status}`, Source: 'Sensitive File Probe' },
              resHeaders: resp.headers || {},
              isDiscovered: true,
            };
            pushItem(item, 'ffuf');
          }
        } catch {}
      }

      // Stage 3: GAU Historical Route Mining
      updateStatus('3/4: Historical Route Mining', 'Harvesting unlinked endpoints from historical web archives...');
      try {
        const gauItems = await gauArchiveService.runGauMining({
          targetDomain: targetHost,
          limit: 150,
          onProgress: (cnt, src) => updateStatus('3/4: Historical Route Mining', `Found ${cnt} historical routes from ${src}`),
          onItemDiscovered: (item) => pushItem(item, 'gau'),
        });
        engineCounts.gau = gauItems.length;
      } catch (err) {
        console.warn('GAU mining in hidden endpoint pipeline error:', err);
      }
      // Stage 3b: Robots.txt Disallowed & Recursive XML Sitemap Mining
      try {
        const rResult = await robotsTxtDiscoveryService.fetchAndParseRobotsTxt(targetUrl);
        const rEntries = robotsTxtDiscoveryService.generateSiteMapEntries(targetHost, rResult, (item) => pushItem(item, 'ffuf'));
        for (const re of rEntries) {
          pushItem(re, 'ffuf');
        }
      } catch (err) {
        console.warn('Robots.txt & Sitemap mining in hidden endpoint pipeline error:', err);
      }

      // Stage 4: IDOR Object Reference & Groq AI Route Extrapolation
      updateStatus('4/4: IDOR & Object Reference Audit', 'Auditing object references and predicting framework routes...');
      try {
        const pathsForPrediction = Array.from(discoveredMap.values()).map((i) => i.path);
        if (pathsForPrediction.length > 0) {
          const predicted = await idorAndHiddenEndpointHunter.predictHiddenEndpointsWithGroq(
            targetHost,
            pathsForPrediction,
            (item) => pushItem(item, 'ffuf')
          );
          for (const predPath of predicted) {
            if (this.isAborted) break;
            const predUrl = `https://${targetHost}${predPath}`;
            try {
              const pResp = await stealthCdpBrowserDriver.fetchInBrowserDetails(predUrl);
              if (pResp && pResp.status >= 200 && pResp.status < 400 && !TargetSiteCrawler.isNotFoundResponse(pResp.status, pResp.body)) {
                pushItem({
                  id: `hidden-ai-${targetHost}-${predPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
                  host: targetHost,
                  method: 'GET',
                  url: predPath,
                  path: predPath,
                  params: predPath.includes('?'),
                  status: pResp.status,
                  length: pResp.body.length,
                  mime: predPath.endsWith('.json') ? 'JSON' : 'HTML',
                  title: `[AI Predicted] ${predPath}`,
                  notes: `AI Predicted Route (${pResp.status} ${pResp.statusText})`,
                  requestRaw: `GET ${predPath} HTTP/1.1\r\nHost: ${targetHost}\r\n`,
                  responseRaw: `HTTP/1.1 ${pResp.status} ${pResp.statusText}\r\n\r\n${pResp.body.slice(0, 1500)}`,
                  reqAttributes: { Method: 'GET', Path: predPath, Source: 'AI-Hidden-Hunter' },
                  reqHeaders: { Host: targetHost },
                  resAttributes: { Status: `${pResp.status}`, Source: 'AI Prediction' },
                  resHeaders: pResp.headers || {},
                  isDiscovered: true,
                }, 'ffuf');
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn('IDOR/AI prediction error in hidden endpoint pipeline:', err);
      }

      updateStatus('Hidden Endpoints Hunter Completed', `Finished. Uncovered ${discoveredMap.size} hidden & API surfaces.`);
      return Array.from(discoveredMap.values());
    }

    // ═════════════════════════════════════════════════════════════════
    // MODE 2: ⚡ TITAN NORMAL MODE (Unified 5-Engine HTTP Pipeline)
    // ═════════════════════════════════════════════════════════════════

    // Stage 0: Robots.txt & Comprehensive XML Sitemap Index Dredging
    if (!this.isAborted) {
      updateStatus('Robots.txt & Sitemap Mining', 'Dredging disallowed admin paths and recursive XML sitemaps...');
      try {
        const robotsResult = await robotsTxtDiscoveryService.fetchAndParseRobotsTxt(targetUrl);
        const sitemapEntries = robotsTxtDiscoveryService.generateSiteMapEntries(targetHost, robotsResult, (item) => pushItem(item, 'katana'));
        for (const smItem of sitemapEntries) {
          pushItem(smItem, 'katana');
          const full = smItem.url.startsWith('http') ? smItem.url : `https://${targetHost}${smItem.path}`;
          if (!dynamicSeedUrls.includes(full)) {
            dynamicSeedUrls.push(full);
          }
        }
      } catch (err) {
        console.warn('Robots.txt & Sitemap Mining error:', err);
      }
    }

    // Stage 1: GAU Archive Harvesting (Wayback, AlienVault, URLScan)
    if (!this.isAborted) {
      updateStatus('1/4: GAU Historical Mining', 'Harvesting Wayback, AlienVault OTX, URLScan...');
      try {
        const gauItems = await gauArchiveService.runGauMining({
          targetDomain: targetHost,
          limit: 300,
          onProgress: (cnt, src) => updateStatus('1/4: GAU Historical Mining', `Fetched ${cnt} historical URLs from ${src}`),
          onItemDiscovered: (item) => pushItem(item, 'gau'),
        });
        engineCounts.gau = gauItems.length;
      } catch (err) {
        console.warn('GAU Archive Phase error:', err);
      }
    }

    // Stage 2: Katana Next-Gen Web Spidering (DOM, Forms, Buttons, Fuzzing)
    if (!this.isAborted) {
      updateStatus('2/4: Katana BFS Deep Spider', 'Crawling HTML DOM, extracting buttons, forms, and links...');
      try {
        await katanaCrawlerService.runKatanaCrawl({
          targetHost,
          targetUrl,
          seedUrls: dynamicSeedUrls,
          maxDepth,
          enableFuzzing: true,
          authHeaders,
          onProgress: (_cnt, cur) => updateStatus('2/4: Katana BFS Deep Spider', `Surveying DOM surface: ${cur}`),
          onItemDiscovered: (item) => {
            const isFuzz = item.source === 'fuzz';
            const eng = isFuzz ? 'ffuf' : 'katana';
            pushItem({
              id: item.id,
              host: item.host,
              method: item.method,
              url: item.path,
              path: item.path,
              params: item.params,
              status: item.status,
              length: item.length,
              mime: item.mime,
              title: item.title,
              notes: item.notes,
              requestRaw: item.rawRequest,
              responseRaw: item.rawResponse,
              reqAttributes: { Method: item.method, Path: item.path },
              reqHeaders: { Host: item.host },
              resAttributes: { Status: `${item.status}`, MIME: item.mime },
              resHeaders: {},
              isDiscovered: true,
            }, eng);

            if (item.path.endsWith('.js') || item.mime === 'script') {
              scriptUrlsFound.push(item.url.startsWith('http') ? item.url : `https://${targetHost}${item.path}`);
            }
          },
        });
      } catch (err) {
        console.warn('Katana Spider Phase error:', err);
      }
    }

    // Stage 3: JSluice Deep JavaScript AST & Secret Extraction
    if (!this.isAborted) {
      updateStatus('3/4: JSluice AST Route Mining', `Mining ${scriptUrlsFound.length} script bundles for hidden API routes...`);
      try {
        const jsluiceItems = await jsluiceMiningService.runJSluiceMining({
          targetHost,
          scriptUrls: scriptUrlsFound.length > 0 ? scriptUrlsFound : [`https://${targetHost}/main.js`, `https://${targetHost}/app.js`],
          onProgress: (cnt, cur) => updateStatus('3/4: JSluice AST Route Mining', `Analyzing AST in ${cur} (${cnt} routes found)`),
          onItemDiscovered: (item) => pushItem(item, 'jsluice'),
        });
        engineCounts.jsluice = jsluiceItems.length;
      } catch (err) {
        console.warn('JSluice Phase error:', err);
      }
    }

    // Stage 4: Arjun Hidden Parameter Discovery (Targeted Heuristics)
    if (!this.isAborted && runArjunOnDiscovered !== false) {
      const candidates = Array.from(discoveredMap.values())
        .filter((r) => r.path !== '/' && !r.path.includes('.') && r.status < 400)
        .slice(0, 5);

      if (candidates.length === 0) {
        candidates.push({
          id: 'root-probe',
          host: targetHost,
          method: 'GET',
          url: '/',
          path: '/',
          params: false,
          status: 200,
          length: 0,
          mime: 'HTML',
          title: 'Root',
          notes: 'Root endpoint for param discovery',
          requestRaw: '',
          responseRaw: '',
          reqAttributes: {},
          reqHeaders: {},
          resAttributes: {},
          resHeaders: {},
        });
      }

      for (const cand of candidates) {
        if (this.isAborted) break;
        updateStatus('4/4: Arjun Parameter Discovery', `Probing hidden parameters on ${cand.path}...`);
        try {
          await arjunParamDiscoveryService.runParameterDiscovery({
            targetHost,
            targetUrl: cand.path,
            authHeaders,
            onProgress: (tested, total, found, cur) =>
              updateStatus('4/4: Arjun Parameter Discovery', `Testing parameter "${cur}" [${tested}/${total}] (${found} found)`),
            onParamDiscovered: (param: DiscoveredParameter) => {
              const fullPathWithParam = `${cand.path}${cand.path.includes('?') ? '&' : '?'}${param.param}=1`;
              pushItem({
                id: `arjun-${Date.now()}-${param.param}`,
                host: targetHost,
                method: 'GET',
                url: fullPathWithParam,
                path: fullPathWithParam,
                params: true,
                status: param.statusCode,
                length: param.injectedLength,
                mime: 'param-discovery',
                title: `${cand.path} ? ${param.param}`,
                notes: `Discovered by Arjun (${param.evidence})`,
                requestRaw: param.rawRequest || `GET ${fullPathWithParam} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Arjun\r\n\r\n`,
                responseRaw: param.rawResponse || `HTTP/1.1 ${param.statusCode} OK\r\n\r\n(Parameter discovered)`,
                reqAttributes: { Method: 'GET', Path: fullPathWithParam, Parameter: param.param },
                reqHeaders: { Host: targetHost },
                resAttributes: { Status: `${param.statusCode}`, Parameter: param.param },
                resHeaders: {},
                isDiscovered: true,
              }, 'arjun');
            },
          });
        } catch (err) {
          console.warn('Arjun Phase error:', err);
        }
      }
    }

    if (!this.isAborted && stealthCdpBrowserDriver.connected) {
      updateStatus('Resolving Discovered Endpoints', 'Fetching live server responses and pruning 404s...');
      try {
        await stateFlowGraphCrawler.resolveUnrequestedDiscoveredItems(
          targetHost,
          (msg) => updateStatus('Resolving Discovered Endpoints', msg),
          (item) => pushItem(item, 'katana'),
          35
        );
      } catch {}
    }

    updateStatus('Normal Recon Completed', `Finished. Discovered ${discoveredMap.size} unique endpoints.`);
    return Array.from(discoveredMap.values());
  }
}

export const unifiedReconOrchestrator = new UnifiedReconOrchestrator();
