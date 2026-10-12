/**
 * Sentinel Sovereign Ω - Absolute Endpoint Normalizer & REST Parameter Clustering Engine
 * src/services/contentDiscovery/EndpointNormalizer.ts
 *
 * Implements Level 6 Attack-Surface Normalization:
 * 1. WHATWG URL Canonical Resolution with Base URL handling
 * 2. Single-Page Application (SPA) Hashbang Route Extraction (/#/, #!/)
 * 3. Comprehensive Tracking & Cachebuster Parameter Pruning (RFC 3986)
 * 4. Deterministic Lexicographical Query Parameter Key-Sorting
 * 5. Dynamic RESTful Parameter Clustering (UUID, Numeric ID, Hex Hash, Slugs, Dates, Tokens)
 * 6. Cluster Sampling Governor to eliminate Crawler State-Space Explosion
 */

export interface NormalizedEndpoint {
  canonicalUrl: string;       // Fully resolved WHATWG canonical URL
  origin: string;             // Scheme + Host + Port (e.g. "https://example.com")
  pathname: string;           // Normalized path without query or hash (e.g. "/api/v1/users/49102")
  routeTemplate: string;      // REST-clustered path template (e.g. "/api/v1/users/{id}")
  isInternal: boolean;        // True if matches target host or scoped subdomains
  method?: string;            // Standard HTTP method
  queryParams?: Record<string, string>; // Preserved key-value pairs
  rawOriginalUrl?: string;    // Raw input URL before transformation
}

export interface DiscoveredEndpoint {
  url: string;
  source: 'dom_link' | 'dom_form' | 'dom_button' | 'script_ast' | 'router_route' | 'bundle_chunk' | 'html_comment' | 'worker';
  method?: string;
  parameters?: Record<string, string>;
  discoveredAt: number;
  metadata?: Record<string, any>;
}

export interface TemplateClusteringMetrics {
  template: string;
  sampleCount: number;
  sampleUrls: string[];
  firstDiscoveredAt?: number;
  lastSampledAt?: number;
}

export interface SegmentClassification {
  isDynamic: boolean;
  placeholder: string;
  type: 'uuid' | 'id' | 'hash' | 'token' | 'date' | 'year' | 'month' | 'day' | 'timestamp' | 'slug' | 'static';
}

export class EndpointNormalizer {
  private static readonly UNROUTABLE_PROTOCOLS = new Set([
    'javascript:', 'data:', 'mailto:', 'tel:', 'blob:', 'callto:', 'sms:', 'about:', 'chrome:', 'urn:'
  ]);

  private static readonly TRACKING_EXACT = new Set([
    // Google Analytics, Google Ads & DoubleClick
    'gclid', 'gclsrc', 'dclid', 'wbraid', 'gbraid', '_ga', '_gl', '_gid', '_gat',
    // Facebook / Meta / Instagram
    'fbclid', 'fbid', 'igshid', 'fb_action_ids', 'fb_action_types', 'fb_source',
    // Microsoft / Bing
    'msclkid',
    // Twitter / X
    'twclid',
    // TikTok
    'ttclid',
    // LinkedIn
    'li_fat_id',
    // Yandex
    'yclid', '_openstat',
    // Email / CRM (Mailchimp, Klaviyo, HubSpot, Marketo)
    'mc_eid', 'mc_cid', '_ke', 'hsctstracking', 'hschttstracking', '_hsenc', '_hsmi', 'mkt_tok',
    // E-Commerce & Marketplace Tracking (Catalog search, click, item references)
    'ref', 'ref_', '_encoding', 'qid', 'sr', 'sprefix', 'crid', 'dib', 'dib_tag',
    'as-show', 'as', 'pageuid', 'smid', 'psc', 'tag',
    // Affiliate & Referrals
    'aff_id', 'affiliate_id', 'partner', 'source', 'campaign', 'ref_src', 'ref_url',
    // Cachebusters & Anti-Cache Timestamps
    '_', '_t', 'ts', 'timestamp', 'cb', 'nocache', 'cachebuster', 'time', 'random', 'rnd', 'v'
  ]);

