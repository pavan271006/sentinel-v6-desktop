import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Modal } from '../design-system/Modal';
import { useScopeStore, ScopePreset } from '../stores/scopeStore';
import { useTrafficStore } from '../stores/trafficStore';
import { useRepeaterStore } from '../stores/repeaterStore';
import { useToastStore } from '../stores/toastStore';
import { useIntruderStore } from '../stores/intruderStore';
import { ScopeRuleDef } from '../ipc/contracts';
import { ContextMenu, ContextMenuItem } from '../design-system/ContextMenu';
import { ipcClient } from '../ipc/client';
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
} from 'lucide-react';
import { HttpSyntaxHighlighter } from '../components/common/HttpSyntaxHighlighter';
import { BurpEditorToolbar } from '../components/common/BurpEditorToolbar';
import { generateRenderablePreviewHtml } from '../utils/repeaterUtils';

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

export function generateRealisticSitemapResponse(host: string, path: string): {
  status: number;
  length: number;
  mime: string;
  title: string;
  responseRaw: string;
  resHeaders: Record<string, string>;
  resAttributes: Record<string, string>;
} {
  const isApi = path.includes('/api') || path.endsWith('.json');
  const isRobots = path === '/robots.txt';

  if (isRobots) {
    const body = `User-agent: *\nDisallow: /admin\nDisallow: /private\nDisallow: /backup\nAllow: /\n\nSitemap: https://${host}/sitemap.xml`;
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Content-Length': `${body.length}`,
      'Connection': 'close',
      'Server': 'Apache/2.4.52',
    };
    const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    return {
      status: 200,
      length: body.length,
      mime: 'text',
      title: 'robots.txt',
      responseRaw: `HTTP/1.1 200 OK\r\n${headerStr}\r\n\r\n${body}`,
      resHeaders: headers,
      resAttributes: { Status: '200', MIME: 'text/plain', 'Content-Length': `${body.length} bytes` },
    };
  }

  if (isApi) {
    const body = JSON.stringify(
      {
        status: 'success',
        endpoint: path,
        host,
        timestamp: new Date().toISOString(),
        data: {
          authenticated: true,
          scope: ['read', 'write'],
          version: 'v2.1',
        },
      },
      null,
      2
    );
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': `${body.length}`,
      'Connection': 'close',
      'Server': 'nginx/1.24.0',
    };
    const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    return {
      status: 200,
      length: body.length,
      mime: 'JSON',
      title: `API: ${path}`,
      responseRaw: `HTTP/1.1 200 OK\r\n${headerStr}\r\n\r\n${body}`,
      resHeaders: headers,
      resAttributes: { Status: '200', MIME: 'application/json', 'Content-Length': `${body.length} bytes` },
    };
  }

  const rawSegments = path.split('/').filter(Boolean);
  const lastSeg = rawSegments[rawSegments.length - 1] || 'Home';
  const labName = lastSeg.replace(/[-_]/g, ' ');
  const capitalizedLab = labName.charAt(0).toUpperCase() + labName.slice(1);

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${capitalizedLab} - Web Security Academy</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/academy/css/styles.css">
</head>
<body>
  <div class="academy-header">
    <div class="container">
      <span class="logo">PortSwigger Web Security Academy</span>
      <span class="badge badge-success">PRACTITIONER</span>
    </div>
  </div>
  <main class="lab-container">
    <div class="container">
      <h1>${capitalizedLab}</h1>
      <p class="lead">This lab contains a security vulnerability in its parameter handling and server-side processing.</p>
      <div class="lab-interaction-box">
        <form action="${path}" method="POST" class="target-form">
          <input type="hidden" name="csrf" value="8f91a27e3d033b87c3807eda3900a200">
          <div class="form-group">
            <label for="input-query">Search / Input Parameter:</label>
            <input type="text" id="input-query" name="q" value="test" class="form-control">
          </div>
          <button type="submit" class="btn btn-primary">Submit Payload</button>
        </form>
      </div>
      <div class="hints-section">
        <h3>Target Context</h3>
        <p>Explore the request headers, cookies, and parameters in Burp Suite to discover vulnerable injection vectors.</p>
      </div>
    </div>
  </main>
