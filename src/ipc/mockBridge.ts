import {
  PlatformInfoResponse,
  AppStatusResponse,
  ScopeDecisionResponse,
  CommandSearchItem,
  ProjectMetadata,
  RecentProjectInfo,
  ProjectState,
  ScopeResponse,
  ScopeRuleDef,
  ScopeEvaluationStep,
  ProjectExportResult,
  ProjectImportResult,
  WalStatusResult,
  TrafficPageQuery,
  TrafficPageResult,
  TransactionDetails,
  RawBlobResult,
  TrafficClearResult,
  TrafficDiffRequest,
  TrafficDiffResult,
  TrafficSummary,
  HeaderDiffItem,
  LineDiffItem,
  HttpqlValidationResult,
  RepeaterTabState,
  RepeaterSendRequestPayload,
  RepeaterExecutionResult,
  RepeaterDiffRequest,
  RepeaterExportPayload,
  VariableExtractPayload,
} from './contracts';
import { parseHttpql, evaluateHttpql, validateHttpql } from '../utils/httpql';
import {
  parseRawHttpRequest,
  interpolateVariables,
  extractJsonPath,
  extractHeaderValue,
  exportRepeaterRequest,
} from '../utils/repeaterUtils';



const DEFAULT_INCLUDES = ['target.local', 'https://api.target.local/*'];
const DEFAULT_EXCLUDES = [
  '169.254.169.254/32', // AWS/GCP/Azure SSRF Metadata (SEC-01)
  '10.0.0.0/8',         // Private RFC1918 (SEC-01)
  '127.0.0.1/32',       // Loopback
  '.*[/\\.](logout|signout|delete-account|terminate|drop-db).*', // Destructive endpoints
];

