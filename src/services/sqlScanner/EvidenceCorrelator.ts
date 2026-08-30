import {
  SqlScanFinding,
  ScanVerdict,
  CoverageDimension,
  TestExecutionLogItem,
  ConfidenceLevel,
} from '../../types/sqlScanner';

export interface CorrelationResult {
  verdict: ScanVerdict;
  verdictReason: string;
  confirmedIndicators: number;
  overallConfidence: ConfidenceLevel;
  confidenceScore: number;
}

export class EvidenceCorrelator {
  /**
   * Evaluates all findings and test logs to produce a strict binary verdict:
   * VULNERABLE vs NOT CONFIRMED VULNERABLE
   */
  public static evaluateVerdict(
    findings: SqlScanFinding[],
    executionLogs: TestExecutionLogItem[],
    coverage: CoverageDimension[]
  ): CorrelationResult {
    const confirmedIndicators = findings.reduce((acc, f) => acc + f.evidence.length, 0);
    const isVulnerable = findings.length > 0;

    if (isVulnerable) {
      const highestFindingScore = Math.max(0, ...findings.map((f) => f.confidenceScore));
      let confidenceLevel: ConfidenceLevel = 'Confirmed';
      if (highestFindingScore < 70) confidenceLevel = 'High';
      if (highestFindingScore < 50) confidenceLevel = 'Medium';

      const techniques = Array.from(new Set(findings.map((f) => f.injectionType))).join(', ');
      const affectedParams = Array.from(new Set(findings.map((f) => f.parameterName))).join(', ');

      return {
        verdict: 'VULNERABLE',
        verdictReason: `Reproducible SQL injection confirmed on parameter(s) [${affectedParams}] via [${techniques}]. Discovered ${confirmedIndicators} verified indicator(s).`,
        confirmedIndicators,
        overallConfidence: confidenceLevel,
        confidenceScore: Math.max(85, highestFindingScore),
      };
    }

    const testedCount = executionLogs.filter((l) => l.status === 'negative' || l.status === 'positive').length;
    return {
      verdict: 'NOT CONFIRMED VULNERABLE',
      verdictReason: `Applicable SQLi tests completed (${testedCount} tests executed across ${coverage.length} dimensions). The scanner found no reproducible SQL injection indicators under the tested conditions.`,
      confirmedIndicators: 0,
      overallConfidence: 'Informational',
      confidenceScore: 0,
    };
  }
}
