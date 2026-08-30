// Strongly typed Protobuf/IPC mappings conforming to architecture/v6/V6_IPC_CONTRACTS.proto

export type SeverityLevel =
  | 'SEVERITY_UNSPECIFIED'
  | 'SEVERITY_INFO'
  | 'SEVERITY_LOW'
  | 'SEVERITY_MEDIUM'
  | 'SEVERITY_HIGH'
  | 'SEVERITY_CRITICAL';

export type FindingLifecycleState =
  | 'LIFECYCLE_UNSPECIFIED'
  | 'LIFECYCLE_CANDIDATE'
  | 'LIFECYCLE_VERIFIED'
  | 'LIFECYCLE_CONFIRMED'
  | 'LIFECYCLE_REPORTED'
  | 'LIFECYCLE_REMEDIATED'
  | 'LIFECYCLE_FALSE_POSITIVE'
  | 'LIFECYCLE_ACCEPTED_RISK'
  | 'LIFECYCLE_REGRESSION';

export type TaskExecutionState =
  | 'TASK_STATE_UNSPECIFIED'
  | 'TASK_STATE_PENDING'
  | 'TASK_STATE_RUNNING'
  | 'TASK_STATE_PAUSED'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELLED';

export interface ProtoTimestamp {
  seconds: number;
  nanos: number;
}

export interface UiTrafficEvent {
  transactionId: string;
  timestamp: ProtoTimestamp;
  method: string;
  uri: string;
  status: number;
  durationMs: number;
  inScope: boolean;
  tags: string[];
  reqHeaders?: Array<{ name: string; value: string }>;
  reqBody?: string;
  resHeaders?: Array<{ name: string; value: string }>;
  resBody?: string;
}

export interface UiFindingEvent {
  findingId: string;
  timestamp: ProtoTimestamp;
  title: string;
  severity: SeverityLevel;
  state: FindingLifecycleState;
}

export interface UiScanProgressEvent {
  scanId: string;
  phase: string;
  percentComplete: number;
}

export interface UiTaskStatusEvent {
  taskId: string;
  state: TaskExecutionState;
  message: string;
}

export interface UiCoverageEvent {
  scopeId: string;
  totalEndpoints: number;
  testedEndpoints: number;
  coveragePercent: number;
}

export interface UiContextEvent {
  endpointId: string;
  technology: string;
  confidence: number;
}

export interface UiScopeViolationEvent {
  requestId: string;
  attemptedUri: string;
  violationReason: string;
  timestamp: ProtoTimestamp;
}

export interface UiCandidateVerifiedEvent {
  candidateId: string;
  verificationId: string;
  strategy: string;
  success: boolean;
  timestamp: ProtoTimestamp;
}

export type SentinelUiEvent =
  | { type: 'traffic'; data: UiTrafficEvent }
  | { type: 'finding'; data: UiFindingEvent }
  | { type: 'scan_progress'; data: UiScanProgressEvent }
  | { type: 'task_status'; data: UiTaskStatusEvent }
  | { type: 'coverage'; data: UiCoverageEvent }
  | { type: 'context'; data: UiContextEvent }
  | { type: 'scope_violation'; data: UiScopeViolationEvent }
  | { type: 'candidate_verified'; data: UiCandidateVerifiedEvent };
