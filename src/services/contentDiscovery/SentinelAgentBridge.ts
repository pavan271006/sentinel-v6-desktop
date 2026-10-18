/**
 * Sentinel Sovereign Ω - AI Agent Knowledge Base & Tool Bridge
 * src/services/contentDiscovery/SentinelAgentBridge.ts
 *
 * Provides a unified, programmatic Knowledge Base and Tool Registry (OpenAI / Anthropic / Groq / MCP
 * function-calling compatible) so AI agents can invoke Sentinel's stealth browser, infrastructure
 * de-cloaking, AST/SourceMap dredging, and historical archive engines via single tool calls without
 * writing repetitive reconnaissance or scraping code.
 */

import { infrastructureOriginService, InfrastructureReconReport } from './InfrastructureOriginService';
import { sourceMapRouteMiner, SourceMapDiscoveryResult } from './SourceMapRouteMiner';
import { jsluiceMiningService, JSluiceMiningService, JSluiceDiscoveredEndpoint, JSluiceDiscoveredSecret } from './JSluiceMiningService';
import { multiSourceEndpointMiner, DiscoveredEndpoint } from './MultiSourceEndpointMiner';
import { endpointNormalizer, ClusterGroup } from './EndpointNormalizer';
import { gauArchiveService, GauDiscoveredUrl } from './GauArchiveService';
import { robotsTxtDiscoveryService } from './RobotsTxtDiscoveryService';
import { arjunParamDiscoveryService, DiscoveredParameter } from './ArjunParamDiscoveryService';
import { idorAndHiddenEndpointHunter, IdorFinding } from './IdorAndHiddenEndpointHunter';
import { stealthCdpBrowserDriver, BrowserFetchResult } from './StealthCdpBrowserDriver';
import { clientRuntimeOmniscienceService, DredgedStorageItem } from './ClientRuntimeOmniscienceService';
import { stateFlowGraphCrawler } from './StateFlowGraphCrawler';
import { unifiedReconOrchestrator } from './UnifiedReconOrchestrator';
import { useReconStore } from '../../stores/reconStore';
import { useTrafficStore } from '../../stores/trafficStore';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { HttpHeaderItem } from '../../types/traffic';
import {
  debugApiDocDiscoveryService,
  DiscoveredApiDoc,
  GraphqlIntrospectionResult,
  ExposedDebugFinding,
} from './DebugApiDocDiscoveryService';
import { ipcClient } from '../../ipc/client';
import { TurboIntruderEngine } from '../fuzzer/TurboIntruderEngine';
import { NucleiTemplateEngine } from '../scanner/NucleiTemplateEngine';
import { parseHttpql, evaluateHttpql } from '../../utils/httpql';

