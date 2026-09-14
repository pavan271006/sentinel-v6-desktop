import React, { useState, useMemo, useRef } from 'react';
import { useTrafficStore } from '../../stores/trafficStore';
import { useSqlScannerStore } from '../../stores/sqlScannerStore';
import { useToastStore } from '../../stores/toastStore';
import { useRepeaterStore } from '../../stores/repeaterStore';
import { useAppShellStore } from '../../stores/appShellStore';
import { TargetSiteCrawler, DiscoveredEndpoint } from '../../services/sqlScanner/crawler/TargetSiteCrawler';
import { ipcClient } from '../../ipc/client';
import { ContextMenu, ContextMenuItem } from '../../design-system/ContextMenu';
import { buildTrafficContextMenu } from '../../utils/contextMenuUtils';
import {
  ChevronRight,
  ChevronDown,
  Lock,
  Search,
  Flame,
  Zap,
  Globe,
  Loader2,
  Compass,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';

export interface HostGroup {
  host: string;
  isHttps: boolean;
  totalRequests: number;
  sqliCandidateCount: number;
  endpoints: DiscoveredEndpoint[];
}

export const ProxyTargetSiteMap: React.FC = () => {
  const { transactions } = useTrafficStore();
  const { setRawRequest, targetConfig } = useSqlScannerStore();
  const { addToast } = useToastStore();

  const [expandedHosts, setExpandedHosts] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSqliOnly, setFilterSqliOnly] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlingProgress, setCrawlingProgress] = useState<string>('');
  const [crawledEndpoints, setCrawledEndpoints] = useState<DiscoveredEndpoint[]>([]);
  const [crawlerMode, setCrawlerMode] = useState<'machine' | 'hybrid' | 'sovereign'>('sovereign');
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  const crawlerRef = useRef<TargetSiteCrawler | null>(null);

  // Stop running crawl immediately
  const handleStopCrawl = () => {
    if (crawlerRef.current) {
      crawlerRef.current.abort();
      crawlerRef.current = null;
    }
    setIsCrawling(false);
    setCrawlingProgress('Crawl stopped by operator.');
    addToast({
      type: 'info',
      title: 'Crawler Stopped',
      description: 'Continuous crawl halted. All genuine endpoints discovered so far have been preserved in the Site Map.',
    });
  };

  // Toggle host expansion
  const toggleHost = (host: string) => {
    setSelectedHost(host);
    setExpandedHosts((prev) => ({
      ...prev,
      [host]: !prev[host],
    }));
  };

  // Convert Proxy transactions into DiscoveredEndpoint format
  const proxyEndpoints: DiscoveredEndpoint[] = useMemo(() => {
    const list: DiscoveredEndpoint[] = [];

    // 1. Ingest from trafficStore (Only live endpoints that returned real data, never 404 Not Found)
    for (const tx of transactions) {
      if (!tx.host) continue;

      // Strictly omit 404 Not Found
      if (tx.status === 404) continue;

      // Omit aborted/unresponsive connections
      if (!tx.status || tx.status === 0) continue;

      // Omit error responses that returned no data
      if (tx.status >= 400 && (!tx.resBody || tx.resBody.trim().length === 0)) continue;

      // Omit soft-404 pages (e.g. 200 with "404 Not Found" or "Page Not Found" HTML)
      if (TargetSiteCrawler.isNotFoundResponse(tx.status, tx.resBody)) continue;

      // Omit WAF challenge / verification intercept pages (Never display as application endpoints)
      if (TargetSiteCrawler.isChallengeOrWafResponse(tx.status, tx.resBody)) continue;

      // Require real response data (body content or valid 2xx/3xx response)
      const hasRealData =
        (tx.resBody && tx.resBody.trim().length > 0) ||
        (tx.sizeBytes && tx.sizeBytes > 0) ||
        (tx.status >= 200 && tx.status < 400);

      if (!hasRealData) continue;

      const method = tx.method || 'GET';
      const path = tx.path || '/';
      const host = tx.host;
      const url = tx.url || `https://${host}${path}`;

      // Extract query parameters
      const params: { name: string; type: 'query' | 'body_form'; sampleValue: string }[] = [];
      if (path.includes('?')) {
        const queryStr = path.split('?')[1] || '';
        const sp = new URLSearchParams(queryStr);
        sp.forEach((val, key) => {
          params.push({ name: key, type: 'query', sampleValue: val || '1' });
        });
      }

      const scoring = TargetSiteCrawler.scoreSqliSurface(method, path, params);

      const rawRequest = tx.reqBody
        ? `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${tx.reqBody.length}\r\n\r\n${tx.reqBody}`
        : `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nConnection: close\r\n\r\n`;

      list.push({
        id: `proxy_${tx.id}`,
        host,
        url,
        path,
        method,
        headers: { Host: host },
        body: tx.reqBody,
        source: 'proxy',
        params,
        sqliScore: scoring.sqliScore,
        isSqliCandidate: scoring.isSqliCandidate,
        sqliReason: scoring.sqliReason,
        rawRequest,
        statusCode: tx.status,
        timestamp: tx.timestampMs || Date.now(),
      });
    }

    // Filter crawled endpoints to only keep those that returned real data, are NOT 404, and NOT WAF challenge pages
    const validCrawled = crawledEndpoints.filter((ep) => {
      if (ep.statusCode === 404) return false;
      if (TargetSiteCrawler.isChallengeOrWafResponse(ep.statusCode, ep.rawRequest || ep.body)) return false;
      return true;
    });

    return [...list, ...validCrawled];
  }, [transactions, crawledEndpoints]);

  // Group endpoints by Host
  const hostGroups: HostGroup[] = useMemo(() => {
    const map = new Map<string, HostGroup>();

    for (const ep of proxyEndpoints) {
      if (!map.has(ep.host)) {
        map.set(ep.host, {
          host: ep.host,
          isHttps: !ep.url.startsWith('http://'),
          totalRequests: 0,
          sqliCandidateCount: 0,
          endpoints: [],
        });
      }

      const group = map.get(ep.host)!;
      group.totalRequests++;
      if (ep.isSqliCandidate) {
        group.sqliCandidateCount++;
      }
      group.endpoints.push(ep);
    }

    // Convert map to sorted array
    return Array.from(map.values()).sort((a, b) => {
      // Prioritize hosts with active candidate endpoints
      if (b.sqliCandidateCount !== a.sqliCandidateCount) {
        return b.sqliCandidateCount - a.sqliCandidateCount;
      }
      return b.totalRequests - a.totalRequests;
    });
  }, [proxyEndpoints]);

  // Filtered host groups
  const filteredHostGroups = useMemo(() => {
    return hostGroups
      .map((hg) => {
        let matchingEps = hg.endpoints;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          matchingEps = matchingEps.filter(
            (ep) => ep.path.toLowerCase().includes(q) || ep.host.toLowerCase().includes(q)
          );
        }

        // Always filter out 404 Not Found endpoints
        matchingEps = matchingEps.filter((ep) => ep.statusCode !== 404);

        if (filterSqliOnly) {
          matchingEps = matchingEps.filter((ep) => ep.isSqliCandidate);
        }

        return {
          ...hg,
          endpoints: matchingEps,
        };
      })
      .filter((hg) => {
        if (searchQuery.trim()) {
          return hg.endpoints.length > 0 || hg.host.toLowerCase().includes(searchQuery.toLowerCase());
        }
        if (filterSqliOnly) {
          return hg.endpoints.length > 0;
        }
        return true;
      });
  }, [hostGroups, searchQuery, filterSqliOnly]);

  // Handle clicking an endpoint -> load directly into SQL scanner tab
  const handleSelectEndpoint = (ep: DiscoveredEndpoint) => {
    setRawRequest(ep.rawRequest);
    useSqlScannerStore.getState().probeTargetRequest(ep.rawRequest);
    addToast({
      type: 'success',
      title: 'Target Request Loaded',
      description: `${ep.method} ${ep.path} imported into SQL Scanner. Fetching live response...`,
    });
  };

  // Active target host
  const activeTargetHost = useMemo(() => {
    if (selectedHost) return selectedHost;
    try {
      if (targetConfig.url) return new URL(targetConfig.url).host;
    } catch {
      // Fallback
    }
    return hostGroups[0]?.host || 'portswigger.net';
  }, [selectedHost, targetConfig.url, hostGroups]);

  // Live security tokens & clearance monitor for the active host
  const activeHostSecurityProfile = useMemo(() => {
    const hostTxs = transactions.filter((t) => t.host === activeTargetHost);
    let hasWafClearance = false;
    let wafName = '';
    let cookieCount = 0;
    let hasBearerAuth = false;
    let hasDynamicSignatures = false;
    const detectedTokens: string[] = [];

    for (const tx of hostTxs) {
      if (tx.reqHeaders) {
        for (const h of tx.reqHeaders) {
          const nameLower = h.name.toLowerCase();
          if (nameLower === 'cookie') {
            const cookies = h.value.split(';');
            cookieCount = Math.max(cookieCount, cookies.length);
            if (h.value.includes('cf_clearance')) {
              hasWafClearance = true;
              wafName = 'Cloudflare';
              if (!detectedTokens.includes('cf_clearance')) detectedTokens.push('cf_clearance');
            }
            if (h.value.includes('datadome')) {
              hasWafClearance = true;
              wafName = 'DataDome';
              if (!detectedTokens.includes('datadome')) detectedTokens.push('datadome');
            }
            if (h.value.includes('__cf_bm')) {
              if (!detectedTokens.includes('__cf_bm')) detectedTokens.push('__cf_bm');
            }
          } else if (nameLower === 'authorization') {
            hasBearerAuth = true;
            if (!detectedTokens.includes('Bearer JWT')) detectedTokens.push('Bearer JWT');
          } else if (nameLower === 'x-sign' || nameLower === 'x-signature') {
            hasDynamicSignatures = true;
            if (!detectedTokens.includes(h.name)) detectedTokens.push(h.name);
          } else if (nameLower === 'x-csrf-token' || nameLower === 'x-xsrf-token') {
            if (!detectedTokens.includes('CSRF')) detectedTokens.push('CSRF');
          }
        }
      }

      if (tx.resHeaders) {
        for (const h of tx.resHeaders) {
          if (h.name.toLowerCase() === 'set-cookie') {
            if (h.value.includes('cf_clearance')) {
              hasWafClearance = true;
              wafName = 'Cloudflare';
              if (!detectedTokens.includes('cf_clearance')) detectedTokens.push('cf_clearance');
            }
            if (h.value.includes('datadome')) {
              hasWafClearance = true;
              wafName = 'DataDome';
              if (!detectedTokens.includes('datadome')) detectedTokens.push('datadome');
            }
          }
        }
      }
    }

    return {
      hasWafClearance,
      wafName,
      cookieCount,
      hasBearerAuth,
      hasDynamicSignatures,
      detectedTokens,
    };
  }, [transactions, activeTargetHost]);

  // Launch system browser pre-configured with Sentinel's proxy (solves Turnstile, genuine TLS JA4)
  const handleLaunchProxyBrowser = async (hostToOpen?: string) => {
    let target = hostToOpen || activeTargetHost;
    const fullUrl = target.startsWith('http') ? target : `https://${target}`;
    try {
      await ipcClient.launchSystemBrowser(fullUrl, 8085);
      addToast({
        type: 'success',
        title: 'Proxy Browser Launched',
        description: `Navigating to ${fullUrl} via 127.0.0.1:8085. Real TLS & WAF clearance will sync into Sentinel automatically.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Browser Launch Failed',
        description: err?.message || 'Could not launch proxy browser',
      });
    }
  };

  // Trigger Website Crawler for selected host or current active target
  const handleCrawlHost = async (hostToCrawl?: string) => {
    if (isCrawling) {
      handleStopCrawl();
      return;
    }

    let target = hostToCrawl || activeTargetHost;

    setIsCrawling(true);
    // Auto-expand crawled host immediately so discovered endpoints stream live
    setExpandedHosts((prev) => ({ ...prev, [target!]: true }));
    setCrawlingProgress(
      crawlerMode === 'sovereign'
        ? `[Sovereign L4 Boundary] Historical archive fusion & smart mutation on ${target}...`
        : crawlerMode === 'hybrid'
        ? `[Stealth Hybrid] Syncing captured tokens & crawling ${target}...`
        : `[Machine Blitz] Mining routes & compiled chunks on ${target}...`
    );

    try {
      // Auto-aggregate active session cookies, clearance tokens, and authorization/signature headers
      const hostTxs = transactions.filter((t) => t.host === target);
      const cookieJar = new Map<string, string>();
      const customHeaders: Record<string, string> = {};

      for (const tx of hostTxs) {
        // Request headers
        if (tx.reqHeaders) {
          for (const h of tx.reqHeaders) {
            const nameLower = h.name.toLowerCase();
            if (nameLower === 'cookie') {
              h.value.split(';').forEach((pair) => {
                const [k, ...v] = pair.trim().split('=');
                if (k) cookieJar.set(k.trim(), v.join('='));
              });
            } else if (
              nameLower === 'authorization' ||
              nameLower === 'x-api-key' ||
              nameLower === 'x-csrf-token' ||
              nameLower === 'x-xsrf-token' ||
              nameLower === 'x-sign' ||
              nameLower === 'x-signature' ||
              nameLower === 'x-timestamp' ||
              nameLower === 'x-requested-with' ||
              nameLower === 'x-tenant-id'
            ) {
              customHeaders[h.name] = h.value;
            }
          }
        }

        // Response headers (Set-Cookie for WAF clearance cookies e.g. cf_clearance, datadome)
        if (tx.resHeaders) {
          for (const h of tx.resHeaders) {
            if (h.name.toLowerCase() === 'set-cookie') {
              const cookiePart = h.value.split(';')[0];
              if (cookiePart) {
                const [k, ...v] = cookiePart.trim().split('=');
                if (k) cookieJar.set(k.trim(), v.join('='));
              }
            }
          }
        }
      }

      const mergedCookies = Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      const crawler = new TargetSiteCrawler();
      crawlerRef.current = crawler;

      const discovered = await crawler.crawlHost(
        target,
        (msg) => {
          setCrawlingProgress(msg);
        },
        {
          crawlMode: crawlerMode === 'hybrid' ? 'hybrid' : 'machine',
          headers: customHeaders,
          cookies: mergedCookies || undefined,
          enableHistoricalMining: crawlerMode === 'sovereign',
          enableSmartMutations: crawlerMode === 'sovereign' || crawlerMode === 'machine',
          onEndpointDiscovered: (ep) => {
            // Live real-time streaming update to Site Map
            setCrawledEndpoints((prev) => {
              if (prev.some((p) => p.url === ep.url || (p.path === ep.path && p.host === ep.host))) {
                return prev;
              }
              return [...prev, ep];
            });
          },
        }
      );

      setCrawledEndpoints((prev) => {
        const existingIds = new Set(prev.map((p) => p.url));
        const newOnes = discovered.filter((d) => !existingIds.has(d.url));
        return [...prev, ...newOnes];
      });

      const sqliCount = discovered.filter((d) => d.isSqliCandidate).length;
      addToast({
        type: 'success',
        title: `${crawlerMode === 'sovereign' ? 'Sovereign L4' : crawlerMode === 'hybrid' ? 'Stealth Hybrid' : 'Machine Blitz'} Crawl Complete`,
        description: `Discovered ${discovered.length} total endpoints (${sqliCount} SQL injection candidates) on ${target}.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Crawl Failed',
        description: err.message || 'Unable to probe target endpoints',
      });
    } finally {
      setIsCrawling(false);
      setCrawlingProgress('');
      crawlerRef.current = null;
    }
  };

  // Handle context menu for an individual endpoint
  const handleEndpointContextMenu = (e: React.MouseEvent, ep: DiscoveredEndpoint) => {
    e.preventDefault();
    e.stopPropagation();
    const txLike = {
      id: ep.id,
      url: ep.url,
      method: ep.method,
      rawRequest: ep.rawRequest,
      host: ep.host,
      path: ep.path,
      statusCode: ep.statusCode,
      reqHeaders: ep.headers ? Object.entries(ep.headers).map(([k, v]) => ({ name: k, value: String(v) })) : [],
      reqBody: '',
      request: {
        method: ep.method,
        url: ep.url,
        headers: ep.headers ? Object.entries(ep.headers).map(([k, v]) => ({ name: k, value: String(v) })) : [],
        bodyText: '',
      },
      response: null,
    };
    const items = buildTrafficContextMenu(txLike, {
      onSendToRepeater: (t) => {
        useRepeaterStore.getState().createTabFromTransaction(t);
        useAppShellStore.getState().setActiveWorkspace('repeater');
      },
    });
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  // Handle context menu for a host
  const handleHostContextMenu = (e: React.MouseEvent, group: HostGroup) => {
    e.preventDefault();
    e.stopPropagation();
    const hostUrl = `${group.isHttps ? 'https' : 'http'}://${group.host}`;
    const items: ContextMenuItem[] = [
      {
        label: `Crawl ${group.host}`,
        onClick: () => handleCrawlHost(group.host),
      },
      {
        label: 'Send host to Repeater',
        shortcut: 'Ctrl+R',
        onClick: () => {
          useRepeaterStore.getState().createTab({
            url: `${hostUrl}/`,
            method: 'GET',
            title: `GET ${group.host}`,
          });
          useAppShellStore.getState().setActiveWorkspace('repeater');
        },
      },
      {
        label: 'Send host to SQL Scanner',
        shortcut: 'Ctrl+U',
        onClick: () => {
          const raw = `GET / HTTP/1.1\r\nHost: ${group.host}\r\nUser-Agent: Sentinel/6.0\r\nConnection: close\r\n\r\n`;
          useSqlScannerStore.getState().importFromTransaction({
            host: group.host,
            url: `${hostUrl}/`,
            rawRequest: raw,
          });
          useAppShellStore.getState().setActiveWorkspace('sql');
        },
      },
      { divider: true },
      {
        label: 'Copy host URL',
        onClick: () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(hostUrl);
            addToast({ type: 'success', title: 'Copied Host URL', description: hostUrl });
          }
        },
      },
      {
        label: 'Copy host domain',
        onClick: () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(group.host);
            addToast({ type: 'success', title: 'Copied Host Domain', description: group.host });
          }
        },
      },
    ];
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#12151c] border-r border-border-subtle text-text-primary select-none overflow-hidden font-sans w-[360px] flex-shrink-0">
      {/* 1. Header Toolbar with 3-Mode Segmented Control */}
      <div className="h-9 px-3 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Globe className="w-3.5 h-3.5 text-accent-cyan flex-shrink-0" />
          <span className="text-xs font-bold text-white font-mono tracking-wide whitespace-nowrap">
            SITE MAP
          </span>
        </div>

        {/* 3-Mode Selector Segmented Control */}
        <div className="flex items-center bg-[#0a0d13] p-0.5 rounded border border-border-subtle text-[10px] font-mono flex-shrink-0 gap-0.5">
          <button
            onClick={() => setCrawlerMode('sovereign')}
            title="Sovereign L4: Passive Wayback + AlienVault recon fusion + dynamic JS AST + smart mutation frontier"
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
              crawlerMode === 'sovereign'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />
            <span>L4 Max</span>
          </button>
          <button
            onClick={() => setCrawlerMode('hybrid')}
            title="Stealth Hybrid: Human-in-the-loop browser clearance harvesting for protected modern websites"
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
              crawlerMode === 'hybrid'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <Shield className="w-2.5 h-2.5 flex-shrink-0" />
            <span>Hybrid</span>
          </button>
          <button
            onClick={() => setCrawlerMode('machine')}
            title="Machine Blitz: Autonomous high-speed HTTP, Next.js App Router, and manifest mining"
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
              crawlerMode === 'machine'
                ? 'bg-accent-cyan/20 text-accent-cyan shadow-sm'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <Zap className="w-2.5 h-2.5 flex-shrink-0" />
            <span>Machine</span>
          </button>
        </div>
      </div>

      {/* Crawl Progress Banner (when active) */}
      {isCrawling && (
        <div className="px-2.5 py-1.5 bg-accent-cyan/10 border-b border-accent-cyan/30 text-[10px] font-mono text-accent-cyan flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
            <span className="truncate">{crawlingProgress}</span>
          </div>
          <button
            onClick={handleStopCrawl}
            className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[9px] font-bold flex items-center gap-1 flex-shrink-0 transition-all shadow-sm"
            title="Stop continuous crawling immediately"
          >
            <Square className="w-2.5 h-2.5 fill-red-400 text-red-400" />
            <span>STOP</span>
          </button>
        </div>
      )}

      {/* MODE-SPECIFIC SUB-PANEL */}
      {crawlerMode === 'sovereign' ? (
        /* Sovereign L4 Recon Banner */
        <div className="p-2 border-b border-purple-500/30 bg-purple-950/20 flex flex-col gap-1.5 flex-shrink-0 text-[10px] font-mono">
          <div className="flex items-center justify-between gap-1">
            <span className="text-purple-300 font-bold flex items-center gap-1 text-[10px] flex-shrink-0">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>SOVEREIGN RECON</span>
            </span>
            <input
              type="text"
              value={selectedHost || activeTargetHost}
              onChange={(e) => setSelectedHost(e.target.value.trim())}
              placeholder="target.domain"
              className="bg-[#12151c] text-purple-200 border border-purple-500/40 rounded px-1.5 py-0.5 text-[9px] font-mono outline-none focus:border-purple-400 w-[145px] truncate"
              title="Target host for L4 sovereign crawl"
            />
          </div>

          <div className="text-[9px] text-text-muted flex items-center gap-1 flex-wrap">
            <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">Wayback CDX</span>
            <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">AlienVault OTX</span>
            <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">JS AST Eval</span>
            <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">Smart Mutations</span>
          </div>

          <button
            onClick={() => (isCrawling ? handleStopCrawl() : handleCrawlHost())}
            title={isCrawling ? 'Stop crawler immediately' : 'Execute full multi-source Level 4 boundary crawl'}
            className={`h-6 mt-0.5 rounded font-bold flex items-center justify-center gap-1 border transition-all text-[10px] ${
              isCrawling
                ? 'bg-red-600/30 hover:bg-red-600/50 text-red-200 border-red-500/60 animate-pulse'
                : 'bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border-purple-500/50'
            }`}
          >
            {isCrawling ? (
              <>
                <Square className="w-2.5 h-2.5 fill-red-400 text-red-400" />
                <span>■ STOP CRAWL</span>
              </>
            ) : (
              <>
                <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                <span>Launch Sovereign L4 Crawl</span>
              </>
            )}
          </button>
        </div>
      ) : crawlerMode === 'hybrid' ? (
        /* Stealth Hybrid Clearance & Action Monitor */
        <div className="p-2 border-b border-emerald-500/30 bg-emerald-950/20 flex flex-col gap-1.5 flex-shrink-0 text-[10px] font-mono">
          <div className="flex items-center justify-between gap-1">
            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px] flex-shrink-0">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>CLEARANCE MONITOR</span>
            </span>
            <input
              type="text"
              value={selectedHost || activeTargetHost}
              onChange={(e) => setSelectedHost(e.target.value.trim())}
              placeholder="target.domain"
              className="bg-[#12151c] text-emerald-300 border border-emerald-500/40 rounded px-1.5 py-0.5 text-[9px] font-mono outline-none focus:border-emerald-400 w-[145px] truncate"
              title="Target host for hybrid browser clearance"
            />
          </div>

          {/* Security Profile Badges */}
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <div
              className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                activeHostSecurityProfile.hasWafClearance
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#161a23] text-amber-400 border-amber-500/30'
              }`}
            >
              {activeHostSecurityProfile.hasWafClearance ? (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
              )}
              <span className="truncate">
                {activeHostSecurityProfile.hasWafClearance
                  ? `${activeHostSecurityProfile.wafName} Solved`
                  : 'Pending Challenge'}
              </span>
            </div>

            <div className="px-1.5 py-0.5 rounded bg-[#161a23] border border-border-subtle flex items-center justify-between text-text-muted">
              <span>Cookies:</span>
              <span className="text-emerald-400 font-bold">
                {activeHostSecurityProfile.cookieCount}
              </span>
            </div>
          </div>

          {/* Active Security Tokens Found */}
          {activeHostSecurityProfile.detectedTokens.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
              {activeHostSecurityProfile.detectedTokens.map((tok, idx) => (
                <span
                  key={idx}
                  className="px-1 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-600/30 text-[8px] font-mono flex items-center gap-0.5"
                >
                  <CheckCircle2 className="w-2 h-2 text-emerald-400" />
                  {tok}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons: Launch Browser & Run Stealth Crawl */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={() => handleLaunchProxyBrowser()}
              title="Launch authentic browser via Sentinel proxy (127.0.0.1:8085) to solve Turnstile and harvest real sessions"
              className="flex-1 h-6 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1 border border-emerald-500/40 transition-all"
            >
              <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
              <span>1. Browser</span>
            </button>

            <button
              onClick={() => (isCrawling ? handleStopCrawl() : handleCrawlHost())}
              title={isCrawling ? 'Stop crawler immediately' : 'Run crawl with harvested clearance cookies and polite Gaussian jitter'}
              className={`flex-1 h-6 rounded text-[10px] font-bold flex items-center justify-center gap-1 border transition-all ${
                isCrawling
                  ? 'bg-red-500/20 hover:bg-red-500/40 text-red-300 border-red-500/50 animate-pulse'
                  : 'bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border-accent-cyan/40'
              }`}
            >
              {isCrawling ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-red-400 text-red-400" />
                  <span>■ Stop</span>
                </>
              ) : (
                <>
                  <Compass className="w-2.5 h-2.5 text-accent-cyan" />
                  <span>2. Crawl</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Machine Blitz Action Bar */
        <div className="px-3 py-1.5 border-b border-border-subtle bg-[#0a0d13] flex items-center justify-between text-[10px] font-mono gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Zap className="w-3 h-3 text-accent-cyan flex-shrink-0" />
            <input
              type="text"
              value={selectedHost || activeTargetHost}
              onChange={(e) => setSelectedHost(e.target.value.trim())}
              placeholder="target.domain"
              className="bg-[#12151c] text-accent-cyan border border-accent-cyan/40 rounded px-1.5 py-0.5 text-[9px] font-mono outline-none focus:border-accent-cyan w-[130px] truncate"
              title="Target host for machine crawl"
            />
          </div>
          <button
            onClick={() => (isCrawling ? handleStopCrawl() : handleCrawlHost())}
            title={isCrawling ? 'Stop crawler immediately' : 'Run high-speed autonomous crawl for hidden routes and endpoints'}
            className={`h-6 px-2.5 rounded font-bold flex items-center gap-1 border transition-all text-[10px] whitespace-nowrap ${
              isCrawling
                ? 'bg-red-500/20 hover:bg-red-500/40 text-red-300 border-red-500/50 animate-pulse'
                : 'bg-accent-cyan/15 hover:bg-accent-cyan/25 text-accent-cyan hover:text-white border-accent-cyan/30'
            }`}
          >
            {isCrawling ? (
              <>
                <Square className="w-2.5 h-2.5 fill-red-400 text-red-400" />
                <span>■ Stop</span>
              </>
            ) : (
              <>
                <Compass className="w-2.5 h-2.5 text-accent-cyan" />
                <span>Crawl Site</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. Filter Bar */}
      <div className="p-2 border-b border-border-subtle bg-[#0e1117] flex items-center gap-1.5 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="w-3 h-3 absolute left-2 top-2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter targets..."
            className="w-full bg-[#161a23] pl-6 pr-2 py-1 text-xs font-mono text-white rounded border border-border-subtle focus:outline-none focus:border-accent-cyan placeholder:text-text-muted text-[11px]"
          />
        </div>

        {/* SQL Injection Candidates Toggle */}
        <button
          onClick={() => setFilterSqliOnly(!filterSqliOnly)}
          title="Toggle SQL Injection Candidate Filter"
          className={`h-6 px-1.5 rounded flex items-center gap-1 text-[10px] font-mono font-bold border transition-colors ${
            filterSqliOnly
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
              : 'bg-[#161a23] text-text-muted border-border-subtle hover:text-white'
          }`}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>SQLi</span>
        </button>

        {/* Clear Crawled Endpoints Purge Button */}
        {crawledEndpoints.length > 0 && (
          <button
            onClick={() => {
              setCrawledEndpoints([]);
              addToast({
                type: 'info',
                title: 'Crawl Surfaces Purged',
                description: 'Cleared speculative and crawled routes. Showing genuine proxy endpoints only.',
              });
            }}
            title="Purge speculative / crawled routes and show only live proxy endpoints"
            className="h-6 px-1.5 rounded flex items-center gap-1 text-[10px] font-mono border border-border-subtle bg-[#161a23] text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span>Purge Crawl ({crawledEndpoints.length})</span>
          </button>
        )}
      </div>

      {/* 3. Collapsible Host Tree (Exact Match to User's Reference Image) */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50 font-mono text-xs no-scrollbar">
        {filteredHostGroups.length === 0 ? (
          <div className="p-4 text-center text-text-muted text-xs italic">
            No matching hosts found in proxy traffic.
          </div>
        ) : (
          filteredHostGroups.map((group) => {
            const isExpanded = Boolean(expandedHosts[group.host]);

            return (
              <div key={group.host} className="flex flex-col">
                {/* Host Row (Styled identical to uploaded screenshot) */}
                <div
                  onClick={() => toggleHost(group.host)}
                  onContextMenu={(e) => handleHostContextMenu(e, group)}
                  className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer transition-colors group ${
                    isExpanded
                      ? 'bg-[#181c26] text-white'
                      : 'hover:bg-[#161a23] text-[#d1d5db]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {/* Chevron expander */}
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                    )}

                    {/* Padlock Icon (Emerald/Green matching screenshot) */}
                    <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />

                    {/* Host Name */}
                    <span
                      title={group.host}
                      className="font-mono text-xs truncate max-w-[155px] font-medium"
                    >
                      {group.host}
                    </span>

                    {/* SQLi Candidate Flame Indicator */}
                    {group.sqliCandidateCount > 0 && (
                      <span
                        title={`${group.sqliCandidateCount} SQL injection surface(s) detected`}
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Inline Crawl Trigger on Hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCrawlHost(group.host);
                      }}
                      title={`Crawl ${group.host} for SQL sinks`}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent-cyan/20 text-accent-cyan transition-opacity"
                    >
                      <Compass className="w-3 h-3" />
                    </button>

                    {/* Count Badge on the Right (Muted font matching screenshot) */}
                    <span className="text-zinc-500 font-mono text-xs pr-1">
                      {group.totalRequests}
                    </span>
                  </div>
                </div>

                {/* Expanded Endpoint Subtree */}
                {isExpanded && (
                  <div className="bg-[#0b0d13] border-t border-b border-border-subtle/40 divide-y divide-border-subtle/30 pl-4">
                    {group.endpoints.length === 0 ? (
                      <div className="py-2 pl-4 text-text-muted text-[11px] italic">
                        No endpoints available.
                      </div>
                    ) : (
                      group.endpoints.map((ep) => (
                        <div
                          key={ep.id}
                          onClick={() => handleSelectEndpoint(ep)}
                          onContextMenu={(e) => handleEndpointContextMenu(e, ep)}
                          className="py-1.5 pr-2 pl-2 flex items-center justify-between hover:bg-[#161a24] cursor-pointer transition-colors group/item"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {/* Method Badge */}
                            <span
                              className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                ep.method === 'GET'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40'
                                  : ep.method === 'POST'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                                  : 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                              }`}
                            >
                              {ep.method}
                            </span>

                            {/* Live Status Code Badge (e.g. 200 OK) */}
                            {ep.statusCode && ep.statusCode !== 404 && (
                              <span
                                title={`HTTP ${ep.statusCode} Live Response`}
                                className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded ${
                                  ep.statusCode >= 200 && ep.statusCode < 300
                                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-400'
                                    : ep.statusCode >= 300 && ep.statusCode < 400
                                    ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-400'
                                    : 'bg-amber-950/80 border border-amber-500/40 text-amber-400'
                                }`}
                              >
                                {ep.statusCode}
                              </span>
                            )}

                            {/* Path */}
                            <span
                              title={ep.path}
                              className={`text-[11px] truncate max-w-[140px] ${
                                ep.isSqliCandidate
                                  ? 'text-white font-medium'
                                  : 'text-text-muted'
                              }`}
                            >
                              {ep.path}
                            </span>
                          </div>

                          {/* Candidate Surface Indicators */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {ep.source === 'openapi' && (
                              <span title="Discovered via OpenAPI/Swagger specification" className="text-[8px] px-1 py-0.2 rounded bg-purple-950/70 border border-purple-500/30 text-purple-300 font-mono">
                                API
                              </span>
                            )}
                            {ep.source === 'graphql' && (
                              <span title="Discovered via GraphQL introspection" className="text-[8px] px-1 py-0.2 rounded bg-pink-950/70 border border-pink-500/30 text-pink-300 font-mono">
                                GQL
                              </span>
                            )}
                            {ep.source === 'html_form' && (
                              <span title="Discovered via HTML Form extraction" className="text-[8px] px-1 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 font-mono">
                                Form
                              </span>
                            )}
                            {ep.sqliReason.includes('Wayback') && (
                              <span title="Discovered via Historical Wayback Machine" className="text-[8px] px-1 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono font-bold">
                                ARCH
                              </span>
                            )}
                            {ep.sqliReason.includes('AlienVault') && (
                              <span title="Discovered via AlienVault OTX Threat Intel" className="text-[8px] px-1 py-0.2 rounded bg-red-950/80 border border-red-500/40 text-red-300 font-mono font-bold">
                                OTX
                              </span>
                            )}
                            {ep.sqliReason.includes('Dynamic') && (
                              <span title="Discovered via Dynamic JS AST Expression Evaluation" className="text-[8px] px-1 py-0.2 rounded bg-blue-950/80 border border-blue-500/40 text-blue-300 font-mono font-bold">
                                DYN
                              </span>
                            )}
                            {ep.sqliReason.includes('mutation') && (
                              <span title="Discovered via Smart Mutation Frontier" className="text-[8px] px-1 py-0.2 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono font-bold">
                                MUT
                              </span>
                            )}
                            {ep.isSqliCandidate ? (
                              <span
                                title={ep.sqliReason}
                                className="text-[9px] px-1 py-0.2 rounded bg-amber-950/70 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-0.5"
                              >
                                <Zap className="w-2.5 h-2.5 text-amber-400" />
                                <span>SQLi</span>
                              </span>
                            ) : ep.params.length > 0 ? (
                              <span className="text-[9px] text-text-muted font-mono">
                                ({ep.params.length}p)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Footer Summary */}
      <div className="h-7 px-2.5 bg-bg-panel border-t border-border-subtle flex items-center justify-between text-[10px] font-mono text-text-muted flex-shrink-0">
        <span>{filteredHostGroups.length} Hosts</span>
        <span className="text-emerald-400">
          {proxyEndpoints.filter((e) => e.isSqliCandidate).length} SQLi Surfaces
        </span>
      </div>

      {/* 5. Right-Click Context Menu */}
      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={contextMenu.items}
        />
      )}
    </div>
  );
};
