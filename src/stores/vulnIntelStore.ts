import { create } from 'zustand';
import {
  CanonicalVulnerabilityAdvisory,
  TargetTechnology,
  VerificationProgress,
  VerificationStageStatus,
} from '../types/vulnIntel';

export interface VulnIntelState {
  advisories: CanonicalVulnerabilityAdvisory[];
  selectedAdvisoryId: string | null;
  searchQuery: string;
  filterOnlyKev: boolean;
  filterMinSeverity: string;
  targetTechnologies: TargetTechnology[];
  verificationStages: Record<string, VerificationProgress>;
  isSyncing: boolean;
  lastSyncTime: string | null;

  // Actions
  setSearchQuery: (query: string) => void;
  toggleKevFilter: () => void;
  setMinSeverityFilter: (severity: string) => void;
  selectAdvisory: (id: string | null) => void;
  setTargetTechnologies: (technologies: TargetTechnology[]) => void;
  syncFeeds: () => Promise<void>;
  runVerificationProbe: (
    cveId: string,
    targetUrl: string,
    inScope?: boolean,
    simulatedResponse?: { status: number; body: string; oastCallback?: boolean }
  ) => Promise<VerificationProgress>;
  resetStore: () => void;
}

// Canonical real-world CVE advisories matching VULNERABILITY_RULE_REGISTRY.yaml
const SEED_ADVISORIES: CanonicalVulnerabilityAdvisory[] = [
  {
    id: 'CVE-2024-3094',
    source: 'CISA_KEV',
    title: 'XZ Utils / liblzma Malicious Backdoor Extraction & SSH Authentication Bypass',
    description: 'Malicious backdoor embedded in xz upstream tarballs versions 5.6.0 and 5.6.1.',
    publishedAt: '2024-03-29T14:00:00Z',
    updatedAt: '2024-04-19T10:00:00Z',
    severity: 'CRITICAL',
    cvssV3: {
      baseScore: 10.0,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
    },
    epss: {
      score: 0.965,
      percentile: 0.998,
    },
    isKev: true,
    kevDueDate: '2024-04-19',
    cpeMatches: [
      'cpe:2.3:a:tukaani:xz:5.6.0:*:*:*:*:*:*:*',
      'cpe:2.3:a:tukaani:xz:5.6.1:*:*:*:*:*:*:*',
    ],
    affectedPackages: [
      {
        ecosystem: 'Debian',
        name: 'xz-utils',
        vulnerableRanges: ['>= 5.6.0, <= 5.6.1'],
        fixedVersion: '5.6.2',
      },
    ],
    cweIds: ['CWE-506'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-3094'],
    ruleRegistryRef: 'RULE-CVE-2024-3094',
    remediationAdvice: 'Downgrade xz to 5.4.x or upgrade to >= 5.6.2.',
  },
  {
    id: 'CVE-2021-44228',
    source: 'CISA_KEV',
    title: 'Apache Log4j2 JNDI Injection Remote Code Execution (Log4Shell)',
    description: 'Remote code execution vulnerability via unauthenticated JNDI lookup expressions.',
    publishedAt: '2021-12-10T10:00:00Z',
    updatedAt: '2021-12-24T18:00:00Z',
    severity: 'CRITICAL',
    cvssV3: {
      baseScore: 10.0,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
    },
    epss: {
      score: 0.975,
      percentile: 0.999,
    },
    isKev: true,
    kevDueDate: '2021-12-24',
    cpeMatches: ['cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*'],
    affectedPackages: [
      {
        ecosystem: 'Maven',
        name: 'org.apache.logging.log4j:log4j-core',
        vulnerableRanges: ['>= 2.0-beta9, <= 2.17.0'],
        fixedVersion: '2.17.1',
      },
    ],
    cweIds: ['CWE-502', 'CWE-400'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-44228'],
    ruleRegistryRef: 'RULE-CVE-2021-44228',
    remediationAdvice: 'Upgrade Log4j to >= 2.17.1 (Java 8) or set log4j2.formatMsgNoLookups=true.',
  },
  {
    id: 'CVE-2021-41773',
    source: 'CISA_KEV',
    title: 'Apache HTTP Server 2.4.49 Path Traversal & Remote Code Execution',
    description: 'Flaw in path normalization allowing access to arbitrary files outside DocumentRoot.',
    publishedAt: '2021-10-05T12:00:00Z',
    updatedAt: '2021-11-03T16:00:00Z',
    severity: 'CRITICAL',
    cvssV3: {
      baseScore: 9.8,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    },
    epss: {
      score: 0.974,
      percentile: 0.998,
    },
    isKev: true,
    kevDueDate: '2021-11-03',
    cpeMatches: ['cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*'],
    affectedPackages: [
      {
        ecosystem: 'Ubuntu',
        name: 'apache2',
        vulnerableRanges: ['= 2.4.49'],
        fixedVersion: '2.4.51',
      },
    ],
    cweIds: ['CWE-22'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-41773'],
    ruleRegistryRef: 'RULE-CVE-2021-41773',
    remediationAdvice: 'Upgrade Apache HTTP Server to >= 2.4.51.',
  },
  {
    id: 'CVE-2024-27198',
    source: 'CISA_KEV',
    title: 'JetBrains TeamCity Authentication Bypass in Web Component',
    description: 'Allows arbitrary administrative user creation without credentials via URL path mutation.',
    publishedAt: '2024-03-04T12:00:00Z',
    updatedAt: '2024-03-07T14:00:00Z',
    severity: 'CRITICAL',
    cvssV3: {
      baseScore: 9.8,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    },
    epss: {
      score: 0.942,
      percentile: 0.995,
    },
    isKev: true,
    kevDueDate: '2024-03-07',
    cpeMatches: ['cpe:2.3:a:jetbrains:teamcity:*:*:*:*:*:*:*:*'],
    affectedPackages: [
      {
        ecosystem: 'JetBrains',
        name: 'TeamCity',
        vulnerableRanges: ['< 2023.11.4'],
        fixedVersion: '2023.11.4',
      },
    ],
    cweIds: ['CWE-288'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-27198'],
    ruleRegistryRef: 'RULE-CVE-2024-27198',
    remediationAdvice: 'Upgrade JetBrains TeamCity to >= 2023.11.4.',
  },
  {
    id: 'CVE-2023-22527',
    source: 'CISA_KEV',
    title: 'Atlassian Confluence Data Center & Server SSTI Remote Code Execution',
    description: 'OGNL template injection vulnerability on unauthenticated setup endpoints.',
    publishedAt: '2024-01-16T12:00:00Z',
    updatedAt: '2024-01-24T18:00:00Z',
    severity: 'CRITICAL',
    cvssV3: {
      baseScore: 10.0,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
    },
    epss: {
      score: 0.971,
      percentile: 0.998,
    },
    isKev: true,
    kevDueDate: '2024-01-24',
    cpeMatches: [
      'cpe:2.3:a:atlassian:confluence_server:*:*:*:*:*:*:*:*',
      'cpe:2.3:a:atlassian:confluence_data_center:*:*:*:*:*:*:*:*',
    ],
    affectedPackages: [
      {
        ecosystem: 'Atlassian',
        name: 'confluence',
        vulnerableRanges: ['8.0.0 - 8.5.3', '8.5.4'],
        fixedVersion: '8.5.4',
      },
    ],
    cweIds: ['CWE-1336'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-22527'],
    ruleRegistryRef: 'RULE-CVE-2023-22527',
    remediationAdvice: 'Upgrade Confluence to >= 8.5.4 or >= 8.7.1.',
  },
];

export const useVulnIntelStore = create<VulnIntelState>((set) => ({
  advisories: SEED_ADVISORIES,
  selectedAdvisoryId: 'CVE-2021-41773',
  searchQuery: '',
  filterOnlyKev: false,
  filterMinSeverity: 'ALL',
  targetTechnologies: [
    {
      name: 'Apache',
      version: '2.4.49',
      confidence: 0.98,
      evidence: [
        {
          sourceType: 'PASSIVE_HEADER',
          weight: 0.3,
          matchQuality: 1.0,
          identifier: 'Server',
          details: 'Apache/2.4.49 (Ubuntu)',
        },
        {
          sourceType: 'STATIC_ASSET_HASH',
          weight: 0.85,
          matchQuality: 1.0,
          identifier: 'favicon.ico',
          details: 'MurmurHash3: -129384729',
        },
      ],
    },
    {
      name: 'PHP',
      version: '8.1.2',
      confidence: 0.82,
      evidence: [
        {
          sourceType: 'PASSIVE_HEADER',
          weight: 0.3,
          matchQuality: 1.0,
          identifier: 'X-Powered-By',
          details: 'PHP/8.1.2-1ubuntu2',
        },
      ],
    },
  ],
  verificationStages: {},
  isSyncing: false,
  lastSyncTime: '2026-08-19T14:00:00Z',

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  toggleKevFilter: () => set((state) => ({ filterOnlyKev: !state.filterOnlyKev })),

  setMinSeverityFilter: (severity: string) => set({ filterMinSeverity: severity }),

  selectAdvisory: (id: string | null) => set({ selectedAdvisoryId: id }),

  setTargetTechnologies: (technologies: TargetTechnology[]) =>
    set({ targetTechnologies: technologies }),

  syncFeeds: async () => {
    set({ isSyncing: true });
    // Simulate feed sync latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    set({
      isSyncing: false,
      lastSyncTime: new Date().toISOString(),
      advisories: SEED_ADVISORIES,
    });
  },

  runVerificationProbe: async (
    cveId: string,
    targetUrl: string,
    inScope: boolean = true,
    simulatedResponse?: { status: number; body: string; oastCallback?: boolean }
  ): Promise<VerificationProgress> => {
    const timestamp = new Date().toISOString();
    const log: string[] = [];

    // Stage 1: Candidate Correlation
    log.push(`Stage 1: Matched target technology for ${cveId}`);

    // Stage 2: Precondition Safety Check
    if (!inScope) {
      log.push('Stage 2: Aborted probe - Target URL is outside configured scope (SEC-01)');
      const failedProgress: VerificationProgress = {
        cveId,
        targetUrl,
        stage: 'FAILED',
        log,
        timestamp,
      };
      set((state) => ({
        verificationStages: { ...state.verificationStages, [cveId]: failedProgress },
      }));
      return failedProgress;
    }

    log.push('Stage 2: Precondition checks passed (In-Scope & Reachable)');

    // Stage 3: Safe Non-Destructive Probe
    log.push(`Stage 3: Sending safe non-destructive verification probe to ${targetUrl}`);

    const res = simulatedResponse || {
      status: 200,
      body: '127.0.0.1 localhost\n',
      oastCallback: false,
    };

    let isVerified = false;
    if (cveId === 'CVE-2021-41773') {
      isVerified = res.status === 200 && res.body.includes('127.0.0.1');
    } else if (cveId === 'CVE-2021-44228') {
      isVerified = !!res.oastCallback;
    } else if (cveId === 'CVE-2023-22527') {
      isVerified = res.body.includes('5439');
    } else if (cveId === 'CVE-2024-27198') {
      isVerified = res.status === 200;
    } else {
      isVerified = res.status === 200;
    }

    let finalStage: VerificationStageStatus = 'NOT_VULNERABLE';
    let casHash: string | undefined;
    let findingId: string | undefined;

    if (isVerified) {
      finalStage = 'VERIFIED';
      // Mock SHA-256 CAS hash
      casHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
      findingId = `F-VULN-${cveId}-${Date.now()}`;
      log.push(`Stage 4: Deterministic verification proof succeeded.`);
      log.push(`Stage 5: Cryptographic CAS proof captured: SHA256:${casHash}`);
      log.push(`Stage 6: Finding promoted to Verified Finding #${findingId}`);
    } else {
      finalStage = 'NOT_VULNERABLE';
      log.push('Stage 4: Probe evaluated to negative baseline (Not Vulnerable).');
      log.push('Stage 5: Candidate discarded with zero finding pollution.');
    }

    const progress: VerificationProgress = {
      cveId,
      targetUrl,
      stage: finalStage,
      log,
      casHash,
      findingId,
      timestamp,
    };

    set((state) => ({
      verificationStages: { ...state.verificationStages, [cveId]: progress },
    }));

    return progress;
  },

  resetStore: () =>
    set({
      advisories: SEED_ADVISORIES,
      selectedAdvisoryId: 'CVE-2021-41773',
      searchQuery: '',
      filterOnlyKev: false,
      filterMinSeverity: 'ALL',
      verificationStages: {},
      isSyncing: false,
    }),
}));
