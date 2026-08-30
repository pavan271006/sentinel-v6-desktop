
export interface HttpHeader {
  name: string;
  value: string;
}

export interface HttpRequestData {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  protocol: string;
  headers: HttpHeader[];
  bodyBytes?: Uint8Array | string;
  raw?: string;
  inScope: boolean;
}

export interface HttpResponseData {
  id: string;
  statusCode: number;
  statusText: string;
  headers: HttpHeader[];
  bodyBytes?: Uint8Array | string;
  raw?: string;
  durationMs: number;
  tlsVersion?: string;
  cipherSuite?: string;
}

export interface TransactionModel {
  id: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  inScope: boolean;
  mimeType: string;
  timestamp: string;
  tags: string[];
  request?: HttpRequestData;
  response?: HttpResponseData;
}

export interface FindingModel {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  state: 'candidate' | 'verified' | 'confirmed' | 'reported' | 'remediated' | 'false_positive';
  endpoint: string;
  cweId?: string;
  cvssScore?: number;
  timestamp: string;
  evidenceCasHash?: string;
}

export interface ScopeRuleModel {
  id: string;
  ruleType: 'include' | 'exclude';
  patternType: 'wildcard' | 'regex' | 'cidr' | 'prefix';
  value: string;
  enabled: boolean;
  comment?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  source: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface DiffLine {
  type: 'equal' | 'add' | 'remove';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  similarityScore: number;
}
