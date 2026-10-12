import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Badge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Modal } from '../design-system/Modal';
import { useScopeStore, ScopePreset, ScopeRuleDef } from '../stores/scopeStore';
import { useTrafficStore } from '../stores/trafficStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { useToastStore } from '../stores/toastStore';
import { useIntruderStore } from '../stores/intruderStore';
import { useReconStore } from '../stores/reconStore';
import { ContextMenu, ContextMenuItem } from '../design-system/ContextMenu';
import { ipcClient } from '../ipc/client';
import { CdpTargetPage, stealthCdpBrowserDriver } from '../services/contentDiscovery/StealthCdpBrowserDriver';
import {
  unifiedReconOrchestrator,
  ReconEngineType,
  UnifiedReconProgress,
} from '../services/contentDiscovery/UnifiedReconOrchestrator';
import { isWafChallenge } from '../services/contentDiscovery/WafAndWildcardDetector';
import { isLogoutUrl } from '../services/contentDiscovery/KatanaCrawlerService';
import { ReverseOpenApiSynthesizer } from '../services/apiSecurity/ReverseOpenApiSynthesizer';
import {
  LATEST_BENCHMARK_AUDIT,
  generateBenchmarkSiteMapRequests,
} from '../services/contentDiscovery/BenchmarkAuditData';
import {
  ShieldCheck,
  Trash2,
  Save,
  FileCode,
  Globe,
  Folder,
  Filter,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Lock,
  Sparkles,
  RefreshCw,
  Activity,
  StopCircle,
  Search,
  X,
  Download,
  Copy,
  FileJson,
  FileText,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { HttpSyntaxHighlighter } from '../components/common/HttpSyntaxHighlighter';
import { BurpEditorToolbar } from '../components/common/BurpEditorToolbar';
import { BurpSearchBar, countSearchMatches } from '../components/common/BurpSearchBar';
import { SplitPane } from '../design-system/SplitPane';
import { BurpInspectorPanel } from '../components/traffic/BurpInspectorPanel';
import { generateRenderablePreviewHtml } from '../utils/repeaterUtils';
import {
  HttpHistoryFilterModal,
  HttpHistoryFilterConfig,
  DEFAULT_FILTER_CONFIG,
} from '../components/traffic/HttpHistoryFilterModal';

export interface SiteMapNode {
  id: string;
  name: string;
  fullPath: string;
  host: string;
  isHttps: boolean;
  type: 'host' | 'folder' | 'endpoint';
  expanded?: boolean;
  children?: SiteMapNode[];
  requestCount?: number;
}

export interface SiteMapRequest {
  id: number | string;
  host: string;
  method: string;
  url: string;
  path: string;
  params: boolean;
  status: number;
  length: number;
  mime: string;
  title: string;
  notes: string;
  requestRaw: string;
  responseRaw: string;
  reqAttributes: Record<string, string>;
  reqHeaders: Record<string, string>;
  resAttributes: Record<string, string>;
  resHeaders: Record<string, string>;
  isDiscovered?: boolean;
}



export function getActiveSessionHeadersForHost(transactions: any[], host: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!transactions || transactions.length === 0 || !host) return headers;

  const targetHostLower = host.toLowerCase().trim();

  // Search backwards from newest transaction for this host to extract session cookies/tokens
  for (let i = transactions.length - 1; i >= 0; i--) {
    const t = transactions[i];
    if (!t) continue;
    const tHost = (t.host || '').toLowerCase().trim();
    if (tHost === targetHostLower || targetHostLower.endsWith(`.${tHost}`) || tHost.endsWith(`.${targetHostLower}`)) {
      if (Array.isArray(t.reqHeaders)) {
        const cookie = t.reqHeaders.find((h: any) => h.name?.toLowerCase() === 'cookie');
        const auth = t.reqHeaders.find((h: any) => h.name?.toLowerCase() === 'authorization');
        if (cookie && cookie.value && !headers['Cookie']) {
          headers['Cookie'] = cookie.value;
        }
        if (auth && auth.value && !headers['Authorization']) {
          headers['Authorization'] = auth.value;
        }
      }
      if (headers['Cookie'] || headers['Authorization']) {
        break;
      }
    }
  }

  return headers;
}