  private static readonly TRACKING_PREFIXES = [
    'utm_',
    'pf_rd_',
    'pd_rd_',
    'otracker',
    '_gac_'
  ];

  private static readonly CONTENT_PREFIXES = new Set([
    'product', 'products', 'item', 'items', 'p',
    'category', 'categories', 'cat',
    'tag', 'tags',
    'post', 'posts', 'article', 'articles', 'blog', 'news',
    'author', 'authors', 'user', 'users', 'profile',
    'brand', 'brands', 'shop', 'store',
    'course', 'courses', 'lesson', 'lessons', 'topic', 'topics',
    'collection', 'collections', 'catalog', 'department', 'departments',
    'event', 'events', 'movie', 'movies', 'track', 'album', 'genre', 'genres'
  ]);

  private static readonly RESERVED_ACTIONS = new Set([
    'edit', 'delete', 'new', 'create', 'update', 'view', 'show',
    'feed', 'rss', 'atom', 'json', 'xml', 'raw',
    'cart', 'checkout', 'buy', 'order', 'orders',
    'search', 'filter', 'all', 'list', 'index', 'default',
    'api', 'v1', 'v2', 'v3', 'v4',
    'login', 'logout', 'signin', 'signout', 'register', 'auth', 'oauth',
    'admin', 'dashboard', 'settings', 'config', 'status', 'health', 'metrics',
    'download', 'upload', 'export', 'import', 'preview', 'print',
    'terms', 'privacy', 'about', 'contact', 'faq', 'help', 'page'
  ]);

  // Cluster state governor
  private templateCounts = new Map<string, TemplateClusteringMetrics>();
  private maxSamplesPerTemplate: number;

  constructor(maxSamplesPerTemplate: number = 3) {
    this.maxSamplesPerTemplate = maxSamplesPerTemplate;
  }

  /**
   * Resets clustering metrics for a fresh crawl session.
   */
  public reset(): void {
    this.templateCounts.clear();
  }

  /**
   * Main entry point: Canonicalizes raw URLs, resolves SPA hash routes,
   * prunes tracking tokens, and generates dynamic REST route templates.
   */
  public normalize(rawUrl: string, baseUrl?: string, targetHost?: string): NormalizedEndpoint | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    const sanitized = rawUrl.trim().replace(/&amp;/gi, '&').replace(/&#38;/g, '&');
    if (!sanitized) return null;

    // 1. Unroutable scheme pre-filter
    const lowerTrimmed = sanitized.toLowerCase();
    for (const proto of EndpointNormalizer.UNROUTABLE_PROTOCOLS) {
      if (lowerTrimmed.startsWith(proto)) return null;
    }

    try {
      // 2. Base URL Determination
      const resolvedBase = this.resolveEffectiveBase(baseUrl, targetHost);
      const initialParsed = new URL(sanitized, resolvedBase);

      // 3. Hashbang Route Conversion
      const { pathname, search } = this.extractEffectiveRoute(initialParsed);

      // 4. Normalized Path Creation (remove dot segments, duplicate slashes, normalize trailing slash)
      const cleanPathname = this.normalizePathname(pathname);

      // 5. Query Parameter Canonicalization & Tracking Stripping
      const { canonicalSearch, queryParams } = this.canonicalizeSearch(search);

      // 6. Build Absolute Canonical URL
      const origin = initialParsed.origin;
      const canonicalUrl = `${origin}${cleanPathname}${canonicalSearch ? '?' + canonicalSearch : ''}`;

      // 7. Route Template Generation via REST parameter clustering
      const routeTemplate = this.generateRouteTemplate(cleanPathname, canonicalSearch);

      // 8. Scope Determination
      const isInternal = this.isInternalEndpoint(initialParsed.hostname, targetHost || initialParsed.hostname);

      return {
        canonicalUrl,
        origin,
        pathname: cleanPathname,
        routeTemplate,
        isInternal,
        method: 'GET',
        queryParams,
        rawOriginalUrl: rawUrl
      };
    } catch {
      return null;
    }
  }