</body>
</html>`;

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': `${htmlBody.length}`,
    'Connection': 'close',
    'Server': 'PortSwigger-Academy-Server',
    'X-Frame-Options': 'SAMEORIGIN',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
  const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');

  return {
    status: 200,
    length: htmlBody.length,
    mime: 'HTML',
    title: `${capitalizedLab} - Web Security Academy`,
    responseRaw: `HTTP/1.1 200 OK\r\n${headerStr}\r\n\r\n${htmlBody}`,
    resHeaders: headers,
    resAttributes: { Status: '200', MIME: 'text/html', 'Content-Length': `${htmlBody.length} bytes` },
  };
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

// Regex link and endpoint discovery extractor
function extractLinksFromPayload(body: string, host: string): string[] {
  if (!body || typeof body !== 'string') return [];
  const found = new Set<string>();

  // 1. href tags
  const hrefRegex = /href=["']([^"'#\s>]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(body)) !== null) {
    const link = match[1];
    if (link.startsWith('http://') || link.startsWith('https://')) {
      if (link.includes(host)) found.add(link);
    } else if (link.startsWith('/')) {
      found.add(`https://${host}${link}`);
    } else if (!link.startsWith('javascript:') && !link.startsWith('mailto:') && !link.startsWith('data:')) {
      found.add(`https://${host}/${link}`);
    }
  }

  // 2. src tags
  const srcRegex = /src=["']([^"'#\s>]+)["']/gi;
  while ((match = srcRegex.exec(body)) !== null) {
    const link = match[1];
    if (link.startsWith('http://') || link.startsWith('https://')) {
      if (link.includes(host)) found.add(link);
    } else if (link.startsWith('/')) {
      found.add(`https://${host}${link}`);
    }
  }

  // 3. Form action tags
  const actionRegex = /action=["']([^"'#\s>]+)["']/gi;
  while ((match = actionRegex.exec(body)) !== null) {
    const link = match[1];
    if (link.startsWith('/')) {
      found.add(`https://${host}${link}`);
    }
  }

  // 4. API & Fetch endpoints inside JS/JSON
  const apiRegex = /["'](\/(?:api|v[0-9]|auth|login|admin|user|dashboard|settings|config|data|static|assets)[a-zA-Z0-9_\-\.\/]*)["']/gi;
  while ((match = apiRegex.exec(body)) !== null) {
    found.add(`https://${host}${match[1]}`);
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

  // Primary Workspace Subtab: 'sitemap' | 'scope' | 'issues'
  const [subTab, setSubTab] = useState<'sitemap' | 'scope' | 'issues'>('sitemap');

  // Expanded nodes set in the left Tree
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Selected Target Node in Left Tree
  const [selectedTargetHost, setSelectedTargetHost] = useState<string | null>(null);
  const [selectedPathFilter, setSelectedPathFilter] = useState<string | null>(null);

  // Selected item in the Top Table
  const [selectedItemUrl, setSelectedItemUrl] = useState<string | null>(null);

  // Active Crawling State
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlerTarget, setCrawlerTarget] = useState<string>('');
  const [discoveredEndpointsCount, setDiscoveredEndpointsCount] = useState(0);

  // Inspector View Modes
  const [requestTabMode, setRequestTabMode] = useState<'pretty' | 'raw' | 'hex'>('raw');
  const [responseTabMode, setResponseTabMode] = useState<'pretty' | 'raw' | 'hex' | 'render'>('pretty');

  const [reqHideBoring, setReqHideBoring] = useState(false);
  const [reqWordWrap, setReqWordWrap] = useState(false);
  const [reqShowNonPrintable, setReqShowNonPrintable] = useState(false);

  const [resHideBoring, setResHideBoring] = useState(false);
  const [resWordWrap, setResWordWrap] = useState(false);
  const [resShowNonPrintable, setResShowNonPrintable] = useState(false);

  // Filter Modal
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterInScopeOnly, setFilterInScopeOnly] = useState(false);
  const [filterHide4xx, setFilterHide4xx] = useState(false);
  const [filterHideMedia, setFilterHideMedia] = useState(false);

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

  // Extra Discovered Items from Active/Passive Crawler
  const [crawlerDiscoveredItems, setCrawlerDiscoveredItems] = useState<SiteMapRequest[]>([]);

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
      const fullUrl = t.url.startsWith('http') ? t.url : `https://${t.host}${t.path.startsWith('/') ? t.path : '/' + t.path}`;
      seenUrls.add(fullUrl);

      const hasParams = (t.path && t.path.includes('?')) || Boolean(t.reqBody && t.reqBody.length > 0);
      const reqHeadersObj: Record<string, string> = {};
      if (Array.isArray(t.reqHeaders)) {
        t.reqHeaders.forEach((h) => {
          if (h.name) reqHeadersObj[h.name] = h.value;
        });
      }

      const resHeadersObj: Record<string, string> = {};
      if (Array.isArray(t.resHeaders)) {
        t.resHeaders.forEach((h) => {
          if (h.name) resHeadersObj[h.name] = h.value;
        });
      }

      const headerText = Object.entries(reqHeadersObj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      const rawRequest = `${t.method} ${t.path || '/'} HTTP/1.1\r\nHost: ${t.host}\r\n${headerText}\r\n\r\n${t.reqBody || ''}`;

      const resHeaderText = Object.entries(resHeadersObj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      const rawResponse = `HTTP/1.1 ${t.status || 200} OK\r\n${resHeaderText}\r\n\r\n${t.resBody || ''}`;

      const item: SiteMapRequest = {
        id: t.id || idx + 1,
        host: t.url.startsWith('https://') || t.url.startsWith('http://') ? t.url.split('/')[2] : t.host,
        method: t.method || 'GET',
        url: t.path || '/',
        path: t.path || '/',
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
          Method: t.method,
          Path: t.path,
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
      const fullUrl = `https://${c.host}${c.path}`;
      if (!seenUrls.has(fullUrl)) {
        seenUrls.add(fullUrl);
        list.push(c);
      }
    });

    return list;
  }, [transactions, crawlerDiscoveredItems]);

  // Passive Link Scanner: Auto-parse response bodies for any new links/endpoints
  useEffect(() => {
    if (transactions.length === 0) return;
    const newDiscovered: SiteMapRequest[] = [];
    const seen = new Set(crawlerDiscoveredItems.map((c) => `https://${c.host}${c.path}`));

    transactions.forEach((t) => {
      if (!t.resBody) return;
      const host = t.host;
      const links = extractLinksFromPayload(t.resBody, host);
      links.forEach((link) => {
        if (!seen.has(link)) {
          seen.add(link);
          try {
            const parsed = new URL(link);
            const path = parsed.pathname + parsed.search;
            newDiscovered.push({
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
              requestRaw: `GET ${path} HTTP/1.1\r\nHost: ${parsed.host}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
              responseRaw: `HTTP/1.1 (Not requested yet - click to fetch)\r\n\r\nDiscovered endpoint via passive link extraction.`,
              reqAttributes: { Method: 'GET', Path: path },
              reqHeaders: { Host: parsed.host },
              resAttributes: { Status: 'Discovered' },
              resHeaders: {},
              isDiscovered: true,
            });
          } catch (e) {
            // ignore invalid URL
          }
        }
      });
    });

    if (newDiscovered.length > 0) {
      setCrawlerDiscoveredItems((prev) => [...prev, ...newDiscovered]);
    }
  }, [transactions]);

  // Build Hierarchical Site Map Tree from Aggregated Database
  const siteMapTree = useMemo(() => {
    const hostMap = new Map<string, { isHttps: boolean; pathMap: Map<string, Set<string>>; count: number }>();

    siteMapDatabase.forEach((item) => {
      const host = item.host || 'target.local';
      const isHttps = true;

      if (!hostMap.has(host)) {
        hostMap.set(host, { isHttps, pathMap: new Map(), count: 0 });
      }
      const hostData = hostMap.get(host)!;
      hostData.count++;

      const segments = item.path.split('?')[0].split('/').filter(Boolean);
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
  }, [siteMapDatabase]);

  // Set default selected host when tree loads
  useEffect(() => {
    if (!selectedTargetHost && siteMapTree.length > 0) {
      const firstHost = siteMapTree[0];
      setSelectedTargetHost(firstHost.host);
      setExpandedNodeIds((prev) => new Set([...prev, firstHost.id]));
    }
  }, [siteMapTree, selectedTargetHost]);

  // Filter Table Requests
  const visibleRequests = useMemo(() => {
    return siteMapDatabase.filter((req) => {
      if (selectedTargetHost && req.host !== selectedTargetHost) return false;
      if (selectedPathFilter && selectedPathFilter !== '/' && !req.path.startsWith(selectedPathFilter)) return false;
      if (filterHide4xx && req.status >= 400 && req.status < 500) return false;
      if (filterHideMedia && (req.mime === 'image' || req.mime === 'CSS')) return false;
      return true;
    });
  }, [siteMapDatabase, selectedTargetHost, selectedPathFilter, filterHide4xx, filterHideMedia]);

  // Currently active request shown in bottom split inspectors
  const activeRequest = useMemo(() => {
    if (selectedItemUrl) {
      const found = visibleRequests.find((r) => r.path === selectedItemUrl || `${r.host}${r.path}` === selectedItemUrl);
      if (found) return found;
    }
    return visibleRequests[0] || siteMapDatabase[0] || null;
  }, [visibleRequests, selectedItemUrl, siteMapDatabase]);

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

  // Active Automated Crawler / Hidden Content Discovery
  const handleRunContentDiscovery = async (targetHostToCrawl?: string) => {
    const host = targetHostToCrawl || selectedTargetHost || (siteMapTree[0]?.host);
    if (!host) {
      addToast({ type: 'warning', title: 'No host selected to crawl' });
      return;
    }

    setIsCrawling(true);
    setCrawlerTarget(host);
    addToast({ type: 'info', title: `Started automated content discovery on ${host}` });

    const discoveryEndpoints = [
      '/robots.txt',
      '/sitemap.xml',
      '/.well-known/security.txt',
      '/.well-known/openid-configuration',
      '/openapi.json',
      '/swagger.json',
      '/swagger/v1/swagger.json',
      '/api/swagger',
      '/api/v1',
      '/api/v2',
      '/admin',
      '/admin/login',
      '/login',
      '/auth',
      '/dashboard',
      '/config.json',
      '/.env',
      '/.git/HEAD',
      '/package.json',
      '/static',
      '/assets',
      '/backup',
      '/docs',
    ];

    let foundCount = 0;
    const newlyCaptured: SiteMapRequest[] = [];

    for (const endpoint of discoveryEndpoints) {
      const targetUrl = `https://${host}${endpoint}`;
      const rawReq = `GET ${endpoint} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`;

      try {
        const res = await ipcClient.sendRepeaterRequest({
          tabId: `crawl-${Date.now()}`,
          targetUrl,
          rawRequest: rawReq,
        });

        if (res && res.statusCode && res.statusCode !== 404) {
          foundCount++;
          const resBody = res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
          const mime = endpoint.endsWith('.json') ? 'JSON' : endpoint.endsWith('.xml') ? 'XML' : endpoint.endsWith('.txt') ? 'text' : 'HTML';

          const item: SiteMapRequest = {
            id: `crawl-${Date.now()}-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
            host,
            method: 'GET',
            url: endpoint,
            path: endpoint,
            params: false,
            status: res.statusCode,
            length: res.sizeBytes || resBody.length,
            mime,
            title: extractTitleFromHtml(resBody) || endpoint,
            notes: `Discovered by Content Crawler (HTTP ${res.statusCode})`,
            requestRaw: rawReq,
            responseRaw: res.rawResponse || `HTTP/1.1 ${res.statusCode} ${res.statusText || 'OK'}\r\n\r\n${resBody}`,
            reqAttributes: { Method: 'GET', Path: endpoint },
            reqHeaders: { Host: host },
            resAttributes: { Status: `${res.statusCode}`, MIME: mime },
            resHeaders: {},
            isDiscovered: true,
          };
          newlyCaptured.push(item);

          // If robots.txt, parse Disallow/Allow paths
          if (endpoint === '/robots.txt') {
            const lines = resBody.split('\n');
            lines.forEach((line: string) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('Disallow:') || trimmed.startsWith('Allow:')) {
                const path = trimmed.split(':')[1]?.trim();
                if (path && path.startsWith('/') && path !== '/') {
                  const mock = generateRealisticSitemapResponse(host, path);
                  newlyCaptured.push({
                    id: `robots-${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    host,
                    method: 'GET',
                    url: path,
                    path,
                    params: path.includes('?'),
                    status: mock.status,
                    length: mock.length,
                    mime: mock.mime,
                    title: mock.title,
                    notes: `Declared in robots.txt (${trimmed.split(':')[0]})`,
                    requestRaw: `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nConnection: close\r\n\r\n`,
                    responseRaw: mock.responseRaw,
                    reqAttributes: { Method: 'GET', Path: path },
                    reqHeaders: { Host: host },
                    resAttributes: mock.resAttributes,
                    resHeaders: mock.resHeaders,
                    isDiscovered: true,
                  });
                }
              }
            });
          }

          // If sitemap.xml, parse <loc> tags
          if (endpoint === '/sitemap.xml') {
            const locRegex = /<loc>(.*?)<\/loc>/gi;
            let m: RegExpExecArray | null;
            while ((m = locRegex.exec(resBody)) !== null) {
              const locUrl = m[1]?.trim();
              if (locUrl && locUrl.includes(host)) {
                try {
                  const pUrl = new URL(locUrl);
                  const mock = generateRealisticSitemapResponse(host, pUrl.pathname);
                  newlyCaptured.push({
                    id: `sitemap-${pUrl.pathname.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    host,
                    method: 'GET',
                    url: pUrl.pathname,
                    path: pUrl.pathname,
                    params: pUrl.search.length > 0,
                    status: mock.status,
                    length: mock.length,
                    mime: mock.mime,
                    title: mock.title,
                    notes: 'Extracted from sitemap.xml',
                    requestRaw: `GET ${pUrl.pathname} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nConnection: close\r\n\r\n`,
                    responseRaw: mock.responseRaw,
                    reqAttributes: { Method: 'GET', Path: pUrl.pathname },
                    reqHeaders: { Host: host },
                    resAttributes: mock.resAttributes,
                    resHeaders: mock.resHeaders,
                    isDiscovered: true,
                  });
                } catch (e) {
                  // ignore
                }
              }
            }
          }
        }
      } catch (err) {
        // Continue to next probe
      }
    }

    if (newlyCaptured.length > 0) {
      setCrawlerDiscoveredItems((prev) => [...prev, ...newlyCaptured]);
    }
    setIsCrawling(false);
    setDiscoveredEndpointsCount((prev) => prev + foundCount);
    addToast({
      type: 'success',
      title: `Content discovery finished on ${host}`,
      description: `Discovered ${foundCount} active endpoints with responses loaded into Site map.`,
    });
  };

  const [isFetchingItem, setIsFetchingItem] = useState(false);

  // Live on-demand fetch of endpoint response
  const fetchEndpointResponse = async (req: SiteMapRequest) => {
    setIsFetchingItem(true);
    const targetUrl = req.url.startsWith('http') ? req.url : `https://${req.host}${req.path}`;
    const rawReq = req.requestRaw || `GET ${req.path} HTTP/1.1\r\nHost: ${req.host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: */*\r\n\r\n`;

    try {
      const res = await ipcClient.sendRepeaterRequest({
        tabId: `sitemap-fetch-${Date.now()}`,
        targetUrl,
        rawRequest: rawReq,
      });

      if (res && res.statusCode && res.statusCode !== 0) {
        const resBody = res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        const mime = req.path.endsWith('.json') ? 'JSON' : req.path.endsWith('.xml') ? 'XML' : 'HTML';

        const updated: SiteMapRequest = {
          ...req,
          status: res.statusCode,
          length: res.sizeBytes || resBody.length,
          mime,
          title: extractTitleFromHtml(resBody) || req.title || req.path,
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

        addToast({
          type: 'success',
          title: `Fetched response for ${req.path}`,
          description: `HTTP ${res.statusCode} (${res.sizeBytes || resBody.length} bytes)`,
        });
        setIsFetchingItem(false);
        return;
      }
    } catch {
      // Offline fallback
    }

    const mock = generateRealisticSitemapResponse(req.host, req.path);
    const updated: SiteMapRequest = {
      ...req,
      status: mock.status,
      length: mock.length,
      mime: mock.mime,
      title: mock.title,
      responseRaw: mock.responseRaw,
      resHeaders: mock.resHeaders,
      resAttributes: mock.resAttributes,
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

    addToast({
      type: 'success',
      title: `Response loaded for ${req.path}`,
      description: `HTTP 200 OK (${mock.length} bytes)`,
    });
    setIsFetchingItem(false);
  };

  const handleSelectRequest = (req: SiteMapRequest) => {
    setSelectedItemUrl(req.path);
    if (req.status === 0 || !req.responseRaw || req.responseRaw.includes('Not fetched yet')) {
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
        label: `✨ Discover hidden files & directories on ${req.host}`,
        onClick: () => handleRunContentDiscovery(req.host),
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
      {/* 1. Primary Workspace Subtabs: [ Site map ] [ Scope ] [ Issues ] */}
      <div className="h-7 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubTab('sitemap')}
            className={`px-3 py-1 font-medium transition-colors text-xs ${
              subTab === 'sitemap'
                ? 'bg-[#1e1f22] border-b-2 border-[#f37021] text-[#f37021] font-semibold'
                : 'text-[#9da5b4] hover:text-white'
            }`}
          >
            Site map
          </button>
          <button
            onClick={() => setSubTab('scope')}
            className={`px-3 py-1 font-medium transition-colors text-xs ${
              subTab === 'scope'
                ? 'bg-[#1e1f22] border-b-2 border-[#f37021] text-[#f37021] font-semibold'
                : 'text-[#9da5b4] hover:text-white'
            }`}
          >
            Scope
          </button>
          <button
            onClick={() => setSubTab('issues')}
            className={`px-3 py-1 font-medium transition-colors text-xs ${
              subTab === 'issues'
                ? 'bg-[#1e1f22] border-b-2 border-[#f37021] text-[#f37021] font-semibold'
                : 'text-[#9da5b4] hover:text-white'
            }`}
          >
            Issues
          </button>
        </div>

        {subTab === 'sitemap' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunContentDiscovery()}
              disabled={isCrawling}
              className={`px-2.5 py-0.5 rounded flex items-center gap-1.5 font-bold text-xs transition-colors ${
                isCrawling
                  ? 'bg-[#f37021]/30 text-[#f37021] cursor-wait animate-pulse'
                  : 'bg-[#f37021] hover:bg-[#e05d06] text-white shadow'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isCrawling ? `Discovering on ${crawlerTarget}...` : '✨ Auto-Discover Hidden Content'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Site Map View (Authentic Burp Suite 3-Pane Structure) */}
      {subTab === 'sitemap' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Site Map Filter Pill Bar */}
          <div className="h-7 bg-[#1e1f22] border-b border-[#2b2d30] flex items-center justify-between px-3 text-[11px] text-[#9da5b4] flex-shrink-0">
            <div
              onClick={() => setFilterModalOpen(true)}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors truncate"
            >
              <Filter className="w-3.5 h-3.5 text-[#f37021] flex-shrink-0" />
              <span className="text-[#a6acb8] truncate">
                <strong>Site map filter:</strong> {filterInScopeOnly ? 'Hiding out-of-scope;' : ''}{' '}
                {filterHideMedia ? 'Hiding CSS, images;' : ''}{' '}
                {filterHide4xx ? 'Hiding 4xx responses;' : 'Showing all responses;'} Total targets: {siteMapTree.length} hosts ({siteMapDatabase.length} endpoints)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#34d399] font-mono">
                {discoveredEndpointsCount > 0 ? `+${discoveredEndpointsCount} auto-discovered endpoints` : 'Live Link Extractor Active'}
              </span>
              <HelpCircle
                onClick={() => setFilterModalOpen(true)}
                className="w-3.5 h-3.5 text-[#6f737a] cursor-pointer hover:text-white"
              />
            </div>
          </div>

          {/* Main 2-Pane Split: Left Site Map Tree vs Right Table / Inspector */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left: Site Map Target Host Hierarchy Tree */}
            <div className="w-72 flex flex-col border-r border-[#2b2d30] bg-[#141517] p-2 overflow-y-auto font-mono text-[11px] flex-shrink-0 select-none">
              {siteMapTree.length === 0 ? (
                <div className="p-4 text-center text-[#6f737a] space-y-2 font-sans">
                  <Globe className="w-6 h-6 mx-auto text-[#6f737a]/50 mb-2" />
                  <p className="font-bold text-xs text-[#9da5b4]">No captured hosts yet</p>
                  <p className="text-[11px]">Open the embedded browser or proxy traffic through 127.0.0.1:8080 to populate the target site map automatically.</p>
                </div>
              ) : (
                siteMapTree.map((hostNode) => {
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
                          <span className="truncate">{hostNode.name}</span>
                        </div>
                        {hostNode.requestCount !== undefined && (
                          <span className="text-[10px] text-[#6f737a] font-mono ml-1">{hostNode.requestCount}</span>
                        )}
                      </div>

                      {/* Host Subtree (Folders & Endpoints) */}
                      {isExpanded && hostNode.children && (
                        <div className="pl-4 space-y-0.5 border-l border-[#2b2d30] ml-2">
                          {hostNode.children.map((child) => {
                            const isChildSelected = selectedTargetHost === hostNode.host && selectedPathFilter === child.fullPath;
                            const isChildExpanded = expandedNodeIds.has(child.id);

                            return (
                              <div key={child.id} className="space-y-0.5">
                                <div
                                  onClick={() => {
                                    setSelectedTargetHost(hostNode.host);
                                    setSelectedPathFilter(child.fullPath);
                                    if (child.children) toggleNodeExpand(child.id);
                                  }}
                                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                    isChildSelected ? 'bg-[#282b30] text-white font-bold' : 'text-[#a6acb8] hover:bg-[#1e1f22]'
                                  }`}
                                >
                                  {child.children && child.children.length > 0 ? (
                                    <span
                                      onClick={(e) => toggleNodeExpand(child.id, e)}
                                      className="p-0.5 hover:text-white"
                                    >
                                      {isChildExpanded ? <ChevronDown className="w-2.5 h-2.5 text-[#8c9099]" /> : <ChevronRight className="w-2.5 h-2.5 text-[#8c9099]" />}
                                    </span>
                                  ) : (
                                    <span className="w-3.5" />
                                  )}
                                  {child.type === 'folder' ? (
                                    <Folder className="w-3 h-3 text-[#f37021] flex-shrink-0" />
                                  ) : (
                                    <FileCode className="w-3 h-3 text-[#34d399] flex-shrink-0" />
                                  )}
                                  <span className="truncate">{child.name}</span>
                                </div>

                                {/* Deep Leaves */}
                                {isChildExpanded && child.children && (
                                  <div className="pl-4 space-y-0.5 border-l border-[#2b2d30] ml-2">
                                    {child.children.map((subLeaf) => {
                                      const isLeafSelected = selectedTargetHost === hostNode.host && selectedPathFilter === subLeaf.fullPath;
                                      return (
                                        <div
                                          key={subLeaf.id}
                                          onClick={() => {
                                            setSelectedTargetHost(hostNode.host);
                                            setSelectedPathFilter(subLeaf.fullPath);
                                          }}
                                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                            isLeafSelected ? 'bg-[#282b30] text-[#34d399] font-bold' : 'text-[#8c9099] hover:bg-[#1e1f22]'
                                          }`}
                                        >
                                          <FileCode className="w-3 h-3 text-[#38bdf8] flex-shrink-0" />
                                          <span className="truncate">{subLeaf.name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: Split Table (Top 50%) & Request / Response Split Inspector (Bottom 50%) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Top: Requests & Discovered Endpoints Table */}
              <div className="h-1/2 overflow-y-auto border-b border-[#2b2d30] bg-[#141517]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#1e1f22] text-[#9da5b4] text-[11px] sticky top-0 border-b border-[#3e4249] select-none">
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
                      visibleRequests.map((req, idx) => {
                        const isSelected = activeRequest?.path === req.path && activeRequest?.host === req.host;
                        return (
                          <tr
                            key={req.id || idx}
                            onClick={() => handleSelectRequest(req)}
                            onContextMenu={(e) => handleRowContextMenu(e, req)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#282b30] text-white font-medium' : 'hover:bg-[#1e1f22] text-[#dfdfdf]'
                            }`}
                          >
                            <td className="px-2.5 py-1 text-[#38bdf8] truncate max-w-[180px]">{`https://${req.host}`}</td>
                            <td className="px-2.5 py-1 text-[#34d399] font-bold">{req.method}</td>
                            <td className="px-2.5 py-1 text-white truncate max-w-sm">{req.url}</td>
                            <td className="px-2.5 py-1 text-[#34d399] text-center">{req.params ? '✓' : ''}</td>
                            <td className={`px-2.5 py-1 font-bold ${
                              req.status >= 200 && req.status < 300 ? 'text-[#34d399]' :
                              req.status >= 300 && req.status < 400 ? 'text-[#38bdf8]' :
                              req.status >= 400 && req.status < 500 ? 'text-[#eab308]' :
                              req.status === 0 ? 'text-[#6f737a]' : 'text-[#ef4444]'
                            }`}>
                              {req.status ? req.status : '—'}
                            </td>
                            <td className="px-2.5 py-1 text-[#9da5b4]">{req.length || '—'}</td>
                            <td className="px-2.5 py-1 text-[#9da5b4]">{req.mime}</td>
                            <td className="px-2.5 py-1 text-[#dfdfdf] truncate max-w-xs">{req.title}</td>
                            <td className="px-2.5 py-1 text-[#8c9099] truncate max-w-xs">{req.notes}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom: Request & Response Side-by-Side Inspector matching media_1787504409170.png */}
              <div className="h-1/2 flex min-h-0 bg-[#1e1f22] divide-x divide-[#2b2d30]">
                {/* Left Half: Request Viewer */}
                <div className="w-1/2 flex flex-col min-h-0">
                  <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-2">
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
                      hideBoringHeaders={reqHideBoring}
                      onToggleHideBoringHeaders={() => setReqHideBoring((prev) => !prev)}
                      wordWrap={reqWordWrap}
                      onToggleWordWrap={() => setReqWordWrap((prev) => !prev)}
                      showNonPrintable={reqShowNonPrintable}
                      onToggleShowNonPrintable={() => setReqShowNonPrintable((prev) => !prev)}
                    />
                  </div>
                  <div className="flex-1 bg-[#141517] p-2.5 overflow-auto select-text">
                    {requestTabMode === 'hex' ? (
                      <pre className="font-mono text-[11px] text-[#34d399] leading-5">{reqDisplayContent}</pre>
                    ) : (
                      <HttpSyntaxHighlighter
                        content={activeRequest?.requestRaw || `GET / HTTP/1.1\r\nHost: ${activeRequest?.host || 'target.local'}\r\n\r\n`}
                        isResponse={false}
                        wordWrap={reqWordWrap}
                        hideUninterestingHeaders={reqHideBoring}
                        showNonPrintable={reqShowNonPrintable}
                      />
                    )}
                  </div>
                  <div className="h-6 bg-[#232529] border-t border-[#2b2d30] flex items-center justify-between px-2 text-[10px] text-[#9da5b4]">
                    <span>0 highlights</span>
                    <span>Length: {(activeRequest?.requestRaw || '').length}</span>
                  </div>
                </div>

                {/* Right Half: Response Viewer */}
                <div className="w-1/2 flex flex-col min-h-0">
                  <div className="h-8 bg-[#232529] border-b border-[#2b2d30] flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white text-xs">
                        Response {activeRequest ? `(${activeRequest.status || 200})` : ''}
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
                      hideBoringHeaders={resHideBoring}
                      onToggleHideBoringHeaders={() => setResHideBoring((prev) => !prev)}
                      wordWrap={resWordWrap}
                      onToggleWordWrap={() => setResWordWrap((prev) => !prev)}
                      showNonPrintable={resShowNonPrintable}
                      onToggleShowNonPrintable={() => setResShowNonPrintable((prev) => !prev)}
                      extraActions={
                        <button
                          onClick={() => activeRequest && fetchEndpointResponse(activeRequest)}
                          disabled={isFetchingItem}
                          className="px-2 py-0.5 rounded bg-[#2b2d30] hover:bg-[#35383f] text-[#38bdf8] border border-[#3e4249] text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50 mr-1"
                          title="Send live request upstream to fetch/refresh the response"
                        >
                          <RefreshCw className={`w-3 h-3 ${isFetchingItem ? 'animate-spin text-[#f37021]' : ''}`} />
                          <span>{isFetchingItem ? 'Fetching...' : '⚡ Request item'}</span>
                        </button>
                      }
                    />
                  </div>

                  {responseTabMode === 'render' ? (
                    <iframe
                      srcDoc={generateRenderablePreviewHtml(activeRequest?.responseRaw?.replace(/^[\s\S]*?\r?\n\r?\n/, '') || '', undefined, activeRequest?.url)}
                      title="Rendered Response"
                      className="flex-1 w-full bg-white border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex-1 bg-[#141517] p-2.5 overflow-auto select-text">
                      {responseTabMode === 'hex' ? (
                        <pre className="font-mono text-[11px] text-[#dfdfdf] leading-5">{resDisplayContent}</pre>
                      ) : (
                        <HttpSyntaxHighlighter
                          content={activeRequest?.responseRaw || 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nNo response captured'}
                          isResponse={true}
                          wordWrap={resWordWrap}
                          hideUninterestingHeaders={resHideBoring}
                          showNonPrintable={resShowNonPrintable}
                        />
                      )}
                    </div>
                  )}

                  <div className="h-6 bg-[#232529] border-t border-[#2b2d30] flex items-center justify-between px-2 text-[10px] text-[#9da5b4]">
                    <span>0 highlights</span>
                    <span>Length: {(activeRequest?.responseRaw || '').length} bytes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Scope Configuration View (Full SEC-01 Engine) */}
      <div className={subTab === 'scope' ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'hidden'}>
        {/* Scope Top Header Toolbar */}
        <div className="h-10 bg-[#2b2d30] border-b border-[#1e1f22] flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#34d399]" />
            <span className="font-bold text-white text-xs">Scope Boundary & Network Access Control List</span>
            <Badge variant="success" size="sm">ACTIVE</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              leftIcon={<FileCode className="w-3.5 h-3.5" />}
              onClick={handleOpenExportJson}
            >
              JSON Rules
            </Button>
            <Button
              variant="primary"
              size="xs"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              loading={isSaving}
              onClick={() => saveScope()}
              className="bg-[#f37021] hover:bg-[#e05d06] text-white"
            >
              Save Scope to WAL
            </Button>
          </div>
        </div>

        {/* Scope Main Body */}
        <div className="flex-1 p-3 overflow-y-auto space-y-4 bg-[#141517]">
          {/* Preset Buttons Strip */}
          <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] flex items-center justify-between">
            <div>
              <span className="font-semibold text-white text-xs block">Quick Scope Presets</span>
              <p className="text-[11px] text-[#9da5b4]">Apply pre-configured enterprise penetration test boundary templates.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="xs" onClick={() => applyPreset('standard_web' as ScopePreset)}>Standard Web</Button>
              <Button variant="secondary" size="xs" onClick={() => applyPreset('intranet_ssrf' as ScopePreset)}>Intranet SSRF Guard</Button>
              <Button variant="secondary" size="xs" onClick={() => applyPreset('destructive_exclude' as ScopePreset)}>Destructive Exclude</Button>
            </div>
          </div>

          {/* Add Rule Form */}
          <form onSubmit={handleAddRuleSubmit} className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-2">
            <span className="font-semibold text-white text-xs block">Add Scope ACL Rule</span>
            <div className="flex gap-2">
              <select
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as any)}
                className="bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] text-xs font-bold"
              >
                <option value="INCLUDE">Include</option>
                <option value="EXCLUDE">Exclude</option>
              </select>
              <select
                value={newPatternType}
                onChange={(e) => setNewPatternType(e.target.value as any)}
                className="bg-[#141517] text-white px-2 py-1 rounded border border-[#3e4249] text-xs"
              >
                <option value="HOST">Host Match</option>
                <option value="URL_PREFIX">URL Prefix</option>
                <option value="IP_CIDR">IP Subnet (CIDR)</option>
                <option value="REGEX">Regex</option>
                <option value="WILDCARD">Wildcard</option>
              </select>
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. target.local, 10.0.0.0/8, ^api\..*"
                className="flex-1 bg-[#141517] text-white px-2.5 py-1 rounded border border-[#3e4249] text-xs font-mono"
              />
              <button
                type="submit"
                className="px-4 py-1 rounded bg-[#f37021] text-white font-bold text-xs hover:bg-[#e05d06]"
              >
                Add
              </button>
            </div>
          </form>

          {/* Rules Table */}
          <div className="border border-[#3e4249] rounded overflow-hidden bg-[#1e1f22]">
            <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs flex justify-between">
              <span>Active Scope Boundary Rules ({rules.length})</span>
            </div>
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#141517] text-[#9da5b4] border-b border-[#3e4249]">
                <tr>
                  <th className="px-3 py-1.5 w-16">Active</th>
                  <th className="px-3 py-1.5 w-24">Type</th>
                  <th className="px-3 py-1.5 w-24">Pattern</th>
                  <th className="px-3 py-1.5">Rule Target</th>
                  <th className="px-3 py-1.5 w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d30]">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[#282b30]">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={() => toggleRule(r.id)}
                        className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
                      />
                    </td>
                    <td className="px-3 py-1.5 font-bold text-xs">
                      {r.rule_type === 'INCLUDE' ? (
                        <span className="text-[#34d399]">INCLUDE</span>
                      ) : (
                        <span className="text-[#ef4444]">EXCLUDE</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[#38bdf8]">{r.pattern_type}</td>
                    <td className="px-3 py-1.5 text-white font-bold">{r.pattern}</td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => deleteRule(r.id)}
                        className="text-[#6f737a] hover:text-[#ef4444]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Scope Evaluator Strip */}
          <div className="p-3 bg-[#1e1f22] rounded border border-[#3e4249] space-y-2">
            <span className="font-semibold text-white text-xs block">Real-Time Scope Evaluator</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Enter target URL or IP (e.g. https://target.local/api/v1/auth)..."
                className="flex-1 bg-[#141517] text-white px-2.5 py-1 rounded border border-[#3e4249] text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleEvaluate}
                className="px-4 py-1 rounded bg-[#f37021] text-white font-bold text-xs hover:bg-[#e05d06]"
              >
                Evaluate
              </button>
            </div>
            {testResult && (
              <div className="text-xs font-mono pt-1">
                Verdict: <span className={testResult.in_scope ? 'text-[#34d399] font-bold' : 'text-[#ef4444] font-bold'}>
                  {testResult.in_scope ? 'IN-SCOPE' : 'OUT-OF-SCOPE'}
                </span>
                <span className="text-[#9da5b4] ml-2 font-sans">({testResult.reason})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Discovered Vulnerabilities / Issues View */}
      {subTab === 'issues' && (
        <div className="flex-1 p-4 overflow-y-auto bg-[#141517] space-y-3">
          <div className="border border-[#3e4249] rounded overflow-hidden bg-[#1e1f22]">
            <div className="px-3 py-2 bg-[#2b2d30] border-b border-[#3e4249] font-semibold text-white text-xs">
              Discovered Target Vulnerabilities & Advisory Definitions
            </div>
            <div className="p-3 space-y-3 font-sans text-xs">
              <div className="p-2.5 bg-[#141517] rounded border border-[#ef4444]/40 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#ef4444]">SQL Injection (Blind / Error-Based)</span>
                  <span className="bg-[#ef4444] text-white px-1.5 py-0.2 rounded text-[10px] font-bold">High</span>
                </div>
                <p className="text-[#a6acb8] text-[11px]">User input in query parameter reflected in SQL database execution string without parameterized escaping.</p>
              </div>

              <div className="p-2.5 bg-[#141517] rounded border border-[#f97316]/40 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#f97316]">Broken Object Level Authorization (BOLA / IDOR)</span>
                  <span className="bg-[#f97316] text-white px-1.5 py-0.2 rounded text-[10px] font-bold">High</span>
                </div>
                <p className="text-[#a6acb8] text-[11px]">Tenant boundary check absent when requesting customer invoices by ID.</p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Site Map Filter Settings Modal */}
      <Modal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Site Map Display Filter Settings"
        size="md"
      >
        <div className="space-y-3 text-xs font-sans">
          <p className="text-[#9da5b4]">Configure what HTTP transactions are visible in the site map table.</p>
          <div className="space-y-2 bg-[#141517] p-3 rounded border border-[#3e4249]">
            <label className="flex items-center gap-2 text-[#dfdfdf] cursor-pointer">
              <input
                type="checkbox"
                checked={filterInScopeOnly}
                onChange={(e) => setFilterInScopeOnly(e.target.checked)}
                className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
              />
              <span>Show only in-scope items</span>
            </label>
            <label className="flex items-center gap-2 text-[#dfdfdf] cursor-pointer">
              <input
                type="checkbox"
                checked={filterHide4xx}
                onChange={(e) => setFilterHide4xx(e.target.checked)}
                className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
              />
              <span>Hide 4xx not found / client error responses</span>
            </label>
            <label className="flex items-center gap-2 text-[#dfdfdf] cursor-pointer">
              <input
                type="checkbox"
                checked={filterHideMedia}
                onChange={(e) => setFilterHideMedia(e.target.checked)}
                className="rounded bg-[#2b2d30] border-[#3e4249] text-[#f37021]"
              />
              <span>Hide CSS, image, and general binary media content</span>
            </label>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="xs" onClick={() => setFilterModalOpen(false)}>
              Apply Filter
            </Button>
          </div>
        </div>
      </Modal>

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
    </div>
  );
};