function formatHexDump(str: string): string {
  const lines: string[] = [];
  const bytes = new TextEncoder().encode(str);
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(48, ' ');
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    const offset = i.toString(16).padStart(8, '0');
    lines.push(`${offset}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
}

// Extract HTML title tag
function extractTitleFromHtml(html: string): string {
  if (!html) return '';
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match ? match[1].trim() : '';
}

// Check if a hostname is an analytics, telemetry, or ad tracking service
function isNoiseHost(host: string): boolean {
  if (!host) return true;
  const h = host.toLowerCase().trim();
  return (
    h.includes('google-analytics') ||
    h.includes('googletagmanager') ||
    h.includes('doubleclick') ||
    h.includes('mixpanel') ||
    h.includes('segment') ||
    h.includes('hotjar') ||
    h.includes('clarity.ms') ||
    h.includes('facebook') ||
    h.includes('fonts.googleapis') ||
    h.includes('gstatic.com') ||
    h.includes('fontawesome') ||
    h.includes('sentry.io') ||
    h.includes('datadog')
  );
}

// Regex link and endpoint discovery extractor with performance protections
function extractLinksFromPayload(body: string, host: string): string[] {
  if (!body || typeof body !== 'string' || body.length < 5) return [];
  // Cap body inspection slice to 250KB to eliminate UI freezes on massive minified JS bundles
  const safeBody = body.length > 250000 ? body.slice(0, 250000) : body;
  const found = new Set<string>();

  const isNoisePath = (p: string) => {
    const low = p.toLowerCase();
    return (
      low.endsWith('.png') ||
      low.endsWith('.jpg') ||
      low.endsWith('.jpeg') ||
      low.endsWith('.gif') ||
      low.endsWith('.svg') ||
      low.endsWith('.webp') ||
      low.endsWith('.ico') ||
      low.endsWith('.woff') ||
      low.endsWith('.woff2') ||
      low.endsWith('.ttf') ||
      low.endsWith('.eot') ||
      low.endsWith('.css') ||
      low.endsWith('.map') ||
      low.includes('google-analytics') ||
      low.includes('doubleclick') ||
      low.includes('clarity.ms')
    );
  };

  const addValid = (link: string) => {
    if (!link || isLogoutUrl(link) || isNoisePath(link)) return;
    if (found.size >= 35) return;
    let normalized = link.trim();
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      // Strictly force HTTPS on target host URLs to prevent Akamai 403 plain HTTP port 80 rejections
      if (normalized.startsWith('http://')) {
        normalized = 'https://' + normalized.slice(7);
      }
      if (normalized.includes(host)) found.add(normalized);
    } else if (normalized.startsWith('/')) {
      if (!normalized.startsWith('//') && !normalized.startsWith('/*')) {
        found.add(`https://${host}${normalized}`);
      }
    } else if (
      !normalized.startsWith('javascript:') &&
      !normalized.startsWith('mailto:') &&
      !normalized.startsWith('data:') &&
      !normalized.startsWith('#') &&
      !normalized.startsWith('{')
    ) {
      found.add(`https://${host}/${normalized}`);
    }
  };

  // 1. href tags on <a>, <link>, <li>, <div>, etc.
  const hrefRegex = /\bhref=["']([^"'#\s>]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(safeBody)) !== null && found.size < 35) {
    addValid(match[1]);
  }

  // 2. data-url, data-href, data-target, data-link, data-nav attributes
  const dataRegex = /\bdata-(?:url|href|endpoint|path|target|route|link|nav)=["']([^"'#\s>]+)["']/gi;
  while ((match = dataRegex.exec(safeBody)) !== null && found.size < 35) {
    addValid(match[1]);
  }

  // 3. onclick inline navigation
  const onclickRegex = /\bonclick=["']([^"']+)["']/gi;
  while ((match = onclickRegex.exec(safeBody)) !== null && found.size < 35) {
    const urls = match[1].matchAll(/['"](\/[a-zA-Z0-9_\-\.\/\?=&%#]{2,})['"]/gi);
    for (const u of urls) {
      if (!u[1].startsWith('//') && !u[1].startsWith('/*')) {
        addValid(u[1]);
      }
      if (found.size >= 35) break;
    }
  }

  // 4. Form action tags
  const actionRegex = /action=["']([^"'#\s>]+)["']/gi;
  while ((match = actionRegex.exec(safeBody)) !== null && found.size < 35) {
    addValid(match[1]);
  }

  // 5. API & Web Application Route strings inside JS/JSON/HTML
  const apiRegex = /["'](\/[a-zA-Z0-9_\-\.\/\?=&%#]{2,})["']/gi;
  while ((match = apiRegex.exec(safeBody)) !== null && found.size < 35) {
    const candidate = match[1];
    if (!candidate.startsWith('//') && !candidate.startsWith('/*')) {
      addValid(candidate);
    }
  }

  return Array.from(found);
}

export const ProjectScopeWorkspaceView: React.FC = () => {
  const {
    rules,
    testUrl,
    testResult,
    isSaving,
    addRule,
    deleteRule,
    toggleRule,
    applyPreset,
    saveScope,
    setTestUrl,
    evaluateTestUrl,
    exportRulesJson,
    importRulesJson,
    fetchScope,
  } = useScopeStore();

  const transactions = useTrafficStore((s) => s.transactions);
  const { addToast } = useToastStore();

  // Expanded nodes set in the left Tree
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Left Tree Search & Filter State
  const [treeSearchQuery, setTreeSearchQuery] = useState('');
  const [isTreeSearchOpen, setIsTreeSearchOpen] = useState(true);
  const treeSearchInputRef = useRef<HTMLInputElement>(null);

  // Selected Target Node in Left Tree
  const [selectedTargetHost, setSelectedTargetHost] = useState<string | null>(null);
  const [selectedPathFilter, setSelectedPathFilter] = useState<string | null>(null);

  // Selected item in the Top Table
  const [selectedItemId, setSelectedItemId] = useState<string | number | null>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  // Active Crawling & Multi-Engine Recon State (Persistent Global Recon Store)
  const {
    isCrawling,
    crawlerTarget,
    discoveredEndpointsCount,
    activeReconEngine,
    reconProgress,
    stealthSpeed,
    crawlerDiscoveredItems,
    setIsCrawling,
    setCrawlerTarget,
    setDiscoveredEndpointsCount,
    setActiveReconEngine,
    setReconProgress,
    setStealthSpeed,
    setCrawlerDiscoveredItems,
  } = useReconStore();

  const [selectedSourceFilter, setSelectedSourceFilter] = useState<'all' | 'katana' | 'gau' | 'jsluice' | 'arjun' | 'ffuf'>('all');
  const [targetInput, setTargetInput] = useState<string>('');
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [openChromeTabs, setOpenChromeTabs] = useState<CdpTargetPage[]>([]);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);

  const STEALTH_SPEED_CONFIG: Record<'turbo' | 'fast' | 'normal' | 'human' | 'deep', { label: string; delayMs: number; icon: string; title: string }> = {
    turbo: { label: '🚀 Turbo', delayMs: 20, icon: '🚀', title: 'Turbo: Instant switching as fast as pages load, 0 artificial delay' },
    fast: { label: '⚡ Fast', delayMs: 100, icon: '⚡', title: 'Fast (100ms): Rapid load-based cadence' },
    normal: { label: '⚖️ Balanced', delayMs: 450, icon: '⚖️', title: 'Balanced (450ms): Natural responsive cadence' },
    human: { label: '🥷 Human', delayMs: 1000, icon: '🥷', title: 'Human (1000ms): High stealth with natural pauses' },
    deep: { label: '🐢 Paced', delayMs: 2200, icon: '🐢', title: 'Paced (2200ms): Ultra-stealthy for rate-limited sites' },
  };

  // Sync targetInput when selectedTargetHost changes (unless empty or dummy)
  useEffect(() => {
    if (selectedTargetHost && selectedTargetHost !== 'target.local') {
      setTargetInput(selectedTargetHost);
    }
  }, [selectedTargetHost]);

  const refreshOpenTabs = async () => {
    try {
      const targets = await ipcClient.getCdpTargets();
      const web = targets.filter((p) => p.type === 'page' && !p.url.startsWith('chrome://') && !p.url.startsWith('about:'));
      setOpenChromeTabs(web);
    } catch {
      setOpenChromeTabs([]);
    }
  };

  const handleApplyTargetInput = (val: string) => {
    let clean = val.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        clean = new URL(clean).host;
      } catch {}
    }
    setTargetInput(clean);
    if (clean) {
      setSelectedTargetHost(clean);
      setCrawlerTarget(clean);
    }
  };

  // Inspector View Modes
  const [requestTabMode, setRequestTabMode] = useState<'pretty' | 'raw' | 'hex'>('raw');
  const [responseTabMode, setResponseTabMode] = useState<'pretty' | 'raw' | 'hex' | 'render'>('raw');

  const [reqHideBoring, setReqHideBoring] = useState(false);
  const [reqWordWrap, setReqWordWrap] = useState(false);
  const [reqShowNonPrintable, setReqShowNonPrintable] = useState(false);

  const [resHideBoring, setResHideBoring] = useState(false);
  const [resWordWrap, setResWordWrap] = useState(false);
  const [resShowNonPrintable, setResShowNonPrintable] = useState(false);

  // Target Inspector Search & Layout State
  const [targetReqSearch, setTargetReqSearch] = useState('');
  const [targetReqMatchIdx, setTargetReqMatchIdx] = useState(0);
  const [targetResSearch, setTargetResSearch] = useState('');
  const [targetResMatchIdx, setTargetResMatchIdx] = useState(0);
  const [targetLayoutMode, setTargetLayoutMode] = useState<'sideBySide' | 'stacked'>('sideBySide');
  const [targetRightDrawer, setTargetRightDrawer] = useState<'none' | 'inspector' | 'notes'>('none');
  const [targetNotes, setTargetNotes] = useState('');

  // Filter Modal
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [siteMapFilterConfig, setSiteMapFilterConfig] = useState<HttpHistoryFilterConfig>(DEFAULT_FILTER_CONFIG);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
    items: ContextMenuItem[];
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    items: [],
  });

  // Scope Form State
  const [newRuleType, setNewRuleType] = useState<'INCLUDE' | 'EXCLUDE'>('INCLUDE');
  const [newPatternType, setNewPatternType] = useState<ScopeRuleDef['pattern_type']>('HOST');
  const [newPattern, setNewPattern] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // JSON Import/Export Modal State
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');

  // OpenAPI 3.1 Reverse Synthesizer Modal State
  const [openApiModalOpen, setOpenApiModalOpen] = useState(false);
  const [openApiSpecJson, setOpenApiSpecJson] = useState('');


  // Load scope rules from backend on mount
  useEffect(() => {
    fetchScope();
  }, [fetchScope]);

  // Aggregate Transactions and Discovered Items into Site Map Database
  const siteMapDatabase = useMemo(() => {
    const list: SiteMapRequest[] = [];
    const seenUrls = new Set<string>();

    // 1. Process Live Proxy Transactions
    transactions.forEach((t, idx) => {
      if (!t) return;
      const tUrl = t.url || '';
      const tHost = t.host || (tUrl.startsWith('http') ? tUrl.split('/')[2] : 'target.local');
      const tPath = t.path || (tUrl.startsWith('http') ? '/' + tUrl.split('/').slice(3).join('/') : '/');
      let fullUrl = tUrl.startsWith('https://')
        ? tUrl
        : tUrl.startsWith('http://')
        ? 'https://' + tUrl.slice(7)
        : `https://${tHost}${tPath.startsWith('/') ? tPath : '/' + tPath}`;
      seenUrls.add(fullUrl);

      const hasParams = (tPath && tPath.includes('?')) || Boolean(t.reqBody && t.reqBody.length > 0);
      const reqHeadersObj: Record<string, string> = {};
      if (Array.isArray(t.reqHeaders)) {
        t.reqHeaders.forEach((h) => {
          if (h && h.name) reqHeadersObj[h.name] = h.value;
        });
      }

      const resHeadersObj: Record<string, string> = {};
      if (Array.isArray(t.resHeaders)) {
        t.resHeaders.forEach((h) => {
          if (h && h.name) resHeadersObj[h.name] = h.value;
        });
      }

      // Filter out 'Host' from reqHeadersObj to eliminate duplicate 'Host:' headers
      const filteredHeaders = Object.entries(reqHeadersObj).filter(([k]) => k.toLowerCase() !== 'host');
      const headerText = filteredHeaders
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      const rawRequest = `${t.method || 'GET'} ${tPath || '/'} HTTP/1.1\r\nHost: ${tHost}\r\n${headerText ? headerText + '\r\n' : ''}\r\n${t.reqBody || ''}`;

      const resHeaderText = Object.entries(resHeadersObj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      const rawResponse = `HTTP/1.1 ${t.status || 200} OK\r\n${resHeaderText}\r\n\r\n${t.resBody || ''}`;

      const item: SiteMapRequest = {
        id: t.id ? String(t.id) : `tx-${idx}`,
        host: tHost,
        method: t.method || 'GET',
        url: tPath || '/',
        path: tPath || '/',
        params: hasParams,
        status: t.status || 200,
        length: t.sizeBytes || (t.resBody ? t.resBody.length : 0),
        mime: t.mimeType?.includes('html')
          ? 'HTML'
          : t.mimeType?.includes('json')
          ? 'JSON'
          : t.mimeType?.includes('javascript') || t.mimeType?.includes('script')
          ? 'script'
          : t.mimeType?.includes('image')
          ? 'image'
          : t.mimeType?.includes('css')
          ? 'CSS'
          : t.mimeType || 'HTML',
        title: extractTitleFromHtml(t.resBody || ''),
        notes: '',
        requestRaw: rawRequest,
        responseRaw: rawResponse,
        reqAttributes: {
          Protocol: 'HTTP/1.1',
          Method: t.method || 'GET',
          Path: tPath,
          'Content-Length': `${(t.reqBody || '').length} bytes`,
        },
        reqHeaders: reqHeadersObj,
        resAttributes: {
          Status: `${t.status || 200}`,
          MIME: t.mimeType || 'text/html',
          'Content-Length': `${t.sizeBytes || 0} bytes`,
        },
        resHeaders: resHeadersObj,
        isDiscovered: false,
      };

      list.push(item);
    });

    // 2. Merge Discovered Crawler Items
    crawlerDiscoveredItems.forEach((c) => {
      if (!c || !c.host) return;
      const fullUrl = `https://${c.host}${c.path || '/'}`;
      if (!seenUrls.has(fullUrl)) {
        seenUrls.add(fullUrl);
        list.push(c);
      }
    });

    return list;
  }, [transactions, crawlerDiscoveredItems]);

  // Delta pointer for transaction processing to eliminate O(N^2) UI freeze on streaming proxy traffic
  const lastProcessedTxCount = useRef(0);

  // Passive Link Scanner: High-performance O(1) incremental delta parser
  useEffect(() => {
    if (transactions.length === 0) {
      lastProcessedTxCount.current = 0;
      return;
    }
    if (transactions.length <= lastProcessedTxCount.current) {
      return;
    }

    const deltaTransactions = transactions.slice(lastProcessedTxCount.current);
    lastProcessedTxCount.current = transactions.length;

    setCrawlerDiscoveredItems((prev) => {
      let changed = false;
      const next = [...prev];

      // Fast O(1) Map indexing for instant item enrichment without findIndex linear scans
      const existingKeyMap = new Map<string, number>();
      next.forEach((item, idx) => {
        if (item && item.host && item.path) {
          existingKeyMap.set(`${item.host}:${item.path}:${item.method || 'GET'}`, idx);
        }
      });
      const seen = new Set<string>(next.filter(Boolean).map((c) => `https://${c.host}${c.path || '/'}`));

      for (const t of deltaTransactions) {
        if (!t || !t.host || isNoiseHost(t.host)) continue;

        // 1. If transaction matches an existing discovered item with status 0, enrich it with live response
        const lookupKey = `${t.host}:${t.path || '/'}:${t.method || 'GET'}`;
        const existingIdx = existingKeyMap.get(lookupKey);
        if (existingIdx !== undefined && existingIdx >= 0 && existingIdx < next.length) {
          const targetItem = next[existingIdx];
          if (targetItem && ((targetItem.status === 0 || !targetItem.status) || targetItem.responseRaw?.includes('Unrequested'))) {
            const resHeadersObj: Record<string, string> = {};
            if (Array.isArray(t.resHeaders)) {
              t.resHeaders.forEach((h) => {
                if (h && h.name) resHeadersObj[h.name] = h.value;
              });
            }
            const rawHeaders = Array.isArray(t.resHeaders)
              ? t.resHeaders.map((h) => `${h.name}: ${h.value}`).join('\r\n')
              : '';
            const responseRaw = `HTTP/1.1 ${t.status || 200} OK\r\n${rawHeaders ? rawHeaders + '\r\n' : ''}\r\n${t.resBody || ''}`;

            next[existingIdx] = {
              ...targetItem,
              status: t.status || 200,
              length: t.resBody?.length || t.sizeBytes || targetItem.length,
              responseRaw,
              resHeaders: Object.keys(resHeadersObj).length > 0 ? resHeadersObj : targetItem.resHeaders,
              resAttributes: {
                Status: `${t.status || 200}`,
                Size: `${t.resBody?.length || t.sizeBytes || 0} bytes`,
                Source: 'MITM Proxy Interception'
              }
            };
            changed = true;
          }
        }

        // 2. Extract new passive links only from real HTML/JSON/JS response payloads
        if (!t.resBody || t.resBody.length < 10) continue;
        const mime = (t.mimeType || '').toLowerCase();
        if (mime.includes('image') || mime.includes('css') || mime.includes('font') || mime.includes('audio') || mime.includes('video')) {
          continue;
        }

        const host = t.host;
        const links = extractLinksFromPayload(t.resBody, host);
        for (const link of links) {
          if (!seen.has(link)) {
            seen.add(link);
            try {
              const parsed = new URL(link);
              const path = parsed.pathname + parsed.search;
              const modernRequestRaw =
                `GET ${path} HTTP/1.1\r\n` +
                `Host: ${parsed.host}\r\n` +
                `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\r\n` +
                `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\n` +
                `Accept-Language: en-US,en;q=0.9\r\n` +
                `Sec-Ch-Ua: "Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"\r\n` +
                `Sec-Ch-Ua-Mobile: ?0\r\n` +
                `Sec-Ch-Ua-Platform: "Windows"\r\n` +
                `Sec-Fetch-Dest: document\r\n` +
                `Sec-Fetch-Mode: navigate\r\n` +
                `Sec-Fetch-Site: same-origin\r\n` +
                `Connection: keep-alive\r\n\r\n`;

              const newItem: SiteMapRequest = {
                id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                host: parsed.host,
                method: 'GET',
                url: path,
                path: path,
                params: path.includes('?'),
                status: 0,
                length: 0,
                mime: path.endsWith('.js') ? 'script' : path.endsWith('.json') ? 'JSON' : path.endsWith('.css') ? 'CSS' : 'HTML',
                title: 'Discovered link',
                notes: 'Extracted passively from response payload',
                requestRaw: modernRequestRaw,
                responseRaw: `HTTP/1.1 0 Unrequested\r\n\r\n(Discovered endpoint — auto-resolving live response)`,
                reqAttributes: { Method: 'GET', Path: path },
                reqHeaders: { Host: parsed.host },
                resAttributes: { Status: 'Discovered' },
                resHeaders: {},
                isDiscovered: true,
              };

              next.push(newItem);
              existingKeyMap.set(`${newItem.host}:${newItem.path}:${newItem.method}`, next.length - 1);
              changed = true;
            } catch (e) {
              // ignore invalid URL
            }
          }
        }
      }

      return changed ? next : prev;
    });
  }, [transactions]);

  // Background Auto-Resolver: Automatically fetches and renders live server responses
  // so the user never has to click "⚡ Request item" manually!
  const isResolvingRef = useRef(false);
  useEffect(() => {
    if (isResolvingRef.current) return;
    const unrequested = crawlerDiscoveredItems.filter(
      (c) => c && ((c.status === 0 || !c.status) || c.responseRaw?.includes('Unrequested')) && !c.notes?.includes('Connection Failed')
    );
    if (unrequested.length === 0) return;

    // Prioritize target host if selected
    const targetItems = selectedTargetHost
      ? unrequested.filter((c) => c && c.host && c.host.toLowerCase() === selectedTargetHost.toLowerCase())
      : unrequested;

    if (targetItems.length === 0) return;

    // Prioritize actively viewed item if it needs resolving
    const activeUnrequested = targetItems.find((c) => c && c.id === selectedItemId);
    const itemToResolve = activeUnrequested || targetItems[0];
    if (!itemToResolve) return;
    isResolvingRef.current = true;

    const timer = setTimeout(async () => {
      try {
        await fetchEndpointResponse(itemToResolve, true);
      } catch {} finally {
        isResolvingRef.current = false;
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [crawlerDiscoveredItems, selectedTargetHost, selectedItemId]);

  // Build Hierarchical Site Map Tree from Aggregated Database
  const siteMapTree = useMemo(() => {
    const hostMap = new Map<string, { isHttps: boolean; pathMap: Map<string, Set<string>>; count: number }>();

    const itemsToTree = siteMapFilterConfig.showOnlyQualityData
      ? siteMapDatabase.filter((r) => r && (r.status || 0) > 0 && (r.status || 0) >= 200 && (r.status || 0) < 400 && !r.responseRaw?.includes('Unrequested') && !r.responseRaw?.includes('Not requested yet') && !r.responseRaw?.includes('404 Not Found'))
      : siteMapDatabase.filter(Boolean);

    itemsToTree.forEach((item) => {
      if (!item) return;
      const host = item.host || 'target.local';
      const isHttps = true;

      if (!hostMap.has(host)) {
        hostMap.set(host, { isHttps, pathMap: new Map(), count: 0 });
      }
      const hostData = hostMap.get(host)!;
      hostData.count++;

      const segments = (item.path || '/').split('?')[0].split('/').filter(Boolean);
      if (segments.length === 0) {
        if (!hostData.pathMap.has('/')) {
          hostData.pathMap.set('/', new Set());
        }
      } else {
        let currentFolder = '';
        segments.forEach((seg, i) => {
          if (i === segments.length - 1) {
            // Leaf endpoint
            const parent = currentFolder || '/';
            if (!hostData.pathMap.has(parent)) hostData.pathMap.set(parent, new Set());
            hostData.pathMap.get(parent)!.add(seg);
          } else {
            // Intermediate folder
            const parent = currentFolder || '/';
            currentFolder += `/${seg}`;
            if (!hostData.pathMap.has(parent)) hostData.pathMap.set(parent, new Set());
            hostData.pathMap.get(parent)!.add(seg);
          }
        });
      }
    });

    const rootNodes: SiteMapNode[] = [];

    hostMap.forEach((hostData, host) => {
      const hostNodeId = `host-${host}`;

      const buildFolderChildren = (folderPath: string): SiteMapNode[] => {
        const directChildren = hostData.pathMap.get(folderPath);
        if (!directChildren) return [];
        const nodes: SiteMapNode[] = [];

        directChildren.forEach((childName) => {
          const childPath = folderPath === '/' ? `/${childName}` : `${folderPath}/${childName}`;
          const isFolder = hostData.pathMap.has(childPath);
          nodes.push({
            id: `node-${host}-${childPath}`,
            name: childName,
            fullPath: childPath,
            host,
            isHttps: hostData.isHttps,
            type: isFolder ? 'folder' : 'endpoint',
            children: isFolder ? buildFolderChildren(childPath) : undefined,
          });
        });

        return nodes;
      };

      rootNodes.push({
        id: hostNodeId,
        name: host,
        fullPath: '/',
        host,
        isHttps: hostData.isHttps,
        type: 'host',
        requestCount: hostData.count,
        children: buildFolderChildren('/'),
      });
    });

    return rootNodes;
  }, [siteMapDatabase, siteMapFilterConfig.showOnlyQualityData]);

  // Set default selected host when tree loads
  useEffect(() => {
    if (!selectedTargetHost && siteMapTree.length > 0) {
      const firstHost = siteMapTree[0];
      setSelectedTargetHost(firstHost.host);
      setExpandedNodeIds((prev) => new Set([...prev, firstHost.id]));
    }
  }, [siteMapTree, selectedTargetHost]);

  // Counts by Recon Engine Source
  const engineSourceCounts = useMemo(() => {
    let katana = 0, gau = 0, jsluice = 0, arjun = 0, ffuf = 0;
    siteMapDatabase.forEach((req) => {
      if (!req) return;
      const n = (req.notes || '').toLowerCase();
      const s = (req.reqAttributes?.Source || '').toLowerCase();
      if (n.includes('katana') || n.includes('form') || n.includes('button')) katana++;
      else if (n.includes('archive') || n.includes('wayback') || n.includes('alienvault') || n.includes('urlscan') || s.includes('archive')) gau++;
      else if (n.includes('jsluice') || n.includes('js ast') || s.includes('jsluice')) jsluice++;
      else if (n.includes('arjun') || n.includes('param') || s.includes('arjun')) arjun++;
      else if (n.includes('fuzz') || n.includes('ffuf')) ffuf++;
    });
    return { katana, gau, jsluice, arjun, ffuf, total: siteMapDatabase.length };
  }, [siteMapDatabase]);

  // Filter Table Requests
  const visibleRequests = useMemo(() => {
    return siteMapDatabase.filter((req) => {
      if (!req) return false;
      if (selectedTargetHost && req.host !== selectedTargetHost) return false;
      if (selectedPathFilter && selectedPathFilter !== '/' && !req.path?.startsWith(selectedPathFilter)) return false;

      const status = req.status ?? 0;

      // 0. Quality Data Filter: If enabled, show ONLY verified application endpoints (hide 404s, unrequested, and noise)
      if (siteMapFilterConfig.showOnlyQualityData) {
        if (!status || status === 0) return false;
        if (status < 200 || status >= 400) return false;
        if (req.responseRaw && (req.responseRaw.includes('Unrequested') || req.responseRaw.includes('Not requested yet') || req.responseRaw.includes('404 Not Found'))) return false;
        const m = (req.mime || '').toLowerCase();
        if (!req.params && !req.path?.includes('?')) {
          if (m.includes('image') || m.includes('css') || m.includes('font') || req.path?.match(/\.(png|jpe?g|gif|ico|webp|svg|woff2?|ttf|eot|css)$/i)) {
            return false;
          }
        }
      }

      // 1. Hide items without responses if requested
      if (siteMapFilterConfig.hideNoResponse) {
        if (!status || status === 0) return false;
        if (req.responseRaw && (req.responseRaw.includes('Unrequested') || req.responseRaw.includes('Not requested yet'))) return false;
      }

      // 2. Status codes
      if (status >= 200 && status < 300 && !siteMapFilterConfig.status2xx) return false;
      if (status >= 300 && status < 400 && !siteMapFilterConfig.status3xx) return false;
      if (status >= 400 && status < 500 && !siteMapFilterConfig.status4xx) return false;
      if (status >= 500 && !siteMapFilterConfig.status5xx) return false;

      // 3. MIME types
      const mime = (req.mime || '').toLowerCase();
      if ((mime.includes('html') || mime === 'text/html') && !siteMapFilterConfig.mimeHtml) return false;
      if ((mime.includes('script') || mime.includes('javascript') || req.path?.endsWith('.js')) && !siteMapFilterConfig.mimeScript) return false;
      if ((mime.includes('xml') || mime.includes('svg')) && !siteMapFilterConfig.mimeXml) return false;
      if ((mime.includes('css') || req.path?.endsWith('.css')) && !siteMapFilterConfig.mimeCss) return false;
      if ((mime.includes('image') || req.path?.match(/\.(png|jpe?g|gif|ico|webp)$/i)) && !siteMapFilterConfig.mimeImages) return false;
      if ((mime.includes('bin') || mime.includes('octet') || mime.includes('font') || req.path?.match(/\.(woff2?|ttf|eot)$/i)) && !siteMapFilterConfig.mimeOtherBinary) return false;

      // 4. Parameterized requests
      if (siteMapFilterConfig.showOnlyParameterized && !req.params && !req.path?.includes('?')) {
        return false;
      }

      // 5. File extension filters
      if (siteMapFilterConfig.filterShowOnlyExt && siteMapFilterConfig.showOnlyExtList) {
        const allowed = siteMapFilterConfig.showOnlyExtList.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
        const ext = req.path?.split('?')[0].split('.').pop()?.toLowerCase();
        if (!ext || !allowed.includes(ext)) return false;
      }
      if (siteMapFilterConfig.filterHideExt && siteMapFilterConfig.hideExtList) {
        const disallowed = siteMapFilterConfig.hideExtList.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
        const ext = req.path?.split('?')[0].split('.').pop()?.toLowerCase();
        if (ext && disallowed.includes(ext)) return false;
      }

      // 6. Search Term
      if (siteMapFilterConfig.searchTerm) {
        const st = siteMapFilterConfig.searchCaseSensitive ? siteMapFilterConfig.searchTerm : siteMapFilterConfig.searchTerm.toLowerCase();
        const haystack = siteMapFilterConfig.searchCaseSensitive
          ? `${req.url} ${req.method} ${req.notes || ''}`
          : `${req.url} ${req.method} ${req.notes || ''}`.toLowerCase();
        const matches = haystack.includes(st);
        if (siteMapFilterConfig.searchNegative ? matches : !matches) return false;
      }

      // 7. Source Filter
      if (selectedSourceFilter !== 'all') {
        const notes = (req.notes || '').toLowerCase();
        const reqSrc = (req.reqAttributes?.Source || '').toLowerCase();
        if (selectedSourceFilter === 'katana' && !notes.includes('katana') && !notes.includes('form') && !notes.includes('button')) return false;
        if (selectedSourceFilter === 'gau' && !notes.includes('archive') && !notes.includes('wayback') && !notes.includes('alienvault') && !notes.includes('urlscan') && !reqSrc.includes('archive')) return false;
        if (selectedSourceFilter === 'jsluice' && !notes.includes('jsluice') && !notes.includes('js ast') && !reqSrc.includes('jsluice')) return false;
        if (selectedSourceFilter === 'arjun' && !notes.includes('arjun') && !notes.includes('param') && !reqSrc.includes('arjun')) return false;
        if (selectedSourceFilter === 'ffuf' && !notes.includes('fuzz') && !notes.includes('ffuf')) return false;
      }
      return true;
    });
  }, [siteMapDatabase, selectedTargetHost, selectedPathFilter, siteMapFilterConfig, selectedSourceFilter]);

  // Currently active request shown in bottom split inspectors
  const activeRequest = useMemo(() => {
    if (selectedItemId !== null && selectedItemId !== undefined) {
      const found = visibleRequests.find((r) => r && String(r.id) === String(selectedItemId));
      if (found) return found;
    }
    if (selectedItemKey) {
      const foundByKey = visibleRequests.find((r) => r && `${r.host}${r.path}` === selectedItemKey);
      if (foundByKey) return foundByKey;
    }
    return visibleRequests.find(Boolean) || siteMapDatabase.find(Boolean) || null;
  }, [visibleRequests, selectedItemId, selectedItemKey, siteMapDatabase]);

  // High-performance virtualized windowing for large request volumes (e.g. 5,000 - 50,000+ items)
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(320);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setTableScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    if (tableContainerRef.current) {
      setTableViewportHeight(tableContainerRef.current.clientHeight || 320);
    }
    const handleResize = () => {
      if (tableContainerRef.current) {
        setTableViewportHeight(tableContainerRef.current.clientHeight || 320);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ROW_HEIGHT = 28;
  const OVERSCAN = 20;

  const totalRows = visibleRequests.length;
  const startIndex = Math.max(0, Math.floor(tableScrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(tableViewportHeight / ROW_HEIGHT) + 2 * OVERSCAN;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);
  const visibleSlice = useMemo(() => {
    return visibleRequests.slice(startIndex, endIndex);
  }, [visibleRequests, startIndex, endIndex]);

  // Active authenticated session detection from captured browser traffic
  const hostAuthHeaders = useMemo(() => {
    if (!selectedTargetHost) return {};
    return getActiveSessionHeadersForHost(transactions, selectedTargetHost);
  }, [transactions, selectedTargetHost]);

  const hasActiveSession = Boolean(hostAuthHeaders['Cookie'] || hostAuthHeaders['Authorization']);

  // Toggle Folder Expansion in Tree
  const toggleNodeExpand = (nodeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Filter Tree by treeSearchQuery
  const filteredSiteMapTree = useMemo(() => {
    const q = treeSearchQuery.trim().toLowerCase();
    if (!q) return siteMapTree;

    const filterNode = (node: SiteMapNode): SiteMapNode | null => {
      const selfMatches =
        node.name.toLowerCase().includes(q) ||
        (node.fullPath && node.fullPath.toLowerCase().includes(q)) ||
        (node.host && node.host.toLowerCase().includes(q));

      if (node.children && node.children.length > 0) {
        const filteredChildren: SiteMapNode[] = [];
        for (const child of node.children) {
          const filteredChild = filterNode(child);
          if (filteredChild) {
            filteredChildren.push(filteredChild);
          }
        }

        if (filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
      }

      if (selfMatches) {
        return node;
      }

      return null;
    };

    const results: SiteMapNode[] = [];
    for (const hostNode of siteMapTree) {
      const filtered = filterNode(hostNode);
      if (filtered) {
        results.push(filtered);
      }
    }

    return results;
  }, [siteMapTree, treeSearchQuery]);

  // Automatically expand matching tree nodes when search query changes
  useEffect(() => {
    const q = treeSearchQuery.trim().toLowerCase();
    if (!q) return;

    const idsToExpand = new Set<string>();
    const collectIds = (nodes: SiteMapNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          idsToExpand.add(n.id);
          collectIds(n.children);
        }
      }
    };
    collectIds(filteredSiteMapTree);
    if (idsToExpand.size > 0) {
      setExpandedNodeIds((prev) => new Set([...prev, ...idsToExpand]));
    }
  }, [treeSearchQuery, filteredSiteMapTree]);

  // Auto-select first matching host if current selected host is not in search results
  useEffect(() => {
    if (treeSearchQuery.trim() && filteredSiteMapTree.length > 0) {
      const isCurrentHostInResults = filteredSiteMapTree.some((h) => h.host === selectedTargetHost);
      if (!isCurrentHostInResults) {
        setSelectedTargetHost(filteredSiteMapTree[0].host);
        setSelectedPathFilter(null);
      }
    }
  }, [treeSearchQuery, filteredSiteMapTree, selectedTargetHost]);

  // Toggle Collapse All / Expand All in Left Tree
  const toggleCollapseAll = () => {
    if (expandedNodeIds.size > 0) {
      setExpandedNodeIds(new Set());
    } else {
      const allIds = new Set<string>();
      const collectAll = (nodes: SiteMapNode[]) => {
        for (const n of nodes) {
          if (n.children && n.children.length > 0) {
            allIds.add(n.id);
            collectAll(n.children);
          }
        }
      };
      collectAll(siteMapTree);
      setExpandedNodeIds(allIds);
    }
  };

  // Highlight matching text in tree labels
  const renderHighlightedText = (text: string, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);

    return (
      <span>
        {before}
        <span className="bg-[#f37021]/30 text-amber-300 font-bold px-0.5 rounded">{match}</span>
        {after}
      </span>
    );
  };

  // Recursive Tree Node Renderer for any depth of folders & endpoints
  const renderTreeNode = (node: SiteMapNode, host: string, depth: number = 0): React.ReactNode => {
    const isNodeSelected = selectedTargetHost === host && selectedPathFilter === node.fullPath;
    const isNodeExpanded = expandedNodeIds.has(node.id);
    const hasChildren = Boolean(node.children && node.children.length > 0);

    return (
      <div key={node.id} className="space-y-0.5">
        <div
          onClick={() => {
            setSelectedTargetHost(host);
            setSelectedPathFilter(node.fullPath);
            if (hasChildren) toggleNodeExpand(node.id);
          }}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors ${
            isNodeSelected
              ? 'bg-[#282b30] text-white font-bold'
              : node.type === 'folder'
              ? 'text-[#a6acb8] hover:bg-[#1e1f22]'
              : 'text-[#8c9099] hover:bg-[#1e1f22]'
          }`}
        >
          {hasChildren ? (
            <span
              onClick={(e) => toggleNodeExpand(node.id, e)}
              className="p-0.5 hover:text-white"
            >
              {isNodeExpanded ? (
                <ChevronDown className="w-2.5 h-2.5 text-[#8c9099]" />
              ) : (
                <ChevronRight className="w-2.5 h-2.5 text-[#8c9099]" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}

          {node.type === 'folder' ? (
            <Folder className="w-3 h-3 text-[#f37021] flex-shrink-0" />
          ) : (
            <FileCode className="w-3 h-3 text-[#34d399] flex-shrink-0" />
          )}
          <span className="truncate">{renderHighlightedText(node.name, treeSearchQuery)}</span>
        </div>

        {isNodeExpanded && hasChildren && (
          <div className="pl-3 space-y-0.5 border-l border-[#2b2d30] ml-2">
            {node.children!.map((child) => renderTreeNode(child, host, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Active Automated Multi-Engine Recon & Content Discovery (Stealth & Normal Pipelines)
  const handleRunContentDiscovery = async (targetHostToCrawl?: string, engine: ReconEngineType = 'normal') => {
    let host = targetHostToCrawl || targetInput.trim() || selectedTargetHost;
    let initialUrl = '';

    if (host) {
      if (host.startsWith('http://') || host.startsWith('https://')) {
        try {
          const parsed = new URL(host);
          initialUrl = host;
          host = parsed.host;
        } catch {}
      }
    }

    // Immediate visual feedback so the UI shows active crawling state instantly
    setIsCrawling(true);
    setActiveReconEngine(engine);
    setCrawlerTarget(host || 'Resolving target...');

    try {
      // 1. Inspect open Chrome tabs over CDP
      let cdpTargets: CdpTargetPage[] = [];
      try {
        cdpTargets = await ipcClient.getCdpTargets();
      } catch (err) {
        console.warn('Could not query CDP targets via IPC:', err);
      }

      const activeWebPages = cdpTargets.filter(
        (p) => p.type === 'page' && p.url && !p.url.startsWith('chrome://') && !p.url.startsWith('about:') && !p.url.startsWith('devtools://')
      );

      const hostIsDummyOrUnset = !host || host === 'target.local' || host === 'Auto-Detecting';

      if (!hostIsDummyOrUnset && host) {
        const cleanHost = host.toLowerCase().trim();
        // Check if an open tab in Chrome matches the user's requested host
        const matchedPage = activeWebPages.find((p) => {
          try {
            const h = new URL(p.url).host.toLowerCase();
            return h === cleanHost || h.endsWith(`.${cleanHost}`) || cleanHost.endsWith(`.${h}`);
          } catch {
            return p.url.toLowerCase().includes(cleanHost);
          }
        });

        if (matchedPage) {
          initialUrl = matchedPage.url;
        } else if (!initialUrl) {
          initialUrl = `https://${host}/`;
        }
      } else if (activeWebPages.length > 0) {
        // Only if the user did NOT set any target, auto-detect the active tab in Chrome
        const firstActive = activeWebPages[0];
        try {
          const detectedHost = new URL(firstActive.url).host;
          if (detectedHost) {
            host = detectedHost;
            initialUrl = firstActive.url;
            setSelectedTargetHost(detectedHost);
            setTargetInput(detectedHost);
          }
        } catch {}
      }

      if (!host || host === 'target.local' || host === 'Auto-Detecting') {
        host = selectedTargetHost || siteMapTree[0]?.host;
      }

      if (!host || host === 'target.local' || host === 'Auto-Detecting') {
        addToast({
          type: 'warning',
          title: 'No Target Specified',
          description: 'Type a target domain (e.g. ginandjuice.shop, example.com) in the Target box or open a website in Chrome.',
        });
        return;
      }

      const targetHost = host as string;
      setCrawlerTarget(targetHost);

      const engineNameMap: Record<ReconEngineType, string> = {
        stealth: '🥷 Sovereign Stealth Mode (Interactive Browser Exploration: Clicking, Typing & Form Submission)',
        hidden_endpoints: '🔍 Hidden Endpoints Hunter (API Entrypoints, Swagger/OpenAPI, Sensitive Files, IDOR)',
        normal: '⚡ Titan Normal Mode (Unified 5-Engine Pipeline: GAU + Katana + JSluice + Arjun + FFUF)',
      };

      const authHeaders = getActiveSessionHeadersForHost(transactions, targetHost);
      const hasAuth = Boolean(authHeaders['Cookie'] || authHeaders['Authorization']);

      // Collect seed URLs from captured transactions for this host (e.g. /admin, /admin/dashboard)
      const seedUrls: string[] = [];
      transactions.forEach((t) => {
        if (!t) return;
        const tHost = (t.host || '').toLowerCase().trim();
        const targetHostLower = targetHost.toLowerCase().trim();
        const tStatus = t.status || 0;
        if ((tHost === targetHostLower || targetHostLower.endsWith(`.${tHost}`) || tHost.endsWith(`.${targetHostLower}`)) && tStatus >= 200 && tStatus < 400) {
          if (!isLogoutUrl(t.path || '')) {
            const full = t.url?.startsWith('http') ? t.url : `https://${targetHost}${t.path?.startsWith('/') ? t.path : '/' + (t.path || '')}`;
            if (!seedUrls.includes(full)) {
              seedUrls.push(full);
            }
          }
        }
      });

      // If initialUrl was not already set from the active Chrome tab, construct it
      if (!initialUrl) {
        initialUrl = `https://${targetHost}/`;
        const adminSeed = seedUrls.find((u) => u.includes('/admin') || u.includes('/portal') || u.includes('/dashboard'));
        if (adminSeed) {
          initialUrl = adminSeed;
        }
      }

      addToast({
        type: hasAuth ? 'success' : 'info',
        title: hasAuth ? `🔐 Authenticated Recon: ${engineNameMap[engine]}` : `Engaged: ${engineNameMap[engine]}`,
        description: hasAuth
          ? `Target: ${targetHost} — Reusing active session cookies captured from Open Browser! Starting at ${initialUrl}`
          : `Target: ${targetHost} — Mining attack surfaces across pipeline (Unauthenticated)...`,
      });

      const items = await unifiedReconOrchestrator.runRecon({
        targetHost,
        targetUrl: initialUrl,
        seedUrls,
        engine,
        maxDepth: 3,
        interactionDelayMs: STEALTH_SPEED_CONFIG[stealthSpeed].delayMs,
        runArjunOnDiscovered: engine === 'normal',
        authHeaders,
        onProgress: (prog) => {
          setReconProgress(prog);
          setDiscoveredEndpointsCount(prog.totalDiscovered);
        },
        onItemDiscovered: (item) => {
          if (!item) return;
          setCrawlerDiscoveredItems((prev) => {
            const idx = prev.findIndex((p) => p && p.method === item.method && p.host === item.host && p.path === item.path);
            if (idx !== -1) {
              const current = prev[idx];
              if (!current) return prev;
              // If new item has real response / status, or more detailed attributes, merge and update
              const hasNewResponse = (item.status || 0) > 0 || (item.responseRaw && !item.responseRaw.includes('Unrequested'));
              if (hasNewResponse) {
                const next = [...prev];
                next[idx] = {
                  ...current,
                  ...item,
                  status: item.status || current.status || 0,
                  length: item.length || current.length || 0,
                  responseRaw: item.responseRaw || current.responseRaw || '',
                  resHeaders: Object.keys(item.resHeaders || {}).length > 0 ? item.resHeaders : current.resHeaders,
                  resAttributes: item.resAttributes || current.resAttributes,
                  mime: (item.mime && item.mime !== 'HTML') ? item.mime : (current.mime || item.mime || 'text/html'),
                };
                return next;
              }
              return prev;
            }
            return [...prev, item];
          });
        },
      });

      setDiscoveredEndpointsCount(items.length);
      addToast({
        type: 'success',
        title: `Recon Finished on ${targetHost}`,
        description: `Discovered ${items.length} unique endpoints & parameters.${hasAuth ? ' (Authenticated)' : ''}`,
      });
    } catch (err) {
      console.error('Recon error:', err);
      addToast({
        type: 'error',
        title: 'Recon Failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCrawling(false);
    }
  };

  const handleAbortRecon = () => {
    unifiedReconOrchestrator.abort();
    setIsCrawling(false);
    addToast({ type: 'warning', title: 'Recon Aborted by User' });
  };

  // Reverse OpenAPI 3.1 Spec Synthesis from Discovered Endpoints
  const handleGenerateOpenApiSpec = () => {
    const host = selectedTargetHost || siteMapTree[0]?.host || 'target.local';
    const endpointsToExport = siteMapDatabase.filter((e) => e.host.toLowerCase() === host.toLowerCase());
    const targetSet = endpointsToExport.length > 0 ? endpointsToExport : siteMapDatabase;

    if (targetSet.length === 0) {
      addToast({ type: 'warning', title: 'No Endpoints Available', description: 'Run crawler or proxy traffic first to discover endpoints' });
      return;
    }

    const spec = ReverseOpenApiSynthesizer.synthesizeSpec(targetSet, host);
    setOpenApiSpecJson(JSON.stringify(spec, null, 2));
    setOpenApiModalOpen(true);
    addToast({
      type: 'success',
      title: 'OpenAPI 3.1 Synthesized',
      description: `Generated spec from ${targetSet.length} attack surfaces on ${host}`,
    });
  };

  const [isFetchingItem, setIsFetchingItem] = useState(false);

  // Live on-demand fetch of endpoint response
  const fetchEndpointResponse = async (req: SiteMapRequest, isSilent = false) => {
    if (!isSilent) setIsFetchingItem(true);
    let targetUrl = req.url.startsWith('http') ? req.url : `https://${req.host}${req.path}`;
    if (targetUrl.startsWith('http://')) {
      targetUrl = 'https://' + targetUrl.slice(7);
    }
    
    // Inject active session cookies and standard modern browser headers
    const authHeaders = getActiveSessionHeadersForHost(transactions, req.host);
    let customH = '';
    if (authHeaders['Cookie']) customH += `Cookie: ${authHeaders['Cookie']}\r\n`;
    if (authHeaders['Authorization']) customH += `Authorization: ${authHeaders['Authorization']}\r\n`;

    const rawReq =
      `GET ${req.path} HTTP/1.1\r\n` +
      `Host: ${req.host}\r\n` +
      `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\r\n` +
      `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\n` +
      `Accept-Language: en-US,en;q=0.9\r\n` +
      `Sec-Ch-Ua: "Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"\r\n` +
      `Sec-Ch-Ua-Mobile: ?0\r\n` +
      `Sec-Ch-Ua-Platform: "Windows"\r\n` +
      `Sec-Fetch-Dest: document\r\n` +
      `Sec-Fetch-Mode: navigate\r\n` +
      `Sec-Fetch-Site: same-origin\r\n` +
      `Connection: keep-alive\r\n` +
      `${customH}\r\n`;

    try {
      let res: { statusCode?: number; statusText?: string; body?: string; rawResponse?: string; sizeBytes?: number } | null = null;

      // 1. If CDP is connected, execute fetch in live browser context to reuse real cookies, TLS, and anti-bot tokens
      if (stealthCdpBrowserDriver.connected) {
        try {
          const browserRes = await stealthCdpBrowserDriver.fetchInBrowserDetails(targetUrl, authHeaders);
          if (browserRes && browserRes.status) {
            let rawH = `HTTP/1.1 ${browserRes.status} ${browserRes.statusText || 'OK'}\r\n`;
            for (const [k, v] of Object.entries(browserRes.headers || {})) {
              rawH += `${k}: ${v}\r\n`;
            }
            res = {
              statusCode: browserRes.status,
              statusText: browserRes.statusText || 'OK',
              body: browserRes.body || '',
              rawResponse: `${rawH}\r\n${browserRes.body || ''}`,
              sizeBytes: (browserRes.body || '').length,
            };
          }
        } catch {}
      }

      // 2. Fall back to standard repeater IPC request if browser fetch wasn't available or returned null
      if (!res || !res.statusCode) {
        res = await ipcClient.sendRepeaterRequest({
          tabId: `sitemap-fetch-${Date.now()}`,
          targetUrl,
          rawRequest: rawReq,
        });
      }

      if (res && res.statusCode && res.statusCode !== 0) {
        const resBody = res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        const mime = req.path.endsWith('.json') ? 'JSON' : req.path.endsWith('.xml') ? 'XML' : 'HTML';
        const waf = isWafChallenge(resBody);
        const is404 = res.statusCode === 404;

        let notes = req.notes;
        let title = extractTitleFromHtml(resBody) || req.title || req.path;
        if (waf.isWaf) {
          notes = `[WAF Challenge] ${waf.reason || 'Cloudflare / Bot Verification required'}`;
          title = `[WAF] ${waf.reason || 'Verification Challenge'}`;
        } else if (is404) {
          notes = '404 Not Found on live server';
          title = '404 Not Found';
        }

        const updated: SiteMapRequest = {
          ...req,
          status: res.statusCode,
          length: res.sizeBytes || resBody.length,
          mime,
          title,
          notes,
          responseRaw: res.rawResponse || `HTTP/1.1 ${res.statusCode} ${res.statusText || 'OK'}\r\nContent-Type: text/html\r\n\r\n${resBody}`,
          resAttributes: { Status: `${res.statusCode}`, MIME: mime, 'Content-Length': `${res.sizeBytes || resBody.length} bytes` },
        };

        setCrawlerDiscoveredItems((prev) => {
          const idx = prev.findIndex((p) => p.path === req.path && p.host === req.host);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });

        // Only update selection if explicit click or currently viewing this item
        if (!isSilent || selectedItemId === req.id) {
          setSelectedItemId(updated.id);
          setSelectedItemKey(`${updated.host}${updated.path}`);
        }

        if (!isSilent) {
          if (waf.isWaf) {
            addToast({
              type: 'warning',
              title: `WAF Challenge: ${req.path}`,
              description: `Blocked by ${waf.reason} (HTTP ${res.statusCode})`,
            });
          } else if (is404) {
            addToast({
              type: 'info',
              title: `404 Not Found: ${req.path}`,
              description: `Endpoint does not exist on live server`,
            });
          } else {
            addToast({
              type: 'success',
              title: `Fetched response for ${req.path}`,
              description: `HTTP ${res.statusCode} (${res.sizeBytes || resBody.length} bytes)`,
            });
          }
          setIsFetchingItem(false);
        }
        return;
      }
    } catch (err) {
      console.warn('Live fetch error:', err);
    }

    // Real Connection / Unreachable Fallback (No synthetic mock data)
    const updated: SiteMapRequest = {
      ...req,
      status: 0,
      length: 0,
      mime: 'text',
      title: 'Connection Failed',
      notes: 'Connection Failed / Unreachable (Server down or timed out)',
      responseRaw: `HTTP/1.1 0 Connection Failed\r\n\r\nFailed to establish connection to ${req.host}${req.path}.\r\nServer may be unreachable, offline, or blocking socket connections.`,
      resHeaders: {},
      resAttributes: { Status: '0', Error: 'Connection Failed' },
    };

    setCrawlerDiscoveredItems((prev) => {
      const idx = prev.findIndex((p) => p.path === req.path && p.host === req.host);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });

    if (!isSilent) {
      addToast({
        type: 'error',
        title: `Connection failed for ${req.path}`,
        description: `Could not reach ${req.host}`,
      });
      setIsFetchingItem(false);
    }
  };

  // Handle messages posted from inside the iframe render view (e.g. click "Request Item" or "Follow Redirect")
  useEffect(() => {
    const handleFrameMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'SENTINEL_IFRAME_FETCH') {
        const targetUrl = event.data.url;
        const matched =
          siteMapDatabase.find((r) => r && (r.url === targetUrl || (r.host && r.path && `${r.host}${r.path}` === targetUrl.replace(/^https?:\/\//, '')))) ||
          activeRequest;
        if (matched) {
          setSelectedItemId(matched.id);
          setSelectedItemKey(`${matched.host}${matched.path}`);
          fetchEndpointResponse(matched);
        }
      } else if (event.data.type === 'SENTINEL_IFRAME_NAVIGATE') {
        let dest = event.data.url;
        if (dest && typeof dest === 'string') {
          if (dest.startsWith('/') && activeRequest?.host) {
            dest = `https://${activeRequest.host}${dest}`;
          }
          const matched = siteMapDatabase.find(
            (r) => r && (r.url === dest || (r.host && r.path && `${r.host}${r.path}` === dest.replace(/^https?:\/\//, '')))
          );
          if (matched) {
            setSelectedItemId(matched.id);
            setSelectedItemKey(`${matched.host}${matched.path}`);
            if (matched.status === 0 || !matched.responseRaw) {
              fetchEndpointResponse(matched);
            }
          } else if (activeRequest) {
            try {
              const base = activeRequest.url?.startsWith('http') ? activeRequest.url : `https://${activeRequest.host}`;
              const parsed = new URL(dest, base);
              const path = parsed.pathname + parsed.search;
              const syntheticReq: SiteMapRequest = {
                id: `nav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                host: parsed.host,
                method: 'GET',
                path,
                url: path,
                params: path.includes('?'),
                status: 0,
                length: 0,
                mime: path.endsWith('.json') ? 'JSON' : path.endsWith('.js') ? 'script' : 'HTML',
                title: parsed.pathname,
                notes: 'Navigated via in-browser link preview',
                requestRaw: `GET ${path} HTTP/1.1\r\nHost: ${parsed.host}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
                responseRaw: `HTTP/1.1 0 Unrequested\r\n\r\n(Navigated via Preview)`,
                reqAttributes: { Method: 'GET', Path: path },
                reqHeaders: { Host: parsed.host },
                resAttributes: { Status: 'Discovered' },
                resHeaders: {},
                isDiscovered: true,
              };
              setCrawlerDiscoveredItems((prev) => [...prev, syntheticReq]);
              setSelectedItemId(syntheticReq.id);
              setSelectedItemKey(`${syntheticReq.host}${syntheticReq.path}`);
              fetchEndpointResponse(syntheticReq);
            } catch {}
          }
        }
      }
    };

    window.addEventListener('message', handleFrameMessage);
    return () => window.removeEventListener('message', handleFrameMessage);
  }, [siteMapDatabase, activeRequest]);

  const handleSelectRequest = (req: SiteMapRequest) => {
    if (!req) return;
    setSelectedItemId(req.id);
    setSelectedItemKey(`${req.host}${req.path}`);
    if (req.status === 0 || (req.responseRaw && req.responseRaw.includes('Unrequested'))) {
      fetchEndpointResponse(req);
    }
  };

  // Right-Click Context Menu on Site Map Table Rows
  const handleRowContextMenu = (e: React.MouseEvent, req: SiteMapRequest) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectRequest(req);

    const items: ContextMenuItem[] = [
      {
        label: '⚡ Request this item (Fetch live response)',
        onClick: () => fetchEndpointResponse(req),
      },
      { divider: true },
      {
        label: 'Send to Repeater',
        shortcut: 'Ctrl+R',
        onClick: () => {
          useRepeaterStore.getState().createTabFromTransaction({
            url: `https://${req.host}${req.path}`,
            method: req.method || 'GET',
            rawRequest: req.requestRaw,
            request: { method: req.method, url: `https://${req.host}${req.path}`, headers: [], bodyText: '' },
          } as any);
          addToast({ type: 'success', title: `Sent ${req.path} to Repeater` });
        },
      },
      {
        label: 'Send to Intruder',
        shortcut: 'Ctrl+I',
        onClick: () => {
          useIntruderStore.getState().sendToIntruder({
            url: `https://${req.host}${req.path}`,
            method: req.method || 'GET',
            reqBody: '',
            request: { method: req.method, url: `https://${req.host}${req.path}`, bodyText: req.requestRaw },
          });
          addToast({ type: 'success', title: `Sent ${req.path} to Intruder` });
        },
      },
      {
        label: `🥷 Run Sovereign Stealth Crawl on ${req.host}`,
        onClick: () => handleRunContentDiscovery(req.host, 'stealth'),
      },
      {
        label: `🔍 Run Hidden Endpoints Hunter on ${req.host}`,
        onClick: () => handleRunContentDiscovery(req.host, 'hidden_endpoints'),
      },
      {
        label: `⚡ Run Titan Normal Recon on ${req.host}`,
        onClick: () => handleRunContentDiscovery(req.host, 'normal'),
      },
      { divider: true },
      {
        label: 'Open URL in browser',
        onClick: async () => {
          const target = req.url?.startsWith('http') ? req.url : `https://${req.host}${req.path}`;
          try {
            await ipcClient.launchSystemBrowser(target, 8085);
            addToast({ type: 'success', title: 'Opened in Browser', description: target });
          } catch {
            window.open(target, '_blank');
          }
        },
      },
      {
        label: 'Copy URL',
        onClick: () => {
          navigator.clipboard.writeText(`https://${req.host}${req.path}`);
          addToast({ type: 'info', title: 'Copied URL to clipboard' });
        },
      },
      {
        label: 'Copy as cURL',
        onClick: () => {
          navigator.clipboard.writeText(`curl -i -s -k -X '${req.method}' 'https://${req.host}${req.path}'`);
          addToast({ type: 'info', title: 'Copied cURL command' });
        },
      },
      {
        label: 'Copy raw request',
        onClick: () => {
          navigator.clipboard.writeText(req.requestRaw);
          addToast({ type: 'info', title: 'Copied Raw Request' });
        },
      },
      {
        label: 'Copy raw response',
        onClick: () => {
          navigator.clipboard.writeText(req.responseRaw);
          addToast({ type: 'info', title: 'Copied Raw Response' });
        },
      },
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      items,
    });
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) {
      addToast({ type: 'warning', title: 'Pattern is required' });
      return;
    }
    addRule(newRuleType, newPatternType, newPattern.trim(), newNotes.trim());
    setNewPattern('');
    setNewNotes('');
  };

  const handleOpenExportJson = () => {
    setJsonText(exportRulesJson());
    setJsonModalOpen(true);
  };

  const handleImportJsonSubmit = () => {
    if (!jsonText.trim()) return;
    importRulesJson(jsonText);
    setJsonModalOpen(false);
  };

  const handleEvaluate = async () => {
    if (!testUrl.trim()) return;
    await evaluateTestUrl(testUrl.trim());
  };

  // Request display content computation
  const reqDisplayContent = useMemo(() => {
    if (!activeRequest) return 'No request data';
    const raw = activeRequest.requestRaw || '';
    if (requestTabMode === 'hex') return formatHexDump(raw);
    if (requestTabMode === 'pretty') {
      return raw.split('\n').map((line, idx) => `${(idx + 1).toString().padStart(2, ' ')}  ${line}`).join('\n');
    }
    return raw;
  }, [activeRequest, requestTabMode]);

  // Response display content computation
  const resDisplayContent = useMemo(() => {
    if (!activeRequest) return 'No response data';
    const raw = activeRequest.responseRaw || '';
    if (responseTabMode === 'hex') return formatHexDump(raw);
    if (responseTabMode === 'pretty') {
      return raw.split('\n').map((line, idx) => `${(idx + 1).toString().padStart(2, ' ')}  ${line}`).join('\n');
    }
    return raw;
  }, [activeRequest, responseTabMode]);

  return (
    <div className="flex flex-col w-full h-full bg-[#1e1f22] text-[#dfdfdf] font-sans select-none overflow-hidden text-xs">
      {/* Target Recon & Content Discovery Toolbar */}
      <div className="h-8 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
        {/* Left: Active Target Host Input & Live Tab Selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <div className="flex items-center bg-[#1e222b] border border-[#3e4451]/70 hover:border-[#f37021]/60 focus-within:border-[#f37021] rounded text-xs shadow-inner transition-all">
              <span className="text-[#8c9099] font-mono text-[10px] uppercase tracking-wider font-semibold px-2 py-1 border-r border-[#3e4451]/50 bg-[#16181d] rounded-l select-none">
                Target:
              </span>
              <input
                type="text"
                value={targetInput}
                onChange={(e) => handleApplyTargetInput(e.target.value)}
                placeholder="e.g. example.com or portswigger.net"
                className="bg-transparent text-amber-300 font-mono font-bold text-xs px-2 py-1 outline-none w-44 sm:w-56 placeholder-[#5c6370]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleApplyTargetInput(targetInput);
                  }
                }}
                title="Target domain or URL to crawl (type any website or select an open tab)"
              />
              <button
                type="button"
                onClick={() => {
                  setIsTargetDropdownOpen((prev) => !prev);
                  if (!isTargetDropdownOpen) refreshOpenTabs();
                }}
                className="px-1.5 py-1 text-[#8c9099] hover:text-white border-l border-[#3e4451]/50 cursor-pointer bg-[#16181d] hover:bg-[#252830] transition-colors rounded-r"
                title="Select from open Chrome tabs or discovered hosts"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Dropdown Menu for Open Chrome Tabs & Discovered Hosts */}
            {isTargetDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-[#181a1f] border border-[#3e4451] rounded-md shadow-2xl z-50 py-1 text-xs max-h-72 overflow-y-auto">
                <div className="px-2.5 py-1 text-[10px] font-bold text-[#8c9099] uppercase tracking-wider border-b border-[#2b2d30] flex items-center justify-between bg-[#141518]">
                  <span>Open Browser Tabs</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshOpenTabs();
                    }}
                    className="hover:text-white flex items-center gap-1 text-[10px]"
                    title="Refresh tabs from Chrome"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Refresh</span>
                  </button>
                </div>
                {openChromeTabs.length === 0 ? (
                  <div className="px-3 py-2 text-[#6f737a] text-[11px] italic">
                    No active tabs detected on CDP :9222
                  </div>
                ) : (
                  openChromeTabs.map((tab) => {
                    let h = '';
                    try {
                      h = new URL(tab.url).host;
                    } catch {}
                    return (
                      <div
                        key={tab.id}
                        onClick={() => {
                          if (h) handleApplyTargetInput(h);
                          setIsTargetDropdownOpen(false);
                        }}
                        className="px-2.5 py-1.5 hover:bg-[#282b30] cursor-pointer flex flex-col transition-colors border-b border-[#2b2d30]/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300 font-mono truncate">{h || tab.url}</span>
                          <span className="text-[9px] px-1 py-0.2 bg-[#2b2d30] text-[#9da5b4] rounded">Chrome Tab</span>
                        </div>
                        <span className="text-[10px] text-[#8c9099] truncate mt-0.5">{tab.title || tab.url}</span>
                      </div>
                    );
                  })
                )}

                {siteMapTree.length > 0 && (
                  <>
                    <div className="px-2.5 py-1 text-[10px] font-bold text-[#8c9099] uppercase tracking-wider border-b border-[#2b2d30] bg-[#141518] mt-1">
                      Discovered Site Map Hosts
                    </div>
                    {siteMapTree.slice(0, 8).map((node) => (
                      <div
                        key={node.id}
                        onClick={() => {
                          handleApplyTargetInput(node.host);
                          setIsTargetDropdownOpen(false);
                        }}
                        className="px-2.5 py-1.5 hover:bg-[#282b30] cursor-pointer font-mono text-emerald-400 truncate transition-colors flex items-center justify-between border-b border-[#2b2d30]/30"
                      >
                        <span>{node.host}</span>
                        <span className="text-[9px] text-[#6f737a] font-normal">{node.requestCount} urls</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Crawl Actions & Progress */}
        <div className="flex items-center gap-2">
          {isCrawling ? (
            <div className="flex items-center gap-2 bg-[#232529] border border-[#f37021]/50 px-2.5 py-1 rounded shadow-lg animate-pulse">
              <Activity className="w-3.5 h-3.5 text-[#f37021] animate-spin" />
              <span className="text-[11px] font-mono text-[#f37021] font-bold">
                [{activeReconEngine.toUpperCase()}] {reconProgress ? `${reconProgress.activePhase} (${reconProgress.totalDiscovered} discovered)` : `Recon in progress on ${crawlerTarget}...`}
              </span>
              <button
                onClick={handleAbortRecon}
                className="ml-2 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Stop active recon process"
              >
                <StopCircle className="w-3 h-3 text-rose-400" />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Sovereign Stealth Mode */}
              <button
                onClick={() => handleRunContentDiscovery(undefined, 'stealth')}
                className="px-3 py-1 rounded flex items-center gap-1.5 font-bold text-xs bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white shadow-md transition-all cursor-pointer border border-[#a78bfa]/40"
                title="Run Sovereign Stealth Pipeline: Pure System Chrome over CDP, native anti-bot challenge bypass (wsidchk), Crawljax-grade FSM State-Flow Graph exploration with human-like delays, destructive action protection, and transparent MITM proxy harvesting"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                <span>🥷 Stealth Mode</span>
              </button>

              {/* Stealth Speed Control Button */}
              <button
                onClick={() => {
                  const speeds: Array<'turbo' | 'fast' | 'normal' | 'human' | 'deep'> = ['turbo', 'fast', 'normal', 'human', 'deep'];
                  const nextIdx = (speeds.indexOf(stealthSpeed) + 1) % speeds.length;
                  setStealthSpeed(speeds[nextIdx]);
                }}
                className="px-2 py-1 rounded flex items-center gap-1 text-[11px] font-mono font-semibold bg-[#1e222b] hover:bg-[#282d3a] text-[#a78bfa] border border-[#a78bfa]/30 transition-all cursor-pointer shadow-sm"
                title={`Stealth Crawling Speed: ${STEALTH_SPEED_CONFIG[stealthSpeed].title}. Click to switch speed.`}
              >
                <span>{STEALTH_SPEED_CONFIG[stealthSpeed].label}</span>
                <span className="text-[9px] text-[#8c9099] font-normal">({STEALTH_SPEED_CONFIG[stealthSpeed].delayMs}ms)</span>
              </button>

              {/* 2. Hidden Endpoints Hunter */}
              <button
                onClick={() => handleRunContentDiscovery(undefined, 'hidden_endpoints')}
                className="px-3 py-1 rounded flex items-center gap-1.5 font-bold text-xs bg-[#0284c7] hover:bg-[#0369a1] text-white shadow transition-all cursor-pointer border border-[#38bdf8]/40"
                title="Run Dedicated Hidden Endpoints Hunter: Probe unlinked routes, API specifications (OpenAPI, Swagger, GraphQL), sensitive files, GAU historical archives, and AI-extrapolated endpoints"
              >
                <Search className="w-3.5 h-3.5 text-cyan-200" />
                <span>🔍 Hidden Endpoints</span>
              </button>

              {/* 3. Titan Normal Mode */}
              <button
                onClick={() => handleRunContentDiscovery(undefined, 'normal')}
                className="px-3 py-1 rounded flex items-center gap-1.5 font-bold text-xs bg-[#f37021] hover:bg-[#e05d06] text-white shadow transition-all cursor-pointer"
                title="Run Titan Normal Pipeline: Combined high-speed HTTP attack surface discovery (GAU Historical Archives + Katana BFS DOM Spider + JSluice AST Route Mining + Arjun Parameter Discovery + FFUF Wordlist Fuzzing)"
              >
                <span>⚡ Normal Mode</span>
              </button>

              <div className="h-4 w-px bg-[#3e4451]/60 mx-1 hidden sm:block" />

              {/* Reverse OpenAPI 3.1 Synthesis Tool */}
              <button
                onClick={handleGenerateOpenApiSpec}
                className="px-2 py-1 rounded flex items-center gap-1 text-[11px] font-mono font-medium bg-[#1e222b] hover:bg-[#282d3a] text-[#10b981] border border-[#10b981]/30 transition-all cursor-pointer"
                title="Reverse synthesize valid OpenAPI 3.1 Specification from discovered attack surfaces and proxy traffic"
              >
                <FileJson className="w-3.5 h-3.5 text-[#10b981]" />
                <span>OpenAPI 3.1</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Site Map View (Authentic Burp Suite 3-Pane Structure) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Site Map Filter Pill Bar */}
        <div className="h-7 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between px-3 text-[11px] text-[#9da5b4] flex-shrink-0">
          <div
            onClick={() => setFilterModalOpen(true)}
            className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors truncate"
          >
            <Filter className="w-3.5 h-3.5 text-[#f37021] flex-shrink-0" />
            <span className="text-[#a6acb8] truncate">
              <strong>Site map filter:</strong> {siteMapFilterConfig.showOnlyQualityData ? '🛡️ Quality data only; ' : ''}{siteMapFilterConfig.showOnlyInScope ? 'In-scope only; ' : ''}
              {siteMapFilterConfig.hideNoResponse ? 'Hiding items without responses; ' : ''}
              Showing {visibleRequests.length} of {siteMapDatabase.length} items ({siteMapTree.length} hosts)
            </span>
          </div>

            <div className="flex items-center gap-2.5">
              {/* Quick Quality Data Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSiteMapFilterConfig((prev) => {
                    const isQuality = !prev.showOnlyQualityData;
                    if (isQuality) {
                      return {
                        ...prev,
                        showOnlyQualityData: true,
                        hideNoResponse: true,
                        status2xx: true,
                        status3xx: true,
                        status4xx: false,
                        status5xx: false,
                        mimeImages: false,
                        mimeCss: false,
                      };
                    } else {
                      return {
                        ...prev,
                        showOnlyQualityData: false,
                        hideNoResponse: false,
                        status2xx: true,
                        status3xx: true,
                        status4xx: true,
                        status5xx: true,
                        mimeHtml: true,
                        mimeScript: true,
                        mimeXml: true,
                        mimeCss: true,
                        mimeOtherText: true,
                        mimeImages: true,
                        mimeFlash: true,
                        mimeOtherBinary: true,
                      };
                    }
                  });
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                  siteMapFilterConfig.showOnlyQualityData
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-[#2b2d30] text-[#9da5b4] hover:text-white border-[#3e4249]'
                }`}
                title="Toggle Quality Data: When ON, displays only verified 2xx/3xx application endpoints & API routes, hiding noise and 404s. When OFF, shows everything found."
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Quality data: {siteMapFilterConfig.showOnlyQualityData ? 'ON' : 'OFF'}</span>
              </button>

              {hasActiveSession && (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono"
                  title={`Active session captured from browser for ${selectedTargetHost}. Deep Recon & crawler requests will automatically inherit these cookies.`}
                >
                  <Lock className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Session Linked</span>
                </span>
              )}
              <span className="text-[10px] text-[#34d399] font-mono">
                {discoveredEndpointsCount > 0 ? `+${discoveredEndpointsCount} endpoints discovered` : 'Multi-Engine Recon Ready'}
              </span>
              <HelpCircle
                onClick={() => setFilterModalOpen(true)}
                className="w-3.5 h-3.5 text-[#6f737a] cursor-pointer hover:text-white"
              />
            </div>
          </div>

          {/* Recon Engine Source Filter Bar */}
          <div className="h-7 bg-[#18191c] border-b border-[#2b2d30] flex items-center justify-between px-3 text-[11px] overflow-x-auto flex-shrink-0 select-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[#8c9099] font-semibold text-[10px] uppercase tracking-wide mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#f37021]" /> Source:
              </span>
              {[
                { key: 'all', label: `All (${engineSourceCounts.total})`, color: 'text-white' },
                { key: 'katana', label: `🕷️ Katana (${engineSourceCounts.katana})`, color: 'text-[#f37021]' },
                { key: 'gau', label: `🏛️ GAU (${engineSourceCounts.gau})`, color: 'text-[#38bdf8]' },
                { key: 'jsluice', label: `📜 JSluice (${engineSourceCounts.jsluice})`, color: 'text-[#a855f7]' },
                { key: 'arjun', label: `🎯 Arjun (${engineSourceCounts.arjun})`, color: 'text-[#34d399]' },
                { key: 'ffuf', label: `⚡ FFUF (${engineSourceCounts.ffuf})`, color: 'text-[#eab308]' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedSourceFilter(f.key as any)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                    selectedSourceFilter === f.key
                      ? 'bg-[#282b30] border border-[#f37021] text-white font-bold shadow-sm'
                      : 'bg-[#141517] border border-[#2b2d30] text-[#9da5b4] hover:text-white hover:border-[#3e4249]'
                  }`}
                >
                  <span className={selectedSourceFilter === f.key ? 'text-white' : f.color}>{f.label}</span>
                </button>
              ))}
            </div>

            {reconProgress && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#9da5b4]">
                <span className="text-[#f37021]">Katana: {reconProgress.engineCounts.katana}</span>
                <span>•</span>
                <span className="text-[#38bdf8]">GAU: {reconProgress.engineCounts.gau}</span>
                <span>•</span>
                <span className="text-[#a855f7]">JSluice: {reconProgress.engineCounts.jsluice}</span>
                <span>•</span>
                <span className="text-[#34d399]">Arjun: {reconProgress.engineCounts.arjun}</span>
                <span>•</span>
                <span className="text-[#eab308]">FFUF: {reconProgress.engineCounts.ffuf}</span>
              </div>
            )}
          </div>

          {/* Main 2-Pane Split: Left Site Map Tree vs Right Table / Inspector */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left: Site Map Target Host Hierarchy Tree */}
            <div className="w-72 flex flex-col border-r border-[#2b2d30] bg-[#141517] flex-shrink-0 select-none h-full">
              {/* Top Search & Filter Bar */}
              <div className="p-2 border-b border-[#2b2d30] bg-[#18191c] flex flex-col gap-1.5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#a6acb8]">
                    <Globe className="w-3.5 h-3.5 text-[#f37021]" />
                    <span className="tracking-wide">TARGETS</span>
                    <span className="text-[10px] text-[#6f737a] font-normal font-mono">({siteMapTree.length})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Small Search Button */}
                    <button
                      onClick={() => {
                        setIsTreeSearchOpen((prev) => !prev || !isTreeSearchOpen);
                        setTimeout(() => treeSearchInputRef.current?.focus(), 30);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors cursor-pointer ${
                        treeSearchQuery
                          ? 'bg-[#f37021]/20 text-[#f37021] border-[#f37021]/50 font-semibold'
                          : isTreeSearchOpen
                          ? 'bg-[#282b30] text-white border-[#3e4249]'
                          : 'bg-[#212328] text-[#8c9099] border-[#2b2d30] hover:text-white hover:border-[#3e4249]'
                      }`}
                      title="Search target hosts & endpoints"
                    >
                      <Search className="w-3 h-3 text-[#f37021]" />
                      <span>Search</span>
                    </button>

                    <button
                      onClick={toggleCollapseAll}
                      className="p-1 rounded bg-[#212328] text-[#8c9099] border border-[#2b2d30] hover:text-white hover:border-[#3e4249] transition-colors cursor-pointer"
                      title={expandedNodeIds.size > 0 ? "Collapse all folders" : "Expand all folders"}
                    >
                      {expandedNodeIds.size > 0 ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Small Search Input Box */}
                {isTreeSearchOpen && (
                  <div className="relative flex items-center">
                    <Search className="w-3 h-3 text-[#6f737a] absolute left-2 pointer-events-none" />
                    <input
                      ref={treeSearchInputRef}
                      type="text"
                      value={treeSearchQuery}
                      onChange={(e) => setTreeSearchQuery(e.target.value)}
                      placeholder="Filter host, folder, path..."
                      className="w-full bg-[#121316] border border-[#2b2d30] focus:border-[#f37021] rounded px-2 pl-7 pr-6 py-1 text-[11px] text-white placeholder-[#5a5f69] focus:outline-none transition-colors font-sans"
                    />
                    {treeSearchQuery && (
                      <button
                        onClick={() => {
                          setTreeSearchQuery('');
                          treeSearchInputRef.current?.focus();
                        }}
                        className="absolute right-1.5 p-0.5 text-[#8c9099] hover:text-white rounded cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {treeSearchQuery && (
                  <div className="flex items-center justify-between text-[10px] px-0.5 font-mono">
                    <span className={filteredSiteMapTree.length === 0 ? "text-amber-400" : "text-emerald-400"}>
                      {filteredSiteMapTree.length === 0
                        ? '0 matching hosts'
                        : `${filteredSiteMapTree.length} host${filteredSiteMapTree.length !== 1 ? 's' : ''} found`}
                    </span>
                    <button
                      onClick={() => setTreeSearchQuery('')}
                      className="text-[#f37021] hover:underline cursor-pointer font-sans"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable Tree Items */}
              <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-0.5">
                {filteredSiteMapTree.length === 0 ? (
                  <div className="p-4 text-center text-[#6f737a] space-y-2 font-sans">
                    <Globe className="w-6 h-6 mx-auto text-[#6f737a]/50 mb-2" />
                    <p className="font-bold text-xs text-[#9da5b4]">
                      {treeSearchQuery ? 'No matching targets' : 'No captured hosts yet'}
                    </p>
                    <p className="text-[11px]">
                      {treeSearchQuery
                        ? `No host or path matched "${treeSearchQuery}". Click Reset to show all targets.`
                        : 'Open the embedded browser or proxy traffic through 127.0.0.1:8080 to populate the target site map automatically.'}
                    </p>
                  </div>
                ) : (
                  filteredSiteMapTree.map((hostNode) => {
                    const isHostSelected = selectedTargetHost === hostNode.host && !selectedPathFilter;
                    const isExpanded = expandedNodeIds.has(hostNode.id);

                    return (
                      <div key={hostNode.id} className="space-y-0.5">
                        {/* Host Node Line */}
                        <div
                          onClick={() => {
                            setSelectedTargetHost(hostNode.host);
                            setSelectedPathFilter(null);
                            toggleNodeExpand(hostNode.id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            handleRunContentDiscovery(hostNode.host);
                          }}
                          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                            isHostSelected ? 'bg-[#2b2d30] text-white font-bold' : 'text-[#dfdfdf] hover:bg-[#1e1f22]'
                          }`}
                          title={`Right-click to run automated content discovery on ${hostNode.host}`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {hostNode.children && hostNode.children.length > 0 ? (
                              <span
                                onClick={(e) => toggleNodeExpand(hostNode.id, e)}
                                className="p-0.5 hover:text-white"
                              >
                                {isExpanded ? <ChevronDown className="w-3 h-3 text-[#8c9099]" /> : <ChevronRight className="w-3 h-3 text-[#8c9099]" />}
                              </span>
                            ) : (
                              <span className="w-4" />
                            )}
                            {hostNode.isHttps ? (
                              <Lock className="w-3 h-3 text-[#34d399] flex-shrink-0" />
                            ) : (
                              <Globe className="w-3 h-3 text-[#38bdf8] flex-shrink-0" />
                            )}
                            <span className="truncate">{renderHighlightedText(hostNode.name, treeSearchQuery)}</span>
                          </div>
                          {hostNode.requestCount !== undefined && (
                            <span className="text-[10px] text-[#6f737a] font-mono ml-1">{hostNode.requestCount}</span>
                          )}
                        </div>

                        {/* Host Subtree (Folders & Endpoints) */}
                        {isExpanded && hostNode.children && (
                          <div className="pl-3 space-y-0.5 border-l border-[#2b2d30] ml-2">
                            {hostNode.children.map((child) => renderTreeNode(child, hostNode.host, 1))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Split Table & Request / Response Split Inspector with SplitPane */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <SplitPane
                direction="vertical"
                initialSize={280}
                minSize={120}
                maxSize={800}
                storageKey="sentinel_target_table_split"
                primary={
                  /* Top: Requests & Discovered Endpoints Table */
                  <div
                    ref={tableContainerRef}
                    onScroll={handleTableScroll}
                    className="w-full h-full overflow-y-auto border-b border-[#2b2d30] bg-[#141517]"
                  >
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#3e4249] select-none z-10">
                        <tr>
                          <th className="px-2.5 py-1">Host</th>
                          <th className="px-2.5 py-1 w-16">Method</th>
                          <th className="px-2.5 py-1">URL ^</th>
                          <th className="px-2.5 py-1 w-16 text-center">Params</th>
                          <th className="px-2.5 py-1 w-24">Status code</th>
                          <th className="px-2.5 py-1 w-16">Length</th>
                          <th className="px-2.5 py-1 w-20">MIME type</th>
                          <th className="px-2.5 py-1">Title</th>
                          <th className="px-2.5 py-1">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2b2d30]">
                        {visibleRequests.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-3 py-6 text-center text-[#6f737a] font-sans">
                              No requests captured or discovered for this host/folder yet.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {topSpacerHeight > 0 && (
                              <tr style={{ height: `${topSpacerHeight}px` }}>
                                <td colSpan={9} style={{ padding: 0, border: 0, height: `${topSpacerHeight}px` }} />
                              </tr>
                            )}
                            {visibleSlice.map((req, sliceIdx) => {
                              if (!req) return null;
                              const actualIdx = startIndex + sliceIdx;
                              const isSelected = activeRequest ? String(activeRequest.id) === String(req.id) : false;
                              const status = req.status ?? 0;
                              return (
                                <tr
                                  key={req.id || `row-${actualIdx}`}
                                  onClick={() => handleSelectRequest(req)}
                                  onContextMenu={(e) => handleRowContextMenu(e, req)}
                                  className={`cursor-pointer transition-colors h-[28px] ${
                                    isSelected ? 'bg-[#282b30] text-white font-medium' : 'hover:bg-[#1e1f22] text-[#dfdfdf]'
                                  }`}
                                >
                                  <td className="px-2.5 py-1 text-[#38bdf8] truncate max-w-[180px]">{`https://${req.host || ''}`}</td>
                                  <td className="px-2.5 py-1 text-[#34d399] font-bold">{req.method || 'GET'}</td>
                                  <td className="px-2.5 py-1 text-white truncate max-w-sm">{req.url || req.path || '/'}</td>
                                  <td className="px-2.5 py-1 text-[#34d399] text-center">{req.params ? '✓' : ''}</td>
                                  <td className={`px-2.5 py-1 font-bold ${
                                    status >= 200 && status < 300 ? 'text-[#34d399]' :
                                    status >= 300 && status < 400 ? 'text-[#38bdf8]' :
                                    status >= 400 && status < 500 ? 'text-[#eab308]' :
                                    status === 0 ? 'text-[#6f737a]' : 'text-[#ef4444]'
                                  }`}>
                                    {status > 0 ? status : '—'}
                                  </td>
                                  <td className="px-2.5 py-1 text-[#9da5b4]">{req.length || '—'}</td>
                                  <td className="px-2.5 py-1 text-[#9da5b4]">{req.mime || 'text'}</td>
                                  <td className="px-2.5 py-1 text-[#dfdfdf] truncate max-w-xs">{req.title || ''}</td>
                                  <td className="px-2.5 py-1 text-[#8c9099] truncate max-w-xs flex items-center gap-1.5">
                                    {(() => {
                                      const n = (req.notes || '').toLowerCase();
                                      const s = (req.reqAttributes?.Source || '').toLowerCase();
                                      if (n.includes('katana') || n.includes('form') || n.includes('button')) {
                                        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f37021]/20 text-[#f37021] border border-[#f37021]/40 flex-shrink-0">🕷️ Katana</span>;
                                      }
                                      if (n.includes('archive') || n.includes('wayback') || n.includes('alienvault') || n.includes('urlscan') || s.includes('archive')) {
                                        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 flex-shrink-0">🏛️ GAU</span>;
                                      }
                                      if (n.includes('jsluice') || n.includes('js ast') || s.includes('jsluice')) {
                                        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40 flex-shrink-0">📜 JSluice</span>;
                                      }
                                      if (n.includes('arjun') || n.includes('param') || s.includes('arjun')) {
                                        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40 flex-shrink-0">🎯 Arjun</span>;
                                      }
                                      if (n.includes('fuzz') || n.includes('ffuf')) {
                                        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/40 flex-shrink-0">⚡ FFUF</span>;
                                      }
                                      return null;
                                    })()}
                                    <span className="truncate">{req.notes}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {bottomSpacerHeight > 0 && (
                              <tr style={{ height: `${bottomSpacerHeight}px` }}>
                                <td colSpan={9} style={{ padding: 0, border: 0, height: `${bottomSpacerHeight}px` }} />
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                }
                secondary={
                  <div className="w-full h-full flex min-h-0 overflow-hidden bg-[#1e1f22]">
                    <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                      <SplitPane
                        direction={targetLayoutMode === 'sideBySide' ? 'horizontal' : 'vertical'}
                        initialSize={targetLayoutMode === 'sideBySide' ? 620 : 300}
                        minSize={120}
                        maxSize={1600}
                        storageKey="sentinel_target_req_res_split"
                        primary={
                          /* Request Panel */
                          <div className="w-full h-full flex flex-col min-w-0 min-h-0 bg-[#141517] overflow-hidden">
                            <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-2 flex-shrink-0">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-white text-xs">
                                  Request {activeRequest ? `(${activeRequest.method} ${activeRequest.path})` : ''}
                                </span>
                                <div className="flex items-center gap-1 text-[11px]">
                                  {(['pretty', 'raw', 'hex'] as const).map((m) => (
                                    <button
                                      key={m}
                                      onClick={() => setRequestTabMode(m)}
                                      className={`px-2 py-0.5 rounded capitalize ${
                                        requestTabMode === m ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
                                      }`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <BurpEditorToolbar
                                splitOrientation={targetLayoutMode === 'sideBySide' ? 'horizontal' : 'vertical'}
                                onToggleSplitOrientation={() => setTargetLayoutMode(targetLayoutMode === 'sideBySide' ? 'stacked' : 'sideBySide')}
                                hideBoringHeaders={reqHideBoring}
                                onToggleHideBoringHeaders={() => setReqHideBoring((prev) => !prev)}
                                wordWrap={reqWordWrap}
                                onToggleWordWrap={() => setReqWordWrap((prev) => !prev)}
                                showNonPrintable={reqShowNonPrintable}
                                onToggleShowNonPrintable={() => setReqShowNonPrintable((prev) => !prev)}
                                inspectorOpen={targetRightDrawer === 'inspector'}
                                onToggleInspector={() => setTargetRightDrawer(targetRightDrawer === 'inspector' ? 'none' : 'inspector')}
                              />
                            </div>
                            <div className="flex-1 bg-[#141517] p-2.5 overflow-auto select-text">
                              {requestTabMode === 'hex' ? (
                                <pre className="font-mono text-[11px] text-[#34d399] leading-5">{reqDisplayContent}</pre>
                              ) : (
                                <HttpSyntaxHighlighter
                                  content={activeRequest?.requestRaw || `GET / HTTP/1.1\r\nHost: ${activeRequest?.host || 'target.local'}\r\n\r\n`}
                                  isResponse={false}
                                  showLineNumbers={true}
                                  searchQuery={targetReqSearch}
                                  activeMatchIndex={targetReqMatchIdx}
                                  wordWrap={reqWordWrap}
                                  hideUninterestingHeaders={reqHideBoring}
                                  showNonPrintable={reqShowNonPrintable}
                                />
                              )}
                            </div>
                            <BurpSearchBar
                              searchQuery={targetReqSearch}
                              onSearchChange={(val) => {
                                setTargetReqSearch(val);
                                setTargetReqMatchIdx(0);
                              }}
                              activeMatchIndex={targetReqMatchIdx}
                              totalMatches={countSearchMatches(activeRequest?.requestRaw || '', targetReqSearch)}
                              onPrevMatch={() => setTargetReqMatchIdx((prev) => Math.max(0, prev - 1))}
                              onNextMatch={() => setTargetReqMatchIdx((prev) => prev + 1)}
                              selectionInfo={`Length: ${(activeRequest?.requestRaw || '').length} bytes`}
                            />
                          </div>
                        }
                        secondary={
                          /* Response Panel */
                          <div className="w-full h-full flex flex-col min-w-0 min-h-0 bg-[#141517] overflow-hidden">
                            <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-2 flex-shrink-0">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-white text-xs">
                                  Response {activeRequest ? `(${activeRequest?.status || 200})` : ''}
                                </span>
                                <div className="flex items-center gap-1 text-[11px]">
                                  {(['pretty', 'raw', 'hex', 'render'] as const).map((m) => (
                                    <button
                                      key={m}
                                      onClick={() => setResponseTabMode(m)}
                                      className={`px-2 py-0.5 rounded capitalize ${
                                        responseTabMode === m ? 'bg-[#f37021] text-white font-bold' : 'text-[#9da5b4] hover:text-white'
                                      }`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <BurpEditorToolbar
                                splitOrientation={targetLayoutMode === 'sideBySide' ? 'horizontal' : 'vertical'}
                                onToggleSplitOrientation={() => setTargetLayoutMode(targetLayoutMode === 'sideBySide' ? 'stacked' : 'sideBySide')}
                                hideBoringHeaders={resHideBoring}
                                onToggleHideBoringHeaders={() => setResHideBoring((prev) => !prev)}
                                wordWrap={resWordWrap}
                                onToggleWordWrap={() => setResWordWrap((prev) => !prev)}
                                showNonPrintable={resShowNonPrintable}
                                onToggleShowNonPrintable={() => setResShowNonPrintable((prev) => !prev)}
                                inspectorOpen={targetRightDrawer === 'inspector'}
                                onToggleInspector={() => setTargetRightDrawer(targetRightDrawer === 'inspector' ? 'none' : 'inspector')}
                                extraActions={
                                  <div className="flex items-center gap-1 mr-1">
                                    <button
                                      onClick={() => activeRequest && fetchEndpointResponse(activeRequest)}
                                      disabled={isFetchingItem}
                                      className="px-2 py-0.5 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#38bdf8] border border-[#3e4249] text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                                      title="Send live request upstream to fetch/refresh the response"
                                    >
                                      <RefreshCw className={`w-3 h-3 ${isFetchingItem ? 'animate-spin text-[#f37021]' : ''}`} />
                                      <span>{isFetchingItem ? 'Fetching...' : '⚡ Request item'}</span>
                                    </button>
                                    {activeRequest && (
                                      <button
                                        onClick={() => {
                                          const targetUrl = activeRequest.url?.startsWith('http')
                                            ? activeRequest.url
                                            : activeRequest.host
                                            ? `https://${activeRequest.host}${activeRequest.path || activeRequest.url || ''}`
                                            : activeRequest.url;
                                          if (targetUrl) {
                                            window.open(targetUrl, '_blank');
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#9da5b4] hover:text-white border border-[#3e4249] text-[11px] font-medium flex items-center gap-1 transition-colors"
                                        title="Open target URL in external browser"
                                      >
                                        <ExternalLink className="w-3 h-3 text-[#34d399]" />
                                        <span>Open URL</span>
                                      </button>
                                    )}
                                  </div>
                                }
                              />
                            </div>
                            {responseTabMode === 'render' ? (
                              <div className="flex-1 flex flex-col min-h-0 bg-[#141517] overflow-hidden">
                                <div className="px-3 py-1 bg-[#18191c] border-b border-[#2b2d30] flex items-center justify-between text-[11px] text-[#9da5b4]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                                    <span className="font-medium text-[#dfdfdf]">Static Render Preview</span>
                                    <span className="text-[#6f737a]">(Burp Suite Parity • Scripts Disarmed)</span>
                                  </div>
                                  <span className="text-[10px] text-[#6f737a]">Authentic HTML &amp; Stylesheets</span>
                                </div>
                                <iframe
                                  srcDoc={generateRenderablePreviewHtml(
                                    activeRequest?.responseRaw || '',
                                    undefined,
                                    activeRequest?.url?.startsWith('http')
                                      ? activeRequest.url
                                      : activeRequest?.host
                                      ? `https://${activeRequest.host}${activeRequest.path || activeRequest.url}`
                                      : activeRequest?.url
                                  )}
                                  title="Rendered Response"
                                  className="flex-1 w-full bg-[#141517] border-0"
                                  sandbox="allow-same-origin allow-forms allow-popups"
                                />
                              </div>
                            ) : (
                              <div className="flex-1 bg-[#141517] p-2.5 overflow-auto select-text">
                                {responseTabMode === 'hex' ? (
                                  <pre className="font-mono text-[11px] text-[#dfdfdf] leading-5">{resDisplayContent}</pre>
                                ) : (
                                  <HttpSyntaxHighlighter
                                    content={activeRequest?.responseRaw || 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nNo response captured'}
                                    isResponse={true}
                                    showLineNumbers={true}
                                    searchQuery={targetResSearch}
                                    activeMatchIndex={targetResMatchIdx}
                                    wordWrap={resWordWrap}
                                    hideUninterestingHeaders={resHideBoring}
                                    showNonPrintable={resShowNonPrintable}
                                  />
                                )}
                              </div>
                            )}
                            <BurpSearchBar
                              searchQuery={targetResSearch}
                              onSearchChange={(val) => {
                                setTargetResSearch(val);
                                setTargetResMatchIdx(0);
                              }}
                              activeMatchIndex={targetResMatchIdx}
                              totalMatches={countSearchMatches(activeRequest?.responseRaw || '', targetResSearch)}
                              onPrevMatch={() => setTargetResMatchIdx((prev) => Math.max(0, prev - 1))}
                              onNextMatch={() => setTargetResMatchIdx((prev) => prev + 1)}
                              selectionInfo={`Length: ${(activeRequest?.responseRaw || '').length} bytes`}
                            />
                          </div>
                        }
                      />
                    </div>

                    {/* Right Slide-out Drawer: Inspector or Notes */}
                    {targetRightDrawer === 'inspector' && (
                      <div className="w-80 md:w-96 bg-[#1e1f22] border-l border-[#2b2d30] flex-shrink-0 h-full flex flex-col min-h-0">
                        <BurpInspectorPanel
                          rawRequest={activeRequest?.requestRaw || ''}
                          rawResponse={activeRequest?.responseRaw || ''}
                          onClose={() => setTargetRightDrawer('none')}
                        />
                      </div>
                    )}
                    {targetRightDrawer === 'notes' && (
                      <div className="w-72 bg-[#1e1f22] border-l border-[#2b2d30] flex flex-col p-3 text-xs overflow-y-auto flex-shrink-0">
                        <div className="flex items-center justify-between border-b border-[#2b2d30] pb-2 mb-3">
                          <span className="font-bold text-white uppercase tracking-wider text-[10px]">Target Notes</span>
                          <button
                            onClick={() => setTargetRightDrawer('none')}
                            className="text-[#8c9099] hover:text-white text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-2">
                          <textarea
                            placeholder="Add notes for this target endpoint..."
                            value={targetNotes}
                            onChange={(e) => setTargetNotes(e.target.value)}
                            className="w-full h-36 bg-[#141517] border border-[#3e4249] rounded p-2 text-white font-sans text-xs outline-none focus:border-[#f37021]"
                          />
                          <span className="text-[10px] text-[#6f737a]">Notes are saved for current session.</span>
                        </div>
                      </div>
                    )}

                    {/* Far Right Vertical Dock Tabs Strip (matching media_1790936607632.png) */}
                    <div className="w-7 bg-[#1e1f22] border-l border-[#2b2d30] flex flex-col items-center py-2 text-[#9da5b4] flex-shrink-0 select-none">
                      <button
                        onClick={() => setTargetRightDrawer(targetRightDrawer === 'inspector' ? 'none' : 'inspector')}
                        className={`p-1.5 rounded hover:text-white transition-colors mb-3 relative ${
                          targetRightDrawer === 'inspector' ? 'text-[#f37021] bg-[#2b2d30]' : ''
                        }`}
                        title="Toggle Inspector"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span className="[writing-mode:vertical-rl] text-[10px] tracking-wider mt-2 font-medium">
                          Inspector
                        </span>
                      </button>

                      <button
                        onClick={() => setTargetRightDrawer(targetRightDrawer === 'notes' ? 'none' : 'notes')}
                        className={`p-1.5 rounded hover:text-white transition-colors relative ${
                          targetRightDrawer === 'notes' ? 'text-[#f37021] bg-[#2b2d30]' : ''
                        }`}
                        title="Toggle Notes"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="[writing-mode:vertical-rl] text-[10px] tracking-wider mt-2 font-medium">
                          Notes
                        </span>
                      </button>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      {/* Context Menu Component */}
      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          items={contextMenu.items}
        />
      )}

      {/* Site Map Filter Modal (Burp Suite Pixel-Perfect Dialog) */}
      <HttpHistoryFilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        config={siteMapFilterConfig}
        onApply={(newCfg) => {
          setSiteMapFilterConfig(newCfg);
          setFilterModalOpen(false);
        }}
        title="Site map filter"
      />

      {/* JSON Rules Modal */}
      <Modal
        isOpen={jsonModalOpen}
        onClose={() => setJsonModalOpen(false)}
        title="Scope Policy Rules (JSON Import / Export)"
        size="lg"
      >
        <div className="space-y-4 text-xs font-sans">
          <p className="text-[#9da5b4]">
            Import or export ACL rules as an RFC8259-compliant JSON array for programmatic CI/CD pipeline integration.
          </p>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full h-56 bg-[#141517] text-[#34d399] font-mono text-xs p-3 rounded border border-[#3e4249] focus:outline-none resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="xs" onClick={() => setJsonModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="xs" onClick={handleImportJsonSubmit}>Apply JSON Rules</Button>
          </div>
        </div>
      </Modal>

      {/* OpenAPI 3.1 Spec Synthesis Modal */}
      <Modal
        isOpen={openApiModalOpen}
        onClose={() => setOpenApiModalOpen(false)}
        title="Synthesized OpenAPI 3.1 Specification"
        size="xl"
      >
        <div className="space-y-4 text-xs font-sans">
          <div className="flex items-center justify-between text-[#9da5b4]">
            <p className="max-w-xl">
              Reverse-synthesized OpenAPI 3.1 specification contract derived from all live crawler discoveries and MITM proxy transactions.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  navigator.clipboard.writeText(openApiSpecJson);
                  addToast({ type: 'success', title: 'Copied to Clipboard', description: 'OpenAPI 3.1 JSON copied' });
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy JSON
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  const blob = new Blob([openApiSpecJson], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `openapi-${selectedTargetHost || 'spec'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  addToast({ type: 'success', title: 'Exported File', description: 'Downloaded openapi.json' });
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download JSON
              </Button>
            </div>
          </div>
          <textarea
            value={openApiSpecJson}
            readOnly
            className="w-full h-96 bg-[#141517] text-[#38bdf8] font-mono text-[11px] p-3 rounded border border-[#3e4249] focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </Modal>
    </div>
  );
};
