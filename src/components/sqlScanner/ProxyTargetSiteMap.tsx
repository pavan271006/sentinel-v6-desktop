import React, { useState, useMemo } from 'react';
import { useTrafficStore } from '../../stores/trafficStore';
import { useSqlScannerStore } from '../../stores/sqlScannerStore';
import { useToastStore } from '../../stores/toastStore';
import { TargetSiteCrawler, DiscoveredEndpoint } from '../../services/sqlScanner/crawler/TargetSiteCrawler';
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

  const [expandedHosts, setExpandedHosts] = useState<Record<string, boolean>>({
    'www.google.com': false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSqliOnly, setFilterSqliOnly] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlingProgress, setCrawlingProgress] = useState<string>('');
  const [crawledEndpoints, setCrawledEndpoints] = useState<DiscoveredEndpoint[]>([]);

  // Toggle host expansion
  const toggleHost = (host: string) => {
    setExpandedHosts((prev) => ({
      ...prev,
      [host]: !prev[host],
    }));
  };

  // Convert Proxy transactions into DiscoveredEndpoint format
  const proxyEndpoints: DiscoveredEndpoint[] = useMemo(() => {
    const list: DiscoveredEndpoint[] = [];

    // 1. Ingest from trafficStore
    for (const tx of transactions) {
      if (!tx.host) continue;

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

    // 2. Default Seed Targets if traffic is fresh/empty (reflecting user's reference image structure)
    if (list.length === 0 && crawledEndpoints.length === 0) {
      const seedHosts = [
        { host: 'www.google.com', count: 30, samplePaths: ['/search?q=cybersecurity&hl=en', '/complete/search?q=sql', '/url?sa=t&url=test'] },
        { host: 'www.gstatic.com', count: 10, samplePaths: ['/generate_204', '/images?q=tbn:ANd9GcQ'] },
        { host: 'fonts.gstatic.com', count: 2, samplePaths: ['/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2'] },
        { host: 'ogads-pa.clients6.google.com', count: 2, samplePaths: ['/v1/user/settings?id=1001'] },
        { host: 'content-autofill.googleapis.com', count: 1, samplePaths: ['/autofill/v1/query?form_id=202'] },
        { host: 'play.google.com', count: 2, samplePaths: ['/store/apps/details?id=com.app&hl=en'] },
        { host: 'android.clients.google.com', count: 1, samplePaths: ['/checkin?device_id=98765'] },
        { host: 'beacons.gcp.gvt2.com', count: 1, samplePaths: ['/ping?source=desktop'] },
        { host: 'ogs.google.com', count: 1, samplePaths: ['/widget/app?authuser=0'] },
        { host: 'ssl.gstatic.com', count: 1, samplePaths: ['/gb/images/bar.png'] },
        { host: 'www.youtube.com', count: 2, samplePaths: ['/results?search_query=sqli+tutorial', '/watch?v=dQw4w9WgXcQ'] },
      ];

      for (const sh of seedHosts) {
        for (let i = 0; i < sh.samplePaths.length; i++) {
          const path = sh.samplePaths[i];
          const method = 'GET';
          const params: { name: string; type: 'query'; sampleValue: string }[] = [];
          if (path.includes('?')) {
            const sp = new URLSearchParams(path.split('?')[1]);
            sp.forEach((val, key) => params.push({ name: key, type: 'query', sampleValue: val }));
          }
          const scoring = TargetSiteCrawler.scoreSqliSurface(method, path, params);

          list.push({
            id: `seed_${sh.host}_${i}`,
            host: sh.host,
            url: `https://${sh.host}${path}`,
            path,
            method,
            headers: { Host: sh.host },
            source: 'proxy',
            params,
            sqliScore: scoring.sqliScore,
            isSqliCandidate: scoring.isSqliCandidate,
            sqliReason: scoring.sqliReason,
            rawRequest: `GET ${path} HTTP/1.1\r\nHost: ${sh.host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nConnection: close\r\n\r\n`,
            statusCode: 200,
            timestamp: Date.now() - i * 60000,
          });
        }
      }
    }

    return [...list, ...crawledEndpoints];
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
    addToast({
      type: 'success',
      title: 'Target Request Loaded',
      description: `${ep.method} ${ep.path} imported into SQL Scanner with ${ep.params.length} candidate parameter(s).`,
    });
  };

  // Trigger Website Crawler for selected host or current active target
  const handleCrawlHost = async (hostToCrawl?: string) => {
    let target = hostToCrawl;
    if (!target) {
      // Use active target URL host
      try {
        target = new URL(targetConfig.url).host;
      } catch {
        target = hostGroups[0]?.host || 'ginandjuice.shop';
      }
    }

    setIsCrawling(true);
    setCrawlingProgress(`Initiating SQL sink discovery on ${target}...`);

    try {
      const crawler = new TargetSiteCrawler();
      const discovered = await crawler.crawlHost(target, (msg) => {
        setCrawlingProgress(msg);
      });

      setCrawledEndpoints((prev) => {
        const existingIds = new Set(prev.map((p) => p.url));
        const newOnes = discovered.filter((d) => !existingIds.has(d.url));
        return [...prev, ...newOnes];
      });

      // Auto-expand crawled host
      setExpandedHosts((prev) => ({ ...prev, [target!]: true }));

      const sqliCount = discovered.filter((d) => d.isSqliCandidate).length;
      addToast({
        type: 'success',
        title: `Crawl Completed on ${target}`,
        description: `Discovered ${discovered.length} total endpoints (${sqliCount} high-probability SQL injection surfaces).`,
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
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12151c] border-r border-border-subtle text-text-primary select-none overflow-hidden font-sans w-72 flex-shrink-0">
      {/* 1. Header Toolbar */}
      <div className="h-9 px-2.5 border-b border-border-subtle flex items-center justify-between bg-bg-panel-elevated flex-shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <Globe className="w-3.5 h-3.5 text-accent-cyan flex-shrink-0" />
          <span className="text-xs font-bold text-white font-mono tracking-wide truncate">
            SITE MAP & PROXY
          </span>
        </div>

        {/* Small Crawl Button */}
        <button
          onClick={() => handleCrawlHost()}
          disabled={isCrawling}
          title="Crawl active website for hidden endpoints & SQL injection surfaces"
          className="h-6 px-2 rounded bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan hover:text-white text-[11px] font-mono font-bold flex items-center gap-1 border border-accent-cyan/30 transition-all"
        >
          {isCrawling ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-accent-cyan" />
              <span>Crawling...</span>
            </>
          ) : (
            <>
              <Compass className="w-3 h-3 text-accent-cyan" />
              <span>Crawl Site</span>
            </>
          )}
        </button>
      </div>

      {/* Crawl Progress Banner (when active) */}
      {isCrawling && (
        <div className="px-2.5 py-1.5 bg-accent-cyan/10 border-b border-accent-cyan/30 text-[10px] font-mono text-accent-cyan flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
          <span className="truncate">{crawlingProgress}</span>
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
    </div>
  );
};