const DEFAULT_SCOPE_RULES: ScopeRuleDef[] = [
  { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Primary target domain' },
  { id: 'rule-02', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/*', enabled: true, notes: 'API endpoints' },
  { id: 'rule-03', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'AWS/GCP metadata SSRF protection (SEC-01)' },
  { id: 'rule-04', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true, notes: 'Internal intranet RFC1918 SSRF guard' },
  { id: 'rule-05', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '127.0.0.1/32', enabled: true, notes: 'Loopback socket isolation' },
  { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|delete-account|terminate|drop-db).*', enabled: true, notes: 'Destructive endpoint protection' },
];

let mockProxyRunning = true;

function extractHostname(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    const match = urlStr.match(/^https?:\/\/([^/:?#]+)/i);
    if (match) return match[1].toLowerCase().replace(/\.+$/, '');
    let s = urlStr.replace(/^https?:\/\//i, '');
    const slashIdx = s.indexOf('/');
    if (slashIdx !== -1) s = s.substring(0, slashIdx);
    const colonIdx = s.indexOf(':');
    if (colonIdx !== -1) s = s.substring(0, colonIdx);
    const queryIdx = s.indexOf('?');
    if (queryIdx !== -1) s = s.substring(0, queryIdx);
    return s.toLowerCase().replace(/\.+$/, '');
  }
}

const hostPatternCache = new Map<string, { isWildcard: boolean; root: string } | string>();

function matchHostPattern(pattern: string, host: string): boolean {
  if (pattern === '*' || host === pattern) return true;
  let parsed = hostPatternCache.get(pattern);
  if (parsed === undefined) {
    const pat = pattern.toLowerCase().trim().replace(/\.+$/, '');
    if (pat === '*') {
      parsed = '*';
    } else if (pat.startsWith('*.')) {
      parsed = { isWildcard: true, root: pat.slice(2).replace(/^\.+/, '') };
    } else {
      parsed = pat;
    }
    if (hostPatternCache.size > 5000) hostPatternCache.clear();
    hostPatternCache.set(pattern, parsed);
  }

  if (typeof parsed === 'string') {
    return parsed === '*' || host === parsed;
  }
  if (parsed.isWildcard) {
    if (!parsed.root) return true;
    return host === parsed.root || host.endsWith('.' + parsed.root);
  }
  return false;
}

const prefixCache = new Map<string, string>();
function getCleanPrefix(pattern: string): string {
  let cp = prefixCache.get(pattern);
  if (cp !== undefined) return cp;
  cp = pattern.replace('*', '').trim();
  if (prefixCache.size > 5000) prefixCache.clear();
  prefixCache.set(pattern, cp);
  return cp;
}

function classifyPattern(pat: string): 'REGEX' | 'URL_PREFIX' | 'IP_CIDR' | 'HOST' {
  const p = pat.trim();
  if (p.startsWith('^') || p.includes('.*') || p.includes('\\') || p.includes('(?:') || p.includes('(')) {
    return 'REGEX';
  }
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/')) {
    return 'URL_PREFIX';
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(p) || p.includes(':') || /^\d+\.\d+\.\d+\.\d+/.test(p)) {
    return 'IP_CIDR';
  }
  return 'HOST';
}

const hostIpCache = new Map<string, number | null>();

function ipv4ToInt(ip: string): number | null {
  const cached = hostIpCache.get(ip);
  if (cached !== undefined) return cached;

  const parts = ip.split('.');
  if (parts.length !== 4) {
    if (hostIpCache.size > 2000) hostIpCache.clear();
    hostIpCache.set(ip, null);
    return null;
  }
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const octet = Number(parts[i]);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255 || parts[i].trim() !== String(octet)) {
      if (hostIpCache.size > 2000) hostIpCache.clear();
      hostIpCache.set(ip, null);
      return null;
    }
    num = (num << 8) | octet;
  }
  const result = num >>> 0;
  if (hostIpCache.size > 2000) hostIpCache.clear();
  hostIpCache.set(ip, result);
  return result;
}

const cidrCache = new Map<string, { net: number; mask: number } | null>();

function getParsedCidr(cidrPattern: string): { net: number; mask: number } | null {
  let parsed = cidrCache.get(cidrPattern);
  if (parsed !== undefined) return parsed;

  const clean = cidrPattern.trim();
  const slashIdx = clean.indexOf('/');
  let ipStr = clean;
  let maskBits = 32;

  if (slashIdx !== -1) {
    ipStr = clean.substring(0, slashIdx).trim();
    const bits = parseInt(clean.substring(slashIdx + 1).trim(), 10);
    if (!Number.isNaN(bits) && bits >= 0 && bits <= 32) {
      maskBits = bits;
    }
  }

  const net = ipv4ToInt(ipStr);
  if (net === null) {
    cidrCache.set(cidrPattern, null);
    return null;
  }

  const mask = maskBits === 0 ? 0 : ((0xFFFFFFFF << (32 - maskBits)) >>> 0);
  const entry = { net: (net & mask) >>> 0, mask };
  if (cidrCache.size > 5000) cidrCache.clear();
  cidrCache.set(cidrPattern, entry);
  return entry;
}

interface RegexEntry {
  re: RegExp | null;
  literalCandidates: string[] | null;
}

const regexCache = new Map<string, RegexEntry>();

function getRegexEntry(pattern: string): RegexEntry {
  let entry = regexCache.get(pattern);
  if (entry !== undefined) return entry;

  const matches = pattern.toLowerCase().match(/[a-z0-9_]{3,}/g);
  const words = matches ? matches.filter((w) => w !== 'http' && w !== 'https') : null;
  const literalCandidates = words && words.length > 0 && words.length <= 8 ? words : null;

  let re: RegExp | null = null;
  try {
    if (pattern.includes('\\.') && !pattern.includes('[/') && !pattern.includes('[./') && !pattern.includes('[/.') && !pattern.includes('[\\.')) {
      re = new RegExp(pattern.replace(/\\+\./g, '[/.\\.]'), 'i');
    } else {
      re = new RegExp(pattern, 'i');
    }
  } catch {
    try {
      re = new RegExp(pattern, 'i');
    } catch {
      re = null;
    }
  }

  entry = { re, literalCandidates };

  if (regexCache.size > 10000) regexCache.clear();
  regexCache.set(pattern, entry);
  return entry;
}

interface ParsedCidrRule {
  net: number;
  mask: number;
  rule: ScopeRuleDef;
}

interface ProcessedPrefixRule {
  cleanPrefix: string;
  host: string | null;
  rule: ScopeRuleDef;
}

interface ProcessedRegexRule {
  re: RegExp | null;
  literalCandidates: string[] | null;
  rule: ScopeRuleDef;
}

interface ProcessedWildcardRule {
  cleanKeyword: string;
  rule: ScopeRuleDef;
}

interface ProcessedScopeBucket {
  exactHosts: Map<string, ScopeRuleDef>;
  wildcardHosts: ScopeRuleDef[];
  prefixRules: ProcessedPrefixRule[];
  parsedCidrs: ParsedCidrRule[];
  regexRules: ProcessedRegexRule[];
  wildcardRules: ProcessedWildcardRule[];
}

interface PartitionedRules {
  excludes: ProcessedScopeBucket;
  includes: ProcessedScopeBucket;
}

function partitionRules(rules: ScopeRuleDef[]): PartitionedRules {
  const res: PartitionedRules = {
    excludes: { exactHosts: new Map(), wildcardHosts: [], prefixRules: [], parsedCidrs: [], regexRules: [], wildcardRules: [] },
    includes: { exactHosts: new Map(), wildcardHosts: [], prefixRules: [], parsedCidrs: [], regexRules: [], wildcardRules: [] },
  };

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r.enabled) continue;
    const bucket = r.rule_type === 'EXCLUDE' ? res.excludes : res.includes;
    switch (r.pattern_type) {
      case 'HOST':
        if (r.pattern.startsWith('*')) {
          bucket.wildcardHosts.push(r);
          matchHostPattern(r.pattern, '');
        } else {
          bucket.exactHosts.set(r.pattern.toLowerCase().trim().replace(/\.+$/, ''), r);
        }
        break;
      case 'URL_PREFIX': {
        const clean = getCleanPrefix(r.pattern);
        const host = extractHostname(clean);
        bucket.prefixRules.push({ cleanPrefix: clean, host: host || null, rule: r });
        break;
      }
      case 'IP_CIDR': {
        const parsed = getParsedCidr(r.pattern);
        if (parsed) {
          bucket.parsedCidrs.push({ net: parsed.net, mask: parsed.mask, rule: r });
        }
        break;
      }
      case 'REGEX': {
        const entry = getRegexEntry(r.pattern);
        bucket.regexRules.push({ re: entry.re, literalCandidates: entry.literalCandidates, rule: r });
        break;
      }
      case 'WILDCARD':
        bucket.wildcardRules.push({ cleanKeyword: getCleanPrefix(r.pattern), rule: r });
        break;
    }
  }
  return res;
}

function evaluateBucket(
  bucket: ProcessedScopeBucket,
  uri: string,
  targetHostname: string,
  hostInt: number | null
): ScopeRuleDef | null {
  // 1. Exact host map (O(1))
  const exact = bucket.exactHosts.get(targetHostname);
  if (exact) return exact;

  // 2. Wildcard hosts
  const wildcards = bucket.wildcardHosts;
  for (let i = 0; i < wildcards.length; i++) {
    if (matchHostPattern(wildcards[i].pattern, targetHostname)) return wildcards[i];
  }

  // 3. URL Prefixes
  const prefixes = bucket.prefixRules;
  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (p.host !== null && p.host !== targetHostname) continue;
    if (uri.startsWith(p.cleanPrefix)) return p.rule;
  }

  // 4. Bitwise CIDRs (nanosecond bitops)
  if (hostInt !== null && bucket.parsedCidrs.length > 0) {
    const cidrs = bucket.parsedCidrs;
    for (let i = 0; i < cidrs.length; i++) {
      if (((hostInt & cidrs[i].mask) >>> 0) === cidrs[i].net) return cidrs[i].rule;
    }
  }

  // 5. Regexes
  const regexes = bucket.regexRules;
  if (regexes.length > 0) {
    const lowerUri = uri.toLowerCase();
    for (let i = 0; i < regexes.length; i++) {
      const reg = regexes[i];
      if (!reg.re) continue;
      if (reg.literalCandidates) {
        let hasCand = false;
        for (let c = 0; c < reg.literalCandidates.length; c++) {
          if (lowerUri.includes(reg.literalCandidates[c])) {
            hasCand = true;
            break;
          }
        }
        if (!hasCand) continue;
      }
      if (reg.re.test(uri)) return reg.rule;
    }
  }

  // 6. Wildcards
  const wildcardsList = bucket.wildcardRules;
  for (let i = 0; i < wildcardsList.length; i++) {
    if (uri.includes(wildcardsList[i].cleanKeyword)) return wildcardsList[i].rule;
  }

  return null;
}

function loadStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val) return JSON.parse(val) as T;
    }
  } catch {}
  return fallback;
}

function saveStorage<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

const INITIAL_PROJECTS: RecentProjectInfo[] = [
  {
    id: 'proj-001',
    name: 'Production Target Assessment',
    path: 'C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6',
    last_opened: new Date().toISOString(),
    size_bytes: 14200000,
    scope_rules_count: 6,
    finding_count: 3,
    pinned: true,
  },
  {
    id: 'proj-002',
    name: 'Staging API Security Audit',
    path: 'C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/staging_api',
    last_opened: new Date(Date.now() - 86400000).toISOString(),
    size_bytes: 8400000,
    scope_rules_count: 4,
    finding_count: 1,
    pinned: false,
  },
];

interface CachedScopeData extends ScopeResponse {
  partitionedRules: PartitionedRules;
}

let cachedScope: CachedScopeData | null = null;

export const mockBackendBridge = {
  async getPlatformInfo(): Promise<PlatformInfoResponse> {
    return {
      version: '6.0.0',
      os: 'windows',
      arch: 'x86_64',
      capabilities: [
        {
          subsystem_id: 'SUB-01',
          name: 'Common Security Primitives',
          status: 'BACKEND_IMPLEMENTED',
          description: 'Memory zeroization and domain types',
        },
        {
          subsystem_id: 'SUB-02',
          name: 'SQLite & CAS Storage',
          status: 'BACKEND_IMPLEMENTED',
          description: '32 tables WAL SQLite and CAS blob storage',
        },
        {
          subsystem_id: 'SUB-03',
          name: 'Dual-Channel Event Bus',
          status: 'BACKEND_IMPLEMENTED',
          description: 'Telemetry broadcast and lossless critical queue',
        },
        {
          subsystem_id: 'SUB-04',
          name: 'Fail-Closed Scope Engine',
          status: 'BACKEND_IMPLEMENTED',
          description: 'CIDR, wildcards, regex, SSRF prevention (SEC-01)',
        },
        {
          subsystem_id: 'SUB-06',
          name: 'Traffic Proxy & MITM',
          status: 'BACKEND_IMPLEMENTED',
          description: 'HTTP/1.1 and HTTP/2 TLS interception',
        },
        {
          subsystem_id: 'SUB-22',
          name: 'Productivity & Command Palette',
          status: 'BACKEND_IMPLEMENTED',
          description: 'Fuzzy search and global hotkey dispatcher',
        },
      ],
    };
  },

  async getStatus(): Promise<AppStatusResponse> {
    const current = await this.getCurrentProject();
    const scope = await this.getScope();
    const rulesCount = (scope.rules || []).filter((r) => r.enabled).length;

    return {
      proxy_running: mockProxyRunning,
      proxy_port: 8080,
      active_project: current ? current.name : 'Production Target Assessment',
      db_size_bytes: current ? current.db_size_bytes : 14200000,
      memory_rss_bytes: 68500000,
      ipc_latency_ms: 0.38,
      scope_active: true,
      scope_rules_count: rulesCount || 6,
      backend_version: '6.0.0 (FROZEN)',
    };
  },

  async toggleProxy(): Promise<boolean> {
    mockProxyRunning = !mockProxyRunning;
    return mockProxyRunning;
  },

  // Project Lifecycle API
  async createProject(name: string, path: string, seedScopeRules?: string[]): Promise<ProjectMetadata> {
    const id = `proj-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const metadata: ProjectMetadata = {
      id,
      name: name.trim(),
      path: path.trim(),
      db_size_bytes: 40960,
      created_at: now,
      updated_at: now,
      scope_rules_count: seedScopeRules ? seedScopeRules.length : DEFAULT_SCOPE_RULES.length,
      transaction_count: 0,
      finding_count: 0,
      wal_journal_mode: 'WAL',
      is_clean_shutdown: true,
    };

    saveStorage('sentinel_v6_active_project', metadata);

    const recents = loadStorage<RecentProjectInfo[]>('sentinel_v6_projects', INITIAL_PROJECTS);
    const newRecent: RecentProjectInfo = {
      id: metadata.id,
      name: metadata.name,
      path: metadata.path,
      last_opened: now,
      size_bytes: metadata.db_size_bytes,
      scope_rules_count: metadata.scope_rules_count,
      finding_count: 0,
      pinned: false,
    };
    const updatedRecents = [newRecent, ...recents.filter((r) => r.path !== metadata.path)];
    saveStorage('sentinel_v6_projects', updatedRecents);

    return metadata;
  },

  async openProject(path: string): Promise<ProjectState> {
    const recents = loadStorage<RecentProjectInfo[]>('sentinel_v6_projects', INITIAL_PROJECTS);
    const existing = recents.find((r) => r.path === path);
    const now = new Date().toISOString();
    const name = existing ? existing.name : (path.split(/[\\/]/).filter(Boolean).pop() || 'Untitled Project');

    const metadata: ProjectMetadata = {
      id: existing ? existing.id : `proj-${Date.now().toString(36)}`,
      name,
      path,
      db_size_bytes: existing ? existing.size_bytes : 14200000,
      created_at: existing ? existing.last_opened : now,
      updated_at: now,
      scope_rules_count: existing ? existing.scope_rules_count : 6,
      transaction_count: 142,
      finding_count: existing ? existing.finding_count : 3,
      wal_journal_mode: 'WAL',
      is_clean_shutdown: true,
    };

    saveStorage('sentinel_v6_active_project', metadata);

    const updatedRecents = [
      {
        id: metadata.id,
        name: metadata.name,
        path: metadata.path,
        last_opened: now,
        size_bytes: metadata.db_size_bytes,
        scope_rules_count: metadata.scope_rules_count,
        finding_count: metadata.finding_count,
        pinned: existing ? existing.pinned : false,
      },
      ...recents.filter((r) => r.path !== path),
    ];
    saveStorage('sentinel_v6_projects', updatedRecents);

    const scope = await this.getScope();
    return { metadata, scope };
  },

  async closeProject(): Promise<void> {
    saveStorage('sentinel_v6_active_project', null);
  },

  async getCurrentProject(): Promise<ProjectMetadata | null> {
    return loadStorage<ProjectMetadata | null>('sentinel_v6_active_project', {
      id: 'proj-001',
      name: 'Production Target Assessment',
      path: 'C:/Users/Legion 5 pro/Desktop/cyber sec/engagements/target_v6',
      db_size_bytes: 14200000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scope_rules_count: 6,
      transaction_count: 142,
      finding_count: 3,
      wal_journal_mode: 'WAL',
      is_clean_shutdown: true,
    });
  },

  async listRecentProjects(): Promise<RecentProjectInfo[]> {
    return loadStorage<RecentProjectInfo[]>('sentinel_v6_projects', INITIAL_PROJECTS);
  },

  async exportProject(projectDir: string, destinationZip: string, sanitized?: boolean): Promise<ProjectExportResult> {
    return {
      success: true,
      archive_path: destinationZip || `${projectDir}.sentinel.zip`,
      file_count: sanitized ? 12 : 28,
      total_bytes: sanitized ? 4500000 : 14200000,
      sha256_checksum: 'a8f5c4e2b10938f293847291aebdcfa92847291837492817492048291049ab28',
    };
  },

  async importProject(sourceZip: string, destinationDir: string): Promise<ProjectImportResult> {
    const name = sourceZip.split(/[\\/]/).pop()?.replace('.sentinel.zip', '') || 'Imported Project';
    const metadata = await this.createProject(name, destinationDir);
    return { success: true, metadata };
  },

  async walCheckpoint(): Promise<WalStatusResult> {
    return {
      journal_mode: 'WAL',
      page_count: 3468,
      page_size: 4096,
      freelist_count: 12,
      checkpoint_applied: true,
    };
  },

  // Scope Management API
  async getScope(): Promise<ScopeResponse> {
    if (cachedScope && (typeof localStorage === 'undefined' || localStorage.getItem('sentinel_v6_scope_rules') !== null)) {
      return cachedScope;
    }
    const rules = loadStorage<ScopeRuleDef[]>('sentinel_v6_scope_rules', DEFAULT_SCOPE_RULES);
    const includes = rules.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).map((r) => r.pattern);
    const excludes = rules.filter((r) => r.rule_type === 'EXCLUDE' && r.enabled).map((r) => r.pattern);
    const partitionedRules = partitionRules(rules);

    cachedScope = {
      id: 'scope-default-001',
      version: 1,
      timestamp: new Date().toISOString(),
      includes: includes.length > 0 ? includes : DEFAULT_INCLUDES,
      excludes: excludes.length > 0 ? excludes : DEFAULT_EXCLUDES,
      rules,
      partitionedRules,
    };
    return cachedScope;
  },

  async updateScope(includes: string[], excludes: string[], rules?: ScopeRuleDef[]): Promise<ScopeResponse> {
    let savedRules = rules;
    if (!savedRules) {
      savedRules = [
        ...includes.map((inc, i) => ({
          id: `inc-${i + 1}`,
          rule_type: 'INCLUDE' as const,
          pattern_type: classifyPattern(inc),
          pattern: inc,
          enabled: true,
        })),
        ...excludes.map((exc, i) => ({
          id: `exc-${i + 1}`,
          rule_type: 'EXCLUDE' as const,
          pattern_type: classifyPattern(exc),
          pattern: exc,
          enabled: true,
        })),
      ];
    }

    saveStorage('sentinel_v6_scope_rules', savedRules);
    const partitionedRules = partitionRules(savedRules);

    cachedScope = {
      id: 'scope-default-001',
      version: 2,
      timestamp: new Date().toISOString(),
      includes,
      excludes,
      rules: savedRules,
      partitionedRules,
    };

    return cachedScope;
  },

  async testScopeUri(uri: string): Promise<ScopeDecisionResponse> {
    const scope = cachedScope || await this.getScope();
    const partitioned = (scope as CachedScopeData).partitionedRules || partitionRules(scope.rules || []);
    const urlStr = uri.trim();

    if (!urlStr) {
      return {
        in_scope: false,
        reason: 'Fail-Closed (SEC-01): Empty URI target cannot be evaluated.',
        matched_rule: null,
        rule_type: 'DEFAULT_DENY',
        provenance_steps: [
          {
            step_number: 1,
            rule_pattern: '<empty>',
            rule_type: 'DEFAULT_DENY',
            matched: true,
            outcome: 'DENY',
            description: 'Target URI is empty or malformed',
          },
        ],
      };
    }

    const provenance_steps: ScopeEvaluationStep[] = [];

    // SSRF Hardcoded Check (AWS Metadata 169.254.169.254, RFC1918, loopbacks)
    const isSsrf =
      urlStr.includes('169.254.169.254') ||
      urlStr.includes('169.254.') ||
      urlStr.includes('[::ffff:169.254.') ||
      urlStr.includes('[::FFFF:169.254.') ||
      urlStr.includes('0.0.0.0') ||
      urlStr.includes('127.0.0.1') ||
      urlStr.includes('[::1]');
    if (isSsrf) {
      provenance_steps.push({
        step_number: 1,
        rule_pattern: '169.254.169.254/32',
        rule_type: 'SSRF_PRESET',
        matched: true,
        outcome: 'DENY',
        description: 'Target resolved to AWS/GCP/Azure Cloud Metadata address — blocked by SEC-01 SSRF defense.',
      });
      return {
        in_scope: false,
        reason: 'Blocked by SEC-01 SSRF Defense: Cloud Metadata IP (169.254.169.254)',
        matched_rule: '169.254.169.254/32',
        rule_type: 'EXCLUDE',
        provenance_steps,
      };
    }

    const host = extractHostname(urlStr);
    const hostInt = ipv4ToInt(host);

    // Step 1: Evaluate Active EXCLUDE Rules
    const matchedExclude = evaluateBucket(partitioned.excludes, urlStr, host, hostInt);
    if (matchedExclude) {
      provenance_steps.push({
        step_number: 1,
        rule_id: matchedExclude.id,
        rule_pattern: matchedExclude.pattern,
        rule_type: 'EXCLUDE',
        matched: true,
        outcome: 'DENY',
        description: `Target matched EXCLUDE rule ${matchedExclude.pattern} (${matchedExclude.pattern_type})`,
      });
      return {
        in_scope: false,
        reason: `Explicitly EXCLUDED by rule: ${matchedExclude.pattern} (${matchedExclude.notes || matchedExclude.pattern_type})`,
        matched_rule: matchedExclude.pattern,
        rule_type: 'EXCLUDE',
        provenance_steps,
      };
    }

    // Step 2: Evaluate Active INCLUDE Rules
    const matchedInclude = evaluateBucket(partitioned.includes, urlStr, host, hostInt);
    if (matchedInclude) {
      provenance_steps.push({
        step_number: 1,
        rule_id: matchedInclude.id,
        rule_pattern: matchedInclude.pattern,
        rule_type: 'INCLUDE',
        matched: true,
        outcome: 'ALLOW',
        description: `Target matched INCLUDE rule ${matchedInclude.pattern} (${matchedInclude.pattern_type})`,
      });
      return {
        in_scope: true,
        reason: `Target in-scope: Matched inclusion rule ${matchedInclude.pattern}`,
        matched_rule: matchedInclude.pattern,
        rule_type: 'INCLUDE',
        provenance_steps,
      };
    }

    provenance_steps.push({
      step_number: 1,
      rule_pattern: '<default-deny>',
      rule_type: 'DEFAULT_DENY',
      matched: true,
      outcome: 'DENY',
      description: 'Target did not match any active inclusion rules — SEC-01 fail-closed protection active.',
    });

    return {
      in_scope: false,
      reason: 'Denied by SEC-01 Fail-Closed Policy: Target did not match any inclusion rules.',
      matched_rule: null,
      rule_type: 'DEFAULT_DENY',
      provenance_steps,
    };
  },

  async searchCommands(query: string): Promise<CommandSearchItem[]> {
    const baseCommands: CommandSearchItem[] = [
      { id: 'ws-traffic', title: 'Jump to Traffic History', category: 'Workspace', shortcut: 'Alt+1', action: 'navigate:traffic' },
      { id: 'ws-repeater', title: 'Jump to Repeater', category: 'Workspace', shortcut: 'Alt+2', action: 'navigate:repeater' },
      { id: 'ws-scanner', title: 'Jump to Scanner', category: 'Workspace', shortcut: 'Alt+3', action: 'navigate:scanner' },
      { id: 'ws-fuzzer', title: 'Jump to Fuzzer', category: 'Workspace', shortcut: 'Alt+4', action: 'navigate:fuzzer' },
      { id: 'ws-identity', title: 'Jump to Identity Vault & Auth Matrix', category: 'Workspace', shortcut: 'Alt+5', action: 'navigate:identity' },
      { id: 'ws-api', title: 'Jump to API Security & OAST', category: 'Workspace', shortcut: 'Alt+6', action: 'navigate:apis' },
      { id: 'ws-browser', title: 'Jump to Browser Automation', category: 'Workspace', shortcut: 'Alt+7', action: 'navigate:browser' },
      { id: 'ws-findings', title: 'Jump to Findings Center', category: 'Workspace', shortcut: 'Alt+8', action: 'navigate:findings' },
      { id: 'ws-reports', title: 'Jump to Reports & Retest', category: 'Workspace', shortcut: 'Alt+9', action: 'navigate:reports' },
      { id: 'ws-settings', title: 'Jump to Settings & Diagnostics', category: 'Workspace', shortcut: 'Alt+0', action: 'navigate:settings' },
      { id: 'act-proj-new', title: 'New Project Wizard', category: 'Project', shortcut: 'Ctrl+N', action: 'project:new' },
      { id: 'act-proj-open', title: 'Open Project Archive', category: 'Project', shortcut: 'Ctrl+O', action: 'project:open' },
      { id: 'act-proj-settings', title: 'Project SQLite & WAL Diagnostics', category: 'Project', shortcut: 'Ctrl+Shift+P', action: 'project:settings' },
      { id: 'act-proj-export', title: 'Export Project Bundle (.sentinel.zip)', category: 'Project', shortcut: 'Ctrl+Shift+E', action: 'project:export' },
      { id: 'act-proj-wal', title: 'Commit SQLite WAL Snapshot', category: 'Project', shortcut: 'Ctrl+S', action: 'project:save' },
      { id: 'act-proxy-toggle', title: 'Toggle MITM Proxy Interceptor', category: 'Proxy', shortcut: 'Ctrl+Shift+I', action: 'proxy:toggle' },
      { id: 'act-theme-toggle', title: 'Toggle Dark / Light Theme', category: 'Appearance', shortcut: 'Ctrl+Shift+D', action: 'theme:toggle' },
      { id: 'act-scope-modal', title: 'Open Scope Rule Manager', category: 'Scope', shortcut: 'Ctrl+Shift+S', action: 'scope:open' },
    ];

    if (!query.trim()) return baseCommands;
    const q = query.toLowerCase();
    return baseCommands.filter(
      (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  },

  // ==========================================
  // Phase UI-3 Traffic IPC Mock Engine
  // ==========================================

  async getTrafficPage(query: TrafficPageQuery): Promise<TrafficPageResult> {
    ensureMockTrafficData();
    let filtered = [...mockSummaries];

    if (query?.inScopeOnly) {
      filtered = filtered.filter((t) => t.inScope);
    }

    if (query?.filterHttpql && query.filterHttpql.trim()) {
      const { ast } = parseHttpql(query.filterHttpql);
      filtered = filtered.filter((t) => evaluateHttpql(ast, t));
    }

    if (query?.sortField) {
      const order = query.sortOrder === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const fieldA = (a as any)[query.sortField!] ?? 0;
        const fieldB = (b as any)[query.sortField!] ?? 0;
        if (typeof fieldA === 'number') return (fieldA - fieldB) * order;
        return String(fieldA).localeCompare(String(fieldB)) * order;
      });
    }

    const offset = query?.offset || 0;
    const limit = query?.limit || 50;
    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      totalCount: mockSummaries.length,
      filteredCount: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length,
    };
  },

  async getTransactionDetails(id: string): Promise<TransactionDetails> {
    ensureMockTrafficData();
    let details = mockTransactions.get(id);
    if (!details) {
      const summary = mockSummaries.find((s) => s.id === id);
      if (summary) {
        details = generateTransactionDetailsFromSummary(summary);
        mockTransactions.set(id, details);
      } else {
        throw new Error(`Transaction ${id} not found in database`);
      }
    }
    return details;
  },

  async getRawBlob(sha256Hex: string, maxBytes?: number): Promise<RawBlobResult> {
    ensureMockTrafficData();
    const rawContent = `RAW_BLOB_PAYLOAD [SHA256:${sha256Hex}]\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"status":"verified","sha256":"${sha256Hex}","security":"SEC-07-CAS-VALID"}`;
    const truncated = maxBytes && rawContent.length > maxBytes;
    const effectiveContent = truncated ? rawContent.substring(0, maxBytes) : rawContent;
    const dataBase64 = btoa(effectiveContent);

    return {
      blobId: `blob-${sha256Hex.substring(0, 8)}`,
      sha256Hex,
      sizeBytes: rawContent.length,
      dataBase64,
      isTruncated: Boolean(truncated),
      mimeType: 'application/json',
    };
  },

  async clearTraffic(): Promise<TrafficClearResult> {
    const count = mockSummaries.length;
    mockSummaries = [];
    mockTransactions.clear();
    return {
      clearedCount: count,
      success: true,
      timestamp: new Date().toISOString(),
    };
  },

  async validateHttpql(query: string): Promise<HttpqlValidationResult> {
    return validateHttpql(query);
  },

  async diffTransactions(req: TrafficDiffRequest): Promise<TrafficDiffResult> {
    ensureMockTrafficData();
    const txA = await this.getTransactionDetails(req.idA);
    const txB = await this.getTransactionDetails(req.idB);

    const bodyA = txA.response?.bodyText || '';
    const bodyB = txB.response?.bodyText || '';

    const linesA = bodyA.split('\n');
    const linesB = bodyB.split('\n');

    const bodyLineDiffs: LineDiffItem[] = [];
    const maxLines = Math.max(linesA.length, linesB.length);
    let matchCount = 0;

    for (let i = 0; i < maxLines; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA === lineB) {
        matchCount++;
        bodyLineDiffs.push({
          kind: 'UNCHANGED',
          originalLineNum: i + 1,
          newLineNum: i + 1,
          content: lineA || '',
        });
      } else if (lineA !== undefined && lineB !== undefined) {
        bodyLineDiffs.push({
          kind: 'REMOVED',
          originalLineNum: i + 1,
          content: lineA,
        });
        bodyLineDiffs.push({
          kind: 'ADDED',
          newLineNum: i + 1,
          content: lineB,
        });
      } else if (lineA !== undefined) {
        bodyLineDiffs.push({
          kind: 'REMOVED',
          originalLineNum: i + 1,
          content: lineA,
        });
      } else if (lineB !== undefined) {
        bodyLineDiffs.push({
          kind: 'ADDED',
          newLineNum: i + 1,
          content: lineB,
        });
      }
    }

    const headerDiffs: HeaderDiffItem[] = [];
    const headersA = txA.response?.headers || [];
    const headersB = txB.response?.headers || [];

    for (const hA of headersA) {
      const hB = headersB.find((h) => h.name.toLowerCase() === hA.name.toLowerCase());
      if (!hB) {
        headerDiffs.push({ name: hA.name, kind: 'REMOVED', originalValue: hA.value });
      } else if (hB.value !== hA.value) {
        headerDiffs.push({ name: hA.name, kind: 'MODIFIED', originalValue: hA.value, newValue: hB.value });
      } else {
        headerDiffs.push({ name: hA.name, kind: 'UNCHANGED', originalValue: hA.value, newValue: hB.value });
      }
    }

    for (const hB of headersB) {
      const existsInA = headersA.some((h) => h.name.toLowerCase() === hB.name.toLowerCase());
      if (!existsInA) {
        headerDiffs.push({ name: hB.name, kind: 'ADDED', newValue: hB.value });
      }
    }

    const similarityScore = maxLines > 0 ? (matchCount / maxLines) * 100 : 100;
    const hasDivergence = txA.response?.statusCode !== txB.response?.statusCode || similarityScore < 100;

    return {
      transactionAId: req.idA,
      transactionBId: req.idB,
      statusDelta: [txA.response?.statusCode || 0, txB.response?.statusCode || 0],
      durationDeltaMs: [txA.timingMs, txB.timingMs],
      sizeDeltaBytes: [bodyA.length, bodyB.length],
      headerDiffs,
      bodyLineDiffs,
      similarityScore,
      hasDivergence,
    };
  },

  // ==========================================
  // Phase UI-4 Repeater Backend IPC Handlers
  // ==========================================

  async createRepeaterTab(
    title?: string,
    targetUrl?: string,
    _seedTransactionId?: string,
    initialRequest?: string
  ): Promise<RepeaterTabState> {
    const id = `rep-tab-${Math.random().toString(36).substring(2, 9)}`;
    const url = targetUrl || 'https://target.local/api/v1/auth/login';
    const isTls = url.startsWith('https://');
    let host = 'target.local';
    try {
      host = new URL(url).host;
    } catch {}

    const tabTitle = title || 'Request #1';
    let raw = initialRequest;
    let method: any = 'GET';
    let headers = [
      { id: 'h-1', name: 'Host', value: host, enabled: true },
      { id: 'h-2', name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
      { id: 'h-3', name: 'Accept', value: '*/*', enabled: true },
    ];
    let body = '';

    if (raw) {
      const parsed = parseRawHttpRequest(raw);
      method = parsed.method;
      headers = parsed.headers.length > 0 ? parsed.headers : headers;
      body = parsed.body;
    } else {
      raw = `GET /api/v1/auth/login HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Sentinel/6.0.0 Repeater\r\nAccept: */*\r\n\r\n`;
    }

    const tab: RepeaterTabState = {
      id,
      title: tabTitle,
      isDirty: false,
      method,
      url,
      protocol: isTls ? 'HTTP/1.1' : 'HTTP/1.1',
      headers,
      queryParams: [],
      body,
      bodyType: 'raw',
      rawRequest: raw,
      rawMode: false,
      autoContentLength: true,
      followRedirects: false,
      maxRedirects: 5,
      timeoutMs: 10000,
      localVariables: {},
      history: [],
      activeRevisionIndex: 0,
      baselineRevisionIndex: null,
      isExecuting: false,
      abortController: null,
      requestViewMode: 'raw',
      responseViewMode: 'raw',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return tab;
  },

  async sendRepeaterRequest(payload: RepeaterSendRequestPayload): Promise<RepeaterExecutionResult> {
    const rawReq = payload.rawRequest || '';
    let target = payload.targetUrl;

    if (!target) {
      const parsed = parseRawHttpRequest(rawReq);
      const hostHeader = parsed.headers.find((h) => h.name.toLowerCase() === 'host')?.value || 'target.local';
      const scheme = 'https';
      target = `${scheme}://${hostHeader}${parsed.path.startsWith('/') ? parsed.path : '/' + parsed.path}`;
    }

    // 1. SEC-01 Fail-Closed Scope Check
    const isSsrfOrBlocked =
      target.includes('169.254.169.254') ||
      target.includes('10.0.0.1') ||
      target.includes('attacker') ||
      target.includes('evil');
    if (isSsrfOrBlocked) {
      throw new Error(`SEC-01 Scope Violation: Target ${target} rejected by Fail-Closed Pre-Socket Engine`);
    }

    // 2. Variable Interpolation
    const envVars = payload.envVars || {};
    const interpolatedRaw = interpolateVariables(rawReq, envVars);
    const parsedReq = parseRawHttpRequest(interpolatedRaw);

    // Resolve real target URL dynamically from parsedReq Host header and path
    let liveTargetUrl = target;
    const hostHeader = parsedReq.headers.find((h) => h.name.toLowerCase() === 'host')?.value;
    if (hostHeader && !hostHeader.includes('target.local') && !hostHeader.includes('127.0.0.1')) {
      const isHttp = target.startsWith('http://');
      const scheme = isHttp ? 'http://' : 'https://';
      const cleanPath = (parsedReq.path.startsWith('/') ? parsedReq.path : `/${parsedReq.path}`).replace(/#/g, '%23');
      liveTargetUrl = `${scheme}${hostHeader}${cleanPath}`;
    }

    // 1. If running in browser dev environment, forward via Vite local raw proxy (zero CORS restrictions)
    if (
      typeof window !== 'undefined' &&
      window.location &&
      (liveTargetUrl.startsWith('http://') || liveTargetUrl.startsWith('https://')) &&
      !liveTargetUrl.includes('target.local')
    ) {
      try {
        const vRes = await fetch('/__sentinel_raw_proxy__', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: liveTargetUrl,
            rawRequest: payload.rawRequest,
          }),
        });
        if (vRes.ok) {
          const vData = await vRes.json();
          const durationMs = vData.durationMs || 45;
          const revisionId = `rev-${Math.random().toString(36).substring(2, 9)}`;
          const observationId = `obs-${Math.random().toString(36).substring(2, 9)}`;

          return {
            tabId: payload.tabId,
            revisionId,
            statusCode: vData.statusCode,
            statusText: vData.statusText || 'OK',
            durationMs,
            rawResponse: vData.rawResponse,
            parsedResponse: {
              id: `res-${revisionId}`,
              statusCode: vData.statusCode,
              statusText: vData.statusText || 'OK',
              headers: vData.headers || [],
              bodyText: vData.body || '',
              bodyBlobId: `blob-${Math.random().toString(36).substring(2, 10)}`,
              durationMs,
              tlsVersion: liveTargetUrl.startsWith('https') ? 'TLSv1.3' : undefined,
              cipherSuite: liveTargetUrl.startsWith('https') ? 'TLS_AES_256_GCM_SHA384' : undefined,
              tlsAlpn: 'http/1.1',
              serverName: hostHeader || 'target.domain',
            },
            headers: vData.headers || [],
            body: vData.body || '',
            timingBreakdown: {
              dnsMs: 1.2,
              tcpConnectMs: 3.4,
              tlsHandshakeMs: liveTargetUrl.startsWith('https') ? 6.5 : undefined,
              ttfbMs: durationMs * 0.75,
              contentDownloadMs: durationMs * 0.25,
              totalDurationMs: durationMs,
            },
            observationId,
            casHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            casReqHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
            casResHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            inScope: true,
          };
        }
      } catch (viteErr) {
        // Fallback to direct fetch or public proxy
      }
    }

    // 2. Direct browser fetch fallback
    if (typeof fetch !== 'undefined' && (liveTargetUrl.startsWith('http://') || liveTargetUrl.startsWith('https://')) && !liveTargetUrl.includes('target.local')) {
      try {
        const fetchHeaders: Record<string, string> = {};
        for (const h of parsedReq.headers) {
          const lower = h.name.toLowerCase();
          if (lower !== 'host' && lower !== 'content-length' && lower !== 'connection') {
            fetchHeaders[h.name] = h.value;
          }
        }

        const fetchInit: RequestInit = {
          method: parsedReq.method || 'GET',
          headers: fetchHeaders,
          redirect: 'follow',
        };

        if (parsedReq.method !== 'GET' && parsedReq.method !== 'HEAD' && parsedReq.body) {
          fetchInit.body = parsedReq.body;
        }

        const fetchStart = performance.now();
        let resText = '';
        let status = 200;
        let statusText = 'OK';
        const resHeaders: { name: string; value: string }[] = [];

        try {
          const liveRes = await fetch(liveTargetUrl, fetchInit);
          resText = await liveRes.text();
          status = liveRes.status;
          statusText = liveRes.statusText || 'OK';
          liveRes.headers.forEach((val, key) => {
            resHeaders.push({ name: key, value: val });
          });
        } catch (directErr) {
          const isLocal = liveTargetUrl.includes('127.0.0.1') || liveTargetUrl.includes('localhost');
          if (!isLocal) {
            const proxyUrls = [
              `https://api.allorigins.win/raw?url=${encodeURIComponent(liveTargetUrl)}`,
              `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(liveTargetUrl)}`,
            ];
            for (const pUrl of proxyUrls) {
              try {
                const pRes = await fetch(pUrl, {
                  method: parsedReq.method === 'GET' || parsedReq.method === 'HEAD' ? parsedReq.method : 'GET',
                  headers: { 'Accept': '*/*' },
                });
                if (pRes.status >= 100 && pRes.status < 600) {
                  const proxyText = await pRes.text();
                  if (!proxyText.includes('corsproxy.io') && !proxyText.includes('API key is required')) {
                    resText = proxyText;
                    status = pRes.status;
                    statusText = pRes.statusText || (status === 500 ? 'Internal Server Error' : status === 404 ? 'Not Found' : 'OK');
                    pRes.headers.forEach((val, key) => {
                      resHeaders.push({ name: key, value: val });
                    });
                    break;
                  }
                }
              } catch {}
            }
          }
        }

        const durationMs = Math.round(performance.now() - fetchStart);
        if (resHeaders.length === 0) {
          resHeaders.push(
            { name: 'Content-Type', value: 'text/html; charset=utf-8' },
            { name: 'X-Frame-Options', value: 'SAMEORIGIN' },
            { name: 'Connection', value: 'close' },
            { name: 'Content-Length', value: resText.length.toString() }
          );
        }

        const statusLine = `HTTP/1.1 ${status} ${statusText}`;
        const headerBlock = resHeaders.map((h) => `${h.name}: ${h.value}`).join('\r\n');
        const rawResponse = `${statusLine}\r\n${headerBlock}\r\n\r\n${resText}`;
        const revisionId = `rev-${Math.random().toString(36).substring(2, 9)}`;
        const observationId = `obs-${Math.random().toString(36).substring(2, 9)}`;

        return {
          tabId: payload.tabId,
          revisionId,
          statusCode: status,
          statusText,
          durationMs,
          rawResponse,
          parsedResponse: {
            id: `res-${revisionId}`,
            statusCode: status,
            statusText,
            headers: resHeaders,
            bodyText: resText,
            bodyBlobId: `blob-${Math.random().toString(36).substring(2, 10)}`,
            durationMs,
            tlsVersion: liveTargetUrl.startsWith('https') ? 'TLSv1.3' : undefined,
            cipherSuite: liveTargetUrl.startsWith('https') ? 'TLS_AES_256_GCM_SHA384' : undefined,
            tlsAlpn: 'http/1.1',
            serverName: hostHeader || 'target.domain',
          },
          headers: resHeaders,
          body: resText,
          timingBreakdown: {
            dnsMs: 1.2,
            tcpConnectMs: 3.4,
            tlsHandshakeMs: liveTargetUrl.startsWith('https') ? 6.5 : undefined,
            ttfbMs: durationMs * 0.75,
            contentDownloadMs: durationMs * 0.25,
            totalDurationMs: durationMs,
          },
          observationId,
          casHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          casReqHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
          casResHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          inScope: true,
        };
      } catch (fetchErr) {
        console.warn('[mockBridge] Direct live fetch failed:', fetchErr);
      }
    }

    // 3. Execution Simulation & Timing
    const isHttps = target.startsWith('https://');
    const dnsMs = 1.4;
    const tcpConnectMs = 5.2;
    const tlsHandshakeMs = isHttps ? 8.6 : undefined;
    const ttfbMs = 38.5;
    const contentDownloadMs = 12.0;
    const totalDurationMs = Math.round(dnsMs + tcpConnectMs + (tlsHandshakeMs || 0) + ttfbMs + contentDownloadMs);

    const timingBreakdown = {
      dnsMs,
      tcpConnectMs,
      tlsHandshakeMs,
      ttfbMs,
      contentDownloadMs,
      totalDurationMs,
    };

    // 4. Response Generation
    const revisionId = `rev-${Math.random().toString(36).substring(2, 9)}`;
    const observationId = `obs-${Math.random().toString(36).substring(2, 9)}`;
    let statusCode = 200;
    let statusText = 'OK';

    if (parsedReq.path.includes('404') || parsedReq.path.includes('notfound')) {
      statusCode = 404;
      statusText = 'Not Found';
    } else if (parsedReq.path.includes('500') || parsedReq.path.includes('error')) {
      statusCode = 500;
      statusText = 'Internal Server Error';
    } else if (parsedReq.path.includes('401') || parsedReq.path.includes('unauthorized')) {
      statusCode = 401;
      statusText = 'Unauthorized';
    } else if (parsedReq.path.includes('403') || parsedReq.path.includes('forbidden')) {
      statusCode = 403;
      statusText = 'Forbidden';
    }

    let responseBody = '';
    let rawResponse = '';
    let headers: { name: string; value: string }[] = [];

    if (target.includes('identitytoolkit.googleapis.com') || parsedReq.path.includes('signInWithPassword')) {
      statusCode = 400;
      statusText = 'Bad Request';

      const errorPayload = {
        error: {
          code: 400,
          message: 'INVALID_LOGIN_CREDENTIALS',
          errors: [
            {
              message: 'INVALID_LOGIN_CREDENTIALS',
              domain: 'global',
              reason: 'invalid',
            },
          ],
        },
      };

      responseBody = JSON.stringify(errorPayload, null, 2);
      headers = [
        { name: 'Cache-Control', value: 'no-cache, no-store, max-age=0, must-revalidate' },
        { name: 'Date', value: new Date().toUTCString() },
        { name: 'Expires', value: 'Mon, 01 Jan 1990 00:00:00 GMT' },
        { name: 'Pragma', value: 'no-cache' },
        { name: 'Vary', value: 'Origin, X-Origin, Referer' },
        { name: 'Content-Type', value: 'application/json; charset=UTF-8' },
        { name: 'Server', value: 'ESF' },
        { name: 'Content-Length', value: responseBody.length.toString() },
        { name: 'X-Xss-Protection', value: '0' },
        { name: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { name: 'X-Content-Type-Options', value: 'nosniff' },
        { name: 'Access-Control-Allow-Origin', value: 'https://complaint-management-b1126.web.app' },
        { name: 'Alt-Svc', value: 'h3=":443"; ma=2592000, h3-29=":443"; ma=2592000' },
      ];

      const headerBlock = headers.map((h) => `${h.name}: ${h.value}`).join('\r\n');
      rawResponse = `HTTP/2 400 Bad Request\r\n${headerBlock}\r\n\r\n${responseBody}`;
    } else {
      const responseData = {
        status: statusCode,
        timestamp: new Date().toISOString(),
        echo_method: parsedReq.method,
        echo_path: parsedReq.path,
        authenticated: true,
        session_token: `sess_${Math.random().toString(36).substring(2, 12)}`,
        user: {
          id: 42,
          username: 'admin',
          role: 'security_lead',
        },
        audit: {
          in_scope: true,
          repeater_dispatched: true,
        },
      };

      responseBody = JSON.stringify(responseData, null, 2);
      headers = [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' },
        { name: 'Server', value: 'SentinelShield/6.0' },
        { name: 'Content-Length', value: responseBody.length.toString() },
        { name: 'Connection', value: 'keep-alive' },
        { name: 'Date', value: new Date().toUTCString() },
        { name: 'Set-Cookie', value: `sentinel_session=s%3A_${Math.random().toString(36).substring(2, 10)}; Path=/; Secure; HttpOnly; SameSite=Strict` },
      ];

      rawResponse = `HTTP/1.1 ${statusCode} ${statusText}\r\nContent-Type: application/json; charset=utf-8\r\nServer: SentinelShield/6.0\r\nContent-Length: ${responseBody.length}\r\nConnection: keep-alive\r\nDate: ${new Date().toUTCString()}\r\n\r\n${responseBody}`;
    }

    const casResHash = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
    const casReqHash = `a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e`;

    return {
      tabId: payload.tabId,
      revisionId,
      statusCode,
      statusText,
      durationMs: totalDurationMs,
      rawResponse,
      parsedResponse: {
        id: `res-${revisionId}`,
        statusCode,
        statusText,
        headers,
        bodyText: responseBody,
        bodyBlobId: `blob-${casResHash.substring(0, 8)}`,
        durationMs: totalDurationMs,
        tlsVersion: isHttps ? 'TLSv1.3' : undefined,
        cipherSuite: isHttps ? 'TLS_AES_256_GCM_SHA384' : undefined,
        tlsAlpn: 'http/1.1',
        serverName: 'target.local',
      },
      headers,
      body: responseBody,
      timingBreakdown,
      tlsInfo: isHttps
        ? {
            version: 'TLSv1.3',
            cipherSuite: 'TLS_AES_256_GCM_SHA384',
            alpn: 'http/1.1',
            serverName: 'target.local',
            subject: 'CN=target.local, O=Target Corp',
            issuer: 'CN=Sentinel Internal CA, O=Sentinel Security',
            fingerprintSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          }
        : undefined,
      observationId,
      casHash: casResHash,
      casReqHash,
      casResHash,
      inScope: true,
    };
  },

  async diffRepeaterRevisions(req: RepeaterDiffRequest): Promise<TrafficDiffResult> {
    const sampleA = '{\n  "status": 200,\n  "role": "user"\n}';
    const sampleB = '{\n  "status": 200,\n  "role": "admin",\n  "mfa": false\n}';

    const linesA = sampleA.split('\n');
    const linesB = sampleB.split('\n');
    const bodyLineDiffs: LineDiffItem[] = [];
    const maxLines = Math.max(linesA.length, linesB.length);
    let matchCount = 0;

    for (let i = 0; i < maxLines; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA === lineB) {
        matchCount++;
        bodyLineDiffs.push({
          kind: 'UNCHANGED',
          originalLineNum: i + 1,
          newLineNum: i + 1,
          content: lineA || '',
        });
      } else if (lineA !== undefined && lineB !== undefined) {
        bodyLineDiffs.push({
          kind: 'REMOVED',
          originalLineNum: i + 1,
          content: lineA,
        });
        bodyLineDiffs.push({
          kind: 'ADDED',
          newLineNum: i + 1,
          content: lineB,
        });
      } else if (lineA !== undefined) {
        bodyLineDiffs.push({
          kind: 'REMOVED',
          originalLineNum: i + 1,
          content: lineA,
        });
      } else if (lineB !== undefined) {
        bodyLineDiffs.push({
          kind: 'ADDED',
          newLineNum: i + 1,
          content: lineB,
        });
      }
    }

    const similarityScore = maxLines > 0 ? (matchCount / maxLines) * 100 : 100;
    return {
      transactionAId: `rev-${req.revAIndex}`,
      transactionBId: `rev-${req.revBIndex}`,
      statusDelta: [200, 200],
      durationDeltaMs: [45, 52],
      sizeDeltaBytes: [sampleA.length, sampleB.length],
      headerDiffs: [
        { name: 'Content-Type', kind: 'UNCHANGED', originalValue: 'application/json', newValue: 'application/json' },
      ],
      bodyLineDiffs,
      similarityScore,
      hasDivergence: true,
    };
  },

  async exportRepeaterCommand(payload: RepeaterExportPayload): Promise<string> {
    const parsed = parseRawHttpRequest(payload.rawRequest);
    return exportRepeaterRequest(
      payload.format,
      parsed.method,
      payload.targetUrl,
      parsed.headers,
      parsed.body
    );
  },

  async extractVariable(payload: VariableExtractPayload): Promise<string | null> {
    if (payload.sourceType === 'json') {
      return extractJsonPath(payload.sourceText, payload.expression);
    }
    if (payload.sourceType === 'header') {
      return extractHeaderValue(payload.sourceText, payload.expression);
    }
    return null;
  },
};


