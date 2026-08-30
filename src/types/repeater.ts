import { HttpHeaderItem, TimingBreakdown, TlsCertificateDetails, CasEvidenceData, HttpResponseDetails } from './traffic';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT';
export type HttpProtocol = 'HTTP/1.1' | 'HTTP/2';
export type RequestEditorMode = 'pretty' | 'raw' | 'hex' | 'headers' | 'params' | 'body' | 'auth';
export type ResponseViewerMode = 'pretty' | 'raw' | 'hex' | 'preview' | 'parsed' | 'tree' | 'tls' | 'diff';
export type RequestBodyType = 'raw' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'binary';

export interface QueryParamItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HeaderRowItem {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
}

export interface RepeaterRevisionItem {
  revisionId: string;
  revisionNumber: number;
  timestamp: string;
  timestampMs: number;
  method: HttpMethod;
  url: string;
  requestRaw: string;
  requestHeaders: HttpHeaderItem[];
  requestBody: string;
  responseRaw?: string;
  responseHeaders?: HttpHeaderItem[];
  responseBody?: string;
  statusCode?: number;
  statusText?: string;
  durationMs: number;
  sizeBytes: number;
  tlsInfo?: TlsCertificateDetails;
  timingBreakdown?: TimingBreakdown;
  casEvidence?: CasEvidenceData;
  error?: string;
  isBaseline?: boolean;
}

export interface RepeaterTabState {
  id: string;
  title: string;
  color?: string;
  isDirty: boolean;

  // Request Configuration
  method: HttpMethod;
  url: string;
  protocol: HttpProtocol;
  headers: HeaderRowItem[];
  queryParams: QueryParamItem[];
  body: string;
  bodyType: RequestBodyType;
  rawRequest: string;
  rawMode: boolean;
  autoContentLength: boolean;
  followRedirects: boolean;
  maxRedirects: number;
  timeoutMs: number;

  // Dynamic Variables
  localVariables: Record<string, string>;

  // Execution & History
  history: RepeaterRevisionItem[];
  activeRevisionIndex: number;
  baselineRevisionIndex: number | null;
  isExecuting: boolean;
  abortController: AbortController | null;
  lastExecutionOutput?: RepeaterRevisionItem;

  // View States
  requestViewMode: RequestEditorMode;
  responseViewMode: ResponseViewerMode;

  createdAt: string;
  updatedAt: string;
}

export interface RepeaterVariable {
  key: string;
  value: string;
  scope: 'global' | 'tab';
  tabId?: string;
  description?: string;
  extractedFrom?: {
    type: 'json' | 'header' | 'regex';
    path: string;
  };
}

export interface RepeaterSendRequestPayload {
  tabId: string;
  targetUrl?: string;
  rawRequest: string;
  envVars?: Record<string, string>;
  interpolate?: boolean;
}

export interface RepeaterExecutionResult {
  tabId: string;
  revisionId: string;
  statusCode?: number;
  statusText: string;
  durationMs: number;
  rawResponse: string;
  parsedResponse?: HttpResponseDetails;
  headers: HttpHeaderItem[];
  body: string;
  timingBreakdown: TimingBreakdown;
  tlsInfo?: TlsCertificateDetails;
  observationId?: string;
  casHash?: string;
  casReqHash?: string;
  casResHash?: string;
  inScope: boolean;
  sizeBytes?: number;
  error?: string;
}

export interface RepeaterDiffRequest {
  tabId: string;
  revAIndex: number;
  revBIndex: number;
  diffTarget?: 'response_body' | 'request_body' | 'full_response' | 'headers';
}

export interface RepeaterExportPayload {
  rawRequest: string;
  targetUrl: string;
  format: 'curl' | 'python' | 'javascript' | 'powershell';
}

export interface VariableExtractPayload {
  sourceType: 'json' | 'header';
  sourceText: string;
  expression: string;
  variableName: string;
}
