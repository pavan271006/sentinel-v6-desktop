import { create } from 'zustand';
import {
  ScopeRuleDef,
  ScopeDecisionResponse,
} from '../ipc/contracts';
export type { ScopeRuleDef, ScopeDecisionResponse };
import { ipcClient } from '../ipc/client';
import { useAppShellStore } from './appShellStore';
import { useToastStore } from './toastStore';

export interface ScopeViolationRecord {
  id: string;
  timestamp: string;
  uri: string;
  clientIp: string;
  matchedRuleId: string | null;
  reason: string;
  actionTaken: 'DROPPED_PRE_SOCKET' | 'AUDIT_LOGGED';
}

export type ScopePreset = 'standard_web' | 'strict_deny' | 'intranet_ssrf' | 'destructive_exclude';

export interface ScopeStoreState {
  scopeId: string;
  version: number;
  timestamp: string;
  rules: ScopeRuleDef[];
  violations: ScopeViolationRecord[];
  testUrl: string;
  testResult: ScopeDecisionResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  safetyWarningModal: {
    isOpen: boolean;
    targetUri: string;
    actionName: string;
    onConfirm?: () => void;
  };

  // Scope actions
  fetchScope: () => Promise<void>;
  addRule: (
    ruleType: 'INCLUDE' | 'EXCLUDE',
    patternType: ScopeRuleDef['pattern_type'],
    pattern: string,
    notes?: string
  ) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  updateRule: (id: string, updates: Partial<ScopeRuleDef>) => void;
  applyPreset: (preset: ScopePreset) => void;
  saveScope: () => Promise<void>;

  // Evaluator & Provenance actions
  setTestUrl: (url: string) => void;
  evaluateTestUrl: (url?: string) => Promise<ScopeDecisionResponse>;

  // Violation Audit & Safety Gates (SEC-02/SEC-03)
  recordViolation: (violation: Omit<ScopeViolationRecord, 'id'>) => void;
  clearViolations: () => void;
  checkSafetyGate: (targetUri: string, actionName: string, onConfirm: () => void) => boolean;
  closeSafetyWarning: () => void;

  // JSON Import / Export
  exportRulesJson: () => string;
  importRulesJson: (jsonStr: string) => void;
}