  /**
   * Normalizes an endpoint conforming strictly to interface contract:
   * normalizeEndpoint(rawUrl: string, baseUrl: string): NormalizedEndpoint
   */
  public normalizeEndpoint(rawUrl: string, baseUrl: string): NormalizedEndpoint {
    const res = this.normalize(rawUrl, baseUrl);
    if (res) return res;

    // Fallback if parsing fails
    return {
      canonicalUrl: rawUrl,
      origin: '',
      pathname: rawUrl,
      routeTemplate: rawUrl,
      isInternal: false,
      method: 'GET',
      queryParams: {},
      rawOriginalUrl: rawUrl
    };
  }

  /**
   * Shorthand to canonicalize a URL string (strips tracking, converts hashbang, standardizes path).
   */
  public canonicalizeUrl(rawUrl: string, baseUrl?: string): string {
    const res = this.normalize(rawUrl, baseUrl);
    return res ? res.canonicalUrl : '';
  }

  /**
   * Resolves effective base URL when baseUrl or targetHost is given.
   */
  private resolveEffectiveBase(baseUrl?: string, targetHost?: string): string {
    if (baseUrl && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
      return baseUrl;
    }
    if (targetHost) {
      return `https://${targetHost.replace(/^https?:\/\//, '')}/`;
    }
    return 'https://localhost/';
  }