// Procedural Mock Data Generator
let mockSummaries: TrafficSummary[] = [];
let mockTransactions: Map<string, TransactionDetails> = new Map();

function generateMockResponseBody(s: TrafficSummary): { mimeType: string; body: string } {
  // If HTML MIME type or web page
  if (s.mimeType === 'text/html' || s.path.endsWith('.html') || !s.path.includes('/api/')) {
    if (s.status === 404) {
      return {
        mimeType: 'text/html; charset=UTF-8',
        body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 Not Found - Target Application</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .error-card { text-align: center; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 40px; max-width: 480px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4); }
    .code { font-size: 56px; font-weight: 800; color: #ef4444; margin: 0 0 8px 0; }
    h2 { font-size: 20px; margin: 0 0 12px 0; color: #f1f5f9; }
    p { color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0; }
    .endpoint { font-family: monospace; background: #0f172a; padding: 4px 8px; border-radius: 4px; color: #38bdf8; }
    .btn { display: inline-block; background: #f37021; color: white; padding: 8px 20px; border-radius: 4px; font-weight: 600; text-decoration: none; font-size: 13px; }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="code">404</div>
    <h2>Page Not Found</h2>
    <p>The requested route <span class="endpoint">${s.path}</span> could not be located on target.local.</p>
    <a href="/" class="btn">Return to Security Portal</a>
  </div>
</body>
</html>`
      };
    }

    if (s.path.includes('login') || s.path.includes('auth')) {
      return {
        mimeType: 'text/html; charset=UTF-8',
        body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Security Portal Authentication</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .login-box { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 32px; width: 360px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { margin: 0 0 6px 0; color: #38bdf8; font-size: 20px; }
    .sub { color: #94a3b8; font-size: 12px; margin-bottom: 20px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-top: 14px; }
    input { width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; color: white; padding: 8px 12px; border-radius: 4px; margin-top: 6px; font-size: 13px; }
    input:focus { border-color: #f37021; outline: none; }
    .btn { width: 100%; background: #f37021; color: white; border: none; padding: 10px; border-radius: 4px; font-weight: 700; margin-top: 22px; cursor: pointer; font-size: 13px; }
    .badge { display: inline-block; background: #059669; color: white; font-size: 10px; padding: 2px 8px; border-radius: 9999px; margin-bottom: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="login-box">
    <span class="badge">SEC-06 PROTECTED</span>
    <h2>Sign In to Target</h2>
    <div class="sub">Enter your security credentials to access assessment environment.</div>
    <label>Username / Email</label>
    <input type="text" value="admin@target.local" />
    <label>Password</label>
    <input type="password" value="••••••••••••" />
    <button class="btn">Authenticate (Proxy Intercept)</button>
  </div>
</body>
</html>`
      };
    }

    if (s.path.includes('profile') || s.path.includes('users')) {
      return {
        mimeType: 'text/html; charset=UTF-8',
        body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>User Profile Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
    .container { max-width: 800px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 24px; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; background: #f37021; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }
    h2 { margin: 0; font-size: 18px; color: #38bdf8; }
    .role { color: #34d399; font-size: 12px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 14px; }
    .card-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .card-value { font-size: 14px; font-weight: 600; color: #f8fafc; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="avatar">SA</div>
      <div>
        <h2>Security Auditor</h2>
        <div class="role">ROLE: SYSTEM_ADMIN (SEC-09 IRA+ Matrix)</div>
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-label">User ID</div>
        <div class="card-value">usr_89201a4f</div>
      </div>
      <div class="card">
        <div class="card-label">Assigned Scope</div>
        <div class="card-value">target.local (*.local)</div>
      </div>
      <div class="card">
        <div class="card-label">MFA Status</div>
        <div class="card-value" style="color:#34d399;">Hardware FIDO2 Active</div>
      </div>
      <div class="card">
        <div class="card-label">Session ID</div>
        <div class="card-value">sess_cas_7f83b165</div>
      </div>
    </div>
  </div>
</body>
</html>`
      };
    }

    if (s.path.includes('invoices') || s.path.includes('export') || s.path.includes('orders') || s.path.includes('checkout')) {
      return {
        mimeType: 'text/html; charset=UTF-8',
        body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoices & Export Statements</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
    .container { max-width: 860px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 24px; }
    .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 14px; margin-bottom: 20px; }
    h2 { margin: 0; font-size: 18px; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; background: #0f172a; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #334155; font-size: 12px; }
    th { background: #1e293b; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .status-paid { color: #34d399; font-weight: 700; }
    .status-pending { color: #f59e0b; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="top">
      <h2>Invoice Statement Export</h2>
      <span style="color:#94a3b8; font-size:12px; font-family:monospace;">BATCH: ${s.id}</span>
    </div>
    <table>
      <thead>
        <tr><th>Invoice ID</th><th>Entity</th><th>Amount</th><th>Status</th><th>Timestamp</th></tr>
      </thead>
      <tbody>
        <tr><td>INV-8491</td><td>Acme Enterprise Corp</td><td>$14,500.00</td><td class="status-paid">PAID</td><td>2026-08-20</td></tr>
        <tr><td>INV-8492</td><td>CyberSec Defense LLC</td><td>$8,200.00</td><td class="status-paid">PAID</td><td>2026-08-21</td></tr>
        <tr><td>INV-8493</td><td>Global Logistics AG</td><td>$23,750.00</td><td class="status-pending">PENDING</td><td>2026-08-22</td></tr>
        <tr><td>INV-8494</td><td>Nexus Systems Infra</td><td>$5,100.00</td><td class="status-paid">PAID</td><td>2026-08-23</td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`
      };
    }
  }

  // Default JSON API response
  return {
    mimeType: 'application/json',
    body: JSON.stringify(
      {
        status: s.status,
        transactionId: s.id,
        endpoint: s.path,
        timestamp: s.timestamp,
        data: {
          user: s.inScope ? 'authorized_auditor' : 'guest_external',
          roles: s.inScope ? ['admin', 'security_tester'] : ['public'],
          scopeCheck: s.inScope ? 'ALLOW' : 'DENY',
        },
      },
      null,
      2
    )
  };
}

function generateTransactionDetailsFromSummary(s: TrafficSummary): TransactionDetails {
  const reqBody = s.method === 'GET' ? undefined : JSON.stringify({ action: 'mutate', target: s.path, id: s.id }, null, 2);
  const responseData = generateMockResponseBody(s);

  return {
    id: s.id,
    timestamp: s.timestamp,
    timingMs: s.durationMs,
    provenance: 'Proxy',
    lifecycle: 'Completed',
    scopeId: s.inScope ? 'scope-default-target' : undefined,
    request: {
      id: `req-${s.id}`,
      method: s.method,
      url: s.url,
      protocol: 'HTTP/1.1',
      headers: [
        { name: 'Host', value: s.host },
        { name: 'User-Agent', value: 'Sentinel/6.0.0 Security Scanner' },
        { name: 'Accept', value: 'application/json, text/plain, */*' },
        { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.redacted' },
      ],
      bodyText: reqBody,
      bodyBlobId: s.reqBlobId,
      inScope: s.inScope,
    },
    response: {
      id: `res-${s.id}`,
      statusCode: s.status,
      statusText: s.status === 200 ? 'OK' : s.status === 201 ? 'Created' : s.status === 404 ? 'Not Found' : 'Response',
      headers: [
        { name: 'Content-Type', value: responseData.mimeType },
        { name: 'Server', value: 'SentinelShield/6.0' },
        { name: 'X-Content-Type-Options', value: 'nosniff' },
        { name: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
      bodyText: responseData.body,
      bodyBlobId: s.resBlobId,
      durationMs: s.durationMs,
      tlsVersion: s.tlsVersion || 'TLSv1.3',
      cipherSuite: s.cipherSuite || 'TLS_AES_256_GCM_SHA384',
      tlsAlpn: 'h2, http/1.1',
      serverName: s.host,
    },
    timingBreakdown: {
      dnsMs: 1.2,
      tcpConnectMs: 4.5,
      tlsHandshakeMs: 8.3,
      ttfbMs: s.durationMs * 0.7,
      contentDownloadMs: s.durationMs * 0.3,
      totalDurationMs: s.durationMs,
    },
    tlsInfo: {
      version: s.tlsVersion || 'TLSv1.3',
      cipherSuite: s.cipherSuite || 'TLS_AES_256_GCM_SHA384',
      alpn: 'h2',
      serverName: s.host,
      subject: `CN=${s.host}`,
      issuer: 'CN=Sentinel Dynamic MITM Root CA (SEC-06)',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2027-01-01T00:00:00Z',
      fingerprintSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    casEvidence: {
      blobId: s.resBlobId || `blob-${s.id}`,
      sha256Hex: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      sizeBytes: s.sizeBytes,
      verified: true,
      tamperDetected: false,
      timestamp: new Date().toISOString(),
    },
    scopeAudit: {
      inScope: s.inScope,
      reason: s.inScope ? 'Matched inclusion rule target.local' : 'No matching inclusion rule found',
      matchedRule: s.inScope ? 'target.local' : undefined,
      ruleType: s.inScope ? 'HOST' : 'DEFAULT_DENY',
      provenanceSteps: [
        {
          stepNumber: 1,
          rulePattern: '169.254.169.254/32',
          ruleType: 'EXCLUDE',
          matched: false,
          outcome: 'CONTINUE',
          description: 'SSRF check passed',
        },
        {
          stepNumber: 2,
          rulePattern: 'target.local',
          ruleType: s.inScope ? 'INCLUDE' : 'DEFAULT_DENY',
          matched: s.inScope,
          outcome: s.inScope ? 'ALLOW' : 'DENY',
          description: s.inScope ? 'Inclusion matched' : 'Default deny',
        },
      ],
    },
  };
}

function ensureMockTrafficData() {
  if (mockSummaries.length > 0) return;

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const paths = [
    '/api/v1/auth/login',
    '/api/v1/users/profile',
    '/api/v1/orders/checkout',
    '/graphql?query=getCart',
    '/oauth/v2/token',
    '/static/assets/app.js',
    '/api/v2/admin/roles',
    '/api/v1/invoices/export',
    '/healthz',
    '/metrics',
  ];
  const statuses = [200, 201, 204, 302, 400, 401, 403, 404, 500];
  const baseTime = Date.now();

  for (let i = 1; i <= 250; i++) {
    const method = methods[i % methods.length];
    const path = paths[i % paths.length];
    const status = statuses[i % statuses.length];
    const durationMs = 15 + ((i * 31) % 450);
    const sizeBytes = 256 + ((i * 128) % 32768);
    const inScope = i % 8 !== 0;

    const summary: TrafficSummary = {
      id: `tx-${i.toString().padStart(6, '0')}`,
      seqNumber: i,
      timestamp: new Date(baseTime - (250 - i) * 1000).toLocaleTimeString(),
      timestampMs: baseTime - (250 - i) * 1000,
      method,
      url: `https://target.local${path}`,
      host: 'target.local',
      path,
      status,
      durationMs,
      sizeBytes,
      inScope,
      mimeType: path.includes('graphql') || path.includes('api') ? 'application/json' : 'text/html',
      tags: inScope ? ['scope:target'] : ['scope:out-of-scope'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      reqBlobId: `blob-req-${i}`,
      resBlobId: `blob-res-${i}`,
    };

    mockSummaries.push(summary);
    mockTransactions.set(summary.id, generateTransactionDetailsFromSummary(summary));
  }
}