const INITIAL_RULES: ScopeRuleDef[] = [
  { id: 'rule-01', rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Primary target domain' },
  { id: 'rule-02', rule_type: 'INCLUDE', pattern_type: 'URL_PREFIX', pattern: 'https://api.target.local/*', enabled: true, notes: 'API endpoints' },
  { id: 'rule-03', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'AWS/GCP metadata SSRF protection (SEC-01)' },
  { id: 'rule-04', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true, notes: 'Internal intranet RFC1918 SSRF guard' },
  { id: 'rule-05', rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '127.0.0.1/32', enabled: true, notes: 'Loopback socket isolation' },
  { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|delete-account|terminate|drop-db).*', enabled: true, notes: 'Destructive endpoint protection' },
];

const INITIAL_VIOLATIONS: ScopeViolationRecord[] = [
  { id: 'viol-01', timestamp: '19:42:10', uri: 'http://169.254.169.254/latest/meta-data/', clientIp: '127.0.0.1', matchedRuleId: 'rule-03', reason: 'SSRF Cloud Metadata Blocked (SEC-01)', actionTaken: 'DROPPED_PRE_SOCKET' },
  { id: 'viol-02', timestamp: '19:44:22', uri: 'http://10.0.1.50:8080/internal-admin', clientIp: '127.0.0.1', matchedRuleId: 'rule-04', reason: 'RFC1918 Private CIDR Out-of-Scope', actionTaken: 'DROPPED_PRE_SOCKET' },
  { id: 'viol-03', timestamp: '19:50:05', uri: 'https://target.local/api/v1/auth/logout', clientIp: '127.0.0.1', matchedRuleId: 'rule-06', reason: 'Destructive Session Invalidation Blocked', actionTaken: 'DROPPED_PRE_SOCKET' },
];

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
        const host = extractHost(clean);
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

let cachedRulesRef: ScopeRuleDef[] | null = null;
let cachedRulesLength = 0;
let cachedPartitioned: PartitionedRules | null = null;

function getPartitionedRules(rules: ScopeRuleDef[]): PartitionedRules {
  if (rules === cachedRulesRef && rules.length === cachedRulesLength && cachedPartitioned !== null) {
    return cachedPartitioned;
  }
  cachedRulesRef = rules;
  cachedRulesLength = rules.length;
  cachedPartitioned = partitionRules(rules);
  return cachedPartitioned;
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

function extractHost(urlStr: string): string {
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

export const useScopeStore = create<ScopeStoreState>((set, get) => ({
  scopeId: 'scope-default-001',
  version: 1,
  timestamp: new Date().toISOString(),
  rules: INITIAL_RULES,
  violations: INITIAL_VIOLATIONS,
  testUrl: 'https://target.local/api/v1/users',
  testResult: null,
  isLoading: false,
  isSaving: false,
  safetyWarningModal: {
    isOpen: false,
    targetUri: '',
    actionName: '',
  },

  fetchScope: async () => {
    try {
      set({ isLoading: true });
      const scope = await ipcClient.getScope();
      set({
        scopeId: scope.id,
        version: scope.version,
        timestamp: scope.timestamp,
        rules: scope.rules || INITIAL_RULES,
        isLoading: false,
      });
      useAppShellStore.getState().setScopeRulesCount(
        (scope.rules || INITIAL_RULES).filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
      );
    } catch (err) {
      set({ isLoading: false });
      console.error('[ScopeStore] fetchScope error:', err);
    }
  },

  addRule: (ruleType, patternType, pattern, notes) => {
    const trimmed = pattern.trim();
    if (!trimmed) return;

    const newRule: ScopeRuleDef = {
      id: `rule-${Date.now().toString(36)}`,
      rule_type: ruleType,
      pattern_type: patternType,
      pattern: trimmed,
      enabled: true,
      notes: notes || (ruleType === 'INCLUDE' ? 'Inclusion target boundary' : 'Exclusion constraint (SEC-01)'),
    };

    const updated = [...get().rules, newRule];
    set({ rules: updated });
    useAppShellStore.getState().setScopeRulesCount(
      updated.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
    );
    useToastStore.getState().addToast({
      type: 'success',
      title: `Added ${ruleType} rule`,
      description: `${trimmed} (${patternType})`,
    });
  },

  deleteRule: (id: string) => {
    const updated = get().rules.filter((r) => r.id !== id);
    set({ rules: updated });
    useAppShellStore.getState().setScopeRulesCount(
      updated.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
    );
    useToastStore.getState().addToast({
      type: 'info',
      title: 'Scope rule removed',
    });
  },

  toggleRule: (id: string) => {
    const updated = get().rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    set({ rules: updated });
    useAppShellStore.getState().setScopeRulesCount(
      updated.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
    );
  },

  updateRule: (id: string, updates: Partial<ScopeRuleDef>) => {
    const updated = get().rules.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    );
    set({ rules: updated });
    useAppShellStore.getState().setScopeRulesCount(
      updated.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
    );
  },

  applyPreset: (preset: ScopePreset) => {
    let presetRules: ScopeRuleDef[] = [];
    switch (preset) {
      case 'standard_web':
        presetRules = [
          { id: `rule-${Date.now()}-1`, rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: 'target.local', enabled: true, notes: 'Standard web host' },
          { id: `rule-${Date.now()}-2`, rule_type: 'INCLUDE', pattern_type: 'HOST', pattern: '*.target.local', enabled: true, notes: 'Subdomain wildcard' },
          { id: `rule-${Date.now()}-3`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'SSRF Cloud metadata' },
          { id: `rule-${Date.now()}-4`, rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout).*', enabled: true, notes: 'Session preservation' },
        ];
        break;
      case 'strict_deny':
        presetRules = [
          { id: `rule-${Date.now()}-1`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '0.0.0.0/0', enabled: true, notes: 'Total network deny' },
        ];
        break;
      case 'intranet_ssrf':
        presetRules = [
          { id: `rule-${Date.now()}-1`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '10.0.0.0/8', enabled: true, notes: 'RFC1918 10/8' },
          { id: `rule-${Date.now()}-2`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '172.16.0.0/12', enabled: true, notes: 'RFC1918 172.16/12' },
          { id: `rule-${Date.now()}-3`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '192.168.0.0/16', enabled: true, notes: 'RFC1918 192.168/16' },
          { id: `rule-${Date.now()}-4`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '169.254.169.254/32', enabled: true, notes: 'AWS metadata' },
          { id: `rule-${Date.now()}-5`, rule_type: 'EXCLUDE', pattern_type: 'IP_CIDR', pattern: '127.0.0.1/32', enabled: true, notes: 'Loopback IPv4' },
        ];
        break;
      case 'destructive_exclude':
        presetRules = [
          { id: `rule-${Date.now()}-1`, rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*[/\\.](logout|signout|invalidate|delete-account|terminate|drop-db).*', enabled: true, notes: 'Destructive endpoint regex pattern' },
        ];
        break;
    }

    const merged = [...get().rules, ...presetRules];
    set({ rules: merged });
    useAppShellStore.getState().setScopeRulesCount(
      merged.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
    );
    useToastStore.getState().addToast({
      type: 'success',
      title: `Applied preset: ${preset.replace('_', ' ').toUpperCase()}`,
      description: `Added ${presetRules.length} policy rules`,
    });
  },

  saveScope: async () => {
    try {
      set({ isSaving: true });
      const rules = get().rules;
      const includes = rules.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).map((r) => r.pattern);
      const excludes = rules.filter((r) => r.rule_type === 'EXCLUDE' && r.enabled).map((r) => r.pattern);

      const resp = await ipcClient.updateScope(includes, excludes, rules);
      set({
        scopeId: resp.id,
        version: resp.version,
        timestamp: resp.timestamp,
        isSaving: false,
      });

      useToastStore.getState().addToast({
        type: 'success',
        title: 'Scope Policy Persisted',
        description: `Version ${resp.version} synchronized to SQLite storage`,
      });
    } catch (err) {
      set({ isSaving: false });
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to save scope',
        description: String(err),
      });
    }
  },

  setTestUrl: (url: string) => {
    set({ testUrl: url });
  },

  evaluateTestUrl: async (targetUrl?: string) => {
    const uri = targetUrl || get().testUrl;
    try {
      const decision = await ipcClient.testScopeUri(uri);
      set({ testResult: decision });
      return decision;
    } catch (err) {
      const fallback: ScopeDecisionResponse = {
        in_scope: false,
        reason: `Evaluation failed: ${String(err)}`,
        matched_rule: null,
        rule_type: 'DEFAULT_DENY',
      };
      set({ testResult: fallback });
      return fallback;
    }
  },

  recordViolation: (v) => {
    const record: ScopeViolationRecord = {
      ...v,
      id: `viol-${Date.now().toString(36)}`,
    };
    set((state) => ({
      violations: [record, ...state.violations].slice(0, 500),
    }));
  },

  clearViolations: () => {
    set({ violations: [] });
    useToastStore.getState().addToast({
      type: 'info',
      title: 'Violation audit log cleared',
    });
  },

  checkSafetyGate: (targetUri: string, actionName: string, onConfirm: () => void) => {
    const uri = targetUri.trim();
    if (!uri) return false;

    // Check SSRF
    if (
      uri.includes('169.254.169.254') ||
      uri.includes('169.254.') ||
      uri.includes('[::ffff:169.254.') ||
      uri.includes('[::FFFF:169.254.') ||
      uri.includes('0.0.0.0') ||
      uri.includes('127.0.0.1') ||
      uri.includes('[::1]')
    ) {
      set({
        safetyWarningModal: { isOpen: true, targetUri: uri, actionName, onConfirm },
      });
      return false;
    }

    const partitioned = getPartitionedRules(get().rules);
    const targetHostname = extractHost(uri);
    const hostInt = ipv4ToInt(targetHostname);

    // 1. STRICT EXCLUDE PRECEDENCE (SEC-01): If ANY exclude rule matches -> IMMEDIATE DENY
    const matchedExclude = evaluateBucket(partitioned.excludes, uri, targetHostname, hostInt);
    if (matchedExclude) {
      const curr = get().safetyWarningModal;
      if (!curr.isOpen || curr.targetUri !== uri || curr.actionName !== actionName) {
        set({
          safetyWarningModal: { isOpen: true, targetUri: uri, actionName, onConfirm },
        });
      }
      return false;
    }

    // 2. INCLUDE RULES: If an include rule matches -> ALLOW
    const matchedInclude = evaluateBucket(partitioned.includes, uri, targetHostname, hostInt);
    if (matchedInclude) {
      onConfirm();
      return true;
    }

    // 3. DEFAULT DENY: Out-of-scope targets trigger safety warning modal
    const curr = get().safetyWarningModal;
    if (!curr.isOpen || curr.targetUri !== uri || curr.actionName !== actionName) {
      set({
        safetyWarningModal: { isOpen: true, targetUri: uri, actionName, onConfirm },
      });
    }
    return false;
  },

  closeSafetyWarning: () => {
    set({
      safetyWarningModal: {
        isOpen: false,
        targetUri: '',
        actionName: '',
      },
    });
  },

  exportRulesJson: () => {
    return JSON.stringify(get().rules, null, 2);
  },

  importRulesJson: (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr) as ScopeRuleDef[];
      if (!Array.isArray(parsed)) throw new Error('Root JSON must be an array of rules');
      set({ rules: parsed });
      useAppShellStore.getState().setScopeRulesCount(
        parsed.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
      );
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Scope Rules Imported',
        description: `Loaded ${parsed.length} rules from JSON`,
      });
    } catch (err) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'JSON Import Error',
        description: String(err),
      });
    }
  },
}));