  /**
   * Extracts effective pathname and search, resolving SPA hashbang routes.
   * Supports /#/dashboard, /#!/dashboard, and nested query params.
   * Ignores standard HTML page anchors (#top, #installation).
   */
  public extractEffectiveRoute(parsedUrl: URL): { pathname: string; search: string } {
    let effectivePath = parsedUrl.pathname;
    let baseQuery = parsedUrl.search ? parsedUrl.search.replace(/^\?/, '') : '';
    let hashQuery = '';

    const hash = parsedUrl.hash ? parsedUrl.hash.replace(/^#/, '') : '';

    if (hash) {
      // An SPA route in the hash either starts with '/' or '!/' or contains '/'
      const isSpaRoute = hash.startsWith('/') || hash.startsWith('!/') || hash.startsWith('!') || hash.includes('/');

      if (isSpaRoute) {
        const cleanHash = hash.replace(/^!/, '');
        const qIndex = cleanHash.indexOf('?');
        let hashRoutePath = qIndex !== -1 ? cleanHash.slice(0, qIndex) : cleanHash;
        if (qIndex !== -1) {
          hashQuery = cleanHash.slice(qIndex + 1);
        }

        // Standardize leading slash for route path
        if (!hashRoutePath.startsWith('/')) {
          hashRoutePath = '/' + hashRoutePath;
        }

        // Combine base path (pruning index.html / default.aspx / etc.) with hash route path
        let basePath = effectivePath.replace(/\/(?:index|default)\.[a-zA-Z0-9]+$/i, '');
        if (basePath.endsWith('/')) {
          basePath = basePath.slice(0, -1);
        }

        effectivePath = `${basePath}${hashRoutePath}`;
      }
    }

    // Merge base queries and hash queries
    const mergedQueries: string[] = [];
    if (baseQuery) mergedQueries.push(baseQuery);
    if (hashQuery) mergedQueries.push(hashQuery);

    return {
      pathname: effectivePath || '/',
      search: mergedQueries.join('&')
    };
  }

  /**
   * Normalizes pathname by resolving dot segments, collapsing duplicate slashes,
   * decoding unreserved RFC 3986 percent-encodings, and trimming non-root trailing slashes.
   */
  public normalizePathname(rawPath: string): string {
    if (!rawPath || rawPath === '/') return '/';

    // Collapse multiple consecutive slashes
    let path = rawPath.replace(/\/+/g, '/');

    // Decode unreserved percent-encoded characters per RFC 3986 (ALPHA, DIGIT, - . _ ~)
    path = path.replace(/%([0-9a-fA-F]{2})/g, (match, hex) => {
      const code = parseInt(hex, 16);
      if (
        (code >= 0x41 && code <= 0x5a) || // A-Z
        (code >= 0x61 && code <= 0x7a) || // a-z
        (code >= 0x30 && code <= 0x39) || // 0-9
        code === 0x2d || code === 0x2e || code === 0x5f || code === 0x7e // - . _ ~
      ) {
        return String.fromCharCode(code);
      }
      return match.toUpperCase();
    });

    // Remove non-root trailing slash
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    return path.startsWith('/') ? path : '/' + path;
  }

  /**
   * Strips tracking parameters, prunes cachebusters, and sorts keys lexicographically.
   */
  public canonicalizeSearch(searchString: string): { canonicalSearch: string; queryParams: Record<string, string> } {
    if (!searchString) return { canonicalSearch: '', queryParams: {} };

    const clean = searchString.startsWith('?') ? searchString.slice(1) : searchString;
    if (!clean) return { canonicalSearch: '', queryParams: {} };

    const pairs = clean.split('&');
    const validPairs: Array<[string, string]> = [];
    const queryParams: Record<string, string> = {};

    for (const pair of pairs) {
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      const rawKey = eqIdx !== -1 ? pair.slice(0, eqIdx) : pair;
      const rawVal = eqIdx !== -1 ? pair.slice(eqIdx + 1) : '';

      let key = rawKey;
      let val = rawVal;
      try {
        key = decodeURIComponent(rawKey).trim();
      } catch {}
      try {
        val = decodeURIComponent(rawVal).trim();
      } catch {}

      // Strip legacy HTML entity artifact if extracted as "amp;param"
      if (key.toLowerCase().startsWith('amp;')) {
        key = key.slice(4);
      }

      const lowerKey = key.toLowerCase();

      // Check exact tracking parameters
      if (EndpointNormalizer.TRACKING_EXACT.has(lowerKey)) continue;

      // Check tracking prefixes
      if (EndpointNormalizer.TRACKING_PREFIXES.some(p => lowerKey.startsWith(p))) continue;

      // Dynamic anti-cache cachebuster heuristic (10 or 13 digit epoch timestamps)
      if (/^\d{10}(?:\d{3})?$/.test(val)) {
        if (key.length <= 4 || /time|ts|date|stamp|random|rnd|_/i.test(key)) {
          continue;
        }
      }

      validPairs.push([key, val]);
      queryParams[key] = val;
    }

    // Sort parameters lexicographically by key (code point order)
    validPairs.sort((a, b) => {
      const cmp = a[0].localeCompare(b[0]);
      if (cmp !== 0) return cmp;
      return a[1].localeCompare(b[1]);
    });

    const canonicalSearch = validPairs
      .map(([k, v]) => (v !== '' ? `${encodeURIComponent(k)}=${encodeURIComponent(v)}` : encodeURIComponent(k)))
      .join('&');

    return { canonicalSearch, queryParams };
  }

  /**
   * Converts a URL or pathname into a dynamic RESTful route template.
   * e.g. /api/v1/users/49102/edit -> /api/v1/users/{id}/edit
   */
  public generateRouteTemplate(pathnameOrUrl: string, search?: string): string {
    let path = pathnameOrUrl;
    let query = search || '';

    try {
      if (pathnameOrUrl.startsWith('http://') || pathnameOrUrl.startsWith('https://')) {
        const u = new URL(pathnameOrUrl);
        path = u.pathname;
        if (!query) query = u.search;
      } else {
        const parts = pathnameOrUrl.split('?');
        path = parts[0];
        if (!query && parts[1]) query = parts[1];
      }
    } catch {
      path = pathnameOrUrl.split('?')[0];
    }

    // Standardize path without trailing slash before splitting
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Split path into segments and abstract dynamic tokens
    const rawSegments = path.split('/').filter(Boolean);
    const templatedSegments = rawSegments.map((seg, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : undefined;
      const next = idx < arr.length - 1 ? arr[idx + 1] : undefined;
      const classification = this.classifySegment(seg, prev, next);
      return classification.isDynamic ? classification.placeholder : seg;
    });

    const templatedPath = '/' + templatedSegments.join('/');

    // Also abstract numeric/UUID query parameters for structural clustering comparison
    const templatedQuery = this.abstractQueryParams(query);

    return templatedPath + (templatedQuery ? '?' + templatedQuery : '');
  }

  /**
   * Classifies a single route segment against dynamic parameter signatures.
   */
  public classifySegment(segment: string, prevSegment?: string, nextSegment?: string): SegmentClassification {
    // Check and handle file extensions (e.g., "123.json" -> classify "123" with ".json")
    let baseSeg = segment;
    let extension = '';
    const dotIdx = segment.lastIndexOf('.');
    if (dotIdx > 0) {
      const ext = segment.slice(dotIdx).toLowerCase();
      // Only separate common extensions, not dots within slugs
      if (/^\.(?:json|xml|html|htm|pdf|csv|txt|png|jpg|jpeg|svg)$/.test(ext)) {
        baseSeg = segment.slice(0, dotIdx);
        extension = ext;
      }
    }

    // 1. UUID v1 - v5 / generic GUID (8-4-4-4-12 hex)
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-50-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(baseSeg)) {
      return { isDynamic: true, placeholder: '{uuid}' + extension, type: 'uuid' };
    }

    // 2. Pure Numeric ID
    if (/^\d+$/.test(baseSeg)) {
      // Check if this segment represents a 4-digit year in calendar context
      if (/^(?:19\d\d|20\d\d)$/.test(baseSeg)) {
        if (nextSegment && /^(?:0?[1-9]|1[0-2])$/.test(nextSegment)) {
          return { isDynamic: true, placeholder: '{year}' + extension, type: 'year' };
        }
      }
      return { isDynamic: true, placeholder: '{id}' + extension, type: 'id' };
    }

    // 3. Hex Hash / Object ID (MongoDB 24 hex, MD5 32 hex, SHA-1 40 hex, SHA-256 64 hex, or generic 24-64 hex)
    if (/^[0-9a-fA-F]{24,64}$/.test(baseSeg)) {
      return { isDynamic: true, placeholder: '{hash}' + extension, type: 'hash' };
    }

    // 4. Security Token (JWT or Base64 / Hex token)
    if (/^eyJ[A-Za-z0-9_-]{10,}/.test(baseSeg) || (baseSeg.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(baseSeg))) {
      return { isDynamic: true, placeholder: '{token}' + extension, type: 'token' };
    }

    // 5. ISO Date format (YYYY-MM-DD)
    if (/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(baseSeg) || /^\d{4}-\d{2}-\d{2}$/.test(baseSeg)) {
      return { isDynamic: true, placeholder: '{date}' + extension, type: 'date' };
    }

    // 6. Calendar Year
    if (/^(?:19\d\d|20\d\d)$/.test(baseSeg)) {
      return { isDynamic: true, placeholder: '{year}' + extension, type: 'year' };
    }

    // 7. Prefixed Micro-format IDs (Stripe, Twilio, AWS: cus_xxx, ch_xxx, etc.)
    if (/^(?:cus|ch|inv|usr|ord|txn|sub|acc)_[0-9a-zA-Z]{12,}$/.test(baseSeg)) {
      return { isDynamic: true, placeholder: '{id}' + extension, type: 'id' };
    }

    // 8. Content & Catalog Slugs
    if (prevSegment) {
      const prevLower = prevSegment.toLowerCase();
      const segLower = baseSeg.toLowerCase();

      if (EndpointNormalizer.CONTENT_PREFIXES.has(prevLower) && !EndpointNormalizer.RESERVED_ACTIONS.has(segLower)) {
        // Must match slug naming grammar
        if (/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(baseSeg)) {
          return { isDynamic: true, placeholder: '{slug}' + extension, type: 'slug' };
        }
      }
    }

    return { isDynamic: false, placeholder: segment, type: 'static' };
  }

