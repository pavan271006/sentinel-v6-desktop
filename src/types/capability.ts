export type CapabilityStatus =
  | 'BACKEND_IMPLEMENTED'
  | 'BACKEND_PARTIAL'
  | 'BACKEND_EXPERIMENTAL'
  | 'BACKEND_DEFERRED'
  | 'BACKEND_UNAVAILABLE';

export interface SubsystemCapability {
  subsystemId: string;
  name: string;
  cratePath: string;
  status: CapabilityStatus;
  primaryApi: string;
  description: string;
  testEvidence?: string;
  explanationIfUnavailable?: string;
}
