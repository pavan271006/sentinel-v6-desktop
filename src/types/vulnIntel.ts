export type AdvisorySource = 'NVD' | 'CISA_KEV' | 'GHSA' | 'OSV' | 'VENDOR';

export type VulnerabilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface CvssV3Data {
  baseScore: number;
  vectorString: string;
  attackVector?: string;
  attackComplexity?: string;
  privilegesRequired?: string;
  userInteraction?: string;
  scope?: string;
  confidentialityImpact?: string;
  integrityImpact?: string;
  availabilityImpact?: string;
}

export interface CvssV4Data {
  baseScore: number;
  vectorString: string;
}

export interface EpssData {
  score: number;       // 0.00000 to 1.00000
  percentile: number;  // 0.00000 to 1.00000
}

export interface CpeMatchCriteria {
  criteria: string;
  vulnerable: boolean;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

export interface AffectedPackage {
  ecosystem: string;
  name: string;
  vulnerableRanges: string[];
  fixedVersion?: string;
}

export interface CanonicalVulnerabilityAdvisory {
  id: string; // e.g. "CVE-2024-3094", "CVE-2021-44228"
  source: AdvisorySource;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  severity: VulnerabilitySeverity;
  cvssV3?: CvssV3Data;
  cvssV4?: CvssV4Data;
  epss?: EpssData;
  isKev: boolean;
  kevDueDate?: string;
  cpeMatches: string[];
  affectedPackages: AffectedPackage[];
  cweIds: string[];
  references: string[];
  ruleRegistryRef?: string;
  remediationAdvice: string;
}

export interface TargetTechnology {
  name: string;
  version?: string;
  confidence: number; // 0.00 to 1.00
  evidence: Array<{
    sourceType: 'PASSIVE_HEADER' | 'DOM_SIGNATURE' | 'STATIC_ASSET_HASH' | 'BEHAVIORAL_PROBE';
    weight: number;
    matchQuality: number;
    identifier: string;
    details: string;
  }>;
}

export type VerificationStageStatus =
  | 'IDLE'
  | 'CANDIDATE'
  | 'PRECONDITION'
  | 'PROBING'
  | 'VERIFIED'
  | 'NOT_VULNERABLE'
  | 'FAILED';

export interface VerificationProgress {
  cveId: string;
  targetUrl: string;
  stage: VerificationStageStatus;
  log: string[];
  casHash?: string;
  findingId?: string;
  timestamp: string;
}

export interface VulnerabilityRule {
  id: string;
  cveId: string;
  title: string;
  category: string;
  severity: VulnerabilitySeverity;
  cvssScore: number;
  isKev: boolean;
  cpeMatches: string[];
  technologyPrerequisites: Array<{
    name: string;
    confidenceThreshold: number;
  }>;
  safeProbe: {
    method: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
    nonDestructive: boolean;
  };
  verification: {
    type: 'HTTP_STATUS_AND_BODY' | 'HTTP_DIFFERENTIAL_RESPONSE' | 'OAST_CALLBACK' | 'TIMING_STATISTICAL' | 'DYNAMIC_SYMBOL_VERIFICATION' | 'HTTP_BODY_EXACT';
    expectedStatus?: number;
    bodyRegex?: string;
    exactPattern?: string;
    oastProtocol?: string;
    casProofRequired: boolean;
  };
  remediation: {
    guidance: string;
    fixedVersion?: string;
  };
}