  /**
   * Normalizes query string for template clustering (replaces dynamic parameter values with {id} or {uuid}).
   * Matches PathTemplateClusterer.normalizeQuery test contracts.
   */
  public normalizeQuery(queryString: string): string {
    if (!queryString || queryString === '?') return '';
    const clean = queryString.startsWith('?') ? queryString.slice(1) : queryString;

    const trackingExact = EndpointNormalizer.TRACKING_EXACT;
    const trackingPrefixes = EndpointNormalizer.TRACKING_PREFIXES;
    const params: Array<[string, string]> = [];
    const pairs = clean.split('&');

    for (const pair of pairs) {
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      const rawK = eqIdx !== -1 ? pair.slice(0, eqIdx) : pair;
      const rawV = eqIdx !== -1 ? pair.slice(eqIdx + 1) : '';

      let lowerKey = rawK.toLowerCase();
      try {
        lowerKey = decodeURIComponent(rawK).toLowerCase();
      } catch {}

      let val = rawV;
      try {
        val = decodeURIComponent(rawV);
      } catch {}

      if (trackingExact.has(lowerKey) || trackingPrefixes.some(p => lowerKey.startsWith(p))) {
        continue;
      }

      // Filter dynamic timestamp values
      if (/^\d{10}(?:\d{3})?$/.test(val)) {
        if (lowerKey.length <= 4 || /time|ts|date|stamp|random|rnd|_/i.test(lowerKey)) {
          continue;
        }
      }

      // Abstract purely numeric or UUID parameter values in the query template
      let valPattern = val;
      if (/^\d+$/.test(val)) valPattern = '{id}';
      else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-50-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val) || /^[0-9a-fA-F-]{36}$/.test(val)) {
        valPattern = '{uuid}';
      }