export interface WebsiteKnowledgeBase {
  target: {
    host: string;
    rootUrl: string;
    capturedAt: number;
    detectedCdnOrWaf: string | null;
    detectedSaasEcosystem: string[];
  };
  pillar1_infrastructure: InfrastructureReconReport;
  pillar2_staticClientDredging: {
    unpackedSourceMaps: SourceMapDiscoveryResult[];
    astExtractedEndpoints: JSluiceDiscoveredEndpoint[];
    nextServerActions: JSluiceDiscoveredEndpoint[];
    synthesizedLazyChunks: string[];
    extractedRequestSchemas: Array<{ name: string; fields: string[]; sourceFile: string }>;
    discoveredSecrets: Array<JSluiceDiscoveredSecret & { entropy: number }>;
  };
  pillar3_dynamicBrowserCrawl: {
    cdpConnected: boolean;
    routerRoutes: DredgedStorageItem[];
    offlineStorageAndIndexedDb: DredgedStorageItem[];
    domForms: Array<{ actionUrl: string; method: string; parameters: Record<string, string> }>;
    crawledEndpointsCount: number;
  };
  pillar4_historicalArchives: {
    waybackCount: number;
    commonCrawlCount: number;
    alienVaultCount: number;
    urlScanCount: number;
    legacyApiExtrapolations: string[];
    robotsDisallowedPaths: string[];
    archivedJsBundles: string[];
    apiDocs: DiscoveredApiDoc[];
    graphqlIntrospection: GraphqlIntrospectionResult[];
    exposedDebugFindings: ExposedDebugFinding[];
  };
  clusteredAttackSurface: ClusterGroup[];
  idorCandidates: IdorFinding[];
  allDiscoveredRequests: SiteMapRequest[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export class SentinelAgentBridge {
  private knowledgeBaseCache = new Map<string, WebsiteKnowledgeBase>();

  /**
   * Returns OpenAI / Anthropic / MCP-compatible JSON Schema tool definitions for all Sentinel capabilities.
   * Pass this array directly to an LLM Agent's `tools` parameter.
   */
  public getAgentToolDefinitions(): AgentToolDefinition[] {
    return [
      {
        name: 'sentinel_capture_full_knowledge_base',
        description:
          'Executes all 4 pre-assessment reconnaissance pillars (1. Infrastructure & Origin De-cloaking, 2. Static Client-Side AST/SourceMap Dredging, 3. Dynamic Stealth Browser Crawling, 4. Historical Archive Mining) and builds a complete WebsiteKnowledgeBase for the target.',
        parameters: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'Target root URL (e.g., https://example.com)' },
            enableStealthBrowser: {
              type: 'string',
              description: 'Set to "true" to attach/launch live Stealth CDP Chrome during capture',
              enum: ['true', 'false'],
            },
          },
          required: ['targetUrl'],
        },
      },
      {
        name: 'sentinel_recon_infrastructure',
        description:
          'Pillar 1: Analyzes DNS (A/AAAA/CNAME/TXT/MX/NS/SOA/CAA), SPF/DMARC netblocks, Certificate Transparency (crt.sh) subdomains, dangling CNAME takeovers, Shodan/Censys Favicon MurmurHash3, Cloud Storage Buckets (S3/GCP/Azure/R2), and non-standard web ports.',
        parameters: {
          type: 'object',
          properties: {
            targetHost: { type: 'string', description: 'Target hostname or domain (e.g., app.example.com)' },
          },
          required: ['targetHost'],
        },
      },
      {
        name: 'sentinel_dredge_client_bundles',
        description:
          'Pillar 2: Probes and unpacks JavaScript Source Maps (.map, SourceMap headers, inline base64), executes TypeScript AST Constant-Folding, extracts Next.js Server Actions, synthesizes lazy-loaded Webpack/Vite chunks, extracts Zod/TS schemas, and scans for high-entropy secrets.',
        parameters: {
          type: 'object',
          properties: {
            targetHost: { type: 'string', description: 'Target hostname' },
            scriptUrlsJson: {
              type: 'string',
              description: 'JSON array of script URLs to dredge (optional; auto-discovers from page if omitted)',
            },
          },
          required: ['targetHost'],
        },
      },
      {
        name: 'sentinel_stealth_browser_crawl',
        description:
          'Pillar 3: Runs the human-mimetic Stealth CDP Browser Crawler with State-Flow Graph traversal, React/Vue/Next/Remix router introspection, IndexedDB/CacheStorage/GlobalState dredging, and honeypot filtering.',
        parameters: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'Target URL to crawl in Stealth Mode' },
            maxStates: { type: 'string', description: 'Maximum SPA states to visit (default: "40")' },
          },
          required: ['targetUrl'],
        },
      },
      {
        name: 'sentinel_mine_historical_archives',
        description:
          'Pillar 4: Queries Wayback Machine CDX, Common Crawl Index, AlienVault OTX, URLScan.io, and robots.txt/sitemaps concurrently, and extrapolates legacy API versions (/api/v1, /api/beta).',
        parameters: {
          type: 'object',
          properties: {
            targetDomain: { type: 'string', description: 'Target domain (e.g., example.com)' },
            limit: { type: 'string', description: 'Max URLs per archive source (default: "300")' },
          },
          required: ['targetDomain'],
        },
      },
      {
        name: 'sentinel_discover_hidden_params',
        description:
          'Runs Arjun differential HTTP parameter discovery on a specific endpoint to uncover unlinked query/body parameters (e.g., debug, admin, role, id).',
        parameters: {
          type: 'object',
          properties: {
            targetHost: { type: 'string', description: 'Target hostname' },
            endpointPath: { type: 'string', description: 'Endpoint path to probe (e.g., /api/v1/users)' },
          },
          required: ['targetHost', 'endpointPath'],
        },
      },
      {
        name: 'sentinel_audit_idor_candidates',
        description:
          'Runs non-destructive differential object-reference (IDOR/BOLA) probes on discovered endpoints containing numeric IDs, UUIDs, or object keys.',
        parameters: {
          type: 'object',
          properties: {
            targetHost: { type: 'string', description: 'Target hostname' },
            endpointUrl: { type: 'string', description: 'Endpoint URL with object reference (e.g., /api/users?id=101)' },
          },
          required: ['targetHost', 'endpointUrl'],
        },
      },
      {
        name: 'sentinel_browser_fetch',
        description:
          'Executes an HTTP request directly inside Sentinel’s live authenticated Stealth Chrome tab via CDP, automatically inheriting all anti-bot clearance cookies, TLS JA3/JA4 fingerprints, and session headers.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Full URL to request inside the browser context' },
          },
          required: ['url'],
        },
      },
      {
        name: 'sentinel_query_knowledge_base',
        description:
          'Queries the cached WebsiteKnowledgeBase for a target host by filter category (endpoints, secrets, subdomains, buckets, schemas, actions, historical).',
        parameters: {
          type: 'object',
          properties: {
            targetHost: { type: 'string', description: 'Target hostname' },
            category: {
              type: 'string',
              description: 'Section of the knowledge base to retrieve',
              enum: ['summary', 'infrastructure', 'endpoints', 'secrets', 'schemas', 'actions', 'historical', 'clusters'],
            },
            searchKeyword: { type: 'string', description: 'Optional keyword filter' },
          },
          required: ['targetHost', 'category'],
        },
      },
      {
        name: 'sentinel_discover_api_docs_and_debug',
        description:
          'Probes target for Swagger/OpenAPI specifications (/swagger.json, /openapi.json, /v3/api-docs), executes GraphQL schema introspection (__schema), and discovers exposed debug endpoints (Spring Boot /actuator/env, ASP.NET elmah/trace, Rails routes, /.env).',
        parameters: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'Target root URL or domain' },
          },
          required: ['targetUrl'],
        },
      },
      {
        name: 'sentinel_verify_origin_bypass',
        description:
          'Probes an unproxied candidate origin IP directly with a forged Host header to confirm if it matches the target web application and bypasses Cloudflare/WAF protections.',
        parameters: {
          type: 'object',
          properties: {
            targetHost: { type: 'string', description: 'Front-facing target hostname (e.g. app.target.com)' },
            candidateIp: { type: 'string', description: 'Direct IP address candidate discovered from SPF or DNS' },
          },
          required: ['targetHost', 'candidateIp'],
        },
      },
      {
        name: 'sentinel_send_repeater_request',
        description:
          'Sends a custom raw HTTP request or targeted probe via Sentinel’s Repeater engine, returning response status, headers, body, round-trip time, and full raw output.',
        parameters: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'Full target URL (e.g., https://example.com/api/v1/user)' },
            rawRequest: { type: 'string', description: 'Optional exact RFC-compliant raw HTTP request string' },
            method: { type: 'string', description: 'HTTP method (default: GET)' },
            headersJson: { type: 'string', description: 'Optional JSON object of custom headers' },
            body: { type: 'string', description: 'Optional request body' },
          },
          required: ['targetUrl'],
        },
      },
      {
        name: 'sentinel_run_turbo_fuzzer',
        description:
          'Runs Sentinel’s high-speed Turbo Intruder fuzzer with concurrent workers and statistical anomaly clustering against an endpoint template containing §payload§ or %s.',
        parameters: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'Target URL' },
            requestTemplate: { type: 'string', description: 'Raw request template containing §payload§ or %s' },
            payloadsJson: { type: 'string', description: 'JSON array of string payloads to test' },
            concurrentWorkers: { type: 'string', description: 'Concurrent worker pool count (default: 50)' },
          },
          required: ['targetUrl', 'requestTemplate', 'payloadsJson'],
        },
      },
      {
        name: 'sentinel_run_nuclei_scan',
        description:
          'Executes Sentinel’s curated Nuclei-compatible zero-day and critical misconfiguration templates (git exposure, .env files, prototype pollution, actuator exposures) against a target.',
        parameters: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'Target base URL (e.g. https://example.com)' },
          },
          required: ['targetUrl'],
        },
      },
      {
        name: 'sentinel_query_traffic_httpql',
        description:
          'Queries Sentinel’s intercepted proxy traffic using standard HTTPQL expressions (e.g., `req.method == "POST" && res.status == 200`, `res.body ~ "token"`, `req.path startsWith "/api"`).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'HTTPQL query expression' },
            limit: { type: 'string', description: 'Max transactions to return (default: 20)' },
          },
          required: ['query'],
        },
      },
    ];
  }

  /**
   * Dispatches a tool call from an AI Agent by tool name and JSON arguments
   */
  public async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'sentinel_discover_api_docs_and_debug': {
        const url = String(args.targetUrl);
        return await debugApiDocDiscoveryService.runFullDiscovery(url);
      }
      case 'sentinel_capture_full_knowledge_base': {
        const enableBrowser = String(args.enableStealthBrowser ?? 'false').toLowerCase() === 'true';
        return await this.captureFullWebsiteKnowledgeBase(String(args.targetUrl), { enableStealthBrowser: enableBrowser });
      }
      case 'sentinel_recon_infrastructure': {
        return await infrastructureOriginService.runFullInfrastructureRecon(String(args.targetHost));
      }
      case 'sentinel_dredge_client_bundles': {
        const host = this.cleanHost(String(args.targetHost));
        let scripts: string[] = [];
        if (args.scriptUrlsJson) {
          try {
            scripts = JSON.parse(String(args.scriptUrlsJson));
          } catch {}
        }
        if (scripts.length === 0) {
          scripts = [`https://${host}/main.js`, `https://${host}/app.js`, `https://${host}/bundle.js`];
        }
        return await this.runStaticClientDredging(host, scripts);
      }
      case 'sentinel_stealth_browser_crawl': {
        const url = String(args.targetUrl);
        const host = this.cleanHost(url);
        const maxStates = args.maxStates ? parseInt(String(args.maxStates), 10) : 40;
        return await stateFlowGraphCrawler.runStealthCrawl({
          targetHost: host,
          targetUrl: url,
          maxStates,
          maxClicksPerState: 25,
        });
      }
      case 'sentinel_mine_historical_archives': {
        const domain = this.cleanHost(String(args.targetDomain));
        const limit = args.limit ? parseInt(String(args.limit), 10) : 300;
        return await gauArchiveService.runGauMining({ targetDomain: domain, limit });
      }
      case 'sentinel_discover_hidden_params': {
        const host = this.cleanHost(String(args.targetHost));
        const path = String(args.endpointPath);
        const found: DiscoveredParameter[] = [];
        await arjunParamDiscoveryService.runParameterDiscovery({
          targetHost: host,
          targetUrl: path,
          onParamDiscovered: (p) => found.push(p),
        });
        return found;
      }
      case 'sentinel_audit_idor_candidates': {
        const host = this.cleanHost(String(args.targetHost));
        const epUrl = String(args.endpointUrl);
        const dummyItem: SiteMapRequest = {
          id: `agent-idor-${Date.now()}`,
          host,
          method: 'GET',
          url: epUrl,
          path: epUrl,
          params: epUrl.includes('?'),
          status: 200,
          length: 0,
          mime: 'HTML',
          title: epUrl,
          notes: 'Agent IDOR Audit',
          requestRaw: '',
          responseRaw: '',
          reqAttributes: {},
          reqHeaders: {},
          resAttributes: {},
          resHeaders: {},
        };
        return await idorAndHiddenEndpointHunter.auditEndpointForIdor(dummyItem, host);
      }
      case 'sentinel_browser_fetch': {
        const res: BrowserFetchResult | null = await stealthCdpBrowserDriver.fetchInBrowserDetails(String(args.url));
        return res;
      }
      case 'sentinel_query_knowledge_base': {
        const host = this.cleanHost(String(args.targetHost));
        const kb = this.knowledgeBaseCache.get(host);
        if (!kb) {
          return { error: `No cached Knowledge Base for ${host}. Run sentinel_capture_full_knowledge_base first.` };
        }
        return this.filterKnowledgeBase(kb, String(args.category), args.searchKeyword ? String(args.searchKeyword) : undefined);
      }
      case 'sentinel_verify_origin_bypass': {
        const host = this.cleanHost(String(args.targetHost));
        const ip = String(args.candidateIp);
        return await infrastructureOriginService.verifyOriginIpCandidate(host, ip);
      }
      case 'sentinel_send_repeater_request': {
        const targetUrl = String(args.targetUrl);
        let rawReq = args.rawRequest ? String(args.rawRequest) : undefined;
        if (!rawReq) {
          const method = (args.method || 'GET').toUpperCase();
          const parsed = new URL(targetUrl);
          const path = `${parsed.pathname}${parsed.search}`;
          let headersStr = `Host: ${parsed.host}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Agent\r\nConnection: close\r\n`;
          if (args.headersJson) {
            try {
              const headersObj = JSON.parse(args.headersJson);
              for (const [k, v] of Object.entries(headersObj)) {
                headersStr += `${k}: ${v}\r\n`;
              }
            } catch {}
          }
          const bodyStr = args.body ? String(args.body) : '';
          if (bodyStr && !headersStr.toLowerCase().includes('content-length')) {
            headersStr += `Content-Length: ${new TextEncoder().encode(bodyStr).length}\r\n`;
          }
          rawReq = `${method} ${path} HTTP/1.1\r\n${headersStr}\r\n${bodyStr}`;
        }
        return await ipcClient.sendRepeaterRequest({
          tabId: `agent-repeater-${Date.now()}`,
          targetUrl,
          rawRequest: rawReq,
        });
      }
      case 'sentinel_run_turbo_fuzzer': {
        const targetUrl = String(args.targetUrl);
        const template = String(args.requestTemplate);
        let payloads: string[] = [];
        try {
          payloads = JSON.parse(args.payloadsJson);
        } catch {
          payloads = [String(args.payloadsJson)];
        }
        const workers = args.concurrentWorkers ? parseInt(args.concurrentWorkers, 10) : 50;
        const engine = new TurboIntruderEngine({
          targetUrl,
          requestTemplate: template,
          payloads,
          concurrentWorkers: isNaN(workers) ? 50 : workers,
        });
        const results = await engine.run();
        const anomalies = results.filter((r) => r.isAnomaly);
        return {
          totalSent: results.length,
          anomaliesCount: anomalies.length,
          anomalies: anomalies.slice(0, 20),
          allResultsSummary: results.slice(0, 30).map((r) => ({
            id: r.id,
            payload: r.payload,
            status: r.status,
            length: r.length,
            timeMs: r.timeMs,
            isAnomaly: r.isAnomaly,
          })),
        };
      }
      case 'sentinel_run_nuclei_scan': {
        const targetUrl = String(args.targetUrl);
        const engine = new NucleiTemplateEngine();
        const results = await engine.scanTarget(targetUrl);
        const matched = results.filter((r) => r.matched);
        return {
          scannedTemplatesCount: results.length,
          matchedVulnerabilitiesCount: matched.length,
          findings: matched,
        };
      }
      case 'sentinel_query_traffic_httpql': {
        const queryStr = String(args.query);
        const limit = args.limit ? parseInt(args.limit, 10) : 20;
        const max = isNaN(limit) ? 20 : limit;
        const { ast } = parseHttpql(queryStr);
        const transactions = useTrafficStore.getState().transactions || [];
        const matches = transactions.filter((t) => evaluateHttpql(ast, t as any)).slice(0, max);
        return {
          query: queryStr,
          totalMatching: matches.length,
          results: matches.map((t) => ({
            id: t.id,
            method: t.method,
            url: t.url,
            statusCode: t.status,
            length: t.sizeBytes,
            durationMs: t.durationMs,
          })),
        };
      }
      default:
        throw new Error(`Unknown Sentinel Agent tool: ${toolName}`);
    }
  }

  /**
   * Executes Pillar 2 Static Client-Side Dredging across a list of script URLs and optional inline scripts
   */
  public async runStaticClientDredging(
    targetHost: string,
    scriptUrls: string[],
    inlineScripts: string[] = [],
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): Promise<WebsiteKnowledgeBase['pillar2_staticClientDredging']> {
    const cleanHost = this.cleanHost(targetHost);
    const unpackedSourceMaps: SourceMapDiscoveryResult[] = [];
    const astExtractedEndpoints: JSluiceDiscoveredEndpoint[] = [];
    const nextServerActions: JSluiceDiscoveredEndpoint[] = [];
    const synthesizedLazyChunks = new Set<string>();
    const extractedRequestSchemas: Array<{ name: string; fields: string[]; sourceFile: string }> = [];
    const discoveredSecrets: Array<JSluiceDiscoveredSecret & { entropy: number }> = [];

    // 1. Parse inline scripts via JSluice AST + Constant-Folding
    for (let i = 0; i < inlineScripts.length; i++) {
      const res = jsluiceMiningService.parseScriptContent(inlineScripts[i], `inline_${i}.js`, cleanHost);
      for (const ep of res.endpoints) {
        astExtractedEndpoints.push(ep);
        if (ep.path.startsWith('/_next/action/')) {
          nextServerActions.push(ep);
        }
      }
      for (const sec of res.secrets) {
        discoveredSecrets.push({
          ...sec,
          entropy: JSluiceMiningService.calculateShannonEntropy(sec.value),
        });
      }
    }

    // 2. Probe Source Maps & Bundle ASTs for external scripts
    for (const sUrl of scriptUrls) {
      const smResult = await sourceMapRouteMiner.probeAndMineScript(sUrl, cleanHost, onItemDiscovered);
      if (smResult) {
        if (smResult.sourceMapUrl) {
          unpackedSourceMaps.push(smResult);
        }
        if (smResult.extractedSchemas) {
          extractedRequestSchemas.push(...smResult.extractedSchemas);
        }
        if (smResult.extractedSecrets) {
          for (const sec of smResult.extractedSecrets) {
            discoveredSecrets.push({
              type: sec.type,
              value: sec.value,
              sourceScript: sec.sourceFile,
              snippet: `SourceMap: ${sec.sourceFile}`,
              entropy: JSluiceMiningService.calculateShannonEntropy(sec.value),
            });
          }
        }
      }

      // Also synthesize unloaded lazy chunks from main bundle
      try {
        const body = await stealthCdpBrowserDriver.fetchInBrowser(sUrl);
        if (body) {
          const lazy = jsluiceMiningService.synthesizeUnloadedChunkUrls(body, `https://${cleanHost}`);
          lazy.forEach((c) => synthesizedLazyChunks.add(c));
          const parsed = jsluiceMiningService.parseScriptContent(body, sUrl, cleanHost);
          for (const ep of parsed.endpoints) {
            astExtractedEndpoints.push(ep);
            if (ep.path.startsWith('/_next/action/')) {
              nextServerActions.push(ep);
            }
          }
          for (const sec of parsed.secrets) {
            discoveredSecrets.push({
              ...sec,
              entropy: JSluiceMiningService.calculateShannonEntropy(sec.value),
            });
          }
        }
      } catch {}
    }

    return {
      unpackedSourceMaps,
      astExtractedEndpoints,
      nextServerActions,
      synthesizedLazyChunks: Array.from(synthesizedLazyChunks),
      extractedRequestSchemas,
      discoveredSecrets,
    };
  }

  /**
   * Captures the complete 4-Pillar Website Knowledge Base and syncs all discovered items
   * into Sentinel's global `reconStore` and `trafficStore`.
   */
  public async captureFullWebsiteKnowledgeBase(
    targetUrl: string,
    options?: {
      enableStealthBrowser?: boolean;
      maxArchiveLimit?: number;
      forceRefresh?: boolean;
      onProgress?: (phase: string, detail: string) => void;
    }
  ): Promise<WebsiteKnowledgeBase> {
    const cleanHost = this.cleanHost(targetUrl);
    if (!options?.forceRefresh && this.knowledgeBaseCache.has(cleanHost)) {
      return this.knowledgeBaseCache.get(cleanHost)!;
    }
    const rootUrl = targetUrl.startsWith('http') ? targetUrl : `https://${cleanHost}/`;
    const allItemsMap = new Map<string, SiteMapRequest>();

    const recordSiteMapItem = (item: SiteMapRequest) => {
      const key = `${item.method}:${item.host}${item.path}`;
      if (!allItemsMap.has(key)) {
        allItemsMap.set(key, item);
        try {
          useReconStore.getState().addCrawlerDiscoveredItem(item);
          const reqHeaderItems: HttpHeaderItem[] = Object.entries(item.reqHeaders || {}).map(([name, value]) => ({ name, value }));
          const resHeaderItems: HttpHeaderItem[] = Object.entries(item.resHeaders || {}).map(([name, value]) => ({ name, value }));
          useTrafficStore.getState().addTransaction({
            id: String(item.id),
            seqNumber: Date.now() % 1000000,
            timestamp: new Date().toISOString(),
            timestampMs: Date.now(),
            method: item.method,
            host: item.host,
            path: item.path,
            url: item.url.startsWith('http') ? item.url : `https://${item.host}${item.path}`,
            status: item.status || 200,
            durationMs: 0,
            sizeBytes: item.length || 0,
            inScope: true,
            mimeType: item.mime || 'text/html',
            tags: ['Agent-KB'],
            reqHeaders: reqHeaderItems,
            resHeaders: resHeaderItems,
          });
        } catch {}
      }
    };

    options?.onProgress?.('Pillar 1/4: Infrastructure & Origin De-Cloaking', `Analyzing DNS, SPF/DMARC, CT logs, Favicon mmh3, and Cloud Buckets for ${cleanHost}...`);
    const pillar1 = await infrastructureOriginService.runFullInfrastructureRecon(cleanHost, [], recordSiteMapItem);

    options?.onProgress?.('Pillar 4/4: Historical, API Specs & Debug Discovery', `Mining Archives, OpenAPI/Swagger specs, GraphQL schemas, and Actuator/Debug endpoints...`);
    const [gauItems, robotsRes, debugDocRes] = await Promise.all([
      gauArchiveService.runGauMining({
        targetDomain: cleanHost,
        limit: options?.maxArchiveLimit || 250,
        onItemDiscovered: recordSiteMapItem,
      }),
      robotsTxtDiscoveryService.fetchAndParseRobotsTxt(rootUrl),
      debugApiDocDiscoveryService.runFullDiscovery(rootUrl, recordSiteMapItem),
    ]);
    robotsTxtDiscoveryService.generateSiteMapEntries(cleanHost, robotsRes, recordSiteMapItem);

    // Collect script URLs discovered so far
    const discoveredScriptUrls = new Set<string>();
    for (const item of allItemsMap.values()) {
      if (item.path.endsWith('.js') || item.mime === 'script') {
        discoveredScriptUrls.add(item.url.startsWith('http') ? item.url : `https://${item.host}${item.path}`);
      }
    }

    // Pillar 3: Dynamic Browser Crawl & Runtime Introspection
    let cdpConnected = false;
    let routerRoutes: DredgedStorageItem[] = [];
    let offlineStorageAndIndexedDb: DredgedStorageItem[] = [];
    const domForms: Array<{ actionUrl: string; method: string; parameters: Record<string, string> }> = [];

    if (options?.enableStealthBrowser) {
      options?.onProgress?.('Pillar 3/4: Dynamic Stealth Browser Crawl', `Connecting Stealth CDP Chrome to ${rootUrl}...`);
      try {
        cdpConnected = await stealthCdpBrowserDriver.connect(rootUrl, cleanHost);
        if (cdpConnected) {
          await clientRuntimeOmniscienceService.injectInstrumentation();
          routerRoutes = await clientRuntimeOmniscienceService.introspectClientRouters();
          offlineStorageAndIndexedDb = await clientRuntimeOmniscienceService.dredgeOfflineStorage();

          const liveDomEndpoints: DiscoveredEndpoint[] = await multiSourceEndpointMiner.extractEndpoints({
            targetHost: cleanHost,
            currentUrl: rootUrl,
            driver: stealthCdpBrowserDriver,
          });

          for (const ep of liveDomEndpoints) {
            if (ep.source === 'bundle_chunk' || ep.url.endsWith('.js')) {
              discoveredScriptUrls.add(ep.url);
            }
            if (ep.source === 'dom_form' && ep.parameters) {
              domForms.push({
                actionUrl: ep.url,
                method: ep.method || 'POST',
                parameters: ep.parameters,
              });
            }
          }

          // Extract all scripts directly from live authenticated DOM (bypassing WAF challenges)
          const domScriptUrls = await stealthCdpBrowserDriver.evaluate<string[]>(`
            (function() {
              return Array.from(document.querySelectorAll('script[src]'))
                .map(s => (s as HTMLScriptElement).src)
                .filter(Boolean);
            })()
          `).catch(() => []);
          for (const s of domScriptUrls) {
            discoveredScriptUrls.add(s);
          }
        }
      } catch {}
    }

    // Extract inline scripts from DOM for constant folding
    let inlineScriptsFromDom: string[] = [];
    if (cdpConnected) {
      inlineScriptsFromDom = await stealthCdpBrowserDriver.evaluate<string[]>(`
        (function() {
          return Array.from(document.querySelectorAll('script:not([src])'))
            .map(s => s.textContent || '')
            .filter(t => t.trim().length > 10);
        })()
      `).catch(() => []);
    }

    // Run standard normal/hidden_endpoints pipeline to populate remaining DOM & API routes
    options?.onProgress?.('Normal & Hidden API Sweep', `Probing OpenAPI/Swagger, GraphQL, and HTML surface...`);
    try {
      const sweepItems = await unifiedReconOrchestrator.runRecon({
        targetHost: cleanHost,
        targetUrl: rootUrl,
        engine: 'hidden_endpoints',
        onItemDiscovered: (item) => recordSiteMapItem(item),
      });
      sweepItems.forEach(recordSiteMapItem);
    } catch {}

    // Pillar 2: Static Client-Side Dredging (Source Maps, AST Constant Folding, Next.js Actions, Lazy Chunks, Secrets)
    options?.onProgress?.('Pillar 2/4: Static Client-Side AST & SourceMap Dredging', `Analyzing ${discoveredScriptUrls.size} scripts for source maps, AST routes, and secrets...`);
    const pillar2 = await this.runStaticClientDredging(
      cleanHost,
      Array.from(discoveredScriptUrls).slice(0, 35),
      inlineScriptsFromDom,
      recordSiteMapItem
    );

    // Normalize and cluster all discovered endpoints into REST templates
    const rawEndpointUrls = Array.from(allItemsMap.values()).map((i) =>
      i.url.startsWith('http') ? i.url : `https://${i.host}${i.path}`
    );
    const normalizedList = rawEndpointUrls.map((u) => endpointNormalizer.normalizeEndpoint(u, rootUrl));
    const clusteredAttackSurface = endpointNormalizer.clusterEndpoints(normalizedList);

    // Identify IDOR candidates
    const idorCandidates: IdorFinding[] = [];
    for (const item of Array.from(allItemsMap.values()).slice(0, 20)) {
      const finding = await idorAndHiddenEndpointHunter.auditEndpointForIdor(item, cleanHost);
      if (finding) idorCandidates.push(finding);
    }

    const waybackCount = gauItems.filter((i) => i.notes?.includes('Wayback Machine')).length;
    const commonCrawlCount = gauItems.filter((i) => i.notes?.includes('Common Crawl')).length;
    const alienVaultCount = gauItems.filter((i) => i.notes?.includes('AlienVault')).length;
    const urlScanCount = gauItems.filter((i) => i.notes?.includes('URLScan')).length;
    const legacyApiExtrapolations = gauItems
      .filter((i) => i.notes?.includes('Legacy API Extrapolator'))
      .map((i) => i.path);
    const archivedJsBundles = gauItems.filter((i) => i.path.endsWith('.js') || i.path.endsWith('.map')).map((i) => i.path);

    const kb: WebsiteKnowledgeBase = {
      target: {
        host: cleanHost,
        rootUrl,
        capturedAt: Date.now(),
        detectedCdnOrWaf: pillar1.originAnalysis.detectedCdnOrWaf,
        detectedSaasEcosystem: pillar1.emailSecurity.detectedSaasVendors,
      },
      pillar1_infrastructure: pillar1,
      pillar2_staticClientDredging: pillar2,
      pillar3_dynamicBrowserCrawl: {
        cdpConnected,
        routerRoutes,
        offlineStorageAndIndexedDb,
        domForms,
        crawledEndpointsCount: allItemsMap.size,
      },
      pillar4_historicalArchives: {
        waybackCount,
        commonCrawlCount,
        alienVaultCount,
        urlScanCount,
        legacyApiExtrapolations,
        robotsDisallowedPaths: robotsRes.disallowedPaths,
        archivedJsBundles,
        apiDocs: debugDocRes.apiDocs,
        graphqlIntrospection: debugDocRes.graphql,
        exposedDebugFindings: debugDocRes.debugFindings,
      },
      clusteredAttackSurface,
      idorCandidates,
      allDiscoveredRequests: Array.from(allItemsMap.values()),
    };

    this.knowledgeBaseCache.set(cleanHost, kb);
    useReconStore.getState().setLatestKnowledgeBase(kb);
    return kb;
  }

  public getCachedKnowledgeBase(targetHost: string): WebsiteKnowledgeBase | undefined {
    return this.knowledgeBaseCache.get(this.cleanHost(targetHost));
  }

  public setCachedKnowledgeBase(targetHost: string, kb: WebsiteKnowledgeBase): void {
    this.knowledgeBaseCache.set(this.cleanHost(targetHost), kb);
  }

  private filterKnowledgeBase(kb: WebsiteKnowledgeBase, category: string, keyword?: string): any {
    const kw = keyword?.toLowerCase();
    const matchesKw = (val: any) => !kw || JSON.stringify(val).toLowerCase().includes(kw);

    switch (category) {
      case 'summary':
        return {
          target: kb.target,
          subdomainsCount: kb.pillar1_infrastructure.subdomains.length,
          originCandidates: kb.pillar1_infrastructure.originAnalysis.originCandidateIps,
          faviconHashMmh3: kb.pillar1_infrastructure.originAnalysis.faviconHashMmh3,
          cloudBucketsCount: kb.pillar1_infrastructure.cloudBuckets.length,
          unpackedSourceMapsCount: kb.pillar2_staticClientDredging.unpackedSourceMaps.length,
          astEndpointsCount: kb.pillar2_staticClientDredging.astExtractedEndpoints.length,
          nextServerActionsCount: kb.pillar2_staticClientDredging.nextServerActions.length,
          secretsCount: kb.pillar2_staticClientDredging.discoveredSecrets.length,
          historicalArchiveTotals: {
            wayback: kb.pillar4_historicalArchives.waybackCount,
            commonCrawl: kb.pillar4_historicalArchives.commonCrawlCount,
            alienVault: kb.pillar4_historicalArchives.alienVaultCount,
            urlScan: kb.pillar4_historicalArchives.urlScanCount,
            legacyExtrapolated: kb.pillar4_historicalArchives.legacyApiExtrapolations.length,
          },
          totalUniqueEndpoints: kb.allDiscoveredRequests.length,
        };
      case 'infrastructure':
        return kb.pillar1_infrastructure;
      case 'endpoints':
        return kb.allDiscoveredRequests.filter(matchesKw).map((r) => ({
          method: r.method,
          path: r.path,
          status: r.status,
          mime: r.mime,
          notes: r.notes,
        }));
      case 'secrets':
        return kb.pillar2_staticClientDredging.discoveredSecrets.filter(matchesKw);
      case 'schemas':
        return kb.pillar2_staticClientDredging.extractedRequestSchemas.filter(matchesKw);
      case 'actions':
        return kb.pillar2_staticClientDredging.nextServerActions.filter(matchesKw);
      case 'historical':
        return kb.pillar4_historicalArchives;
      case 'clusters':
        return kb.clusteredAttackSurface.filter(matchesKw);
      default:
        return kb;
    }
  }

  private cleanHost(input: string): string {
    return input.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim().toLowerCase();
  }
}

export const sentinelAgentBridge = new SentinelAgentBridge();
