import { ConfidenceBreakdown, ConfidenceLevel } from '../../types/sqlScanner';

export class ConfidenceEngine {
  /**
   * Calculates normalized score and confidence classification from multi-factor evidence
   */
  public static calculateConfidence(evidence: {
    hasBooleanDiff?: boolean;
    hasConsistentSqlError?: boolean;
    hasDbmsSpecificBehavior?: boolean;
    hasTimeDifferential?: boolean;
    hasUnionCanary?: boolean;
    hasRepeatedConfirmation?: boolean;
    hasOobInteraction?: boolean;
    customFactors?: { name: string; points: number; description: string }[];
  }): ConfidenceBreakdown {
    const factors: { name: string; points: number; description: string }[] = [];
    let rawScore = 0;

    if (evidence.hasOobInteraction) {
      factors.push({
        name: 'Out-of-Band (OAST) Interaction',
        points: 95,
        description: 'Verified external DNS/HTTP interaction triggered by database backend',
      });
      rawScore += 95;
    }

    if (evidence.hasUnionCanary) {
      factors.push({
        name: 'UNION Canary Reflection',
        points: 35,
        description: 'Harmless canary tokens (SENTINEL_CANARY_XX) reflected in HTTP response body',
      });
      rawScore += 35;
    }

    if (evidence.hasBooleanDiff) {
      factors.push({
        name: 'Boolean Differential',
        points: 30,
        description: 'Statistically significant true/false logical divergence across responses',
      });
      rawScore += 30;
    }

    if (evidence.hasConsistentSqlError) {
      factors.push({
        name: 'Normalized SQL Error Signature',
        points: 25,
        description: 'Direct DBMS parser error matched against 80+ normalized syntax patterns',
      });
      rawScore += 25;
    }

    if (evidence.hasTimeDifferential) {
      factors.push({
        name: 'Calibrated Time Delay',
        points: 25,
        description: 'Server execution paused for statistically significant sleep threshold',
      });
      rawScore += 25;
    }

    if (evidence.hasDbmsSpecificBehavior) {
      factors.push({
        name: 'DBMS-Specific Behavioral Fingerprint',
        points: 20,
        description: 'Database dialect functions/commenting syntax verified independently',
      });
      rawScore += 20;
    }

    if (evidence.hasRepeatedConfirmation) {
      factors.push({
        name: 'Multi-Probe Confirmation',
        points: 20,
        description: 'Multiple independent test probes confirmed identical differential behavior',
      });
      rawScore += 20;
    }

    if (evidence.customFactors) {
      for (const cf of evidence.customFactors) {
        factors.push(cf);
        rawScore += cf.points;
      }
    }

    // Clamp score to 0 - 100
    const score = Math.min(100, Math.max(0, rawScore));

    let level: ConfidenceLevel = 'Informational';
    if (score >= 90) {
      level = 'Confirmed';
    } else if (score >= 70) {
      level = 'High';
    } else if (score >= 50) {
      level = 'Medium';
    } else if (score >= 30) {
      level = 'Low';
    }

    return {
      score,
      level,
      factors,
    };
  }
}
