// Strongly typed IPC command signatures for Sentinel V6

export interface PlatformInfoResponse {
  version: string;
  os: string;
  arch: string;
  capabilities: Array<{
    subsystem_id: string;
    name: string;
    status: string;
    description: string;
  }>;
}

export interface AppStatusResponse {
  proxy_running: boolean;
  proxy_port: number;
  active_project: string | null;
  db_size_bytes: number;
  memory_rss_bytes: number;
  ipc_latency_ms: number;
  scope_active: boolean;
  scope_rules_count: number;
  backend_version: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  path: string;
  db_size_bytes: number;
  created_at: string;
  updated_at: string;
  scope_rules_count: number;
  transaction_count: number;
  finding_count: number;
  wal_journal_mode: string;
  is_clean_shutdown: boolean;
}

export interface RecentProjectInfo {
  id: string;
  name: string;
  path: string;
  last_opened: string;
  size_bytes: number;
  scope_rules_count: number;
  finding_count: number;
  pinned: boolean;
}

export interface ScopeRuleDef {
  id: string;
  rule_type: 'INCLUDE' | 'EXCLUDE';
  pattern_type: 'HOST' | 'URL_PREFIX' | 'IP_CIDR' | 'REGEX' | 'WILDCARD';
  pattern: string;
  enabled: boolean;
  notes?: string;
}

export interface ScopeResponse {
  id: string;
  version: number;
  timestamp: string;
  includes: string[];
  excludes: string[];
  rules?: ScopeRuleDef[];
}

export interface ProjectState {
  metadata: ProjectMetadata;
  scope: ScopeResponse;
}

export interface ScopeEvaluationStep {
  step_number: number;
  rule_id?: string;
  rule_pattern: string;
  rule_type: 'EXCLUDE' | 'INCLUDE' | 'SSRF_PRESET' | 'DEFAULT_DENY';
  matched: boolean;
  outcome: 'DENY' | 'ALLOW' | 'CONTINUE';
  description: string;
}

export interface ScopeDecisionResponse {
  in_scope: boolean;
  reason: string;
  matched_rule: string | null;
  rule_type?: string | null;
  provenance_steps?: ScopeEvaluationStep[];
}

export interface ProjectExportResult {
  success: boolean;
  archive_path: string;
  file_count: number;
  total_bytes: number;
  sha256_checksum: string;
}

export interface ProjectImportResult {
  success: boolean;
  metadata: ProjectMetadata;
}

export interface WalStatusResult {
  journal_mode: string;
  page_count: number;
  page_size: number;
  freelist_count: number;
  checkpoint_applied: boolean;
}

export interface CommandSearchItem {
  id: string;
  title: string;
  category: string;
  shortcut: string | null;
  action: string;
}

// ==========================================
// Phase UI-3 Traffic IPC Command Contracts
// ==========================================

export * from '../types/traffic';
export * from '../types/httpql';
export * from '../types/repeater';


