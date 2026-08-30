/**
 * Compact scalar summary item for high-density virtual table and indexing.
 * Memory footprint: ~120 bytes. 100,000 items = ~12MB.
 */
export interface TrafficSummary {
  id: string;
  seqNumber: number;
  timestamp: string;
  timestampMs: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  inScope: boolean;
  mimeType: string;
  tags: string[];
  hasFinding?: boolean;
  tlsVersion?: string;
  cipherSuite?: string;
  reqBlobId?: string;
  resBlobId?: string;
  reqHeaders?: HttpHeaderItem[];
  reqBody?: string;
  resHeaders?: HttpHeaderItem[];
  resBody?: string;
}

/**
 * HTTP Header representation.
 */
export interface HttpHeaderItem {
  name: string;
  value: string;
}

/**
 * Detailed Request information.
 */
export interface HttpRequestDetails {
  id: string;
  timestamp?: string;
  method: string;
  url: string;
  protocol: string;
  headers: HttpHeaderItem[];
  bodyBlobId?: string;
  bodyText?: string;
  bodyBytes?: Uint8Array | string;
  rawBlobId?: string;
  rawText?: string;
  inScope: boolean;
}

/**
 * Detailed Response information.
 */
export interface HttpResponseDetails {
  id: string;
  statusCode: number;
  statusText: string;
  headers: HttpHeaderItem[];
  bodyBlobId?: string;
  bodyText?: string;
  bodyBytes?: Uint8Array | string;
  rawBlobId?: string;
  rawText?: string;
  durationMs: number;
  tlsVersion?: string;
  cipherSuite?: string;
  tlsAlpn?: string;
  serverName?: string;
}

/**
 * Detailed timing breakdown for connection & transfer lifecycle.
 */
export interface TimingBreakdown {
  dnsMs?: number;
  tcpConnectMs?: number;
  tlsHandshakeMs?: number;
  ttfbMs: number;
  contentDownloadMs: number;
  totalDurationMs: number;
}

/**
 * TLS / Certificate security audit details.
 */
export interface TlsCertificateDetails {
  version: string;
  cipherSuite: string;
  alpn?: string;
  serverName?: string;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  fingerprintSha256?: string;
  sanList?: string[];
}

/**
 * CAS (Content-Addressed Storage) evidence verification data (SEC-06, SEC-07).
 */
export interface CasEvidenceData {
  blobId: string;
  sha256Hex: string;
  sizeBytes: number;
  verified: boolean;
  tamperDetected: boolean;
  casStoragePath?: string;
  timestamp: string;
}

/**
 * Scope provenance step for SEC-01 audit.
 */
export interface ScopeAuditStep {
  stepNumber: number;
  ruleId?: string;
  rulePattern: string;
  ruleType: 'EXCLUDE' | 'INCLUDE' | 'SSRF_PRESET' | 'DEFAULT_DENY';
  matched: boolean;
  outcome: 'DENY' | 'ALLOW' | 'CONTINUE';
  description: string;
}

/**
 * Scope audit verification proof.
 */
export interface ScopeAuditProof {
  inScope: boolean;
  reason: string;
  matchedRule?: string;
  ruleType?: string;
  provenanceSteps: ScopeAuditStep[];
}

/**
 * Full transaction detail model.
 */
export interface TransactionDetails {
  id: string;
  timestamp: string;
  timingMs: number;
  provenance: 'Proxy' | 'Scanner' | 'Fuzzer' | 'Repeater' | 'Manual' | 'AI';
  lifecycle?: string;
  scopeId?: string;
  request: HttpRequestDetails;
  response?: HttpResponseDetails;
  timingBreakdown?: TimingBreakdown;
  tlsInfo?: TlsCertificateDetails;
  casEvidence?: CasEvidenceData;
  scopeAudit?: ScopeAuditProof;
}

/**
 * Pagination query parameters for backend traffic retrieval.
 */
export interface TrafficPageQuery {
  offset: number;
  limit: number;
  filterHttpql?: string;
  sortField?: 'timestamp' | 'method' | 'status' | 'duration_ms' | 'size_bytes';
  sortOrder?: 'asc' | 'desc';
  inScopeOnly?: boolean;
}

/**
 * Result of a paginated traffic query.
 */
export interface TrafficPageResult {
  items: TrafficSummary[];
  totalCount: number;
  filteredCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Raw binary payload retrieval result (SEC-07 verified).
 */
export interface RawBlobResult {
  blobId: string;
  sha256Hex: string;
  sizeBytes: number;
  dataBase64: string;
  isTruncated: boolean;
  mimeType: string;
}

/**
 * Traffic history clear result.
 */
export interface TrafficClearResult {
  clearedCount: number;
  success: boolean;
  timestamp: string;
}

/**
 * Transaction Diff Request.
 */
export interface TrafficDiffRequest {
  idA: string;
  idB: string;
  diffTarget?: 'response_body' | 'response_headers' | 'request_body' | 'full';
}

/**
 * Header differential item.
 */
export interface HeaderDiffItem {
  name: string;
  kind: 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'MODIFIED';
  originalValue?: string;
  newValue?: string;
}

/**
 * Line differential item.
 */
export interface LineDiffItem {
  kind: 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'MODIFIED';
  originalLineNum?: number;
  newLineNum?: number;
  content: string;
}

/**
 * Transaction Diff Result.
 */
export interface TrafficDiffResult {
  transactionAId: string;
  transactionBId: string;
  statusDelta?: [number, number];
  durationDeltaMs?: [number, number];
  sizeDeltaBytes: [number, number];
  headerDiffs: HeaderDiffItem[];
  bodyLineDiffs: LineDiffItem[];
  similarityScore: number;
  hasDivergence: boolean;
}

/**
 * Quick filter presets.
 */
export type QuickFilterPreset =
  | 'all'
  | 'in_scope'
  | 'errors_only'
  | 'methods_mutating'
  | 'media_json'
  | 'media_html'
  | 'media_bin';

/**
 * Traffic filter state.
 */
export interface TrafficFilterState {
  scopeOnly: boolean;
  errorsOnly: boolean;
  methods: string[];
  statuses: Array<'2xx' | '3xx' | '4xx' | '5xx'>;
  mimes: string[];
  activePreset: QuickFilterPreset;
}