      params.push([lowerKey, valPattern]);
    }

    params.sort((a, b) => a[0].localeCompare(b[0]));
    return params.map(([k, v]) => (v !== '' ? `${k}=${v}` : k)).join('&');
  }

  /**
   * Abstracts query parameters for routeTemplate generation.
   */
  private abstractQueryParams(queryString: string): string {
    return this.normalizeQuery(queryString);
  }

  /**
   * Verifies if a hostname is within scope of the target host (including subdomains).
   */
  public isInternalEndpoint(hostname: string, targetHost: string): boolean {
    if (!hostname || !targetHost) return false;
    const cleanHost = hostname.toLowerCase();
    const cleanTarget = targetHost.toLowerCase().replace(/^https?:\/\//, '').split(':')[0].split('/')[0];

    return cleanHost === cleanTarget || cleanHost.endsWith('.' + cleanTarget);
  }

  /**
   * Checks whether a candidate URL should be crawled based on template sampling quota.
   * Returns true if within sampling limit, false if this template is already well-explored.
   */
  public shouldCrawlUrl(url: string, maxSamples?: number): boolean {
    const limit = maxSamples !== undefined ? maxSamples : this.maxSamplesPerTemplate;
    const template = this.generateRouteTemplate(url);

    let metrics = this.templateCounts.get(template);
    if (!metrics) {
      metrics = {
        template,
        sampleCount: 1,
        sampleUrls: [url],
        firstDiscoveredAt: Date.now(),
        lastSampledAt: Date.now()
      };
      this.templateCounts.set(template, metrics);
      return true;
    }

    if (metrics.sampleUrls.includes(url)) {
      return true;
    }

    if (metrics.sampleCount < limit) {
      metrics.sampleCount++;
      metrics.sampleUrls.push(url);
      metrics.lastSampledAt = Date.now();
      return true;
    }

    // Exceeded sample quota for this template pattern
    return false;
  }

  /**
   * Non-mutating probe to check if a candidate URL has remaining crawling budget.
   */
  public hasCrawlCapacity(url: string, maxSamples?: number): boolean {
    const limit = maxSamples !== undefined ? maxSamples : this.maxSamplesPerTemplate;
    const template = this.generateRouteTemplate(url);
    const metrics = this.templateCounts.get(template);
    if (!metrics) return true;
    if (metrics.sampleUrls.includes(url)) return true;
    return metrics.sampleCount < limit;
  }

  /**
   * Returns the count of unique discovered structural templates.
   */
  public getTemplateCount(): number {
    return this.templateCounts.size;
  }

  /**
   * Returns clustering telemetry for all explored route templates.
   */
  public getTemplateMetrics(): TemplateClusteringMetrics[] {
    return Array.from(this.templateCounts.values());
  }
}

export const endpointNormalizer = new EndpointNormalizer();
